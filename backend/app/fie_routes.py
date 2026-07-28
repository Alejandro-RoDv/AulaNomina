from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.fie_schema_patch import apply_fie_schema_patch
from app.schemas.fie import (
    FieActionRequest,
    FieCommunicationResponse,
    FieProcessingEventResponse,
    FieResolutionRequest,
    FieSimulationRequest,
)
from app.services.fie_case_service import (
    compare_fie_case_communication,
    reopen_fie_case_communication,
)
from app.services.fie_enhanced_service import (
    mark_fie_communication_read,
    resolve_fie_communication,
    simulate_fie_communication_enhanced,
)
from app.services.fie_pending_service import generate_pending_fie_communications
from app.services.fie_service import (
    FieDomainError,
    apply_fie_communication,
    get_fie_communication,
    ignore_fie_communication,
    list_fie_communications,
)

apply_fie_schema_patch()
router = APIRouter(prefix="/fie", tags=["fie"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def domain_error(error: FieDomainError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


@router.get("/communications", response_model=list[FieCommunicationResponse])
def get_communications(
    company_id: int | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    communication_type: str | None = Query(default=None),
    received_from: date | None = Query(default=None),
    received_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return list_fie_communications(
        db,
        company_id=company_id,
        employee_id=employee_id,
        status=status,
        communication_type=communication_type,
        received_from=received_from,
        received_to=received_to,
    )


@router.get("/communications/{communication_id}", response_model=FieCommunicationResponse)
def get_communication(communication_id: int, db: Session = Depends(get_db)):
    try:
        return get_fie_communication(db, communication_id)
    except FieDomainError as error:
        raise domain_error(error) from error


@router.post("/simulate", response_model=FieCommunicationResponse)
def simulate_communication(payload: FieSimulationRequest, db: Session = Depends(get_db)):
    try:
        return simulate_fie_communication_enhanced(db, payload)
    except FieDomainError as error:
        raise domain_error(error) from error


@router.post("/generate-pending", response_model=list[FieCommunicationResponse])
def generate_pending_communications(
    payload: FieActionRequest | None = None,
    company_id: int | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        return generate_pending_fie_communications(
            db,
            company_id=company_id,
            actor=payload.actor if payload else "Sistema INSS simulado",
            limit=limit,
        )
    except FieDomainError as error:
        raise domain_error(error) from error


@router.post("/communications/{communication_id}/read", response_model=FieCommunicationResponse)
def read_communication(
    communication_id: int,
    payload: FieActionRequest | None = None,
    db: Session = Depends(get_db),
):
    try:
        return mark_fie_communication_read(
            db,
            communication_id,
            actor=payload.actor if payload else None,
        )
    except FieDomainError as error:
        raise domain_error(error) from error


@router.post("/communications/{communication_id}/compare", response_model=FieCommunicationResponse)
def compare_communication(
    communication_id: int,
    payload: FieActionRequest | None = None,
    db: Session = Depends(get_db),
):
    try:
        return compare_fie_case_communication(
            db,
            communication_id,
            actor=payload.actor if payload else None,
        )
    except FieDomainError as error:
        raise domain_error(error) from error


@router.post("/communications/{communication_id}/resolve", response_model=FieCommunicationResponse)
def resolve_communication(
    communication_id: int,
    payload: FieResolutionRequest,
    db: Session = Depends(get_db),
):
    try:
        return resolve_fie_communication(db, communication_id, payload)
    except FieDomainError as error:
        raise domain_error(error) from error


@router.post("/communications/{communication_id}/apply", response_model=FieCommunicationResponse)
def apply_communication(
    communication_id: int,
    payload: FieActionRequest,
    db: Session = Depends(get_db),
):
    try:
        return apply_fie_communication(
            db,
            communication_id,
            actor=payload.actor,
            notes=payload.notes,
        )
    except FieDomainError as error:
        raise domain_error(error) from error


@router.post("/communications/{communication_id}/ignore", response_model=FieCommunicationResponse)
def ignore_communication(
    communication_id: int,
    payload: FieActionRequest,
    db: Session = Depends(get_db),
):
    try:
        return ignore_fie_communication(
            db,
            communication_id,
            actor=payload.actor,
            notes=payload.notes,
        )
    except FieDomainError as error:
        raise domain_error(error) from error


@router.post("/communications/{communication_id}/reopen", response_model=FieCommunicationResponse)
def reopen_communication(
    communication_id: int,
    payload: FieActionRequest,
    db: Session = Depends(get_db),
):
    try:
        return reopen_fie_case_communication(
            db,
            communication_id,
            actor=payload.actor,
            notes=payload.notes,
        )
    except FieDomainError as error:
        raise domain_error(error) from error


@router.get(
    "/communications/{communication_id}/events",
    response_model=list[FieProcessingEventResponse],
)
def get_communication_events(communication_id: int, db: Session = Depends(get_db)):
    try:
        return get_fie_communication(db, communication_id).events
    except FieDomainError as error:
        raise domain_error(error) from error


@router.get("/employees/{employee_id}/history", response_model=list[FieCommunicationResponse])
def get_employee_history(employee_id: int, db: Session = Depends(get_db)):
    return list_fie_communications(db, employee_id=employee_id)
