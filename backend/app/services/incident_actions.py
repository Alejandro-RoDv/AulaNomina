from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.crud.incident import get_incident
from app.models.document import Document
from app.models.incident import Incident
from app.models.incident_detail import IncidentConfirmation, IncidentDetail
from app.models.payroll import Payroll
from app.schemas.incident_actions import (
    IncidentCancelRequest,
    IncidentConfirmationCancelRequest,
    IncidentConfirmationCreate,
    IncidentConfirmationUpdate,
    IncidentProcessRequest,
    IncidentRecalculationRequest,
)
from app.services.incident_service import incident_snapshot, register_incident_audit


MEDICAL_INCIDENT_TYPES = {
    "IT",
    "RECAIDA",
    "NACIMIENTO_CUIDADO",
    "RIESGO_EMBARAZO",
    "RIESGO_LACTANCIA",
    "CUIDADO_MENOR",
}


def _require_incident(db: Session, incident_id: int) -> Incident:
    incident = get_incident(db, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    if not incident.detail:
        incident.detail = IncidentDetail(incident_id=incident.id)
        db.flush()
    return incident


def _require_version(incident: Incident, expected_version: int) -> None:
    if incident.version != expected_version:
        raise HTTPException(
            status_code=409,
            detail="La incidencia fue modificada por otro usuario. Recargue el registro antes de continuar.",
        )


def _touch_incident(incident: Incident, actor: str | None) -> None:
    incident.detail.version += 1
    incident.detail.updated_by = actor
    incident.detail.updated_at = datetime.utcnow()


def cancel_incident(db: Session, incident_id: int, request: IncidentCancelRequest) -> Incident:
    incident = _require_incident(db, incident_id)
    _require_version(incident, request.expected_version)

    if incident.is_cancelled:
        return incident

    previous = incident_snapshot(incident)
    incident.status = "cancelled"
    incident.detail.is_cancelled = True
    incident.detail.cancelled_at = datetime.utcnow()
    incident.detail.cancellation_reason = request.reason
    if incident.processed_payroll_id:
        incident.detail.requires_recalculation = True
        incident.detail.requires_regularization = True
    _touch_incident(incident, request.actor)
    db.flush()
    register_incident_audit(
        db,
        incident,
        action="cancelled",
        actor=request.actor,
        reason=request.reason,
        previous_values=previous,
        new_values=incident_snapshot(incident),
    )
    db.commit()
    return get_incident(db, incident_id)


def process_incident(db: Session, incident_id: int, request: IncidentProcessRequest) -> Incident:
    incident = _require_incident(db, incident_id)
    _require_version(incident, request.expected_version)
    if incident.is_cancelled:
        raise HTTPException(status_code=400, detail="No se puede procesar una incidencia anulada")

    payroll = db.query(Payroll).filter(Payroll.id == request.payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if payroll.contract_id != incident.contract_id:
        raise HTTPException(status_code=400, detail="La nómina no pertenece a la vida laboral de la incidencia")

    amount = Decimal(request.generated_amount)
    if incident.processed_payroll_id == payroll.id and incident.status == "processed":
        if Decimal(incident.generated_amount or 0) == amount:
            return incident
        raise HTTPException(
            status_code=409,
            detail="La incidencia ya fue procesada en esta nómina con otro importe. Solicite recálculo o regularización.",
        )
    if incident.processed_payroll_id and incident.processed_payroll_id != payroll.id:
        raise HTTPException(
            status_code=409,
            detail="La incidencia ya está vinculada a otra nómina y no puede procesarse dos veces.",
        )

    previous = incident_snapshot(incident)
    incident.status = "processed"
    incident.detail.processed_payroll_id = payroll.id
    incident.detail.generated_amount = amount
    incident.detail.processed_at = datetime.utcnow()
    incident.detail.requires_recalculation = False
    incident.detail.requires_regularization = False
    _touch_incident(incident, request.actor)
    db.flush()
    register_incident_audit(
        db,
        incident,
        action="processed",
        actor=request.actor,
        reason=f"Procesada en nómina {payroll.id}",
        previous_values=previous,
        new_values=incident_snapshot(incident),
    )
    db.commit()
    return get_incident(db, incident_id)


def request_incident_recalculation(
    db: Session,
    incident_id: int,
    request: IncidentRecalculationRequest,
) -> Incident:
    incident = _require_incident(db, incident_id)
    _require_version(incident, request.expected_version)
    previous = incident_snapshot(incident)
    incident.detail.requires_recalculation = True
    if incident.processed_payroll and incident.processed_payroll.status == "closed":
        incident.detail.requires_regularization = True
    _touch_incident(incident, request.actor)
    db.flush()
    register_incident_audit(
        db,
        incident,
        action="recalculation_requested",
        actor=request.actor,
        reason=request.reason,
        previous_values=previous,
        new_values=incident_snapshot(incident),
    )
    db.commit()
    return get_incident(db, incident_id)


def _validate_confirmation_incident(incident: Incident, confirmation_date: date) -> None:
    if incident.incident_type not in MEDICAL_INCIDENT_TYPES:
        raise HTTPException(status_code=400, detail="Los partes de confirmación solo pueden vincularse a una prestación médica")
    if incident.is_cancelled:
        raise HTTPException(status_code=400, detail="No se puede modificar una incidencia anulada")
    if confirmation_date < incident.start_date:
        raise HTTPException(status_code=400, detail="El parte no puede ser anterior al inicio del proceso")
    if incident.end_date and confirmation_date > incident.end_date:
        raise HTTPException(status_code=400, detail="El parte no puede ser posterior al fin del proceso")


def _validate_document(db: Session, document_id: int | None) -> None:
    if document_id is not None and not db.query(Document).filter(Document.id == document_id).first():
        raise HTTPException(status_code=404, detail="Documento adjunto no encontrado")


def create_confirmation(
    db: Session,
    incident_id: int,
    data: IncidentConfirmationCreate,
) -> Incident:
    incident = _require_incident(db, incident_id)
    _require_version(incident, data.expected_incident_version)
    _validate_confirmation_incident(incident, data.confirmation_date)
    _validate_document(db, data.document_id)

    duplicate = db.query(IncidentConfirmation).filter(
        IncidentConfirmation.incident_id == incident.id,
        IncidentConfirmation.number == data.number,
        IncidentConfirmation.confirmation_date == data.confirmation_date,
        IncidentConfirmation.is_cancelled.is_(False),
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe un parte de confirmación con ese número y fecha")

    confirmation = IncidentConfirmation(
        incident_id=incident.id,
        number=data.number,
        confirmation_date=data.confirmation_date,
        doctor_number=data.doctor_number,
        confirmation_type=data.confirmation_type,
        observations=data.observations,
        document_id=data.document_id,
        status=data.status,
    )
    db.add(confirmation)
    previous = incident_snapshot(incident)
    _touch_incident(incident, data.actor)
    db.flush()
    register_incident_audit(
        db,
        incident,
        action="confirmation_created",
        actor=data.actor,
        reason=f"Parte {confirmation.number}",
        previous_values=previous,
        new_values={**incident_snapshot(incident), "confirmation_id": confirmation.id},
    )
    db.commit()
    return get_incident(db, incident_id)


def update_confirmation(
    db: Session,
    incident_id: int,
    confirmation_id: int,
    data: IncidentConfirmationUpdate,
) -> Incident:
    incident = _require_incident(db, incident_id)
    _require_version(incident, data.expected_incident_version)
    confirmation = db.query(IncidentConfirmation).filter(
        IncidentConfirmation.id == confirmation_id,
        IncidentConfirmation.incident_id == incident.id,
    ).first()
    if not confirmation:
        raise HTTPException(status_code=404, detail="Parte de confirmación no encontrado")
    if confirmation.version != data.expected_version:
        raise HTTPException(status_code=409, detail="El parte fue modificado por otro usuario")
    if confirmation.is_cancelled:
        raise HTTPException(status_code=400, detail="No se puede editar un parte anulado")

    update_data = data.model_dump(
        exclude_unset=True,
        exclude={"actor", "expected_version", "expected_incident_version"},
    )
    next_date = update_data.get("confirmation_date", confirmation.confirmation_date)
    _validate_confirmation_incident(incident, next_date)
    _validate_document(db, update_data.get("document_id", confirmation.document_id))

    previous = incident_snapshot(incident)
    for key, value in update_data.items():
        setattr(confirmation, key, value)
    confirmation.version += 1
    confirmation.updated_at = datetime.utcnow()
    _touch_incident(incident, data.actor)
    db.flush()
    register_incident_audit(
        db,
        incident,
        action="confirmation_updated",
        actor=data.actor,
        reason=f"Parte {confirmation.number}",
        previous_values=previous,
        new_values={**incident_snapshot(incident), "confirmation_id": confirmation.id},
    )
    db.commit()
    return get_incident(db, incident_id)


def cancel_confirmation(
    db: Session,
    incident_id: int,
    confirmation_id: int,
    data: IncidentConfirmationCancelRequest,
) -> Incident:
    incident = _require_incident(db, incident_id)
    _require_version(incident, data.expected_incident_version)
    confirmation = db.query(IncidentConfirmation).filter(
        IncidentConfirmation.id == confirmation_id,
        IncidentConfirmation.incident_id == incident.id,
    ).first()
    if not confirmation:
        raise HTTPException(status_code=404, detail="Parte de confirmación no encontrado")
    if confirmation.version != data.expected_version:
        raise HTTPException(status_code=409, detail="El parte fue modificado por otro usuario")
    if confirmation.is_cancelled:
        return incident

    previous = incident_snapshot(incident)
    confirmation.is_cancelled = True
    confirmation.status = "cancelled"
    confirmation.cancelled_at = datetime.utcnow()
    confirmation.cancellation_reason = data.reason
    confirmation.version += 1
    confirmation.updated_at = datetime.utcnow()
    if incident.processed_payroll_id:
        incident.detail.requires_recalculation = True
        incident.detail.requires_regularization = bool(
            incident.processed_payroll and incident.processed_payroll.status == "closed"
        )
    _touch_incident(incident, data.actor)
    db.flush()
    register_incident_audit(
        db,
        incident,
        action="confirmation_cancelled",
        actor=data.actor,
        reason=data.reason,
        previous_values=previous,
        new_values={**incident_snapshot(incident), "confirmation_id": confirmation.id},
    )
    db.commit()
    return get_incident(db, incident_id)


def build_monthly_incident_summary(
    db: Session,
    employee_id: int,
    year: int,
    month: int,
    contract_id: int | None = None,
) -> dict:
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="El mes debe estar entre 1 y 12")
    period_start = date(year, month, 1)
    period_end = date(year, month, monthrange(year, month)[1])
    query = (
        db.query(Incident)
        .outerjoin(IncidentDetail, IncidentDetail.incident_id == Incident.id)
        .filter(
            Incident.employee_id == employee_id,
            Incident.start_date <= period_end,
            func.coalesce(Incident.end_date, Incident.start_date) >= period_start,
        )
    )
    if contract_id is not None:
        query = query.filter(Incident.contract_id == contract_id)
    incidents = query.all()

    by_type: dict[str, int] = {}
    amount = Decimal("0")
    for incident in incidents:
        by_type[incident.incident_type] = by_type.get(incident.incident_type, 0) + 1
        amount += Decimal(incident.generated_amount or 0)

    return {
        "employee_id": employee_id,
        "contract_id": contract_id,
        "year": year,
        "month": month,
        "total": len(incidents),
        "pending": sum(item.status in {"draft", "open", "pending"} and not item.is_cancelled for item in incidents),
        "processed": sum(bool(item.processed_payroll_id) or item.status == "processed" for item in incidents),
        "cancelled": sum(item.is_cancelled for item in incidents),
        "requires_recalculation": sum(item.requires_recalculation for item in incidents),
        "requires_regularization": sum(item.requires_regularization for item in incidents),
        "generated_amount": amount,
        "by_type": by_type,
    }
