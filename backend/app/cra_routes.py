from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.catalogs.cra_codes import CRA_CODES
from app.db import SessionLocal
from app.schemas.cra import (
    CraConceptMappingResponse,
    CraConceptMappingUpdate,
    CraGenerateRequest,
    CraPreviewRequest,
    CraPreviewResponse,
    CraSendRequest,
)
from app.services.cra_service import (
    CraDomainError,
    build_cra_preview,
    create_cra_file,
    list_cra_files,
    list_cra_mappings,
    send_cra_file,
    upsert_cra_mapping,
)

router = APIRouter(prefix="/cra", tags=["cra"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def domain_error(error: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


@router.get("/catalog")
def get_cra_catalog():
    return CRA_CODES


@router.get("/mappings", response_model=list[CraConceptMappingResponse])
def get_cra_mappings(
    include_inactive: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    return list_cra_mappings(db, include_inactive=include_inactive)


@router.put("/mappings/{payroll_concept_id}", response_model=CraConceptMappingResponse)
def save_cra_mapping(
    payroll_concept_id: int,
    payload: CraConceptMappingUpdate,
    db: Session = Depends(get_db),
):
    try:
        return upsert_cra_mapping(
            db,
            payroll_concept_id,
            cra_code=payload.cra_code,
            base_indicator=payload.base_indicator,
            is_active=payload.is_active,
            notes=payload.notes,
        )
    except CraDomainError as error:
        raise domain_error(error) from error


@router.post("/preview", response_model=CraPreviewResponse)
def preview_cra(payload: CraPreviewRequest, db: Session = Depends(get_db)):
    try:
        return build_cra_preview(db, payload.company_id, payload.ccc_id, payload.period)
    except CraDomainError as error:
        raise domain_error(error) from error


@router.post("/generate")
def generate_cra(payload: CraGenerateRequest, db: Session = Depends(get_db)):
    try:
        return create_cra_file(
            db,
            payload.company_id,
            payload.ccc_id,
            payload.period,
            created_by=payload.created_by,
        )
    except CraDomainError as error:
        raise domain_error(error) from error


@router.get("/files")
def get_cra_files(
    company_id: int | None = Query(default=None),
    period: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return list_cra_files(db, company_id=company_id, period=period)


@router.post("/files/{communication_file_id}/send")
def send_cra(
    communication_file_id: int,
    payload: CraSendRequest,
    db: Session = Depends(get_db),
):
    try:
        return send_cra_file(db, communication_file_id, created_by=payload.created_by)
    except CraDomainError as error:
        raise domain_error(error) from error
