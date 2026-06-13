from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.crud.payroll import ACTIVE_PAYROLL_STATUSES
from app.models.contract import Contract
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept
from app.services.agreement_extra_pay import _get_extra_pay, preview_extra_pay
from app.services.contract_salary_summary import get_partiality
from app.services.extra_pay_accrual_days import (
    contract_active_days,
    date_set,
    inactivity_exclusions,
    incident_exclusions,
    resolve_accrual_dates,
)


MONEY = Decimal("0.01")
RATIO = Decimal("0.0001")


def as_money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def as_ratio(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(RATIO, rounding=ROUND_HALF_UP)


def load_contract(db: Session, contract_id: int) -> Contract:
    contract = (
        db.query(Contract)
        .options(
            joinedload(Contract.employee),
            joinedload(Contract.company),
            joinedload(Contract.salary_table_row),
            joinedload(Contract.collective_agreement),
        )
        .filter(Contract.id == contract_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return contract


def contract_concept_amounts(
    db: Session,
    contract_id: int,
    concept_keys: set[str],
    accrual_start,
    accrual_end,
) -> dict[str, Decimal]:
    if not concept_keys:
        return {}
    lines = (
        db.query(ContractPayrollConcept)
        .options(joinedload(ContractPayrollConcept.concept))
        .join(PayrollConcept, PayrollConcept.id == ContractPayrollConcept.concept_id)
        .filter(
            ContractPayrollConcept.contract_id == contract_id,
            ContractPayrollConcept.is_active == True,
            PayrollConcept.code.in_(concept_keys),
            or_(ContractPayrollConcept.start_date.is_(None), ContractPayrollConcept.start_date <= accrual_end),
            or_(ContractPayrollConcept.end_date.is_(None), ContractPayrollConcept.end_date >= accrual_start),
        )
        .order_by(ContractPayrollConcept.id.desc())
        .all()
    )
    result = {}
    for line in lines:
        if line.concept and line.concept.code not in result:
            result[line.concept.code] = as_money(line.amount)
    return result


def existing_special_payroll(db: Session, contract_id: int, period: int, year: int):
    return (
        db.query(Payroll)
        .filter(
            Payroll.contract_id == contract_id,
            Payroll.period_month == period,
            Payroll.period_year == year,
            Payroll.status.in_(ACTIVE_PAYROLL_STATUSES),
        )
        .order_by(Payroll.id.desc())
        .first()
    )


def preview_contract_extra_pay(
    db: Session,
    extra_pay_id: int,
    contract_id: int,
    period_year: int,
) -> dict:
    extra_pay = _get_extra_pay(db, extra_pay_id)
    contract = load_contract(db, contract_id)
    if contract.collective_agreement_id != extra_pay.collective_agreement_id:
        raise HTTPException(status_code=400, detail="El contrato no pertenece al convenio de la paga")
    if not contract.professional_category_id:
        raise HTTPException(status_code=400, detail="El contrato no tiene categoría profesional vinculada")

    contract_table_id = contract.salary_table_row.salary_table_id if contract.salary_table_row else None
    resolved_table_id = extra_pay.salary_table_id or contract_table_id
    if not resolved_table_id:
        raise HTTPException(
            status_code=400,
            detail="La paga y el contrato no tienen una tabla salarial para resolver los conceptos",
        )

    accrual_start, accrual_end = resolve_accrual_dates(extra_pay, period_year)
    period_days = date_set(accrual_start, accrual_end)
    active_days = contract_active_days(contract, accrual_start, accrual_end)
    it_days, unpaid_days, incidents = incident_exclusions(
        db, contract, active_days, accrual_start, accrual_end, extra_pay
    )
    inactivity_days = inactivity_exclusions(
        contract, active_days, accrual_start, accrual_end, extra_pay.deduct_inactivity_days
    )
    excluded_days = it_days | unpaid_days | inactivity_days
    accrued_days = len(active_days - excluded_days)
    accrual_ratio = as_ratio(
        Decimal(accrued_days) / Decimal(len(period_days)) if period_days else 0
    )
    partiality = as_money(get_partiality(contract)) if extra_pay.apply_partiality else Decimal("100.00")
    partiality_ratio = as_ratio(partiality / Decimal("100"))

    base = preview_extra_pay(
        db,
        extra_pay.id,
        contract.professional_category_id,
        salary_table_id=resolved_table_id,
    )
    keys = {line["concept_key"] for line in base["lines"]}
    contract_amounts = contract_concept_amounts(
        db, contract.id, keys, accrual_start, accrual_end
    )
    salary_base_key = f"AGR_{extra_pay.collective_agreement_id}_SALARY_BASE"

    lines = []
    theoretical = Decimal("0.00")
    full_period = Decimal("0.00")
    final = Decimal("0.00")
    warnings = list(base.get("warnings") or [])

    if extra_pay.salary_table_id and contract_table_id != extra_pay.salary_table_id:
        warnings.append("El contrato utiliza una tabla salarial distinta de la paga.")
    elif extra_pay.salary_table_id is None:
        warnings.append("La paga general se ha resuelto con la tabla salarial del contrato.")

    for line in base["lines"]:
        table_base = as_money(line["base_amount"])
        contract_base = table_base
        source = "salary_table"
        if line["concept_key"] == salary_base_key and contract.salary_base is not None:
            contract_base = as_money(contract.salary_base)
            source = "contract_salary_base"
        elif line["concept_key"] in contract_amounts:
            contract_base = contract_amounts[line["concept_key"]]
            source = "contract_permanent_concept"

        if line["calculation_mode"] == "fixed":
            full_time = as_money(line["fixed_amount"])
            source = "fixed_amount"
        else:
            full_time = as_money(
                contract_base * Decimal(str(line.get("percentage") or 0)) / Decimal("100")
            )
        after_partiality = as_money(full_time * partiality_ratio)
        line_final = as_money(after_partiality * accrual_ratio)
        theoretical += full_time
        full_period += after_partiality
        final += line_final
        lines.append({
            "concept_line_id": line["concept_line_id"],
            "concept_key": line["concept_key"],
            "concept_name": line["concept_name"],
            "calculation_mode": line["calculation_mode"],
            "percentage": line.get("percentage"),
            "fixed_amount": line.get("fixed_amount"),
            "table_base_amount": table_base,
            "contract_base_amount": contract_base,
            "base_source": source,
            "full_time_amount": full_time,
            "after_partiality_amount": after_partiality,
            "final_amount": line_final,
            "warning": line.get("warning"),
        })

    theoretical = as_money(theoretical)
    full_period = as_money(full_period)
    final = as_money(final)
    monthly_proration = (
        as_money(final / Decimal(extra_pay.accrual_months))
        if extra_pay.proration_allowed and extra_pay.accrual_months else Decimal("0.00")
    )
    existing = existing_special_payroll(
        db, contract.id, extra_pay.payroll_period, period_year
    )

    block_reason = None
    if existing:
        block_reason = "Ya existe una nómina activa para este contrato y período especial."
    elif not contract.company_id:
        block_reason = "El contrato no tiene empresa vinculada."
    elif extra_pay.proration_default or contract.pay_schedule == "prorated_12":
        block_reason = "La paga está prorrateada y no debe generar una nómina especial."
    elif not active_days:
        block_reason = "El contrato no estuvo vigente durante el período de devengo."
    elif accrued_days <= 0:
        block_reason = "No quedan días devengados después de las exclusiones."
    elif final <= 0:
        block_reason = "El importe calculado es cero."

    if contract.start_date > accrual_start:
        warnings.append("El contrato comenzó después del inicio del devengo.")
    if contract.end_date and contract.end_date < accrual_end:
        warnings.append("El contrato terminó antes del final del devengo.")
    if excluded_days:
        warnings.append("Se han descontado días según las reglas configuradas.")

    return {
        "extra_pay_id": extra_pay.id,
        "extra_pay_name": extra_pay.name,
        "payroll_period": extra_pay.payroll_period,
        "period_year": period_year,
        "contract_id": contract.id,
        "contract_code": contract.contract_code or str(contract.id),
        "employee_id": contract.employee_id,
        "employee_name": contract.employee_name,
        "company_id": contract.company_id,
        "salary_table_id": resolved_table_id,
        "professional_category_id": contract.professional_category_id,
        "accrual_start_date": accrual_start,
        "accrual_end_date": accrual_end,
        "total_period_days": len(period_days),
        "contract_overlap_days": len(active_days),
        "excluded_it_days": len(it_days),
        "excluded_unpaid_absence_days": len(unpaid_days),
        "excluded_inactivity_days": len(inactivity_days),
        "excluded_total_days": len(excluded_days),
        "accrued_days": accrued_days,
        "accrual_ratio": accrual_ratio,
        "partiality_percentage": partiality,
        "partiality_ratio": partiality_ratio,
        "theoretical_full_time_amount": theoretical,
        "contract_full_period_amount": full_period,
        "final_amount": final,
        "proration_monthly_amount": monthly_proration,
        "already_generated_payroll_id": existing.id if existing else None,
        "can_generate": block_reason is None,
        "generation_block_reason": block_reason,
        "incident_breakdown": incidents,
        "lines": lines,
        "warnings": warnings,
    }
