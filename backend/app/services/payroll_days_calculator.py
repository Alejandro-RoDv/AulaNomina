from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Iterable, Any

from app.services.incident_payroll_rules import resolve_incident_rule

STANDARD_MONTH_DAYS = 30


def clamp_day_count(value: int) -> int:
    return max(0, min(STANDARD_MONTH_DAYS, value))


def calculate_overlap_days(
    start_date: date,
    end_date: date | None,
    period_start: date,
    period_end: date,
) -> int:
    """Calculate natural days of overlap between an incident and a period.

    The result is inclusive on both boundaries because labour incidents are
    usually registered by full start/end dates.
    """

    effective_start = max(start_date, period_start)
    effective_end = min(end_date or period_end, period_end)

    if effective_start > effective_end:
        return 0

    return (effective_end - effective_start).days + 1


def normalize_period_days(period_start: date, period_end: date) -> int:
    """Return the simulated payroll days for a monthly period.

    Monthly payroll in this MVP is normalized to 30 days. Extra-pay or invalid
    periods can later override this at the payroll engine layer.
    """

    if period_start > period_end:
        return 0
    return STANDARD_MONTH_DAYS


def calculate_payroll_days(
    incidents: Iterable[Any],
    period_start: date,
    period_end: date,
) -> dict:
    """Calculate simulated payroll day data for a monthly payroll period.

    MVP interpretation:
    - Monthly payroll periods use 30 standard days.
    - IT and relapse reduce worked days but not contribution days.
    - Vacations and paid leave are informative for payroll contribution.
    - Unpaid absences reduce salary-relevant and contribution days.
    - Overlapping incidents are capped so totals never exceed 30 days.
    """

    period_days = normalize_period_days(period_start, period_end)
    incident_breakdown = []

    total_incident_days = 0
    worked_day_reductions = 0
    non_contribution_days = 0
    payroll_affecting_incident_days = 0

    for incident in incidents:
        days = calculate_overlap_days(
            start_date=incident.start_date,
            end_date=incident.end_date,
            period_start=period_start,
            period_end=period_end,
        )
        days = clamp_day_count(days)
        if days == 0:
            continue

        rule = resolve_incident_rule(incident.incident_type)

        total_incident_days += days
        if rule.reduces_worked_days:
            worked_day_reductions += days
        if rule.reduces_contribution_days:
            non_contribution_days += days
        if rule.affects_payroll:
            payroll_affecting_incident_days += days

        incident_breakdown.append(
            {
                "incident_id": getattr(incident, "id", None),
                "incident_type": incident.incident_type,
                "label": rule.display_label,
                "days": days,
                "affects_payroll": rule.affects_payroll,
                "reduces_worked_days": rule.reduces_worked_days,
                "reduces_contribution_days": rule.reduces_contribution_days,
            }
        )

    total_incident_days = clamp_day_count(total_incident_days)
    worked_day_reductions = clamp_day_count(worked_day_reductions)
    non_contribution_days = clamp_day_count(non_contribution_days)
    payroll_affecting_incident_days = clamp_day_count(payroll_affecting_incident_days)

    worked_days = clamp_day_count(period_days - worked_day_reductions)
    contribution_days = clamp_day_count(period_days - non_contribution_days)

    return {
        "period_days": period_days,
        "worked_days": worked_days,
        "incident_days": total_incident_days,
        "contribution_days": contribution_days,
        "non_contribution_days": non_contribution_days,
        "payroll_affecting_incident_days": payroll_affecting_incident_days,
        "has_payroll_affecting_incidents": payroll_affecting_incident_days > 0,
        "contribution_day_ratio": Decimal(contribution_days) / Decimal(STANDARD_MONTH_DAYS)
        if STANDARD_MONTH_DAYS
        else Decimal("0"),
        "worked_day_ratio": Decimal(worked_days) / Decimal(STANDARD_MONTH_DAYS)
        if STANDARD_MONTH_DAYS
        else Decimal("0"),
        "incident_breakdown": incident_breakdown,
    }
