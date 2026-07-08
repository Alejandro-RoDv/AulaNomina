from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.services.payroll_receipt import split_lines, totals_payload


def line(code, amount, concept_type="DEVENGO", category="OTRO", affects_gross=True, affects_net=True):
    return {
        "code": code,
        "name": code,
        "amount": Decimal(amount),
        "concept_type": concept_type,
        "salary_nature": "SALARIAL" if concept_type == "DEVENGO" else "INFORMATIVA",
        "category": category,
        "source_type": "system",
        "display_order": 1,
        "taxable": concept_type == "DEVENGO",
        "contribution_base": concept_type == "DEVENGO",
        "affects_gross": affects_gross,
        "affects_net": affects_net,
    }


def test_split_lines_groups_receipt_sections():
    lines = [
        line("SALARIO_BASE", "1200.00"),
        line("IRPF", "120.00", concept_type="DEDUCCION", affects_gross=False),
        line("BASE_CC", "1200.00", concept_type="BASE_INFORMATIVA", category="BASE_INFORMATIVA", affects_gross=False, affects_net=False),
        line("COSTE_EMPRESA_TOTAL", "1580.00", concept_type="BASE_INFORMATIVA", category="COSTE_EMPRESA", affects_gross=False, affects_net=False),
        line("TRAZA", "0.00", concept_type="INFORMATIVO", category="INFORMATIVO", affects_gross=False, affects_net=False),
    ]

    earnings, deductions, base_lines, company_cost_lines, informative_lines = split_lines(lines)

    assert [item["code"] for item in earnings] == ["SALARIO_BASE"]
    assert [item["code"] for item in deductions] == ["IRPF"]
    assert [item["code"] for item in base_lines] == ["BASE_CC"]
    assert [item["code"] for item in company_cost_lines] == ["COSTE_EMPRESA_TOTAL"]
    assert [item["code"] for item in informative_lines] == ["TRAZA"]


def test_totals_payload_keeps_aggregate_and_concept_totals_visible():
    payroll = SimpleNamespace(
        gross_salary=Decimal("1200.00"),
        total_deductions=Decimal("180.00"),
        net_salary=Decimal("1020.00"),
        company_total_cost=Decimal("1580.00"),
    )
    lines = [
        line("SALARIO_BASE", "1200.00"),
        line("SS", "60.00", concept_type="DEDUCCION", affects_gross=False),
        line("IRPF", "120.00", concept_type="DEDUCCION", affects_gross=False),
    ]

    totals = totals_payload(payroll, lines)

    assert totals["total_earnings"] == Decimal("1200.00")
    assert totals["total_deductions"] == Decimal("180.00")
    assert totals["net_salary"] == Decimal("1020.00")
    assert totals["concept_earnings"] == Decimal("1200.00")
    assert totals["concept_deductions"] == Decimal("180.00")
    assert totals["concept_net_salary"] == Decimal("1020.00")
