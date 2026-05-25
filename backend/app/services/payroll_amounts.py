from decimal import Decimal, ROUND_HALF_UP

EMPLOYEE_COMMON_CONTINGENCIES_PERCENTAGE = Decimal("4.70")
EMPLOYEE_UNEMPLOYMENT_PERCENTAGE = Decimal("1.55")
EMPLOYEE_TRAINING_PERCENTAGE = Decimal("0.10")
EMPLOYEE_MEI_PERCENTAGE = Decimal("0.13")

COMPANY_COMMON_CONTINGENCIES_PERCENTAGE = Decimal("23.60")
COMPANY_UNEMPLOYMENT_PERCENTAGE = Decimal("5.50")
COMPANY_FOGASA_PERCENTAGE = Decimal("0.20")
COMPANY_TRAINING_PERCENTAGE = Decimal("0.60")
COMPANY_AT_EP_PERCENTAGE = Decimal("1.50")
COMPANY_MEI_PERCENTAGE = Decimal("0.67")


def money(value) -> Decimal:
    return Decimal(value or "0.00").quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_payroll_amounts(
    base_salary: Decimal,
    salary_supplements: Decimal,
    variable_incentives: Decimal,
    extra_pay_proration: Decimal,
    irpf_percentage: Decimal,
) -> dict[str, Decimal]:
    """Calculate the full simulated payroll breakdown.

    This is the canonical payroll calculation shape for the MVP.
    It returns business-friendly aliases and persistence-friendly names.

    MVP simplification:
    - all contribution bases use gross salary / total accrued amount.
    - no legal minimum or maximum bases are applied yet.
    - no excluded salary concepts are handled yet.
    """

    gross_salary = money(base_salary + salary_supplements + variable_incentives + extra_pay_proration)

    cc_base = gross_salary
    professional_base = gross_salary
    unemployment_training_fogasa_base = gross_salary
    irpf_base = gross_salary

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
