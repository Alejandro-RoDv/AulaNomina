from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.incident import Incident
from app.models.incident_detail import IncidentAudit, IncidentDetail
from app.models.payroll import Payroll


BASE_FIELDS = {
    "center_id",
    "incident_type",
    "start_date",
    "end_date",
    "description",
    "status",
}

DETAIL_FIELDS = {
    "unit_type",
    "hours",
    "days",
    "paid",
    "payroll_effect",
    "processed_payroll_id",
    "generated_amount",
    "overlap_override",
    "overlap_reason",
    "origin",
    "details",
    "updated_by",
}

ABSENCE_LIKE_TYPES = {
    "IT",
    "RECAIDA",
    "NACIMIENTO_CUIDADO",
    "RIESGO_EMBARAZO",
    "RIESGO_LACTANCIA",
    "CUIDADO_MENOR",
    "VACACIONES",
    "AUSENCIA",
    "PERMISO_NO_RETRIBUIDO",
    "SUSPENSION",
    "SANCION",
}


def json_safe(value: Any):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    return value


def incident_snapshot(incident: Incident) -> dict[str, Any]:
    return {
        "employee_id": incident.employee_id,
        "contract_id": incident.contract_id,
        "company_id": incident.company_id,
        "center_id": incident.center_id,
        "incident_type": incident.incident_type,
        "start_date": json_safe(incident.start_date),
        "end_date": json_safe(incident.end_date),
        "description": incident.description,
        "status": incident.status,
        "unit_type": incident.unit_type,
        "hours": json_safe(incident.hours),
        "days": json_safe(incident.days),
        "paid": incident.paid,
        "payroll_effect": incident.payroll_effect,
        "processed_payroll_id": incident.processed_payroll_id,
        "generated_amount": json_safe(incident.generated_amount),
        "is_cancelled": incident.is_cancelled,
        "cancellation_reason": incident.cancellation_reason,
        "requires_recalculation": incident.requires_recalculation,
        "requires_regularization": incident.requires_regularization,
        "overlap_override": incident.overlap_override,
        "overlap_reason": incident.overlap_reason,
        "origin": incident.origin,
        "details": json_safe(incident.details),
        "version": incident.version,
    }


def register_incident_audit(
    db: Session,
    incident: Incident,
    action: str,
    actor: str | None,
    reason: str | None,
    previous_values: dict[str, Any] | None,
    new_values: dict[str, Any] | None,
) -> None:
    db.add(
        IncidentAudit(
            incident_id=incident.id,
            action=action,
            version=incident.version,
            actor=actor,
            reason=reason,
            previous_values=json_safe(previous_values),
            new_values=json_safe(new_values),
        )
    )


def validate_incident_period(contract: Contract, start_date: date, end_date: date | None, details: dict[str, Any] | None = None) -> None:
    effective_end = end_date or start_date
    if effective_end < start_date:
        raise HTTPException(status_code=400, detail="La fecha final no puede ser anterior a la inicial")

    allow_regularization = bool((details or {}).get("regularization_allowed"))
    outside_contract = start_date < contract.start_date or (contract.end_date and effective_end > contract.end_date)
    if outside_contract and not allow_regularization:
        raise HTTPException(
            status_code=400,
            detail="La incidencia queda fuera de la vida laboral seleccionada. Marque la regularización como autorizada para continuar.",
        )


def find_incident_conflicts(
    db: Session,
    *,
    employee_id: int,
    contract_id: int,
    incident_type: str,
    start_date: date,
    end_date: date | None,
    exclude_incident_id: int | None = None,
) -> list[Incident]:
    effective_end = end_date or start_date
    query = (
        db.query(Incident)
        .outerjoin(IncidentDetail, IncidentDetail.incident_id == Incident.id)
        .filter(
            Incident.employee_id == employee_id,
            Incident.contract_id == contract_id,
            Incident.start_date <= effective_end,
            func.coalesce(Incident.end_date, Incident.start_date) >= start_date,
            or_(IncidentDetail.id.is_(None), IncidentDetail.is_cancelled.is_(False)),
        )
    )
    if exclude_incident_id is not None:
        query = query.filter(Incident.id != exclude_incident_id)

    conflicts = []
    for existing in query.all():
        exact_duplicate = (
            existing.incident_type == incident_type
            and existing.start_date == start_date
            and (existing.end_date or existing.start_date) == effective_end
        )
        incompatible_overlap = existing.incident_type in ABSENCE_LIKE_TYPES and incident_type in ABSENCE_LIKE_TYPES
        if exact_duplicate or incompatible_overlap:
            conflicts.append(existing)
    return conflicts


def validate_or_authorize_conflicts(
    conflicts: list[Incident],
    overlap_override: bool,
    overlap_reason: str | None,
) -> None:
    if not conflicts:
        return
    if overlap_override and (overlap_reason or "").strip():
        return
    conflict_ids = ", ".join(str(item.id) for item in conflicts)
    raise HTTPException(
        status_code=409,
        detail=f"Se ha detectado un solapamiento con las incidencias {conflict_ids}. Revise el conflicto o autorícelo indicando un motivo.",
    )


def payroll_change_flags(db: Session, incident: Incident) -> tuple[bool, bool]:
    period_end = incident.end_date or incident.start_date
    affected = db.query(Payroll).filter(
        Payroll.contract_id == incident.contract_id,
        or_(
            Payroll.period_year > incident.start_date.year,
            and_(Payroll.period_year == incident.start_date.year, Payroll.period_month >= incident.start_date.month),
        ),
        or_(
            Payroll.period_year < period_end.year,
            and_(Payroll.period_year == period_end.year, Payroll.period_month <= period_end.month),
        ),
    ).all()
    if not affected:
        return False, False
    return True, any(payroll.status == "closed" for payroll in affected)
