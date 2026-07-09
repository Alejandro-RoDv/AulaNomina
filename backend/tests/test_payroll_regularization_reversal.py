from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.payroll_regularization import PayrollRegularizationReversalRequest
from app.services.payroll_regularization_reversal import (
    build_reversal_request_from_items,
    compute_item_group_deltas,
    is_reversal_item,
    item_trace,
    parse_regularization_source_key,
    validate_group_key_for_payroll,
)


def concept(**overrides):
    values = {
        "code": "REGULARIZACION_DEVENGO_COTIZA_TRIBUTA",
        "concept_type": "DEVENGO",
        "affects_gross": True,
        "affects_net": True,
        "is_taxable": True,
        "is_contribution_base": True,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def item(**overrides):
    values = {
        "id": 1,
        "payroll_id": 25,
        "source_key": "REGULARIZACION:25:1:1:REGULARIZACION_DEVENGO_COTIZA_TRIBUTA",
        "source_type": "regularization",
        "source_id": 10,
        "description": "Regularización original",
        "amount": Decimal("150.00"),
        "calculation_trace": {
            "reason": "INCIDENCIA_TARDIA",
            "origin_payroll_id": 10,
            "taxable": True,
            "contribution_base": True,
        },
        "concept": concept(),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def source_items():
    return [
        item(),
        item(
            id=2,
            source_key="REGULARIZACION:25:1:2:REGULARIZACION_DEDUCCION",
            amount=Decimal("9.53"),
            concept=concept(
                code="REGULARIZACION_DEDUCCION",
                concept_type="DEDUCCION",
                affects_gross=False,
                affects_net=True,
                is_taxable=False,
                is_contribution_base=False,
            ),
        ),
        item(
            id=3,
            source_key="REGULARIZACION:25:1:3:REGULARIZACION_IRPF",
            amount=Decimal("15.00"),
            concept=concept(
                code="REGULARIZACION_IRPF",
                concept_type="DEDUCCION",
                affects_gross=False,
                affects_net=True,
                is_taxable=False,
                is_contribution_base=False,
            ),
        ),
        item(
            id=4,
            source_key="REGULARIZACION:25:1:4:REGULARIZACION_COSTE_EMPRESA",
            amount=Decimal("47.85"),
            concept=concept(
                code="REGULARIZACION_COSTE_EMPRESA",
                concept_type="BASE_INFORMATIVA",
                affects_gross=False,
                affects_net=False,
                is_taxable=False,
                is_contribution_base=False,
            ),
        ),
    ]


def test_parse_regularization_source_key_extracts_group_parts():
    parsed = parse_regularization_source_key("REGULARIZACION:25:3:2:REGULARIZACION_IRPF")

    assert parsed == {
        "payroll_id": 25,
        "sequence": 3,
        "line_index": 2,
        "concept_code": "REGULARIZACION_IRPF",
        "group_key": "REGULARIZACION:25:3",
    }


def test_parse_regularization_source_key_rejects_invalid_values():
    assert parse_regularization_source_key(None) is None
    assert parse_regularization_source_key("ENGINE:25:1") is None
    assert parse_regularization_source_key("REGULARIZACION:x:1:1:CODIGO") is None


def test_validate_group_key_requires_same_payroll():
    assert validate_group_key_for_payroll(25, "REGULARIZACION:25:1") == "REGULARIZACION:25:1"

    with pytest.raises(HTTPException):
        validate_group_key_for_payroll(26, "REGULARIZACION:25:1")
    with pytest.raises(HTTPException):
        validate_group_key_for_payroll(25, "REGULARIZACION:25")


def test_item_trace_accepts_dict_json_string_and_invalid_text():
    assert item_trace(item(calculation_trace={"reason": "MANUAL"})) == {"reason": "MANUAL"}
    assert item_trace(item(calculation_trace='{"reason": "MANUAL", "origin_payroll_id": 10}')) == {"reason": "MANUAL", "origin_payroll_id": 10}
    assert item_trace(item(calculation_trace="texto no json")) == {}
    assert item_trace(item(calculation_trace=None)) == {}


def test_compute_item_group_deltas_separates_gross_deductions_and_company_cost():
    deltas = compute_item_group_deltas(source_items())

    assert deltas["gross_delta"] == Decimal("150.00")
    assert deltas["deduction_delta"] == Decimal("24.53")
    assert deltas["net_delta"] == Decimal("125.47")
    assert deltas["company_cost_delta"] == Decimal("47.85")
    assert deltas["contribution_base_delta"] == Decimal("150.00")
    assert deltas["irpf_base_delta"] == Decimal("150.00")


def test_compute_item_group_deltas_prefers_trace_flags_over_mutable_concept_flags():
    source = item(
        calculation_trace={
            "reason": "MANUAL",
            "taxable": False,
            "contribution_base": False,
        },
        concept=concept(is_taxable=True, is_contribution_base=True),
    )

    deltas = compute_item_group_deltas([source])

    assert deltas["gross_delta"] == Decimal("150.00")
    assert deltas["contribution_base_delta"] == Decimal("0.00")
    assert deltas["irpf_base_delta"] == Decimal("0.00")


def test_build_reversal_request_uses_inverse_amounts_without_deleting_source_lines():
    request = PayrollRegularizationReversalRequest(
        regularization_group_key="REGULARIZACION:25:1",
        description="Anular regularización aplicada por error",
    )

    reversal = build_reversal_request_from_items(25, "REGULARIZACION:25:1", source_items(), request)

    assert reversal.reason == "REVERSION"
    assert reversal.description == "Anular regularización aplicada por error"
    assert reversal.origin_payroll_id == 25
    assert reversal.gross_delta == Decimal("-150.00")
    assert reversal.employee_deduction_delta == Decimal("-9.53")
    assert reversal.irpf_delta == Decimal("-15.00")
    assert reversal.company_cost_delta == Decimal("-47.85")
    assert reversal.contribution_base_delta == Decimal("-150.00")
    assert reversal.irpf_base_delta == Decimal("-150.00")
    assert reversal.taxable is True
    assert reversal.contribution_base is True


def test_build_reversal_request_respects_original_line_trace_flags():
    request = PayrollRegularizationReversalRequest(
        regularization_group_key="REGULARIZACION:25:1",
        description="Anular regularización no cotizable/no tributable",
    )
    source = item(
        source_key="REGULARIZACION:25:1:1:REGULARIZACION_DEVENGO_NO_COTIZA_NO_TRIBUTA",
        calculation_trace='{"reason": "MANUAL", "taxable": false, "contribution_base": false}',
        concept=concept(
            code="REGULARIZACION_DEVENGO_NO_COTIZA_NO_TRIBUTA",
            is_taxable=True,
            is_contribution_base=True,
        ),
    )

    reversal = build_reversal_request_from_items(25, "REGULARIZACION:25:1", [source], request)

    assert reversal.gross_delta == Decimal("-150.00")
    assert reversal.contribution_base_delta == Decimal("0.00")
    assert reversal.irpf_base_delta == Decimal("0.00")
    assert reversal.taxable is False
    assert reversal.contribution_base is False


def test_is_reversal_item_detects_trace_and_reason():
    assert is_reversal_item(item(calculation_trace={"reversal_of": "REGULARIZACION:25:1"})) is True
    assert is_reversal_item(item(calculation_trace='{"reversal_of": "REGULARIZACION:25:1"}')) is True
    assert is_reversal_item(item(calculation_trace={"is_reversal": True})) is True
    assert is_reversal_item(item(calculation_trace={"reason": "REVERSION"})) is True
    assert is_reversal_item(item()) is False
