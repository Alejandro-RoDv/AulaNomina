from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.incident import Incident
from app.models.incident_calculation import PayrollSegment
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem


AUTOMATIC_SOURCE = "incident_engine"


def period_incidents(db: Session, payroll: Payroll) -> list[Incident]:
    from app.services.incident_segmenter import month_bounds

    start, end = month_bounds(payroll.period_month, payroll.period_year)
    return (
        db.query(Incident)
        .options(joinedload(Incident.contract), joinedload(Incident.detail))
        .filter(
            Incident.contract_id == payroll.contract_id,
            Incident.start_date <= end,
            ((Incident.end_date.is_(None)) | (Incident.end_date >= start)),
        )
        .order_by(Incident.start_date, Incident.id)
        .all()
    )


def upsert_segments(
    db: Session,
    payroll: Payroll,
    segment_result: dict[str, Any],
) -> dict[str, PayrollSegment]:
    existing = {
        segment.segment_key: segment
        for segment in db.query(PayrollSegment).filter(PayrollSegment.payroll_id == payroll.id).all()
    }
    active_keys: set[str] = set()
    persisted: dict[str, PayrollSegment] = {}

    for draft in segment_result["segments"]:
        key = draft["segment_key"]
        active_keys.add(key)
        segment = existing.get(key)
        values = {
            "incident_id": draft["incident_id"],
            "rule_id": draft["rule_id"],
            "segment_type": draft["segment_type"],
            "start_date": draft["start_date"],
            "end_date": draft["end_date"],
            "calendar_days": draft["calendar_days"],
            "payroll_days": draft["payroll_days"],
            "process_day_from": draft["process_day_from"],
            "process_day_to": draft["process_day_to"],
            "salary_percentage": draft["salary_percentage"],
            "benefit_percentage": draft["benefit_percentage"],
            "complement_percentage": draft["complement_percentage"],
            "contribution_treatment": draft["contribution_treatment"],
            "daily_salary_base": draft["daily_salary_base"],
            "daily_regulatory_base": draft["daily_regulatory_base"],
            "salary_amount": draft["salary_amount"],
            "benefit_amount": draft["benefit_amount"],
            "complement_amount": draft["complement_amount"],
            "deduction_amount": draft["deduction_amount"],
            "calculation_trace": draft["trace"],
        }
        if segment is None:
            segment = PayrollSegment(payroll_id=payroll.id, segment_key=key, **values)
            db.add(segment)
        else:
            for field, value in values.items():
                setattr(segment, field, value)
            segment.updated_at = datetime.utcnow()
        db.flush()
        persisted[key] = segment

    stale = [segment for key, segment in existing.items() if key not in active_keys]
    for segment in stale:
        db.query(PayrollItem).filter(
            PayrollItem.segment_id == segment.id,
            PayrollItem.source_type == AUTOMATIC_SOURCE,
        ).delete(synchronize_session=False)
        db.delete(segment)
    db.flush()
    return persisted


__all__ = ["AUTOMATIC_SOURCE", "period_incidents", "upsert_segments"]
