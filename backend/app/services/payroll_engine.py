from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.services.contribution_base_calculator import calculate_contribution_bases
from app.services.payroll_amounts import calculate_social_security_amounts_from_bases, money
from app.services.payroll_days_calculator import calculate_payroll_days

MONTHLY_PERIODS = set(range(1, 12 + 1))
EXTRA_JULY = 13
EXTRA_DECEMBER = 14
EXTRA_COMPLEMENTARY = 15
EXTRA_PERIODS = {EXTRA_JULY, EXTRA_DECEMBER, EXTRA_COMPLEMENTARY}
STANDARD_MONTH_DAYS = Decimal("30")

IT_INCIDENT_TYPES = {"IT", "RECAIDA", "COMMON_SICK_LEAVE", "WORK_ACCIDENT"}
WORK_ACCIDENT_TYPES = {"WORK_ACCIDENT"}


class UnsupportedPayrollPeriodError(ValueError):
    pass


def get_period_dates(period_month: int, period_year: int) -> tuple[date | None, date | None]:
    if period_month not in MONTHLY_PERIODS:
        return None, None

    last_day = monthrange(period_year, period_month)[1]
    return date(period_year, period_month, 1), date(period_year, period_month, last_day)


def get_effective_period_dates(period_month: int, period_year: int) -> tuple[date | None, date | None]:
    if period_month in MONTHLY_PERIODS:
        return get_period_dates(period_month, period_year)
    if period_month == EXTRA_JULY:
        return date(period_year, 7, 1), date(period_year, 7, 31)
    if period_month == EXTRA_DECEMBER:
        return date(period_year, 12, 1), date(period_year, 12, 31)
    if period_month == EXTRA_COMPLEMENTARY:
        return date(period_year, 12, 1), date(period_year, 12, 31)
    return None, None


def calculate_contract_base_salary(contract: Contract, period_month: int) -> Decimal:
    """Calculate the ordinary or extra payroll base amount from annual salary.

    Current contract.salary_base is treated as agreed gross annual salary.
    For both 12-pay prorated and 14-pay non-prorated contracts, the ordinary
    base amount remains annual_salary / 14. In 12-pay contracts the extra-pay
    proration is added separately in ordinary monthly payrolls.
    """

    annual_salary = money(contract.salary_base or Decimal("0.00"))

    if period_month == EXTRA_COMPLEMENTARY:
        return Decimal("0.00")

    if period_month in {EXTRA_JULY, EXTRA_DECEMBER}:
        return money(annual_salary / Decimal("14"))

    return money(annual_salary / Decimal("14"))


def calculate_extra_pay_proration(contract: Contract, period_month: int) -> Decimal:
    annual_salary = money(contract.salary_base or Decimal("0.00"))
    pay_schedule = contract.pay_schedule or "not_prorated_14"

    if period_month not in MONTHLY_PERIODS:
        return Decimal("0.00")

    if pay_schedule != "prorated_12":
        return Decimal("0.00")

    return money(((annual_salary / Decimal("14")) * Decimal("2")) / Decimal("12"))


def get_period_incidents(
    db: Session,
    contract: Contract,
    period_start: date,
    period_end: date,
) -> list[Incident]:
    return db.query(Incident).filter(
        Incident.contract_id == contract.id,
        Incident.start_date <= period_end,
        (Incident.end_date == None) | (Incident.end_date >= period_start),
    ).order_by(Incident.start_date.asc()).all()


def build_empty_day_result() -> dict:
    return {
        "period_days": 0,
        "worked_days": 0,
        "incident_days": 0,
        "contribution_days": 0,
        "non_contribution_days": 0,
        "payroll_affecting_incident_days": 0,
        "has_payroll_affecting_incidents": False,
        "contribution_day_ratio": Decimal("0.0000"),
        "worked_day_ratio": Decimal("0.0000"),
        "incident_breakdown": [],
    }


def calculate_it_days(day_result: dict) -> tuple[int, int]:
    it_days = 0
    work_accident_days = 0
    for item in day_result.get("incident_breakdown", []):
        incident_type = item.get("incident_type")
        days = int(item.get("days") or 0)
        if incident_type in IT_INCIDENT_TYPES:
            it_days += days
        if incident_type in WORK_ACCIDENT_TYPES:
            work_accident_days += days
    return min(30, it_days), min(30, work_accident_days)


def calculate_simulated_earning_lines(
    base_salary: Decimal,
    salary_supplements: Decimal,
    variable_incentives: Decimal,
    extra_pay_proration: Decimal,
    day_result: dict,
) -> dict:
    """Build simple visible earning lines for the MVP payroll receipt.

    This is not a full legal IT engine. It only makes the demo explainable:
    - unpaid/non-contribution days reduce normal salary;
    - IT days split normal salary into simulated benefit + company complement;
    - vacations remain informative and do not reduce the monthly amount.
    """

    daily_base_salary = money(base_salary / STANDARD_MONTH_DAYS) if STANDARD_MONTH_DAYS else Decimal("0.00")
    it_days, work_accident_days = calculate_it_days(day_result)
    non_contribution_days = int(day_result.get("non_contribution_days") or 0)
    salary_reduced_days = min(30, it_days + non_contribution_days)

    normal_salary_reduction = money(daily_base_salary * Decimal(salary_reduced_days))
    worked_base_salary = money(max(Decimal("0.00"), base_salary - normal_salary_reduction))

    common_it_days = max(0, it_days - work_accident_days)
    common_it_benefit = money(daily_base_salary * Decimal(common_it_days) * Decimal("0.60"))
    common_it_company_complement = money(daily_base_salary * Decimal(common_it_days) * Decimal("0.40"))
    accident_benefit = money(daily_base_salary * Decimal(work_accident_days) * Decimal("0.75"))
    accident_company_complement = money(daily_base_salary * Decimal(work_accident_days) * Decimal("0.25"))

    temporary_disability_benefit = money(common_it_benefit + accident_benefit)
    company_disability_complement = money(common_it_company_complement + accident_company_complement)

    gross_salary = money(
        worked_base_salary
        + temporary_disability_benefit
        + company_disability_complement
        + money(salary_supplements)
        + money(variable_incentives)
        + money(extra_pay_proration)
    )

    return {
        "worked_base_salary": worked_base_salary,
        "temporary_disability_benefit": temporary_disability_benefit,
        "company_disability_complement": company_disability_complement,
        "it_days": it_days,
        "gross_salary": gross_salary,
    }


def build_empty_earning_lines(gross_salary: Decimal) -> dict:
    return {
        "worked_base_salary": gross_salary,
        "temporary_disability_benefit": Decimal("0.00"),
        "company_disability_complement": Decimal("0.00"),
        "it_days": 0,
    }


def calculate_special_period_result(
    contract: Contract,
    period_month: int,
    salary_supplements: Decimal,
    variable_incentives: Decimal,
    irpf_percentage: Decimal,
) -> dict:
    """Calculate extra payroll periods without duplicating contribution bases."""

    base_salary = calculate_contract_base_salary(contract, period_month)
    extra_pay_proration = Decimal("0.00")
    gross_salary = money(base_salary + money(salary_supplements) + money(variable_incentives) + extra_pay_proration)

    amounts = calculate_social_security_amounts_from_bases(
        gross_salary=gross_salary,
        common_contingencies_base=Decimal("0.00"),
        professional_contingencies_base=Decimal("0.00"),
        unemployment_training_fogasa_base=Decimal("0.00"),
        irpf_base=gross_salary,
        irpf_percentage=irpf_percentage,
    )

    return {
        "base_salary": base_salary,
        "salary_supplements": money(salary_supplements),
        "variable_incentives": money(variable_incentives),
        "extra_pay_proration": extra_pay_proration,
        **build_empty_day_result(),
        **build_empty_earning_lines(gross_salary),
        "daily_common_base": Decimal("0.00"),
        "daily_professional_base": Decimal("0.00"),
        **amounts,
    }


def calculate_monthly_period_result(
    db: Session,
    contract: Contract,
    period_month: int,
    period_year: int,
    salary_supplements: Decimal,
    variable_incentives: Decimal,
    irpf_percentage: Decimal,
    non_salary_compensation: Decimal = Decimal("0.00"),
    overtime_amount: Decimal = Decimal("0.00"),
) -> dict:
    period_start, period_end = get_period_dates(period_month, period_year)
    if not period_start or not period_end:
        raise UnsupportedPayrollPeriodError("Periodo mensual no válido")

    incidents = get_period_incidents(db, contract, period_start, period_end)
    day_result = calculate_payroll_days(
        incidents=incidents,
        period_start=period_start,
        period_end=period_end,
    )

    base_salary = calculate_contract_base_salary(contract, period_month)
    extra_pay_proration = calculate_extra_pay_proration(contract, period_month)

    base_result = calculate_contribution_bases(
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        variable_incentives=variable_incentives,
        extra_pay_proration=extra_pay_proration,
        non_salary_compensation=non_salary_compensation,
        overtime_amount=overtime_amount,
        contribution_days=day_result["contribution_days"],
        non_contribution_days=day_result["non_contribution_days"],
    )

    earning_lines = calculate_simulated_earning_lines(
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        variable_incentives=variable_incentives,
        extra_pay_proration=extra_pay_proration,
        day_result=day_result,
    )

    amounts = calculate_social_security_amounts_from_bases(
        gross_salary=earning_lines["gross_salary"],
        common_contingencies_base=base_result["common_contingencies_base"],
        professional_contingencies_base=base_result["professional_contingencies_base"],
        unemployment_training_fogasa_base=base_result["unemployment_training_fogasa_base"],
        irpf_base=earning_lines["gross_salary"],
        irpf_percentage=irpf_percentage,
    )

    return {
        "base_salary": base_salary,
        "salary_supplements": money(salary_supplements),
        "variable_incentives": money(variable_incentives),
        "extra_pay_proration": extra_pay_proration,
        **day_result,
        **earning_lines,
        "daily_common_base": base_result["daily_common_base"],
        "daily_professional_base": base_result["daily_professional_base"],
        "included_common_concepts_total": base_result["included_common_concepts_total"],
        "included_professional_concepts_total": base_result["included_professional_concepts_total"],
        "taxable_irpf_concepts_total": base_result["taxable_irpf_concepts_total"],
        "excluded_concepts_total": base_result["excluded_concepts_total"],
        "salary_concepts": base_result["salary_concepts"],
        **amounts,
    }


def calculate_payroll_engine_result(
    db: Session,
    employee: Employee,
    contract: Contract,
    period_month: int,
    period_year: int,
    salary_supplements: Decimal = Decimal("0.00"),
    variable_incentives: Decimal = Decimal("0.00"),
    irpf_percentage: Decimal = Decimal("0.00"),
    suggested_irpf_percentage: Decimal = Decimal("0.00"),
    non_salary_compensation: Decimal = Decimal("0.00"),
    overtime_amount: Decimal = Decimal("0.00"),
) -> dict:
    """Orchestrate the full simulated payroll calculation."""

    if period_month in EXTRA_PERIODS:
        result = calculate_special_period_result(
            contract=contract,
            period_month=period_month,
            salary_supplements=salary_supplements,
            variable_incentives=variable_incentives,
            irpf_percentage=irpf_percentage,
        )
    elif period_month in MONTHLY_PERIODS:
        result = calculate_monthly_period_result(
            db=db,
            contract=contract,
            period_month=period_month,
            period_year=period_year,
            salary_supplements=salary_supplements,
            variable_incentives=variable_incentives,
            irpf_percentage=irpf_percentage,
            non_salary_compensation=non_salary_compensation,
            overtime_amount=overtime_amount,
        )
    else:
        raise UnsupportedPayrollPeriodError("Periodo de nómina no soportado")

    return {
        "employee_id": employee.id,
        "contract_id": contract.id,
        "period_month": period_month,
        "period_year": period_year,
        "irpf_percentage": money(irpf_percentage),
        "suggested_irpf_percentage": money(suggested_irpf_percentage),
        **result,
    }
