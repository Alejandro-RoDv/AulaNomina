from decimal import Decimal
from types import SimpleNamespace

from app.seed_demo_payroll_incident_cases import (
    DEMO_INCIDENT_PAYROLL_CASES,
    get_demo_case_for_payroll,
    update_demo_payroll_amounts,
)


def demo_payroll(employee_name, salary_base):
    return SimpleNamespace(
        employee_name=employee_name,
        contract=SimpleNamespace(salary_base=Decimal(salary_base)),
        base_salary=Decimal(salary_base),
        calculation_version=0,
    )


def test_demo_cases_cover_it_recaida_and_absence():
    assert set(DEMO_INCIDENT_PAYROLL_CASES) == {
        "Javier Romero Sánchez",
        "Carmen López Torres",
        "Ana Pérez Navarro",
    }
    assert DEMO_INCIDENT_PAYROLL_CASES["Javier Romero Sánchez"]["case_code"] == "IT_COMUN_8_DIAS"
    assert DEMO_INCIDENT_PAYROLL_CASES["Carmen López Torres"]["case_code"] == "RECAIDA_IT_7_DIAS"
    assert DEMO_INCIDENT_PAYROLL_CASES["Ana Pérez Navarro"]["case_code"] == "AUSENCIA_NO_RETRIBUIDA_1_DIA"


def test_get_demo_case_for_payroll_returns_none_for_ordinary_case():
    payroll = demo_payroll("Laura Martín Ruiz", "1680.00")

    assert get_demo_case_for_payroll(payroll) is None


def test_update_demo_payroll_amounts_builds_javier_it_case():
    payroll = demo_payroll("Javier Romero Sánchez", "1450.00")
    case = DEMO_INCIDENT_PAYROLL_CASES["Javier Romero Sánchez"]

    update_demo_payroll_amounts(payroll, case)

    assert payroll.base_salary == Decimal("1450.00")
    assert payroll.worked_base_salary == Decimal("1063.33")
    assert payroll.temporary_disability_benefit == Decimal("232.00")
    assert payroll.company_disability_complement == Decimal("154.67")
    assert payroll.gross_salary == Decimal("1450.00")
    assert payroll.incident_days == 8
    assert payroll.it_days == 8
    assert payroll.non_contribution_days == 0
    assert payroll.irpf == Decimal("145.00")
    assert payroll.total_deductions == Decimal("238.97")
    assert payroll.net_salary == Decimal("1211.03")
    assert payroll.company_total_cost == Decimal("1915.02")
    assert payroll.status == "calculated"
    assert payroll.calculation_engine_version == "split-33-demo-incidents"


def test_update_demo_payroll_amounts_builds_absence_case_with_reduced_contribution_days():
    payroll = demo_payroll("Ana Pérez Navarro", "1510.00")
    case = DEMO_INCIDENT_PAYROLL_CASES["Ana Pérez Navarro"]

    update_demo_payroll_amounts(payroll, case)

    assert payroll.worked_base_salary == Decimal("1459.67")
    assert payroll.temporary_disability_benefit == Decimal("0.00")
    assert payroll.company_disability_complement == Decimal("0.00")
    assert payroll.gross_salary == Decimal("1499.67")
    assert payroll.contribution_days == 29
    assert payroll.worked_days == 29
    assert payroll.incident_days == 1
    assert payroll.non_contribution_days == 1
    assert payroll.total_deductions == Decimal("262.13")
    assert payroll.net_salary == Decimal("1237.54")
