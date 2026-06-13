from copy import copy
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.schemas.contract import ContractWorkdaySimulationRequest
from app.services.contract_salary_summary import (
    decimal_or_zero,
    get_active_contract_concepts,
    get_contract_or_404,
    get_partiality,
    get_workday_hours,
)
from app.services.payroll_amounts import money


ESTIMATED_COMPANY_SOCIAL_SECURITY_RATE = Decimal("0.315")
STANDARD_ANNUAL_PAYMENTS = Decimal("14")
PRORATED_MONTHS = Decimal("12")


def resolve_annual_remuneration(contract: Contract, ordinary_monthly: Decimal) -> Decimal:
    gross_annual_salary = decimal_or_zero(contract.gross_annual_salary)
    if gross_annual_salary > 0:
        return money(gross_annual_salary)
    return money(ordinary_monthly * STANDARD_ANNUAL_PAYMENTS)


def build_contract_salary_summary(db: Session, contract_id: int, contract_override: Contract | None = None):
    contract = contract_override or get_contract_or_404(db, contract_id)
    partiality = get_partiality(contract)
    partiality_ratio = partiality / Decimal("100")
    salary_base_theoretical = money(decimal_or_zero(contract.salary_base))
    salary_base_applied = money(salary_base_theoretical * partiality_ratio)

    permanent_original = Decimal("0.00")
    permanent_applied = Decimal("0.00")
    concept_lines = []

    for line in get_active_contract_concepts(db, contract_id):
        concept = line.concept
        original_amount = money(line.amount)
        applies_workday_percentage = bool(concept.applies_workday_percentage) if concept else True
        applied_amount = money(original_amount * partiality_ratio) if applies_workday_percentage else original_amount
        permanent_original += original_amount
        permanent_applied += applied_amount
        concept_lines.append(
            {
                "id": line.id,
                "concept_id": line.concept_id,
                "concept_name": line.concept_name,
                "concept_code": line.concept_code,
                "concept_type": line.concept_type,
                "salary_nature": line.salary_nature,
                "original_amount": original_amount,
                "applied_amount": applied_amount,
                "applies_workday_percentage": applies_workday_percentage,
            }
        )

    ordinary_monthly_remuneration = money(salary_base_applied + permanent_applied)
    annual_remuneration = resolve_annual_remuneration(contract, ordinary_monthly_remuneration)
    is_prorated = contract.pay_schedule == "prorated_12"
    monthly_remuneration = money(annual_remuneration / PRORATED_MONTHS) if is_prorated else ordinary_monthly_remuneration
    monthly_extra_pay_proration = (
        money(max(Decimal("0.00"), monthly_remuneration - ordinary_monthly_remuneration))
        if is_prorated
        else Decimal("0.00")
    )
    estimated_company_social_security = money(annual_remuneration * ESTIMATED_COMPANY_SOCIAL_SECURITY_RATE)
    estimated_company_cost = money(annual_remuneration + estimated_company_social_security)
    hours = get_workday_hours(contract, partiality)

    return {
        "contract_id": contract_id,
        "employee_name": contract.employee_name,
        "working_day_type": contract.working_day_type,
        "pay_schedule": contract.pay_schedule,
        "weekly_hours": hours["weekly_hours"],
        "monthly_hours": hours["monthly_hours"],
        "annual_hours": hours["annual_hours"],
        "annual_agreement_hours": hours["annual_agreement_hours"],
        "full_time_weekly_hours": hours["full_time_weekly_hours"],
        "partiality_coefficient": money(partiality),
        "salary_base_theoretical": salary_base_theoretical,
        "salary_base_applied": salary_base_applied,
        "permanent_concepts_original": money(permanent_original),
        "permanent_concepts_applied": money(permanent_applied),
        "ordinary_monthly_remuneration": ordinary_monthly_remuneration,
        "monthly_extra_pay_proration": monthly_extra_pay_proration,
        "monthly_remuneration": monthly_remuneration,
        "annual_remuneration": annual_remuneration,
        "estimated_company_social_security": estimated_company_social_security,
        "estimated_company_cost": estimated_company_cost,
        "concept_lines": concept_lines,
    }


def simulate_contract_workday_change(db: Session, contract_id: int, request: ContractWorkdaySimulationRequest):
    contract = get_contract_or_404(db, contract_id)
    before = build_contract_salary_summary(db, contract_id, contract)
    simulated_contract = copy(contract)

    if request.target_full_time_weekly_hours is not None:
        simulated_contract.full_time_weekly_hours = request.target_full_time_weekly_hours
    full_time_weekly_hours = decimal_or_zero(simulated_contract.full_time_weekly_hours or 40)

    if request.target_weekly_hours is not None:
        simulated_contract.weekly_hours = request.target_weekly_hours
        if full_time_weekly_hours > 0:
            simulated_contract.partiality_coefficient = float(
                money(decimal_or_zero(request.target_weekly_hours) / full_time_weekly_hours * Decimal("100"))
            )
    elif request.target_partiality_coefficient is not None:
        simulated_contract.partiality_coefficient = request.target_partiality_coefficient
        simulated_contract.weekly_hours = float(
            money(full_time_weekly_hours * decimal_or_zero(request.target_partiality_coefficient) / Decimal("100"))
        )
    else:
        raise HTTPException(status_code=400, detail="Indica una parcialidad objetivo o unas horas semanales objetivo")

    simulated_contract.monthly_hours = None
    simulated_contract.annual_hours = None
    after = build_contract_salary_summary(db, contract_id, simulated_contract)

    return {
        "contract_id": contract_id,
        "before": before,
        "after": after,
        "annual_difference": money(after["annual_remuneration"] - before["annual_remuneration"]),
        "monthly_difference": money(after["monthly_remuneration"] - before["monthly_remuneration"]),
    }
