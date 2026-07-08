from decimal import Decimal
from types import SimpleNamespace

from app.services.payroll_concept_engine import (
    build_concept_lines_from_payroll,
    build_payroll_concept_lines,
    summarize_concept_lines,
)


def test_payroll_concept_lines_explain_ordinary_month():
    result = {
        "base_salary": Decimal("1200.00"),
        "worked_base_salary": Decimal("1200.00"),
        "salary_supplements": Decimal("100.00"),
        "seniority_amount": Decimal("50.00"),
        "variable_incentives": Decimal("75.00"),
        "extra_pay_proration": Decimal("200.00"),
        "employee_common_contingencies": Decimal("76.38"),
        "employee_unemployment": Decimal("25.19"),
        "employee_training": Decimal("1.63"),
        "employee_mei": Decimal("2.11"),
        "irpf": Decimal("162.50"),
        "common_contingencies_base": Decimal("1625.00"),
        "professional_contingencies_base": Decimal("1625.00"),
        "unemployment_training_fogasa_base": Decimal("1625.00"),
        "irpf_base": Decimal("1625.00"),
        "company_common_contingencies": Decimal("383.50"),
        "company_unemployment": Decimal("89.38"),
        "company_fogasa": Decimal("3.25"),
        "company_training": Decimal("9.75"),
        "company_at_ep": Decimal("24.38"),
        "company_mei": Decimal("10.89"),
        "company_total_cost": Decimal("2146.15"),
    }

    lines = build_payroll_concept_lines(result)
    totals = summarize_concept_lines(lines)
    codes = {line["code"] for line in lines}

    assert "SALARIO_BASE" in codes
    assert "COMPLEMENTOS_SALARIALES" in codes
    assert "ANTIGUEDAD" in codes
    assert "PRORRATA_PAGAS_EXTRA" in codes
    assert "IRPF" in codes
    assert "BASE_CC" in codes
    assert totals["total_devengos"] == Decimal("1625.00")
    assert totals["total_deducciones"] == Decimal("267.81")
    assert totals["neto_por_conceptos"] == Decimal("1357.19")


def test_payroll_concept_lines_use_worked_base_when_incidents_reduce_salary():
    result = {
        "base_salary": Decimal("1200.00"),
        "worked_base_salary": Decimal("800.00"),
        "temporary_disability_benefit": Decimal("240.00"),
        "company_disability_complement": Decimal("160.00"),
        "worked_days": 20,
        "incident_days": 10,
        "it_days": 10,
        "employee_common_contingencies": Decimal("56.40"),
        "irpf": Decimal("120.00"),
        "common_contingencies_base": Decimal("1200.00"),
        "professional_contingencies_base": Decimal("1200.00"),
        "unemployment_training_fogasa_base": Decimal("1200.00"),
        "irpf_base": Decimal("1200.00"),
        "company_total_cost": Decimal("1580.00"),
    }

    lines = build_payroll_concept_lines(result)
    totals = summarize_concept_lines(lines)
    base_line = next(line for line in lines if line["code"] == "SALARIO_BASE")
    it_line = next(line for line in lines if line["code"] == "PRESTACION_IT")

    assert base_line["amount"] == Decimal("800.00")
    assert base_line["trace"]["salary_reduction"] == Decimal("400.00")
    assert it_line["source_type"] == "INCIDENT"
    assert totals["total_devengos"] == Decimal("1200.00")


def test_build_concept_lines_from_payroll_object():
    payroll = SimpleNamespace(
        base_salary=Decimal("1000.00"),
        worked_base_salary=Decimal("1000.00"),
        salary_supplements=Decimal("0.00"),
        seniority_amount=Decimal("0.00"),
        variable_incentives=Decimal("0.00"),
        extra_pay_proration=Decimal("166.67"),
        employee_common_contingencies=Decimal("54.83"),
        employee_unemployment=Decimal("18.08"),
        employee_training=Decimal("1.17"),
        employee_mei=Decimal("1.52"),
        irpf=Decimal("58.33"),
        common_contingencies_base=Decimal("1166.67"),
        professional_contingencies_base=Decimal("1166.67"),
        unemployment_training_fogasa_base=Decimal("1166.67"),
        irpf_base=Decimal("1166.67"),
        company_total_cost=Decimal("1542.00"),
    )

    lines = build_concept_lines_from_payroll(payroll)
    totals = summarize_concept_lines(lines)

    assert totals["total_devengos"] == Decimal("1166.67")
    assert totals["total_deducciones"] == Decimal("133.93")
    assert totals["neto_por_conceptos"] == Decimal("1032.74")
