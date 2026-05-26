from decimal import Decimal, ROUND_HALF_UP

from app.services.payroll_rates import DEFAULT_PAYROLL_RATES

EMPLOYEE_COMMON_CONTINGENCIES_PERCENTAGE = DEFAULT_PAYROLL_RATES["employee_common_contingencies"]
EMPLOYEE_UNEMPLOYMENT_PERCENTAGE = DEFAULT_PAYROLL_RATES["employee_unemployment"]
EMPLOYEE_TRAINING_PERCENTAGE = DEFAULT_PAYROLL_RATES["employee_training"]
EMPLOYEE_MEI_PERCENTAGE = DEFAULT_PAYROLL_RATES["employee_mei"]

COMPANY_COMMON_CONTINGENCIES_PERCENTAGE = DEFAULT_PAYROLL_RATES["company_common_contingencies"]
COMPANY_UNEMPLOYMENT_PERCENTAGE = DEFAULT_PAYROLL_RATES["company_unemployment"]
COMPANY_FOGASA_PERCENTAGE = DEFAULT_PAYROLL_RATES["company_fogasa"]
COMPANY_TRAINING_PERCENTAGE = DEFAULT_PAYROLL_RATES["company_training"]
COMPANY_AT_EP_PERCENTAGE = DEFAULT_PAYROLL_RATES["company_at_ep"]
COMPANY_MEI_PERCENTAGE = DEFAULT_PAYROLL_RATES["company_mei"]


def money(value) -> Decimal:
    return Decimal(value or "0.00").quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_social_security_amounts_from_bases(
    gross_salary: Decimal,
    common_contingencies_base: Decimal,
    professional_contingencies_base: Decimal,
    unemployment_training_fogasa_base: Decimal,
    irpf_base: Decimal,
    irpf_percentage: Decimal = Decimal("0.00"),
) -> dict[str, Decimal]:
    """Calculate deductions, net salary and company cost from explicit bases.

    This is the canonical low-level amount calculator for the payroll engine.

    Responsibility boundaries:
    - It receives contribution bases already calculated.
    - It applies employee/company contribution rates.
    - It calculates IRPF withholding, total deductions, net salary and company cost.

    It must not decide which salary concepts contribute, which days are quoted,
    or how contribution bases are obtained. That belongs to
    contribution_base_calculator.py and payroll_days_calculator.py.
    """

    gross_salary = money(gross_salary)
    cc_base = money(common_contingencies_base)
    professional_base = money(professional_contingencies_base)
    unemployment_training_fogasa_base = money(unemployment_training_fogasa_base)
    irpf_base = money(irpf_base)
    irpf_percentage = money(irpf_percentage)

    employee_common_contingencies = money(cc_base * EMPLOYEE_COMMON_CONTINGENCIES_PERCENTAGE / Decimal("100"))
    employee_unemployment = money(unemployment_training_fogasa_base * EMPLOYEE_UNEMPLOYMENT_PERCENTAGE / Decimal("100"))
    employee_training = money(unemployment_training_fogasa_base * EMPLOYEE_TRAINING_PERCENTAGE / Decimal("100"))
    employee_mei = money(cc_base * EMPLOYEE_MEI_PERCENTAGE / Decimal("100"))
    employee_total_ss = money(
        employee_common_contingencies
        + employee_unemployment
        + employee_training
        + employee_mei
    )

    irpf = money(irpf_base * irpf_percentage / Decimal("100"))
    total_deductions = money(employee_total_ss + irpf)
    net_salary = money(gross_salary - total_deductions)

    company_common_contingencies = money(cc_base * COMPANY_COMMON_CONTINGENCIES_PERCENTAGE / Decimal("100"))
    company_unemployment = money(unemployment_training_fogasa_base * COMPANY_UNEMPLOYMENT_PERCENTAGE / Decimal("100"))
    company_fogasa = money(unemployment_training_fogasa_base * COMPANY_FOGASA_PERCENTAGE / Decimal("100"))
    company_training = money(unemployment_training_fogasa_base * COMPANY_TRAINING_PERCENTAGE / Decimal("100"))
    company_at_ep = money(professional_base * COMPANY_AT_EP_PERCENTAGE / Decimal("100"))
    company_mei = money(cc_base * COMPANY_MEI_PERCENTAGE / Decimal("100"))
    company_total_ss = money(
        company_common_contingencies
        + company_unemployment
        + company_fogasa
        + company_training
        + company_at_ep
        + company_mei
    )
    company_total_cost = money(gross_salary + company_total_ss)

    return {
        # Business-friendly names requested for the payroll engine.
        "gross_salary": gross_salary,
        "cc_base": cc_base,
        "professional_base": professional_base,
        "unemployment_training_fogasa_base": unemployment_training_fogasa_base,
        "irpf_base": irpf_base,
        "employee_common_contingencies": employee_common_contingencies,
        "employee_unemployment": employee_unemployment,
        "employee_training": employee_training,
        "employee_mei": employee_mei,
        "employee_total_ss": employee_total_ss,
        "irpf": irpf,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "company_common_contingencies": company_common_contingencies,
        "company_unemployment": company_unemployment,
        "company_fogasa": company_fogasa,
        "company_training": company_training,
        "company_at_ep": company_at_ep,
        "company_mei": company_mei,
        "company_total_ss": company_total_ss,
        "company_total_cost": company_total_cost,

        # Persistence-compatible aliases currently used by Payroll model/API.
        "common_contingencies_base": cc_base,
        "professional_contingencies_base": professional_base,
        "employee_social_security": employee_total_ss,
        "company_total_social_security": company_total_ss,
    }


def calculate_payroll_amounts(
    base_salary: Decimal | None = None,
    salary_supplements: Decimal | None = None,
    variable_incentives: Decimal = Decimal("0.00"),
    extra_pay_proration: Decimal = Decimal("0.00"),
    irpf_percentage: Decimal = Decimal("0.00"),
    gross_salary: Decimal | None = None,
    common_contingencies_base: Decimal | None = None,
    professional_contingencies_base: Decimal | None = None,
    unemployment_training_fogasa_base: Decimal | None = None,
    irpf_base: Decimal | None = None,
) -> dict[str, Decimal]:
    """Calculate the full simulated payroll breakdown.

    Preferred usage:
    - Pass gross_salary and all contribution bases explicitly.

    Temporary legacy compatibility:
    - If explicit bases are not provided, the function falls back to the old MVP
      behaviour and derives every base from the gross salary.
    - This keeps crud/payroll.py working until the new payroll_engine.py is
      integrated.
    """

    if gross_salary is None:
        gross_salary = money(
            money(base_salary)
            + money(salary_supplements)
            + money(variable_incentives)
            + money(extra_pay_proration)
        )
    else:
        gross_salary = money(gross_salary)

    if common_contingencies_base is None:
        common_contingencies_base = gross_salary
    if professional_contingencies_base is None:
        professional_contingencies_base = gross_salary
    if unemployment_training_fogasa_base is None:
        unemployment_training_fogasa_base = professional_contingencies_base
    if irpf_base is None:
        irpf_base = gross_salary

    return calculate_social_security_amounts_from_bases(
        gross_salary=gross_salary,
        common_contingencies_base=common_contingencies_base,
        professional_contingencies_base=professional_contingencies_base,
        unemployment_training_fogasa_base=unemployment_training_fogasa_base,
        irpf_base=irpf_base,
        irpf_percentage=irpf_percentage,
    )
