import re
import unicodedata
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.agreement_parameterization import AgreementSalaryConcept
from app.models.collective_agreement import SalaryTable, SalaryTableRow
from app.models.contract import Contract
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept
from app.services.payroll_amounts import money


STABLE_SEMANTIC_CODES = {
    "salary_base",
    "seniority",
    "agreement_plus",
    "specific_complement",
}


def _decimal(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0.00")
    return money(Decimal(str(value)))


def _normalized(value: str | None) -> str:
    text = unicodedata.normalize("NFD", str(value or "").lower())
    text = "".join(character for character in text if unicodedata.category(character) != "Mn")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def _semantic_key(name: str | None) -> str:
    normalized = _normalized(name)
    if "salario_base" in normalized or normalized == "base":
        return "salary_base"
    if "antiguedad" in normalized or "trienio" in normalized or "quinquenio" in normalized:
        return "seniority"
    if "plus_convenio" in normalized or "complemento_convenio" in normalized:
        return "agreement_plus"
    if "complemento_especific" in normalized:
        return "specific_complement"
    return normalized or "concept"


def _payroll_category(semantic_key: str, character: str | None, name: str | None) -> str:
    normalized_name = _normalized(name)
    if semantic_key == "salary_base":
        return "BASE"
    if semantic_key == "seniority":
        return "COMPLEMENTO"
    if semantic_key == "agreement_plus":
        return "PLUS"
    if semantic_key == "specific_complement":
        return "COMPLEMENTO"
    if "paga_extra" in normalized_name or "extraordinaria" in normalized_name:
        return "PAGA_EXTRA"
    if "dieta" in normalized_name:
        return "DIETA"
    if "kilometraje" in normalized_name:
        return "KILOMETRAJE"
    if str(character or "").lower() == "deduccion":
        return "DEDUCCION"
    return "COMPLEMENTO"


def _concept_type(character: str | None) -> str:
    return "DEDUCCION" if str(character or "").lower() == "deduccion" else "DEVENGO"


def _salary_nature(character: str | None) -> str:
    return "EXTRASALARIAL" if str(character or "").lower() == "no_salarial" else "SALARIAL"


def _concept_code(agreement_id: int, semantic_key: str, agreement_concept: AgreementSalaryConcept | None = None) -> str:
    if semantic_key in STABLE_SEMANTIC_CODES:
        suffix = semantic_key
    else:
        catalog_code = agreement_concept.catalog_concept.code if agreement_concept and agreement_concept.catalog_concept else None
        suffix = _normalized(catalog_code) or semantic_key or f"concept_{agreement_concept.id if agreement_concept else 'table'}"
    return f"AGR_{agreement_id}_{suffix}".upper()[:120]


def _candidate_priority(candidate: dict, contract: Contract) -> tuple:
    category_specific = candidate.get("professional_category_id") is not None and candidate.get("professional_category_id") == contract.professional_category_id
    has_amount = _decimal(candidate.get("amount")) != Decimal("0.00")
    is_parameterized = candidate.get("source") == "agreement_salary_concept"
    return (1 if has_amount else 0, 1 if category_specific else 0, 1 if is_parameterized else 0)


def _resolve_salary_table_row(db: Session, contract: Contract) -> bool:
    if contract.salary_table_row:
        return False
    if not contract.professional_category_id:
        return False

    base_query = (
        db.query(SalaryTableRow)
        .join(SalaryTable, SalaryTable.id == SalaryTableRow.salary_table_id)
        .filter(
            SalaryTable.collective_agreement_id == contract.collective_agreement_id,
            SalaryTableRow.professional_category_id == contract.professional_category_id,
        )
    )
    salary_row = (
        base_query.filter(SalaryTable.status == "active")
        .order_by(SalaryTable.year.desc(), SalaryTable.id.desc(), SalaryTableRow.id.desc())
        .first()
    )
    if not salary_row:
        salary_row = base_query.order_by(SalaryTable.year.desc(), SalaryTable.id.desc(), SalaryTableRow.id.desc()).first()
    if not salary_row:
        return False

    contract.salary_table_row_id = salary_row.id
    contract.salary_table_row = salary_row
    return True


def _build_candidates(contract: Contract, agreement_concepts: list[AgreementSalaryConcept]) -> dict[str, dict]:
    candidates: dict[str, dict] = {}

    for item in agreement_concepts:
        key = _semantic_key(item.name)
        candidate = {
            "semantic_key": key,
            "name": item.name,
            "amount": item.amount,
            "character": item.character,
            "contributes": item.contributes,
            "taxable": item.taxable,
            "calculation_type": item.calculation_type,
            "payment_type": item.payment_type,
            "cra_code": item.cra_code,
            "professional_category_id": item.professional_category_id,
            "source": "agreement_salary_concept",
            "agreement_concept": item,
        }
        current = candidates.get(key)
        if current is None or _candidate_priority(candidate, contract) > _candidate_priority(current, contract):
            candidates[key] = candidate

    salary_row = contract.salary_table_row
    if salary_row:
        table_candidates = [
            ("salary_base", "Salario base", salary_row.base_salary, "salarial"),
            ("seniority", "Antigüedad", salary_row.seniority_amount, "salarial"),
            ("specific_complement", "Complemento específico", salary_row.specific_complement, "salarial"),
            ("agreement_plus", "Plus convenio", salary_row.agreement_plus, "salarial"),
        ]
        for key, name, amount, character in table_candidates:
            if amount is None:
                continue
            candidate = {
                "semantic_key": key,
                "name": name,
                "amount": amount,
                "character": character,
                "contributes": True,
                "taxable": True,
                "calculation_type": "manual",
                "payment_type": "mensual",
                "cra_code": None,
                "professional_category_id": contract.professional_category_id,
                "source": "salary_table_row",
                "agreement_concept": None,
            }
            current = candidates.get(key)
            if current is None or _candidate_priority(candidate, contract) > _candidate_priority(current, contract):
                candidates[key] = candidate

    return candidates


def _get_or_create_payroll_concept(db: Session, contract: Contract, candidate: dict) -> tuple[PayrollConcept, bool, bool]:
    agreement_id = contract.collective_agreement_id
    code = _concept_code(agreement_id, candidate["semantic_key"], candidate.get("agreement_concept"))
    concept = db.query(PayrollConcept).filter(PayrollConcept.code == code).first()
    created = False
    updated = False

    values = {
        "name": candidate["name"],
        "category": _payroll_category(candidate["semantic_key"], candidate.get("character"), candidate.get("name")),
        "concept_type": _concept_type(candidate.get("character")),
        "salary_nature": _salary_nature(candidate.get("character")),
        "source_type": "AGREEMENT",
        "agreement_id": agreement_id,
        "calculation_type": "FIXED_AMOUNT",
        "default_amount": Decimal("0.00"),
        "default_unit_price": Decimal("0.00"),
        "applies_workday_percentage": True,
        "is_system": False,
        "is_taxable": bool(candidate.get("taxable", True)),
        "is_contribution_base": bool(candidate.get("contributes", True)),
        "is_active": True,
        "notes": f"Concepto generado desde el convenio {agreement_id}. Clave: {candidate['semantic_key']}.",
    }

    if not concept:
        concept = PayrollConcept(code=code, **values)
        db.add(concept)
        db.flush()
        created = True
    else:
        for key, value in values.items():
            if getattr(concept, key) != value:
                setattr(concept, key, value)
                updated = True

    return concept, created, updated


def sync_agreement_concepts_to_contract(
    db: Session,
    contract_id: int,
    overwrite_salary_base: bool = False,
    reactivate_inactive: bool = True,
) -> dict:
    contract = (
        db.query(Contract)
        .options(joinedload(Contract.salary_table_row), joinedload(Contract.collective_agreement))
        .filter(Contract.id == contract_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    if not contract.collective_agreement_id:
        raise HTTPException(status_code=400, detail="El contrato no tiene un convenio colectivo vinculado")

    salary_table_row_linked = _resolve_salary_table_row(db, contract)

    agreement_concepts = (
        db.query(AgreementSalaryConcept)
        .options(joinedload(AgreementSalaryConcept.catalog_concept))
        .filter(
            AgreementSalaryConcept.collective_agreement_id == contract.collective_agreement_id,
            AgreementSalaryConcept.is_active == True,
            or_(
                AgreementSalaryConcept.professional_category_id.is_(None),
                AgreementSalaryConcept.professional_category_id == contract.professional_category_id,
            ),
        )
        .all()
    )

    candidates = _build_candidates(contract, agreement_concepts)
    warnings: list[str] = []
    imported_names: list[str] = []
    salary_base_updated = False
    salary_base_preserved = False
    payroll_concepts_created = 0
    payroll_concepts_updated = 0
    contract_concepts_created = 0
    contract_concepts_reactivated = 0
    contract_concepts_skipped = 0

    if salary_table_row_linked:
        warnings.append("Se ha vinculado automáticamente la fila salarial activa correspondiente a la categoría del contrato.")
    elif not contract.salary_table_row_id and contract.professional_category_id:
        warnings.append("No se encontró una fila salarial del convenio para la categoría del contrato.")
    elif not contract.professional_category_id:
        warnings.append("El contrato no tiene categoría profesional vinculada; solo se aplican conceptos globales del convenio.")

    salary_candidate = candidates.pop("salary_base", None)
    if salary_candidate and _decimal(salary_candidate.get("amount")) > 0:
        current_salary = _decimal(contract.salary_base)
        proposed_salary = _decimal(salary_candidate.get("amount"))
        if current_salary == Decimal("0.00") or overwrite_salary_base:
            contract.salary_base = proposed_salary
            salary_base_updated = current_salary != proposed_salary
        else:
            salary_base_preserved = True
            warnings.append("Se conserva el salario base actual del contrato. No se ha sobrescrito.")
    elif _decimal(contract.salary_base) == Decimal("0.00"):
        warnings.append("No se encontró un salario base aplicable en la parametrización o tabla salarial del convenio.")

    for display_order, candidate in enumerate(candidates.values(), start=10):
        amount = _decimal(candidate.get("amount"))
        concept, created, updated = _get_or_create_payroll_concept(db, contract, candidate)
        payroll_concepts_created += int(created)
        payroll_concepts_updated += int(updated)

        existing = (
            db.query(ContractPayrollConcept)
            .filter(
                ContractPayrollConcept.contract_id == contract.id,
                ContractPayrollConcept.concept_id == concept.id,
            )
            .first()
        )
        source_note = (
            f"Importado desde {contract.collective_agreement.name if contract.collective_agreement else 'convenio'}; "
            f"origen {candidate['source']}; clave {candidate['semantic_key']}."
        )

        if existing and existing.is_active:
            contract_concepts_skipped += 1
            continue

        if existing and not existing.is_active and reactivate_inactive:
            existing.is_active = True
            existing.description = candidate["name"]
            existing.quantity = Decimal("1.00")
            existing.unit_price = Decimal("0.00")
            existing.amount = amount
            existing.start_date = contract.start_date
            existing.end_date = contract.end_date
            existing.display_order = display_order
            existing.notes = source_note
            contract_concepts_reactivated += 1
            imported_names.append(candidate["name"])
            continue

        if existing:
            contract_concepts_skipped += 1
            continue

        db.add(
            ContractPayrollConcept(
                contract_id=contract.id,
                concept_id=concept.id,
                description=candidate["name"],
                quantity=Decimal("1.00"),
                unit_price=Decimal("0.00"),
                amount=amount,
                start_date=contract.start_date,
                end_date=contract.end_date,
                is_active=True,
                display_order=display_order,
                notes=source_note,
            )
        )
        contract_concepts_created += 1
        imported_names.append(candidate["name"])

    if not candidates:
        warnings.append("No se encontraron complementos salariales aplicables para cargar como conceptos permanentes.")

    db.commit()
    db.refresh(contract)

    return {
        "contract_id": contract.id,
        "agreement_id": contract.collective_agreement_id,
        "agreement_name": contract.collective_agreement.name if contract.collective_agreement else None,
        "professional_category_id": contract.professional_category_id,
        "salary_table_row_id": contract.salary_table_row_id,
        "salary_table_row_linked": salary_table_row_linked,
        "agreement_salary_concepts_found": len(agreement_concepts),
        "resolved_candidates": len(candidates) + (1 if salary_candidate else 0),
        "salary_base_updated": salary_base_updated,
        "salary_base_preserved": salary_base_preserved,
        "salary_base_amount": contract.salary_base,
        "payroll_concepts_created": payroll_concepts_created,
        "payroll_concepts_updated": payroll_concepts_updated,
        "contract_concepts_created": contract_concepts_created,
        "contract_concepts_reactivated": contract_concepts_reactivated,
        "contract_concepts_skipped": contract_concepts_skipped,
        "imported_names": imported_names,
        "warnings": warnings,
    }
