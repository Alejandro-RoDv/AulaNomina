from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.agreement_extra_pay import AgreementExtraPay
from app.models.contract import Contract
from app.models.incident import Incident
from app.services.incident_payroll_rules import resolve_incident_rule


IT_INCIDENT_TYPES = {"IT", "RECAIDA", "COMMON_SICK_LEAVE", "WORK_ACCIDENT"}


def resolve_accrual_dates(extra_pay: AgreementExtraPay, period_year: int) -> tuple[date, date]:
    start_month = extra_pay.accrual_start_month
    end_month = extra_pay.accrual_end_month

    if start_month > end_month:
        start_year = period_year - 1
        end_year = period_year
    elif extra_pay.payment_month < start_month:
        start_year = period_year - 1
        end_year = period_year - 1
    else:
        start_year = period_year
        end_year = period_year

    end_day = monthrange(end_year, end_month)[1]
    return date(start_year, start_month, 1), date(end_year, end_month, end_day)


def date_set(start: date, end: date) -> set[date]:
    if end < start:
        return set()
    return {
        start + timedelta(days=offset)
        for offset in range((end - start).days + 1)
    }


def overlap(
    start: date,
    end: date,
    limit_start: date,
    limit_end: date,
) -> tuple[date, date] | None:
    overlap_start = max(start, limit_start)
    overlap_end = min(end, limit_end)
    if overlap_end < overlap_start:
        return None
    return overlap_start, overlap_end


def contract_active_days(
    contract: Contract,
    accrual_start: date,
    accrual_end: date,
) -> set[date]:
    contract_end = contract.end_date or accrual_end
    period = overlap(contract.start_date, contract_end, accrual_start, accrual_end)
    return date_set(*period) if period else set()


def incident_exclusions(
    db: Session,
    contract: Contract,
    active_days: set[date],
    accrual_start: date,
    accrual_end: date,
    extra_pay: AgreementExtraPay,
) -> tuple[set[date], set[date], list[dict]]:
    incidents = (
        db.query(Incident)
        .filter(
            Incident.contract_id == contract.id,
            Incident.start_date <= accrual_end,
            or_(Incident.end_date.is_(None), Incident.end_date >= accrual_start),
        )
        .order_by(Incident.start_date, Incident.id)
        .all()
    )

    it_days: set[date] = set()
    unpaid_days: set[date] = set()
    breakdown: list[dict] = []

    for incident in incidents:
        incident_end = incident.end_date or accrual_end
        period = overlap(incident.start_date, incident_end, accrual_start, accrual_end)
        if not period:
            continue

        overlapping = date_set(*period) & active_days
        rule = resolve_incident_rule(incident.incident_type)
        is_it = incident.incident_type in IT_INCIDENT_TYPES
        is_unpaid = bool(rule.reduces_contribution_days)
        deducted_days: set[date] = set()

        if is_it and extra_pay.deduct_it_days:
            it_days |= overlapping
            deducted_days |= overlapping
        if is_unpaid and extra_pay.deduct_unpaid_absence_days:
            unpaid_days |= overlapping
            deducted_days |= overlapping

        breakdown.append(
            {
                "incident_id": incident.id,
                "incident_type": incident.incident_type,
                "label": rule.display_label,
                "start_date": period[0],
                "end_date": period[1],
                "overlapping_days": len(overlapping),
                "deducted_days": len(deducted_days),
                "deducted": bool(deducted_days),
            }
        )

    return it_days, unpaid_days, breakdown


def inactivity_exclusions(
    contract: Contract,
    active_days: set[date],
    accrual_start: date,
    accrual_end: date,
    deduct: bool,
) -> set[date]:
    if not deduct or not contract.inactivity_start_date:
        return set()

    inactivity_end = (
        contract.inactivity_return_date - timedelta(days=1)
        if contract.inactivity_return_date
        else accrual_end
    )
    period = overlap(
        contract.inactivity_start_date,
        inactivity_end,
        accrual_start,
        accrual_end,
    )
    return (date_set(*period) & active_days) if period else set()
