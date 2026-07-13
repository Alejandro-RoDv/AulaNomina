import json
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.schemas.social_security_settlement import (
    SocialSecuritySettlementPrepareRequest,
    SocialSecuritySettlementStatus,
)
from app.services.social_security_settlement_application import recalculate_settlement_totals
from app.services.social_security_settlement_service import (
    SocialSecuritySettlementDomainError,
    build_line_values,
    build_simulated_settlement_content,
    confirm_social_security_settlement,
    resolve_payroll_ccc,
)


def payroll_stub(**overrides):
    values = {
        "id": 10,
        "employee_id": 2,
        "contract_id": 3,
        "center_id": 4,
        "employee_common_contingencies": Decimal("47.00"),
        "employee_unemployment": Decimal("15.50"),
        "employee_training": Decimal("1.00"),
        "employee_mei": Decimal("1.30"),
        "company_common_contingencies": Decimal("236.00"),
        "company_unemployment": Decimal("55.00"),
        "company_fogasa": Decimal("2.00"),
        "company_training": Decimal("6.00"),
        "company_at_ep": Decimal("15.00"),
        "company_mei": Decimal("6.70"),
        "company_total_social_security": Decimal("320.70"),
        "common_contingencies_base": Decimal("1000.00"),
        "professional_contingencies_base": Decimal("1100.00"),
        "unemployment_training_fogasa_base": Decimal("1100.00"),
        "items": [],
        "work_center": None,
        "company": SimpleNamespace(ccc="01/1234567-89"),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def item(code: str, amount: str):
    return SimpleNamespace(
        amount=Decimal(amount),
        description=None,
        concept=SimpleNamespace(code=code, category="OTRO"),
    )


def test_prepare_request_normalizes_ccc():
    payload = SocialSecuritySettlementPrepareRequest(
        company_id=1,
        ccc_id=" 01 / 1234567-89 ",
        period_year=2026,
        period_month=8,
    )
    assert payload.ccc_id == "01123456789"


def test_resolve_payroll_ccc_prefers_center_over_company():
    payroll = payroll_stub(
        work_center=SimpleNamespace(main_ccc="02-9999999-88", general_ccc="02-1111111-77"),
    )
    assert resolve_payroll_ccc(payroll) == "02999999988"

    payroll.work_center = SimpleNamespace(main_ccc=None, general_ccc="02-1111111-77")
    assert resolve_payroll_ccc(payroll) == "02111111177"

    payroll.work_center = None
    assert resolve_payroll_ccc(payroll) == "01123456789"


def test_build_line_values_includes_overtime_bonuses_and_reductions():
    payroll = payroll_stub(
        items=[
            item("HORAS_EXTRA", "100.00"),
            item("BONIFICACION_SS", "20.00"),
            item("REDUCCION_COTIZACION", "10.00"),
        ]
    )

    values = build_line_values(payroll)

    assert values["overtime_base"] == Decimal("100.00")
    assert values["employee_total"] == Decimal("64.80")
    assert values["company_total"] == Decimal("320.70")
    assert values["bonuses"] == Decimal("20.00")
    assert values["reductions"] == Decimal("10.00")
    assert values["total_due"] == Decimal("355.50")


def test_recalculate_totals_uses_persisted_lines_once():
    line_a = SimpleNamespace(
        contribution_days=30,
        **{field: Decimal("1.00") for field in (
            "common_contingencies_base",
            "professional_contingencies_base",
            "unemployment_training_fogasa_base",
            "overtime_base",
            "employee_common_contingencies",
            "employee_unemployment",
            "employee_training",
            "employee_mei",
            "employee_total",
            "company_common_contingencies",
            "company_unemployment",
            "company_fogasa",
            "company_training",
            "company_at_ep",
            "company_mei",
            "company_total",
            "bonuses",
            "reductions",
            "total_due",
        )},
    )
    line_b = SimpleNamespace(**line_a.__dict__)
    settlement = SimpleNamespace(lines=[line_a, line_b])

    recalculate_settlement_totals(settlement)

    assert settlement.worker_count == 2
    assert settlement.contribution_days == 60
    assert settlement.total_due == Decimal("2.00")


def test_confirm_rejects_blocking_line_errors():
    settlement = SimpleNamespace(
        status=SocialSecuritySettlementStatus.READY.value,
        validation_errors="[]",
        lines=[SimpleNamespace(validation_errors=json.dumps([
            {"severity": "ERROR", "code": "NAF_REQUIRED"}
        ]))],
    )

    with pytest.raises(SocialSecuritySettlementDomainError):
        confirm_social_security_settlement(SimpleNamespace(), settlement)


def test_simulated_file_contains_period_workers_and_totals():
    line = SimpleNamespace(
        payroll_id=10,
        employee_id=2,
        employee_code="0002",
        employee_name="Ana Ejemplo",
        document="00000000T",
        naf="281234567890",
        contribution_group="07",
        contribution_days=30,
        common_contingencies_base=Decimal("1000.00"),
        professional_contingencies_base=Decimal("1100.00"),
        unemployment_training_fogasa_base=Decimal("1100.00"),
        overtime_base=Decimal("100.00"),
        employee_total=Decimal("64.80"),
        company_total=Decimal("320.70"),
        bonuses=Decimal("20.00"),
        reductions=Decimal("10.00"),
        total_due=Decimal("355.50"),
    )
    settlement = SimpleNamespace(
        id=5,
        company_id=1,
        ccc_id="01123456789",
        period_year=2026,
        period_month=8,
        worker_count=1,
        contribution_days=30,
        common_contingencies_base=Decimal("1000.00"),
        professional_contingencies_base=Decimal("1100.00"),
        unemployment_training_fogasa_base=Decimal("1100.00"),
        overtime_base=Decimal("100.00"),
        employee_total=Decimal("64.80"),
        company_total=Decimal("320.70"),
        bonuses=Decimal("20.00"),
        reductions=Decimal("10.00"),
        total_due=Decimal("355.50"),
        lines=[line],
    )

    payload = json.loads(build_simulated_settlement_content(settlement))

    assert payload["period"] == "2026-08"
    assert payload["totals"]["total_due"] == "355.50"
    assert payload["workers"][0]["naf"] == "281234567890"
