from decimal import Decimal

import pytest

from app.services.wage_garnishment_calculator import calculate_wage_garnishment


def test_backend_calculator_matches_progressive_example():
    result = calculate_wage_garnishment(
        monthly_net=Decimal("2400"),
        smi_annual=Decimal("16576"),
    )
    assert result["smiMensual"] == 1184.0
    assert result["totalEmbargable"] == 371.2


def test_backend_calculator_supports_prorated_extra_pay():
    result = calculate_wage_garnishment(
        monthly_net=Decimal("4000"),
        smi_annual=Decimal("17094"),
        extra_pay_prorated=True,
    )
    assert result["minimoInembargable"] == 1424.5
    assert result["unidadTramo"] == 1221.0
    assert result["totalEmbargable"] == 1056.9


def test_backend_calculator_applies_authorized_reduction_to_first_four_percentages():
    result = calculate_wage_garnishment(
        monthly_net=Decimal("6000"),
        smi_annual=Decimal("14000"),
        reduction_percentage=Decimal("10"),
    )
    assert [row["porcentajeAplicado"] for row in result["tramos"]] == [0.0, 20.0, 40.0, 50.0, 65.0, 90.0]
    assert result["totalEmbargable"] == 2650.0


def test_backend_calculator_rejects_incompatible_options():
    with pytest.raises(ValueError):
        calculate_wage_garnishment(
            monthly_net=Decimal("2000"),
            smi_annual=Decimal("17094"),
            extra_pay_prorated=True,
            includes_full_extra_pay=True,
            extra_pay_amount=Decimal("1200"),
        )
