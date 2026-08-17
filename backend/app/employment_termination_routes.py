from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.employment_termination import (
    EmploymentTerminationCreate,
    EmploymentTerminationPreviewRequest,
    EmploymentTerminationPreviewResponse,
    EmploymentTerminationResponse,
    EmploymentTerminationUpdate,
)
from app.services.employment_termination_service import (
    EmploymentTerminationDomainError,
    build_termination_preview,
    create_or_replace_termination,
    finalize_termination,
    get_termination,
    list_terminations,
    serialize_termination,
    update_termination,
)


router = APIRouter(prefix="/employment-terminations", tags=["employment-terminations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _domain_error(error: EmploymentTerminationDomainError):
    raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("", response_model=list[EmploymentTerminationResponse])
def list_employment_terminations_endpoint(db: Session = Depends(get_db)):
    return [serialize_termination(item) for item in list_terminations(db)]


@router.post("/preview", response_model=EmploymentTerminationPreviewResponse)
def preview_employment_termination_endpoint(
    payload: EmploymentTerminationPreviewRequest,
    db: Session = Depends(get_db),
):
    try:
        return build_termination_preview(db, payload)
    except EmploymentTerminationDomainError as error:
        _domain_error(error)


@router.post("", response_model=EmploymentTerminationResponse, status_code=201)
def create_employment_termination_endpoint(
    payload: EmploymentTerminationCreate,
    db: Session = Depends(get_db),
):
    try:
        return serialize_termination(create_or_replace_termination(db, payload))
    except EmploymentTerminationDomainError as error:
        _domain_error(error)


@router.get("/{termination_id}", response_model=EmploymentTerminationResponse)
def get_employment_termination_endpoint(termination_id: int, db: Session = Depends(get_db)):
    record = get_termination(db, termination_id)
    if not record:
        raise HTTPException(status_code=404, detail="Extinción no encontrada")
    return serialize_termination(record)


@router.put("/{termination_id}", response_model=EmploymentTerminationResponse)
def update_employment_termination_endpoint(
    termination_id: int,
    payload: EmploymentTerminationUpdate,
    db: Session = Depends(get_db),
):
    try:
        return serialize_termination(update_termination(db, termination_id, payload))
    except EmploymentTerminationDomainError as error:
        _domain_error(error)


@router.post("/{termination_id}/finalize", response_model=EmploymentTerminationResponse)
def finalize_employment_termination_endpoint(termination_id: int, db: Session = Depends(get_db)):
    try:
        return serialize_termination(finalize_termination(db, termination_id))
    except EmploymentTerminationDomainError as error:
        _domain_error(error)
