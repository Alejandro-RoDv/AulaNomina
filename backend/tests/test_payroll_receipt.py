from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.services.payroll_receipt import (
    build_incident_explanations,
    incident_summary_payload,
    split_lines,
    totals_payload,
)


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


def test_build_incident_explanations_creates_didactic_segment_payload():
    segment = SimpleNamespace(
        id=7,
        incident_id=3,
        segment_type="IT",
        start_date=date(2026, 5, 10),
        end_date=date(2026, 5, 18),
        calendar_days=9,
        payroll_days=Decimal("9.00"),
        salary_amount=Decimal("120.00"),
        benefit_amount=Decimal("180.00"),
        complement_amount=Decimal("60.00"),
        deduction_amount=Decimal("30.00"),
        contribution_treatment="CONTRIBUTION",
    )
    payroll = SimpleNamespace(segments=[segment], incident_days=9, it_days=9, non_contribution_days=0)
    lines = [
        line("SALARIO_BASE", "800.00"),
        line("PRESTACION_IT", "180.00", category="IT"),
        line("COMPLEMENTO_EMPRESA_IT", "60.00", category="IT"),
    ]

    explanations = build_incident_explanations(payroll, lines)

    assert len(explanations) == 1
    explanation = explanations[0]
    assert explanation["title"] == "Incapacidad temporal"
    assert explanation["period"] == "10/05/2026 - 18/05/2026"
    assert explanation["net_effect"] == Decimal("330.00")
    assert "Se incorpora prestación" in explanation["explanation"]
    assert "Mantiene cotización" in explanation["learning_points"][-1]
    assert [item["code"] for item in explanation["affected_concepts"]] == ["PRESTACION_IT", "COMPLEMENTO_EMPRESA_IT"]


def test_incident_summary_payload_aggregates_explanations():
    payroll = SimpleNamespace(incident_days=9, it_days=9, non_contribution_days=0)
    explanations = [
        {
            "benefit_amount": Decimal("180.00"),
            "complement_amount": Decimal("60.00"),
            "deduction_amount": Decimal("30.00"),
            "net_effect": Decimal("330.00"),
        }
    ]

    summary = incident_summary_payload(payroll, explanations)

    assert summary["has_incidents"] is True
    assert summary["incident_days"] == 9
    assert summary["total_benefits"] == Decimal("180.00")
    assert summary["total_company_complements"] == Decimal("60.00")
    assert summary["total_absence_deductions"] == Decimal("30.00")
    assert summary["total_net_incident_effect"] == Decimal("330.00")
    assert "El recibo separa salario" in summary["explanation"]
