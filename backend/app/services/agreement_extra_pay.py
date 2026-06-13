from decimal import Decimal, ROUND_HALF_UP
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.agreement_extra_pay import AgreementExtraPay, AgreementExtraPayConcept
from app.models.collective_agreement import ProfessionalCategory, SalaryTable, SalaryTableRow
from app.schemas.agreement_extra_pay import (
    AgreementExtraPayConceptCreate,
    AgreementExtraPayConceptUpdate,
    AgreementExtraPayCreate,
    AgreementExtraPayUpdate,
)
from app.services.agreement_contract_concept_sync import (
    _build_candidates,
    _concept_code,
    _decimal,
    _load_agreement_concepts,
)


MONEY_QUANT = Decimal("0.01")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _get_salary_table(db: Session, table_id: int, agreement_id: int | None = None) -> SalaryTable:
    table = db.query(SalaryTable).filter(SalaryTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Tabla salarial no encontrada")
    if agreement_id is not None and table.collective_agreement_id != agreement_id:
        raise HTTPException(status_code=400, detail="La tabla salarial no pertenece al convenio")
    return table


def _get_category(db: Session, category_id: int, agreement_id: int) -> ProfessionalCategory:
    category = db.query(ProfessionalCategory).filter(ProfessionalCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría profesional no encontrada")
    if category.collective_agreement_id != agreement_id:
        raise HTTPException(status_code=400, detail="La categoría profesional no pertenece al convenio")
    return category


def _get_extra_pay(db: Session, extra_pay_id: int) -> AgreementExtraPay:
    extra_pay = (
        db.query(AgreementExtraPay)
        .options(selectinload(AgreementExtraPay.concept_lines))
        .filter(AgreementExtraPay.id == extra_pay_id)
        .first()
    )
    if not extra_pay:
        raise HTTPException(status_code=404, detail="Paga extraordinaria no encontrada")
    return extra_pay


def _validate_extra_pay_values(proration_allowed: bool, proration_default: bool):
    if proration_default and not proration_allowed:
        raise HTTPException(
            status_code=400,
            detail="No puede marcarse prorrateo por defecto cuando el prorrateo no está permitido",
        )


def list_extra_pays(
    db: Session,
    agreement_id: int,
    salary_table_id: int | None = None,
    include_inactive: bool = False,
):
    query = (
        db.query(AgreementExtraPay)
        .options(selectinload(AgreementExtraPay.concept_lines))
        .filter(AgreementExtraPay.collective_agreement_id == agreement_id)
    )
    if salary_table_id is not None:
        _get_salary_table(db, salary_table_id, agreement_id)
        query = query.filter(
            or_(
                AgreementExtraPay.salary_table_id.is_(None),
                AgreementExtraPay.salary_table_id == salary_table_id,
            )
        )
    if not include_inactive:
        query = query.filter(AgreementExtraPay.is_active == True)
    return query.order_by(AgreementExtraPay.payment_month, AgreementExtraPay.name).all()


def create_extra_pay(db: Session, agreement_id: int, payload: AgreementExtraPayCreate):
    if payload.salary_table_id is not None:
        _get_salary_table(db, payload.salary_table_id, agreement_id)
    _validate_extra_pay_values(payload.proration_allowed, payload.proration_default)

    duplicate_query = db.query(AgreementExtraPay).filter(
        AgreementExtraPay.collective_agreement_id == agreement_id,
        AgreementExtraPay.salary_table_id == payload.salary_table_id,
    )
    if payload.code:
        duplicate = duplicate_query.filter(AgreementExtraPay.code == payload.code).first()
    else:
        duplicate = duplicate_query.filter(AgreementExtraPay.name == payload.name).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe una paga extraordinaria equivalente en esta tabla")

    data = payload.model_dump(exclude={"concept_lines"})
    extra_pay = AgreementExtraPay(collective_agreement_id=agreement_id, **data)
    db.add(extra_pay)
    db.flush()

    for line_payload in payload.concept_lines:
        _create_extra_pay_concept(db, extra_pay, line_payload, commit=False)

    db.commit()
    return _get_extra_pay(db, extra_pay.id)


def update_extra_pay(db: Session, extra_pay_id: int, payload: AgreementExtraPayUpdate):
    extra_pay = _get_extra_pay(db, extra_pay_id)
    data = payload.model_dump(exclude_unset=True)
    if "salary_table_id" in data and data["salary_table_id"] is not None:
        _get_salary_table(db, data["salary_table_id"], extra_pay.collective_agreement_id)

    proration_allowed = data.get("proration_allowed", extra_pay.proration_allowed)
    proration_default = data.get("proration_default", extra_pay.proration_default)
    _validate_extra_pay_values(proration_allowed, proration_default)

    if "code" in data:
        data["code"] = data["code"].strip().upper() if data["code"] else None
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
        if not data["name"]:
            raise HTTPException(status_code=400, detail="La paga extraordinaria debe tener nombre")

    for key, value in data.items():
        setattr(extra_pay, key, value)
    db.commit()
    return _get_extra_pay(db, extra_pay.id)


def delete_extra_pay(db: Session, extra_pay_id: int):
    extra_pay = _get_extra_pay(db, extra_pay_id)
    db.delete(extra_pay)
    db.commit()
    return extra_pay


def _create_extra_pay_concept(
    db: Session,
    extra_pay: AgreementExtraPay,
    payload: AgreementExtraPayConceptCreate,
    commit: bool = True,
):
    if payload.professional_category_id is not None:
        _get_category(db, payload.professional_category_id, extra_pay.collective_agreement_id)

    duplicate = (
        db.query(AgreementExtraPayConcept)
        .filter(
            AgreementExtraPayConcept.extra_pay_id == extra_pay.id,
            AgreementExtraPayConcept.professional_category_id == payload.professional_category_id,
            AgreementExtraPayConcept.concept_key == payload.concept_key,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="El concepto ya participa en esta paga para el ámbito seleccionado")

    line = AgreementExtraPayConcept(extra_pay_id=extra_pay.id, **payload.model_dump())
    db.add(line)
    if commit:
        db.commit()
        db.refresh(line)
    return line


def create_extra_pay_concept(
    db: Session,
    extra_pay_id: int,
    payload: AgreementExtraPayConceptCreate,
):
    extra_pay = _get_extra_pay(db, extra_pay_id)
    return _create_extra_pay_concept(db, extra_pay, payload)


def update_extra_pay_concept(
    db: Session,
    concept_line_id: int,
    payload: AgreementExtraPayConceptUpdate,
):
    line = db.query(AgreementExtraPayConcept).filter(AgreementExtraPayConcept.id == concept_line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Participación de paga extraordinaria no encontrada")
    extra_pay = _get_extra_pay(db, line.extra_pay_id)
    data = payload.model_dump(exclude_unset=True)

    if "professional_category_id" in data and data["professional_category_id"] is not None:
        _get_category(db, data["professional_category_id"], extra_pay.collective_agreement_id)
    if "concept_key" in data and data["concept_key"] is not None:
        data["concept_key"] = data["concept_key"].strip()
    if "concept_name" in data and data["concept_name"] is not None:
        data["concept_name"] = data["concept_name"].strip()

    calculation_mode = data.get("calculation_mode", line.calculation_mode)
    percentage = data.get("percentage", line.percentage)
    fixed_amount = data.get("fixed_amount", line.fixed_amount)
    if calculation_mode == "percentage" and percentage is None:
        raise HTTPException(status_code=400, detail="Indica el porcentaje computable")
    if calculation_mode == "fixed" and fixed_amount is None:
        raise HTTPException(status_code=400, detail="Indica el importe fijo computable")

    for key, value in data.items():
        setattr(line, key, value)
    db.commit()
    db.refresh(line)
    return line


def delete_extra_pay_concept(db: Session, concept_line_id: int):
    line = db.query(AgreementExtraPayConcept).filter(AgreementExtraPayConcept.id == concept_line_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="Participación de paga extraordinaria no encontrada")
    db.delete(line)
    db.commit()
    return line


def resolve_extra_pay_candidates(
    db: Session,
    agreement_id: int,
    salary_table_id: int,
    professional_category_id: int,
):
    _get_salary_table(db, salary_table_id, agreement_id)
    _get_category(db, professional_category_id, agreement_id)
    salary_row = (
        db.query(SalaryTableRow)
        .filter(
            SalaryTableRow.salary_table_id == salary_table_id,
            SalaryTableRow.professional_category_id == professional_category_id,
        )
        .order_by(SalaryTableRow.id)
        .first()
    )
    if not salary_row:
        raise HTTPException(status_code=404, detail="La tabla salarial no contiene una fila para la categoría")

    context = SimpleNamespace(
        collective_agreement_id=agreement_id,
        professional_category_id=professional_category_id,
        salary_table_row=salary_row,
    )
    agreement_concepts = _load_agreement_concepts(db, context)
    candidates = _build_candidates(context, agreement_concepts)

    result = []
    for candidate in candidates.values():
        result.append(
            {
                "concept_key": _concept_code(
                    agreement_id,
                    candidate["semantic_key"],
                    candidate.get("agreement_concept"),
                ),
                "name": candidate["name"],
                "amount": _decimal(candidate.get("amount")),
                "character": candidate.get("character") or "salarial",
                "source": candidate["source"],
                "salary_table_id": candidate.get("salary_table_id"),
                "professional_category_id": candidate.get("professional_category_id"),
            }
        )
    return sorted(result, key=lambda item: item["name"])


def preview_extra_pay(
    db: Session,
    extra_pay_id: int,
    professional_category_id: int,
    salary_table_id: int | None = None,
):
    extra_pay = _get_extra_pay(db, extra_pay_id)
    table_id = salary_table_id or extra_pay.salary_table_id
    if not table_id:
        raise HTTPException(status_code=400, detail="Selecciona una tabla salarial para calcular la vista previa")
    if extra_pay.salary_table_id is not None and salary_table_id is not None and salary_table_id != extra_pay.salary_table_id:
        raise HTTPException(status_code=400, detail="La paga está versionada para otra tabla salarial")

    candidates = resolve_extra_pay_candidates(
        db,
        extra_pay.collective_agreement_id,
        table_id,
        professional_category_id,
    )
    candidate_map = {item["concept_key"]: item for item in candidates}

    applicable_lines = {}
    for line in extra_pay.concept_lines:
        if not line.is_active:
            continue
        if line.professional_category_id not in (None, professional_category_id):
            continue
        current = applicable_lines.get(line.concept_key)
        if current is None or (
            current.professional_category_id is None
            and line.professional_category_id == professional_category_id
        ):
            applicable_lines[line.concept_key] = line

    preview_lines = []
    warnings = []
    total = Decimal("0.00")
    unresolved = 0

    for line in sorted(applicable_lines.values(), key=lambda item: (item.display_order, item.concept_name)):
        candidate = candidate_map.get(line.concept_key)
        base_amount = _money(candidate["amount"]) if candidate else Decimal("0.00")
        resolved = candidate is not None
        warning = None

        if line.calculation_mode == "fixed":
            computed = _money(line.fixed_amount)
        elif resolved:
            computed = _money(base_amount * Decimal(str(line.percentage or 0)) / Decimal("100"))
        else:
            computed = Decimal("0.00")
            warning = "El concepto ya no existe en la estructura salarial seleccionada."
            unresolved += 1
            warnings.append(f"{line.concept_name}: {warning}")

        total += computed
        preview_lines.append(
            {
                "concept_line_id": line.id,
                "concept_key": line.concept_key,
                "concept_name": line.concept_name,
                "professional_category_id": line.professional_category_id,
                "base_amount": base_amount,
                "calculation_mode": line.calculation_mode,
                "percentage": line.percentage,
                "fixed_amount": line.fixed_amount,
                "computed_amount": computed,
                "resolved": resolved,
                "warning": warning,
            }
        )

    total = _money(total)
    monthly_proration = (
        _money(total / Decimal(extra_pay.accrual_months))
        if extra_pay.proration_allowed and extra_pay.accrual_months
        else Decimal("0.00")
    )
    if not applicable_lines:
        warnings.append("La paga extraordinaria no tiene conceptos aplicables para esta categoría.")

    return {
        "extra_pay_id": extra_pay.id,
        "extra_pay_name": extra_pay.name,
        "salary_table_id": table_id,
        "professional_category_id": professional_category_id,
        "payment_month": extra_pay.payment_month,
        "accrual_start_month": extra_pay.accrual_start_month,
        "accrual_end_month": extra_pay.accrual_end_month,
        "accrual_months": extra_pay.accrual_months,
        "proration_allowed": extra_pay.proration_allowed,
        "proration_default": extra_pay.proration_default,
        "total_amount": total,
        "monthly_proration_amount": monthly_proration,
        "included_lines": len(preview_lines),
        "unresolved_lines": unresolved,
        "lines": preview_lines,
        "warnings": warnings,
    }
