from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.social_security_settlement import (
    CompanyCccOptionResponse,
    SocialSecuritySettlementActionRequest,
    SocialSecuritySettlementPrepareRequest,
    SocialSecuritySettlementResponse,
    SocialSecuritySettlementStatus,
)
from app.services.social_security_settlement_service import (
    SocialSecuritySettlementDomainError,
    confirm_social_security_settlement,
    generate_social_security_settlement_file,
    get_social_security_settlement,
    list_company_ccc_options,
    list_social_security_settlements,
    prepare_social_security_settlement,
    serialize_social_security_settlement,
)


router = APIRouter(prefix="/social-security-settlements", tags=["social-security-settlements"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _domain_error(error: SocialSecuritySettlementDomainError) -> HTTPException:
    message = str(error)
    status_code = 404 if "no encontrada" in message.lower() else 400
    return HTTPException(status_code=status_code, detail=message)


@router.get("/ccc-options", response_model=list[CompanyCccOptionResponse])
def read_company_ccc_options(
    company_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    try:
        return list_company_ccc_options(db, company_id)
    except SocialSecuritySettlementDomainError as error:
        raise _domain_error(error) from error


@router.post("/prepare", response_model=SocialSecuritySettlementResponse)
def prepare_settlement(
    payload: SocialSecuritySettlementPrepareRequest,
    db: Session = Depends(get_db),
):
    try:
        settlement = prepare_social_security_settlement(db, payload)
        return serialize_social_security_settlement(settlement)
    except SocialSecuritySettlementDomainError as error:
        raise _domain_error(error) from error


@router.get("", response_model=list[SocialSecuritySettlementResponse])
def list_settlements(
    company_id: int | None = Query(default=None, gt=0),
    ccc_id: str | None = None,
    period_year: int | None = Query(default=None, ge=2000, le=2100),
    period_month: int | None = Query(default=None, ge=1, le=12),
    status: SocialSecuritySettlementStatus | None = None,
    db: Session = Depends(get_db),
):
    settlements = list_social_security_settlements(
        db,
        company_id=company_id,
        ccc_id=ccc_id,
        period_year=period_year,
        period_month=period_month,
        status=status,
    )
    return [serialize_social_security_settlement(item) for item in settlements]


@router.get("/{settlement_id}", response_model=SocialSecuritySettlementResponse)
def read_settlement(settlement_id: int, db: Session = Depends(get_db)):
    settlement = get_social_security_settlement(db, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Liquidación de Seguridad Social no encontrada")
    return serialize_social_security_settlement(settlement)


@router.post("/{settlement_id}/confirm", response_model=SocialSecuritySettlementResponse)
def confirm_settlement(
    settlement_id: int,
    payload: SocialSecuritySettlementActionRequest,
    db: Session = Depends(get_db),
):
    settlement = get_social_security_settlement(db, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Liquidación de Seguridad Social no encontrada")
    try:
        confirmed = confirm_social_security_settlement(
            db,
            settlement,
            created_by=payload.created_by,
        )
        return serialize_social_security_settlement(confirmed)
    except SocialSecuritySettlementDomainError as error:
        raise _domain_error(error) from error


@router.post("/{settlement_id}/generate", response_model=SocialSecuritySettlementResponse)
def generate_settlement_file(
    settlement_id: int,
    payload: SocialSecuritySettlementActionRequest,
    db: Session = Depends(get_db),
):
    settlement = get_social_security_settlement(db, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Liquidación de Seguridad Social no encontrada")
    try:
        generated = generate_social_security_settlement_file(
            db,
            settlement,
            created_by=payload.created_by,
        )
        return serialize_social_security_settlement(generated)
    except SocialSecuritySettlementDomainError as error:
        raise _domain_error(error) from error
