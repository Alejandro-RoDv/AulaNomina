from datetime import date
from decimal import Decimal

import pytest

from app.services.model111_calculator import (
    build_reconciliation,
    classify_result,
    period_bounds,
    period_contains_month,
    summarize_lines,
)


def test_quarter_bounds_and_month_membership():
    start, end, period_type = period_bounds(2026, "2T")

    assert start == date(2026, 4, 1)
    assert end == date(2026, 6, 30)
    assert period_type == "quarterly"
    assert period_contains_month("2T", 5) is True
    assert period_contains_month("2T", 7) is False


def test_monthly_period_is_supported_for_future_use():
    start, end, period_type = period_bounds(2026, "02")

    assert start == date(2026, 2, 1)
    assert end == date(2026, 2, 28)
    assert period_type == "monthly"


def test_no_activity_and_negative_declaration_are_different():
    assert classify_result(False, Decimal("0.00")) == "no_activity"
    assert classify_result(True, Decimal("0.00")) == "negative"


def test_summary_counts_unique_recipients_and_calculates_boxes():
    lines = [
        {
            "category": "work",
            "recipient_key": "employee:1",
            "base_amount": Decimal("1000.00"),
            "withholding_amount": Decimal("100.00"),
        },
        {
            "category": "work",
            "recipient_key": "employee:1",
            "base_amount": Decimal("1100.00"),
            "withholding_amount": Decimal("110.00"),
        },
        {
            "category": "economic_activity",
            "recipient_key": "professional:4",
            "base_amount": Decimal("800.00"),
            "withholding_amount": Decimal("120.00"),
        },
    ]

    summary = summarize_lines(lines)

    assert summary["work"]["perceptors"] == 1
    assert summary["work"]["base"] == Decimal("2100.00")
    assert summary["professionals"]["perceptors"] == 1
    assert summary["total_withholding"] == Decimal("330.00")
    assert summary["result_type"] == "payable"


def test_complementary_result_subtracts_previous_presentations():
    lines = [
        {
            "category": "work",
            "recipient_key": "employee:1",
            "base_amount": Decimal("3000.00"),
            "withholding_amount": Decimal("450.00"),
        }
    ]

    summary = summarize_lines(lines, previous_result=Decimal("400.00"))

    assert summary["previous_result"] == Decimal("400.00")
    assert summary["result_amount"] == Decimal("50.00")


def test_reconciliation_groups_sources():
    lines = [
        {
            "category": "work",
            "recipient_key": "employee:1",
            "base_amount": 1000,
            "withholding_amount": 100,
            "reconciliation_key": "payroll:04",
            "reconciliation_label": "Nóminas abril",
            "reconciliation_order": 4,
        },
        {
            "category": "work",
            "recipient_key": "employee:2",
            "base_amount": 1200,
            "withholding_amount": 120,
            "reconciliation_key": "payroll:04",
            "reconciliation_label": "Nóminas abril",
            "reconciliation_order": 4,
        },
    ]

    result = build_reconciliation(lines)

    assert result == [
        {
            "key": "payroll:04",
            "label": "Nóminas abril",
            "perceptors": 2,
            "base": Decimal("2200.00"),
            "withholding": Decimal("220.00"),
            "source_count": 2,
        }
    ]


def test_invalid_period_is_rejected():
    with pytest.raises(ValueError):
        period_bounds(2026, "5T")
