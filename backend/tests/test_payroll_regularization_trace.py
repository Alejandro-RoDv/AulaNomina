from decimal import Decimal
from types import SimpleNamespace

from app.services.payroll_breakdown import is_regularization_item
from app.services.payroll_regularization_trace import (
    is_regularization_line,
    regularization_explanations_payload,
    regularization_summary_payload,
)


def regularization_line(**overrides):
    values = {
        "id": 1,
        "code": "REGULARIZACION_DEVENGO",
        "name": "Regularización de devengos",
        "amount": Decimal("150.00"),
        "concept_type": "DEVENGO",
        "category": "REGULARIZACION",
        "source_type": "regularization",
        "affects_gross": True,
        "affects_net": True,
        "taxable": True,
        "contribution_base": True,
        "trace": {
            "reason": "INCIDENCIA_TARDIA",
            "origin_payroll_id": 10,
            "actor": "regularization_panel",
        },
    }
    values.update(overrides)
    return values


def test_is_regularization_line_detects_code_category_source_and_trace():
    assert is_regularization_line(regularization_line()) is True
    assert is_regularization_line({"code": "REGULARIZACION_IRPF"}) is True
    assert is_regularization_line({"category": "REGULARIZACION"}) is True
    assert is_regularization_line({"source_type": "regularization"}) is True
    assert is_regularization_line({"trace": {"reason": "MANUAL"}}) is True
    assert is_regularization_line({"code": "SALARIO_BASE", "category": "BASE"}) is False


def test_regularization_summary_aggregates_gross_deductions_net_and_company_cost():
    lines = [
        regularization_line(amount=Decimal("150.00")),
        regularization_line(
            id=2,
            code="REGULARIZACION_DEDUCCION",
            name="Regularización de deducciones",
            amount=Decimal("9.53"),
            concept_type="DEDUCCION",
            affects_gross=False,
            affects_net=True,
        ),
        regularization_line(
            id=3,
            code="REGULARIZACION_IRPF",
            name="Regularización de IRPF",
            amount=Decimal("15.00"),
            concept_type="DEDUCCION",
            affects_gross=False,
            affects_net=True,
        ),
        regularization_line(
            id=4,
            code="REGULARIZACION_COSTE_EMPRESA",
            name="Regularización coste empresa",
            amount=Decimal("47.85"),
            concept_type="BASE_INFORMATIVA",
            affects_gross=False,
            affects_net=False,
        ),
    ]

    summary = regularization_summary_payload(lines)

    assert summary["has_regularizations"] is True
    assert summary["regularization_count"] == 4
    assert summary["gross_delta"] == Decimal("150.00")
    assert summary["deduction_delta"] == Decimal("24.53")
    assert summary["net_delta"] == Decimal("125.47")
    assert summary["company_cost_delta"] == Decimal("47.85")
    assert summary["reasons"] == ["INCIDENCIA_TARDIA"]
    assert summary["origin_payroll_ids"] == [10]
    assert "no contiene" not in summary["explanation"]


def test_regularization_summary_for_ordinary_lines_is_empty():
    summary = regularization_summary_payload([
        {"code": "SALARIO_BASE", "amount": Decimal("1200.00"), "concept_type": "DEVENGO", "affects_gross": True}
    ])

    assert summary["has_regularizations"] is False
    assert summary["regularization_count"] == 0
    assert summary["net_delta"] == Decimal("0.00")


def test_regularization_explanations_keep_reason_and_origin_visible():
    explanations = regularization_explanations_payload([regularization_line()])

    assert len(explanations) == 1
    assert explanations[0]["reason"] == "INCIDENCIA_TARDIA"
    assert explanations[0]["origin_payroll_id"] == 10
    assert "No reabre la nómina histórica" in explanations[0]["explanation"]
    assert any("regularización" in point.lower() for point in explanations[0]["learning_points"])


def test_breakdown_regularization_detection_supports_new_prefix_and_source_key():
    concept = SimpleNamespace(code="REGULARIZACION_DEVENGO", category="REGULARIZACION")
    item = SimpleNamespace(payroll_id=25, source_type="manual", source_key=None)
    assert is_regularization_item(item, concept) is True

    concept = SimpleNamespace(code="SALARIO_BASE", category="BASE")
    item = SimpleNamespace(payroll_id=25, source_type="manual", source_key="REGULARIZACION:25:1:1:REGULARIZACION_DEVENGO")
    assert is_regularization_item(item, concept) is True

    concept = SimpleNamespace(code="SALARIO_BASE", category="BASE")
    item = SimpleNamespace(payroll_id=25, source_type="manual", source_key=None)
    assert is_regularization_item(item, concept) is False
