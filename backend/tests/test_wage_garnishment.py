from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models import WageGarnishment
from app.schemas.wage_garnishment import WageGarnishmentCreate


def valid_payload(**overrides):
    payload = {
        "employee_id": 1,
        "contract_id": 1,
        "company_id": 1,
        "reference": "ETJ 123/2026",
        "issuing_body": "Juzgado de Primera Instancia",
        "status": "active",
        "priority": 1,
        "start_date": date(2026, 7, 1),
        "total_debt": Decimal("5000.00"),
        "withheld_to_date": Decimal("300.00"),
        "monthly_net": Decimal("2400.00"),
        "smi_annual": Decimal("17094.00"),
        "reduction_percentage": Decimal("0.00"),
        "monthly_garnishable": Decimal("353.70"),
        "calculation_snapshot": {"totalEmbargable": 353.70, "tramos": []},
    }
    payload.update(overrides)
    return payload


def test_wage_garnishment_create_accepts_valid_payload():
    garnishment = WageGarnishmentCreate(**valid_payload())
    assert garnishment.monthly_garnishable == Decimal("353.70")
    assert garnishment.status == "active"
    assert garnishment.priority == 1


def test_new_schema_defaults_to_draft():
    payload = valid_payload()
    payload.pop("status")
    garnishment = WageGarnishmentCreate(**payload)
    assert garnishment.status == "draft"


def test_wage_garnishment_rejects_invalid_dates():
    with pytest.raises(ValidationError):
        WageGarnishmentCreate(**valid_payload(end_date=date(2026, 6, 30)))


def test_wage_garnishment_rejects_incompatible_extra_pay_options():
    with pytest.raises(ValidationError):
        WageGarnishmentCreate(**valid_payload(extra_pay_prorated=True, includes_full_extra_pay=True))


def test_wage_garnishment_rejects_withheld_amount_above_debt():
    with pytest.raises(ValidationError):
        WageGarnishmentCreate(**valid_payload(total_debt=Decimal("100.00"), withheld_to_date=Decimal("101.00")))


def test_reduction_requires_authorization_and_reference():
    with pytest.raises(ValidationError):
        WageGarnishmentCreate(**valid_payload(reduction_percentage=Decimal("10")))

    with pytest.raises(ValidationError):
        WageGarnishmentCreate(**valid_payload(
            reduction_percentage=Decimal("10"),
            reduction_authorized=True,
        ))

    garnishment = WageGarnishmentCreate(**valid_payload(
        reduction_percentage=Decimal("10"),
        reduction_authorized=True,
        reduction_authorization_reference="Providencia 25/2026",
        reduction_authorization_date=date(2026, 6, 20),
    ))
    assert garnishment.reduction_percentage == Decimal("10")


def test_remaining_debt_never_returns_negative_amount():
    record = WageGarnishment(total_debt=Decimal("100.00"), withheld_to_date=Decimal("120.00"))
    assert record.remaining_debt == Decimal("0.00")
