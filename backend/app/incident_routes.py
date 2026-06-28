from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud.incident import get_incident
from app.db import SessionLocal
from app.schemas.incident import IncidentAuditResponse, IncidentResponse
from app.schemas.incident_actions import (
    IncidentCancelRequest,
    IncidentConfirmationCancelRequest,
    IncidentConfirmationCreate,
    IncidentConfirmationUpdate,
    IncidentMonthlySummaryResponse,
    IncidentProcessRequest,
    IncidentRecalculationRequest,
)
from app.services.incident_actions import (
    build_monthly_incident_summary,
    cancel_confirmation,
    cancel_incident,
    create_confirmation,
    process_incident,
    request_incident_recalculation,
    update_confirmation,
)


router = APIRouter(prefix="/incidents", tags=["incidents"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{incident_id}/history", response_model=list[IncidentAuditResponse])
def incident_history(incident_id: int, db: Session = Depends(get_db)):
    incident = get_incident(db, incident_id)
    if not incident:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return incident.audit_entries


@router.post("/{incident_id}/cancel", response_model=IncidentResponse)
def cancel_incident_endpoint(
    incident_id: int,
    request: IncidentCancelRequest,
    db: Session = Depends(get_db),
):
    return cancel_incident(db, incident_id, request)


@router.post("/{incident_id}/process", response_model=IncidentResponse)
def process_incident_endpoint(
    incident_id: int,
    request: IncidentProcessRequest,
    db: Session = Depends(get_db),
):
    return process_incident(db, incident_id, request)


@router.post("/{incident_id}/request-recalculation", response_model=IncidentResponse)
def request_recalculation_endpoint(
    incident_id: int,
    request: IncidentRecalculationRequest,
    db: Session = Depends(get_db),
):
    return request_incident_recalculation(db, incident_id, request)


@router.post("/{incident_id}/confirmations", response_model=IncidentResponse)
def create_confirmation_endpoint(
    incident_id: int,
    confirmation: IncidentConfirmationCreate,
    db: Session = Depends(get_db),
):
    return create_confirmation(db, incident_id, confirmation)


@router.put("/{incident_id}/confirmations/{confirmation_id}", response_model=IncidentResponse)
def update_confirmation_endpoint(
    incident_id: int,
    confirmation_id: int,
    confirmation: IncidentConfirmationUpdate,
    db: Session = Depends(get_db),
):
    return update_confirmation(db, incident_id, confirmation_id, confirmation)


@router.post("/{incident_id}/confirmations/{confirmation_id}/cancel", response_model=IncidentResponse)
def cancel_confirmation_endpoint(
    incident_id: int,
    confirmation_id: int,
    request: IncidentConfirmationCancelRequest,
    db: Session = Depends(get_db),
):
    return cancel_confirmation(db, incident_id, confirmation_id, request)


@router.get(
    "/employee/{employee_id}/monthly-summary",
    response_model=IncidentMonthlySummaryResponse,
)
def monthly_summary_endpoint(
    employee_id: int,
    year: int,
    month: int,
    contract_id: int | None = None,
    db: Session = Depends(get_db),
):
    return build_monthly_incident_summary(db, employee_id, year, month, contract_id)
