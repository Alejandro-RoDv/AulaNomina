from datetime import date
from decimal import Decimal

from app.services.payroll_days_calculator import (
    calculate_contract_active_days,
    calculate_payroll_days,
)
from app.services.payroll_engine import calculate_simulated_earning_lines


def test_full_february_remains_a_30_day_payroll_period():
    days = calculate_contract_active_days(
        date(2026, 2, 1),
        date(2026, 2, 28),
        contract_start_date=date(2025, 9, 1),
        contract_end_date=None,
    )

    assert days == 30


def test_contract_starting_on_january_8_has_23_simulated_days():
    days = calculate_contract_active_days(
        date(2026, 1, 1),
        date(2026, 1, 31),
        contract_start_date=date(2026, 1, 8),
        contract_end_date=None,
    )

    assert days == 23


def test_contract_ending_on_day_16_has_16_simulated_days():
    days = calculate_contract_active_days(
        date(2026, 10, 1),
        date(2026, 10, 31),
        contract_start_date=date(2025, 1, 1),
        contract_end_date=date(2026, 10, 16),
    )

    assert days == 16


def test_payroll_days_respect_contract_boundaries_without_incidents():
    result = calculate_payroll_days(
        incidents=[],
        period_start=date(2026, 1, 1),
        period_end=date(2026, 1, 31),
        contract_start_date=date(2026, 1, 8),
        contract_end_date=None,
    )

    assert result["period_days"] == 30
    assert result["active_days"] == 23
    assert result["inactive_contract_days"] == 7
    assert result["worked_days"] == 23
    assert result["contribution_days"] == 23
    assert result["active_day_ratio"] == Decimal("23") / Decimal("30")


def test_earning_lines_reduce_monthly_salary_for_inactive_contract_days():
    day_result = {
        "inactive_contract_days": 7,
        "non_contribution_days": 0,
        "incident_breakdown": [],
    }

    result = calculate_simulated_earning_lines(
        base_salary=Decimal("1450.00"),
        salary_supplements=Decimal("0.00"),
        variable_incentives=Decimal("0.00"),
        extra_pay_proration=Decimal("0.00"),
        day_result=day_result,
    )

    # El simulador monetiza primero el salario diario: 1.450 / 30 = 48,33 €.
    # Siete días inactivos reducen 338,31 €, por lo que quedan 1.111,69 €.
    assert result["worked_base_salary"] == Decimal("1111.69")
    assert result["gross_salary"] == Decimal("1111.69")
