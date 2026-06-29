from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.incident import Incident
from app.models.incident_detail import IncidentDetail
from app.models.payroll import Payroll
from app.services.incident_payroll_calculator import calculate_incident_payroll
from app.services.incident_payroll_concepts import ensure_incident_concepts, sync_payroll_items
from app.services.incident_payroll_result import IncidentPayrollCalculationResult
from app.services.incident_payroll_segments import period_incidents, upsert_segments
from app.services.incident_segmenter import money
from app.services.incident_service import incident_snapshot, register_incident_audit


def load_payroll_for_incident_engine(db: Session, payroll_id: int) -> Payroll:
    payroll = db.query(Payroll).options(joinedload(Payroll.contract), joinedload(Payroll.segments)).filter(Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if payroll.period_month not in range(1, 13):
        raise HTTPException(status_code=400, detail="La segmentación solo se aplica a nóminas mensuales")
    if not payroll.contract:
        raise HTTPException(status_code=400, detail="La nómina no tiene una vida laboral válida")
    return payroll


def calculate_payroll_incidents(db: Session, payroll: Payroll, incidents: list[Incident] | None = None) -> IncidentPayrollCalculationResult:
    selected = incidents if incidents is not None else period_incidents(db, payroll)
    return calculate_incident_payroll(db, payroll, selected)


def apply_payroll_amounts(payroll: Payroll, calculation: IncidentPayrollCalculationResult) -> None:
    for field, value in calculation.payroll_amount_payload().items():
        setattr(payroll, field, value)


def mark_changed_incidents_processed(db: Session, payroll: Payroll, incidents: list[Incident], calculation: IncidentPayrollCalculationResult, actor: str | None) -> int:
    amounts = calculation.incident_amount_map()
    changed = 0
    for incident in incidents:
        if incident.id not in amounts:
            continue
        if incident.detail is None:
            incident.detail = IncidentDetail(incident_id=incident.id)
            db.flush()
        target = amounts[incident.id]
        unchanged = (
            incident.status == "processed"
            and incident.detail.processed_payroll_id == payroll.id
            and money(incident.detail.generated_amount) == target
            and not incident.detail.requires_recalculation
            and not incident.detail.requires_regularization
        )
        if unchanged:
            continue
        previous = incident_snapshot(incident)
        incident.status = "processed"
        incident.detail.processed_payroll_id = payroll.id
        incident.detail.generated_amount = target
        incident.detail.processed_at = datetime.utcnow()
        incident.detail.requires_recalculation = False
        incident.detail.requires_regularization = False
        incident.detail.updated_by = actor
        incident.detail.version += 1
        incident.detail.updated_at = datetime.utcnow()
        db.flush()
        register_incident_audit(
            db,
            incident,
            action="payroll_engine_processed",
            actor=actor,
            reason=f"Procesada automáticamente en nómina {payroll.id}",
            previous_values=previous,
            new_values=incident_snapshot(incident),
        )
        changed += 1
    return changed


def persist_payroll_incident_calculation(db: Session, payroll: Payroll, incidents: list[Incident], calculation: IncidentPayrollCalculationResult, actor: str | None) -> dict[str, int]:
    concepts = ensure_incident_concepts(db)
    segments = upsert_segments(db, payroll, calculation.segment_payload())
    created, updated, deleted = sync_payroll_items(
        db,
        payroll,
        segments,
        concepts,
        calculation.component_adjustments,
    )
    apply_payroll_amounts(payroll, calculation)
    changed = mark_changed_incidents_processed(db, payroll, incidents, calculation, actor)
    payroll.status = "calculated"
    return {
        "segments": len(segments),
        "created_items": created,
        "updated_items": updated,
        "deleted_items": deleted,
        "changed_incidents": changed,
    }


def calculation_response(calculation: IncidentPayrollCalculationResult, persisted: dict[str, int]) -> dict[str, Any]:
    result = calculation.segment_result
    return {
        "payroll_id": calculation.payroll_id,
        **persisted,
        "worked_base_salary": result["worked_base_salary"],
        "temporary_disability_benefit": result["temporary_disability_benefit"],
        "company_disability_complement": result["company_disability_complement"],
        "salary_deductions": result["salary_deductions"],
        "overtime_amount": result["overtime_amount"],
        "worked_days": result["worked_days"],
        "incident_days": result["incident_days"],
        "it_days": result["it_days"],
        "contribution_days": result["contribution_days"],
        "warnings": list(result["warnings"]),
        "component_adjustments": [item.to_dict() for item in calculation.component_adjustments],
        "adjusted_components": calculation.adjusted_component_map(),
    }


def preview_payroll_incidents(db: Session, payroll_id: int) -> dict[str, Any]:
    payroll = load_payroll_for_incident_engine(db, payroll_id)
    return calculate_payroll_incidents(db, payroll).preview_payload()


def process_payroll_incidents(db: Session, payroll_id: int, actor: str | None = None) -> dict[str, Any]:
    payroll = load_payroll_for_incident_engine(db, payroll_id)
    if payroll.status == "closed":
        raise HTTPException(status_code=409, detail="La nómina está cerrada. Debe generarse una regularización, no reescribir el resultado.")
    incidents = period_incidents(db, payroll)
    calculation = calculate_payroll_incidents(db, payroll, incidents)
    try:
        persisted = persist_payroll_incident_calculation(db, payroll, incidents, calculation, actor)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return calculation_response(calculation, persisted)


__all__ = [
    "apply_payroll_amounts",
    "calculate_payroll_incidents",
    "load_payroll_for_incident_engine",
    "persist_payroll_incident_calculation",
    "preview_payroll_incidents",
    "process_payroll_incidents",
]
