from copy import copy
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.contract import Contract
from app.models.payroll_salary_structure import ContractPayrollConcept
from app.schemas.contract import ContractWorkdaySimulationRequest
from app.services.payroll_amounts import money

ESTIMATED_COMPANY_SOCIAL_SECURITY_RATE = Decimal("0.315")


def decimal_or_zero(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0.00")
    return Decimal(str(value))


def get_partiality(contract: Contract) -> Decimal:
    if contract.partiality_coefficient is not None:
        return decimal_or_zero(contract.partiality_coefficient)

    weekly_hours = decimal_or_zero(contract.weekly_hours)
    full_time_weekly_hours = decimal_or_zero(contract.full_time_weekly_hours or 40)
    if weekly_hours > 0 and full_time_weekly_hours > 0:
        return money((weekly_hours / full_time_weekly_hours) * Decimal("100"))

    return Decimal("100.00")


def get_pay_count(contract: Contract) -> Decimal:
    return Decimal("12") if contract.pay_schedule == "prorated_12" else Decimal("14")


def get_workday_hours(contract: Contract, partiality: Decimal) -> dict:
    weekly_hours = decimal_or_zero(contract.weekly_hours)
    full_time_weekly_hours = decimal_or_zero(contract.full_time_weekly_hours or 40)
    annual_agreement_hours = decimal_or_zero(contract.annual_agreement_hours)

    if weekly_hours <= 0 and full_time_weekly_hours > 0:
        weekly_hours = money(full_time_weekly_hours * partiality / Decimal("100"))

    monthly_hours = decimal_or_zero(contract.monthly_hours)
    if monthly_hours <= 0 and weekly_hours > 0:
        monthly_hours = money(weekly_hours * Decimal("52") / Decimal("12"))

    annual_hours = decimal_or_zero(contract.annual_hours)
    if annual_hours <= 0 and annual_agreement_hours > 0:
        annual_hours = money(annual_agreement_hours * partiality / Decimal("100"))
    elif annual_hours <= 0 and weekly_hours > 0:
        annual_hours = money(weekly_hours * Decimal("52"))

    return {
        "weekly_hours": money(weekly_hours),
        "monthly_hours": money(monthly_hours),
        "annual_hours": money(annual_hours),
        "annual_agreement_hours": money(annual_agreement_hours),
        "full_time_weekly_hours": money(full_time_weekly_hours),
    }


def get_contract_or_404(db: Session, contract_id: int) -> Contract:
    contract = db.query(Contract).options(joinedload(Contract.employee)).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return contract


def get_active_contract_concepts(db: Session, contract_id: int):
    return db.query(ContractPayrollConcept).options(joinedload(ContractPayrollConcept.concept)).filter(
        ContractPayrollConcept.contract_id == contract_id,
        ContractPayrollConcept.is_active == True,
    ).order_by(ContractPayrollConcept.display_order, ContractPayrollConcept.id).all()


def build_contract_salary_summary(db: Session, contract_id: int, contract_override: Contract | None = None):
    contract = contract_override or get_contract_or_404(db, contract_id)
    partiality = get_partiality(contract)
    partiality_ratio = partiality / Decimal("100")
    pay_count = get_pay_count(contract)
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

    monthly_remuneration = money(salary_base_applied + permanent_applied)
    annual_remuneration = money(monthly_remuneration * pay_count)
    estimated_company_social_security = money(annual_remuneration * ESTIMATED_COMPANY_SOCIAL_SECURITY_RATE)
    estimated_company_cost = money(annual_remuneration + estimated_company_social_security)
    hours = get_workday_hours(contract, partiality)

    return {
        "contract_id": contract_id,
        "employee_name": contract.employee_name,
        "working_day_type": contract.working_day_type,
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
            simulated_contract.partiality_coefficient = float(money(decimal_or_zero(request.target_weekly_hours) / full_time_weekly_hours * Decimal("100")))
    elif request.target_partiality_coefficient is not None:
        simulated_contract.partiality_coefficient = request.target_partiality_coefficient
        simulated_contract.weekly_hours = float(money(full_time_weekly_hours * decimal_or_zero(request.target_partiality_coefficient) / Decimal("100")))
    else:
        raise HTTPException(status_code=400, detail="Indica target_weekly_hours o target_partiality_coefficient")

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
