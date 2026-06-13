from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import re
import unicodedata

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.crud.payroll import resolve_irpf_percentage
from app.models.agreement_extra_pay import AgreementExtraPay
from app.models.collective_agreement import SalaryTable, SalaryTableRow
from app.models.contract import Contract
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.schemas.salary_regularization import (
    SalaryRegularizationGenerateRequest,
    SalaryRegularizationPreviewRequest,
)
from app.services.agreement_extra_pay import preview_extra_pay
from app.services.contract_salary_summary import get_partiality
from app.services.monthly_extra_pay_proration import month_is_in_accrual
from app.services.payroll_amounts import calculate_social_security_amounts_from_bases, money
from app.services.salary_table_concept_migration import _target_candidates


ACTIVE_PAYROLL_STATUSES = {"draft", "pending", "calculated", "reviewed", "closed"}
MONEY = Decimal("0.01")
RATIO = Decimal("0.0001")


def as_money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def as_ratio(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(RATIO, rounding=ROUND_HALF_UP)


def normalize_code(value: str) -> str:
    text = unicodedata.normalize("NFD", value.upper())
    text = "".join(character for character in text if unicodedata.category(character) != "Mn")
    return re.sub(r"[^A-Z0-9]+", "_", text).strip("_")


def employee_name(contract: Contract) -> str | None:
    if not contract.employee:
        return None
    return " ".join(
        value.strip()
        for value in (
            contract.employee.first_name,
            contract.employee.last_name,
            contract.employee.second_last_name,
        )
        if value and value.strip()
    )


def load_tables(db: Session, source_table_id: int, target_table_id: int):
    tables = (
        db.query(SalaryTable)
        .options(selectinload(SalaryTable.rows))
        .filter(SalaryTable.id.in_([source_table_id, target_table_id]))
        .all()
    )
    by_id = {table.id: table for table in tables}
    source = by_id.get(source_table_id)
    target = by_id.get(target_table_id)
    if not source:
        raise HTTPException(status_code=404, detail="Tabla salarial de origen no encontrada")
    if not target:
        raise HTTPException(status_code=404, detail="Tabla salarial de destino no encontrada")
    if source.id == target.id:
        raise HTTPException(status_code=400, detail="La tabla de origen y la tabla de destino deben ser distintas")
    if source.collective_agreement_id != target.collective_agreement_id:
        raise HTTPException(status_code=400, detail="Las tablas salariales deben pertenecer al mismo convenio")
    return source, target


def rows_by_category(table: SalaryTable) -> dict[int, SalaryTableRow]:
    result = {}
    for row in sorted(table.rows or [], key=lambda item: item.id):
        if row.professional_category_id is not None and row.professional_category_id not in result:
            result[row.professional_category_id] = row
    return result


def monthly_amount(value, row: SalaryTableRow, table: SalaryTable) -> Decimal:
    amount = as_money(value)
    unit = (row.amount_unit or table.amount_type or "monthly").lower()
    if unit in {"annual", "anual"}:
        payments = Decimal(str(table.number_of_payments or 14))
        return as_money(amount / payments) if payments else Decimal("0.00")
    return amount


def payroll_period_dates(payroll: Payroll) -> tuple[date, date]:
    last_day = monthrange(payroll.period_year, payroll.period_month)[1]
    return date(payroll.period_year, payroll.period_month, 1), date(payroll.period_year, payroll.period_month, last_day)


def payroll_remuneration_ratio(payroll: Payroll) -> Decimal:
    base = as_money(payroll.base_salary)
    if base > 0:
        remunerated = as_money(
            as_money(payroll.worked_base_salary)
            + as_money(payroll.temporary_disability_benefit)
            + as_money(payroll.company_disability_complement)
        )
        return min(Decimal("1.0000"), max(Decimal("0.0000"), as_ratio(remunerated / base)))
    return min(
        Decimal("1.0000"),
        max(Decimal("0.0000"), as_ratio(Decimal(str(payroll.contribution_days or 0)) / Decimal("30"))),
    )


def applicable_extra_pays(db: Session, table: SalaryTable) -> dict[str, AgreementExtraPay]:
    pays = (
        db.query(AgreementExtraPay)
        .options(selectinload(AgreementExtraPay.concept_lines))
        .filter(
            AgreementExtraPay.collective_agreement_id == table.collective_agreement_id,
            AgreementExtraPay.is_active == True,
            AgreementExtraPay.proration_allowed == True,
            or_(AgreementExtraPay.salary_table_id.is_(None), AgreementExtraPay.salary_table_id == table.id),
        )
        .order_by(AgreementExtraPay.salary_table_id.asc().nullsfirst(), AgreementExtraPay.id)
        .all()
    )
    selected = {}
    for pay in pays:
        key = (pay.code or pay.name or str(pay.id)).strip().upper()
        current = selected.get(key)
        if current is None or (current.salary_table_id is None and pay.salary_table_id == table.id):
            selected[key] = pay
    return selected


def proration_value(db: Session, pay: AgreementExtraPay | None, table_id: int, category_id: int, month: int, partiality: Decimal) -> Decimal:
    if not pay or not month_is_in_accrual(pay, month):
        return Decimal("0.00")
    preview = preview_extra_pay(db, pay.id, category_id, salary_table_id=table_id)
    amount = as_money(preview.get("monthly_proration"))
    if pay.apply_partiality:
        amount = as_money(amount * partiality)
    return amount


def build_line(
    payroll: Payroll,
    key: str,
    name: str,
    line_type: str,
    source_amount: Decimal,
    target_amount: Decimal,
    partiality: Decimal,
    remuneration_ratio: Decimal,
    contributes: bool,
    taxable: bool,
    positive_only: bool,
):
    theoretical = as_money(target_amount - source_amount)
    multiplier = Decimal("1.00") if line_type == "extra_pay_proration" else partiality
    amount = as_money(theoretical * multiplier * remuneration_ratio)
    if amount == 0 or (positive_only and amount < 0):
        return None
    return {
        "payroll_id": payroll.id,
        "source_period_month": payroll.period_month,
        "source_period_year": payroll.period_year,
        "concept_key": key,
        "concept_name": name,
        "line_type": line_type,
        "source_amount": source_amount,
        "target_amount": target_amount,
        "theoretical_difference": theoretical,
        "partiality_ratio": as_ratio(partiality),
        "remuneration_ratio": remuneration_ratio,
        "amount": amount,
        "contributes": contributes,
        "taxable": taxable,
    }


def build_salary_regularization_preview(
    db: Session,
    target_table_id: int,
    payload: SalaryRegularizationPreviewRequest,
) -> dict:
    source, target = load_tables(db, payload.source_table_id, target_table_id)
    source_rows = rows_by_category(source)
    target_rows = rows_by_category(target)
    selected_ids = set(payload.contract_ids)

    contracts_query = (
        db.query(Contract)
        .options(
            joinedload(Contract.employee),
            joinedload(Contract.agreement_professional_category),
        )
        .filter(
            Contract.collective_agreement_id == target.collective_agreement_id,
            Contract.start_date <= payload.period_to,
            or_(Contract.end_date.is_(None), Contract.end_date >= payload.period_from),
        )
        .order_by(Contract.employee_id, Contract.id)
    )
    if selected_ids:
        contracts_query = contracts_query.filter(Contract.id.in_(selected_ids))
    contracts = contracts_query.all()

    payrolls = (
        db.query(Payroll)
        .filter(
            Payroll.contract_id.in_([contract.id for contract in contracts]) if contracts else False,
            Payroll.period_year == payload.period_from.year,
            Payroll.period_month.between(1, 12),
            Payroll.status.in_(ACTIVE_PAYROLL_STATUSES),
        )
        .order_by(Payroll.contract_id, Payroll.period_month, Payroll.id)
        .all()
        if contracts
        else []
    )
    payrolls_by_contract = {}
    for payroll in payrolls:
        start, end = payroll_period_dates(payroll)
        if end < payload.period_from or start > payload.period_to:
            continue
        payrolls_by_contract.setdefault(payroll.contract_id, {})[payroll.period_month] = payroll

    source_pays = applicable_extra_pays(db, source) if payload.include_extra_pay_proration else {}
    target_pays = applicable_extra_pays(db, target) if payload.include_extra_pay_proration else {}
    items = []
    total_difference = Decimal("0.00")
    contributory_difference = Decimal("0.00")
    taxable_difference = Decimal("0.00")
    eligible = 0
    blocked = 0
    reviewed = 0

    for contract in contracts:
        warnings = ["La parcialidad utilizada es la actualmente registrada en el contrato."]
        category_id = contract.professional_category_id
        source_row = source_rows.get(category_id) if category_id else None
        target_row = target_rows.get(category_id) if category_id else None
        contract_payrolls = list((payrolls_by_contract.get(contract.id) or {}).values())
        lines = []
        reason = None

        if not category_id:
            reason = "El contrato no tiene categoría profesional vinculada."
        elif not source_row:
            reason = "La tabla de origen no contiene una fila para la categoría del contrato."
        elif not target_row:
            reason = "La tabla de destino no contiene una fila para la categoría del contrato."
        elif not contract_payrolls:
            reason = "No existen nóminas históricas activas dentro del período seleccionado."

        if reason is None:
            source_candidates = _target_candidates(db, contract, source_row)
            target_candidates = _target_candidates(db, contract, target_row)
            partiality = as_ratio(get_partiality(contract) / Decimal("100"))

            for payroll in contract_payrolls:
                reviewed += 1
                ratio = payroll_remuneration_ratio(payroll)

                if payload.include_base_salary:
                    source_base = monthly_amount(source_row.base_salary, source_row, source)
                    target_base = monthly_amount(target_row.base_salary, target_row, target)
                    line = build_line(
                        payroll, "SALARY_BASE", "Salario base", "base_salary",
                        source_base, target_base, partiality, ratio, True, True, payload.positive_only,
                    )
                    if line:
                        lines.append(line)

                if payload.include_salary_concepts:
                    for key in sorted(set(source_candidates) | set(target_candidates)):
                        source_candidate = source_candidates.get(key)
                        target_candidate = target_candidates.get(key)
                        candidate = target_candidate or source_candidate or {}
                        character = str(candidate.get("character") or "salarial").lower()
                        if character == "deduccion" or (character == "no_salarial" and not payload.include_non_salary):
                            continue
                        source_amount = as_money(source_candidate.get("amount") if source_candidate else 0)
                        target_amount = as_money(target_candidate.get("amount") if target_candidate else 0)
                        line = build_line(
                            payroll,
                            key,
                            candidate.get("name") or key,
                            "salary_concept",
                            source_amount,
                            target_amount,
                            partiality,
                            ratio,
                            bool(candidate.get("contributes", True)),
                            bool(candidate.get("taxable", True)),
                            payload.positive_only,
                        )
                        if line:
                            lines.append(line)

                if payload.include_extra_pay_proration and contract.pay_schedule == "prorated_12":
                    for pay_key in sorted(set(source_pays) | set(target_pays)):
                        source_pay = source_pays.get(pay_key)
                        target_pay = target_pays.get(pay_key)
                        source_amount = proration_value(db, source_pay, source.id, category_id, payroll.period_month, partiality)
                        target_amount = proration_value(db, target_pay, target.id, category_id, payroll.period_month, partiality)
                        pay = target_pay or source_pay
                        line = build_line(
                            payroll,
                            f"EXTRA_PRORATION_{pay_key}",
                            f"Prorrata {pay.name if pay else pay_key}",
                            "extra_pay_proration",
                            source_amount,
                            target_amount,
                            partiality,
                            ratio,
                            True,
                            True,
                            payload.positive_only,
                        )
                        if line:
                            lines.append(line)

        contract_total = as_money(sum((line["amount"] for line in lines), Decimal("0.00")))
        contract_contributory = as_money(sum((line["amount"] for line in lines if line["contributes"]), Decimal("0.00")))
        contract_taxable = as_money(sum((line["amount"] for line in lines if line["taxable"]), Decimal("0.00")))
        if reason is None and contract_total == 0:
            reason = "No existen diferencias liquidables con las opciones seleccionadas."
        eligibility = "eligible" if reason is None else "blocked"
        if eligibility == "eligible":
            eligible += 1
        else:
            blocked += 1

        total_difference += contract_total
        contributory_difference += contract_contributory
        taxable_difference += contract_taxable
        items.append({
            "contract_id": contract.id,
            "employee_id": contract.employee_id,
            "employee_code": contract.employee.employee_code if contract.employee else None,
            "employee_name": employee_name(contract),
            "contract_code": contract.contract_code,
            "professional_category_id": category_id,
            "professional_category_name": contract.agreement_professional_category.name if contract.agreement_professional_category else contract.professional_category,
            "source_salary_table_row_id": source_row.id if source_row else None,
            "target_salary_table_row_id": target_row.id if target_row else None,
            "payroll_count": len(contract_payrolls),
            "total_difference": contract_total,
            "contributory_difference": contract_contributory,
            "taxable_difference": contract_taxable,
            "eligibility": eligibility,
            "reason": reason,
            "lines": lines,
            "warnings": warnings,
        })

    warnings = [
        "La vista previa no modifica contratos ni nóminas históricas.",
        "La primera versión utiliza la categoría y parcialidad actualmente registradas en el contrato.",
    ]
    if target.status != "active":
        warnings.append("La tabla de destino no está activa; podrá revisarse la diferencia, pero no generarse la complementaria.")

    return {
        "source_table_id": source.id,
        "source_table_name": source.name,
        "target_table_id": target.id,
        "target_table_name": target.name,
        "period_from": payload.period_from,
        "period_to": payload.period_to,
        "exercise": payload.period_from.year,
        "total_contracts": len(items),
        "eligible_contracts": eligible,
        "blocked_contracts": blocked,
        "payrolls_reviewed": reviewed,
        "total_difference": as_money(total_difference),
        "contributory_difference": as_money(contributory_difference),
        "taxable_difference": as_money(taxable_difference),
        "contracts": items,
        "warnings": warnings,
    }


def get_or_create_trace_concept(db: Session, agreement_id: int, source_table_id: int, target_table_id: int, line: dict, order: int):
    suffix = normalize_code(line["concept_key"])[:60]
    code = f"RETRO_TABLE_{source_table_id}_{target_table_id}_{suffix}"[:120]
    concept = db.query(PayrollConcept).filter(PayrollConcept.code == code).first()
    values = {
        "name": f"Atrasos {line['concept_name']}",
        "category": "ATRASOS",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "SALARIAL",
        "source_type": "AGREEMENT",
        "agreement_id": agreement_id,
        "calculation_type": "FIXED_AMOUNT",
        "default_amount": Decimal("0.00"),
        "default_unit_price": Decimal("0.00"),
        "applies_workday_percentage": False,
        "is_system": True,
        "is_taxable": False,
        "is_contribution_base": False,
        "is_active": True,
        "display_order": order,
        "notes": "Traza informativa de regularización retroactiva de tabla salarial.",
    }
    if concept is None:
        concept = PayrollConcept(code=code, **values)
        db.add(concept)
        db.flush()
    else:
        for key, value in values.items():
            setattr(concept, key, value)
    return concept


def generate_salary_regularizations(db: Session, target_table_id: int, payload: SalaryRegularizationGenerateRequest) -> dict:
    source, target = load_tables(db, payload.source_table_id, target_table_id)
    if target.status != "active":
        raise HTTPException(status_code=409, detail="La tabla salarial de destino debe estar activa antes de generar atrasos")

    preview = build_salary_regularization_preview(db, target_table_id, payload)
    selected_ids = set(payload.contract_ids) or {
        item["contract_id"] for item in preview["contracts"] if item["eligibility"] == "eligible"
    }
    item_map = {item["contract_id"]: item for item in preview["contracts"]}
    generated = []
    skipped = []
    total_gross = Decimal("0.00")

    try:
        for contract_id in sorted(selected_ids):
            item = item_map.get(contract_id)
            if not item:
                skipped.append({"contract_id": contract_id, "reason": "Contrato fuera del ámbito de la vista previa."})
                continue
            if item["eligibility"] != "eligible" or item["total_difference"] <= 0:
                skipped.append({"contract_id": contract_id, "employee_id": item["employee_id"], "reason": item["reason"] or "Sin atrasos positivos liquidables."})
                continue

            existing = db.query(Payroll).filter(
                Payroll.contract_id == contract_id,
                Payroll.period_month == 15,
                Payroll.period_year == preview["exercise"],
                Payroll.status.in_(ACTIVE_PAYROLL_STATUSES),
            ).first()
            if existing:
                skipped.append({
                    "contract_id": contract_id,
                    "employee_id": item["employee_id"],
                    "reason": f"Ya existe una nómina complementaria activa para el ejercicio {preview['exercise']}.",
                })
                continue

            contract = (
                db.query(Contract)
                .options(joinedload(Contract.employee))
                .filter(Contract.id == contract_id)
                .first()
            )
            if not contract or not contract.employee or not contract.company_id:
                skipped.append({"contract_id": contract_id, "reason": "Contrato incompleto para generar la nómina complementaria."})
                continue

            irpf_percentage, suggested_irpf = resolve_irpf_percentage(
                db,
                contract.employee,
                contract,
                payload.irpf_mode,
                payload.irpf_percentage,
            )
            gross = as_money(item["total_difference"])
            contributory = as_money(max(Decimal("0.00"), item["contributory_difference"]))
            taxable = as_money(max(Decimal("0.00"), item["taxable_difference"]))
            amounts = calculate_social_security_amounts_from_bases(
                gross_salary=gross,
                common_contingencies_base=contributory,
                professional_contingencies_base=contributory,
                unemployment_training_fogasa_base=contributory,
                irpf_base=taxable,
                irpf_percentage=irpf_percentage,
            )

            payroll = Payroll(
                employee_id=contract.employee_id,
                contract_id=contract.id,
                company_id=contract.company_id,
                center_id=contract.center_id,
                period_month=15,
                period_year=preview["exercise"],
                base_salary=Decimal("0.00"),
                worked_base_salary=Decimal("0.00"),
                temporary_disability_benefit=Decimal("0.00"),
                company_disability_complement=Decimal("0.00"),
                salary_supplements=Decimal("0.00"),
                variable_incentives=Decimal("0.00"),
                extra_pay_proration=Decimal("0.00"),
                gross_salary=gross,
                contribution_days=0,
                worked_days=0,
                incident_days=0,
                it_days=0,
                non_contribution_days=0,
                common_contingencies_base=amounts["common_contingencies_base"],
                professional_contingencies_base=amounts["professional_contingencies_base"],
                unemployment_training_fogasa_base=amounts["unemployment_training_fogasa_base"],
                irpf_base=amounts["irpf_base"],
                daily_common_base=Decimal("0.00"),
                daily_professional_base=Decimal("0.00"),
                employee_common_contingencies=amounts["employee_common_contingencies"],
                employee_unemployment=amounts["employee_unemployment"],
                employee_training=amounts["employee_training"],
                employee_mei=amounts["employee_mei"],
                employee_social_security=amounts["employee_social_security"],
                irpf_mode=payload.irpf_mode,
                irpf_percentage=irpf_percentage,
                suggested_irpf_percentage=suggested_irpf,
                irpf=amounts["irpf"],
                total_deductions=amounts["total_deductions"],
                net_salary=amounts["net_salary"],
                company_common_contingencies=amounts["company_common_contingencies"],
                company_unemployment=amounts["company_unemployment"],
                company_fogasa=amounts["company_fogasa"],
                company_training=amounts["company_training"],
                company_at_ep=amounts["company_at_ep"],
                company_mei=amounts["company_mei"],
                company_total_social_security=amounts["company_total_social_security"],
                company_total_cost=amounts["company_total_cost"],
                status=payload.status,
            )
            db.add(payroll)
            db.flush()

            for order, line in enumerate(item["lines"], start=10):
                concept = get_or_create_trace_concept(
                    db,
                    target.collective_agreement_id,
                    source.id,
                    target.id,
                    line,
                    order,
                )
                db.add(PayrollItem(
                    payroll_id=payroll.id,
                    concept_id=concept.id,
                    description=f"{line['concept_name']} · {line['source_period_month']:02d}/{line['source_period_year']}",
                    quantity=Decimal("1.00"),
                    unit_price=line["amount"],
                    amount=line["amount"],
                    display_order=order,
                    notes=(
                        f"Nómina origen {line['payroll_id']}; tabla {source.id} -> {target.id}; "
                        f"diferencia teórica {line['theoretical_difference']}; "
                        f"parcialidad {line['partiality_ratio']}; proporción remunerada {line['remuneration_ratio']}."
                    ),
                ))

            generated.append({
                "contract_id": contract.id,
                "employee_id": contract.employee_id,
                "payroll_id": payroll.id,
                "period_year": payroll.period_year,
                "gross_salary": gross,
                "employee_social_security": amounts["employee_social_security"],
                "irpf_percentage": irpf_percentage,
                "irpf": amounts["irpf"],
                "net_salary": amounts["net_salary"],
                "created_items": len(item["lines"]),
            })
            total_gross += gross

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "target_table_id": target.id,
        "exercise": preview["exercise"],
        "selected_contracts": len(selected_ids),
        "generated_payrolls": len(generated),
        "skipped_contracts": len(skipped),
        "total_gross": as_money(total_gross),
        "generated": generated,
        "skipped": skipped,
        "warnings": [
            "Las nóminas históricas no se han modificado.",
            "Las líneas de atrasos son trazas informativas; los importes efectivos se guardan en la cabecera complementaria.",
        ],
    }
