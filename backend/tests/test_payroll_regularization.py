from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.payroll_regularization import PayrollRegularizationRequest
from app.services.payroll_regularization import (
    apply_payroll_amount_deltas,
    build_regularization_lines,
    build_regularization_preview,
    validate_target_payroll,
)


def regularization_request(**overrides):
    values = {
        "reason": "INCIDENCIA_TARDIA",
        "description": "Regularización por IT comunicada fuera de plazo",
        "origin_payroll_id": 10,
        "gross_delta": Decimal("150.00"),
        "employee_deduction_delta": Decimal("9.53"),
        "irpf_delta": Decimal("15.00"),
        "company_cost_delta": Decimal("47.85"),
        "taxable": True,
        "contribution_base": True,
    }
    values.update(overrides)
    return PayrollRegularizationRequest(**values)


def test_regularization_request_normalizes_reason():
    request = PayrollRegularizationRequest(
        reason=" incidencia_tardia ",
        description="Ajuste",
    )

    assert request.reason == "INCIDENCIA_TARDIA"


def test_regularization_preview_calculates_core_deltas():
    request = regularization_request()

    preview = build_regularization_preview(20, request)

    assert preview["target_payroll_id"] == 20
    assert preview["origin_payroll_id"] == 10
    assert preview["gross_delta"] == Decimal("150.00")
    assert preview["total_deduction_delta"] == Decimal("24.53")
    assert preview["contribution_base_delta"] == Decimal("150.00")
    assert preview["irpf_base_delta"] == Decimal("150.00")
    assert preview["company_social_security_delta"] == Decimal("47.85")
    assert preview["company_total_cost_delta"] == Decimal("197.85")
    assert preview["net_delta"] == Decimal("125.47")
    assert "no se reabre" in preview["explanation"]


def test_regularization_preview_respects_non_taxable_and_non_contribution_flags():
    request = regularization_request(taxable=False, contribution_base=False)

    preview = build_regularization_preview(20, request)

    assert preview["contribution_base_delta"] == Decimal("0.00")
    assert preview["irpf_base_delta"] == Decimal("0.00")


def test_regularization_preview_allows_explicit_base_overrides():
    request = regularization_request(
        contribution_base_delta=Decimal("80.00"),
        irpf_base_delta=Decimal("70.00"),
    )

    preview = build_regularization_preview(20, request)

    assert preview["contribution_base_delta"] == Decimal("80.00")
    assert preview["irpf_base_delta"] == Decimal("70.00")


def test_regularization_lines_include_traceable_concepts():
    request = regularization_request()

    lines = build_regularization_lines(request)

    assert [line["code"] for line in lines] == [
        "REGULARIZACION_DEVENGO",
        "REGULARIZACION_DEDUCCION",
        "REGULARIZACION_IRPF",
        "REGULARIZACION_COSTE_EMPRESA",
    ]
    assert lines[0]["affects_gross"] is True
    assert lines[0]["taxable"] is True
    assert lines[1]["concept_type"] == "DEDUCCION"
    assert lines[3]["affects_net"] is False


def test_regularization_preview_warns_when_target_and_origin_match():
    request = regularization_request(origin_payroll_id=20)

    preview = build_regularization_preview(20, request)

    assert any("coincide" in warning for warning in preview["warnings"])


def test_regularization_preview_warns_for_negative_deductions():
    request = regularization_request(employee_deduction_delta=Decimal("-20.00"), irpf_delta=Decimal("0.00"))

    preview = build_regularization_preview(20, request)

    assert preview["total_deduction_delta"] == Decimal("-20.00")
    assert preview["net_delta"] == Decimal("170.00")
    assert any("devolución" in warning for warning in preview["warnings"])


def test_apply_payroll_amount_deltas_updates_target_payroll_totals():
    payroll = SimpleNamespace(
        gross_salary=Decimal("1450.00"),
        common_contingencies_base=Decimal("1450.00"),
        professional_contingencies_base=Decimal("1450.00"),
        unemployment_training_fogasa_base=Decimal("1450.00"),
        irpf_base=Decimal("1450.00"),
        employee_social_security=Decimal("93.97"),
        irpf=Decimal("145.00"),
        total_deductions=Decimal("238.97"),
        net_salary=Decimal("1211.03"),
        company_total_social_security=Decimal("465.02"),
        company_total_cost=Decimal("1915.02"),
        calculation_version=2,
        calculation_engine_version="previous",
    )
    preview = build_regularization_preview(20, regularization_request())

    apply_payroll_amount_deltas(payroll, preview)

    assert payroll.gross_salary == Decimal("1600.00")
    assert payroll.common_contingencies_base == Decimal("1600.00")
    assert payroll.irpf_base == Decimal("1600.00")
    assert payroll.employee_social_security == Decimal("103.50")
    assert payroll.irpf == Decimal("160.00")
    assert payroll.total_deductions == Decimal("263.50")
    assert payroll.net_salary == Decimal("1336.50")
    assert payroll.company_total_social_security == Decimal("512.87")
    assert payroll.company_total_cost == Decimal("2112.87")
    assert payroll.calculation_version == 3
    assert payroll.calculation_engine_version == "split-34-regularization"


def test_validate_target_payroll_blocks_closed_and_cancelled_statuses():
    with pytest.raises(HTTPException):
        validate_target_payroll(SimpleNamespace(status="closed"))
    with pytest.raises(HTTPException):
        validate_target_payroll(SimpleNamespace(status="cancelled"))

    validate_target_payroll(SimpleNamespace(status="calculated"))
