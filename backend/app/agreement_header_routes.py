from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud.collective_agreement import get_collective_agreement
from app.db import SessionLocal


class AgreementHeaderResponse(BaseModel):
    id: int
    name: str
    official_name: str | None = None
    internal_name: str | None = None
    agreement_code: str | None = None
    sector: str | None = None
    territorial_scope: str | None = None
    is_extendable: bool = False
    boe_alerts_enabled: bool = False
    boe_search_terms: str | None = None
    source_url: str | None = None
    status: str | None = None

    class Config:
        from_attributes = True


class AgreementHeaderUpdate(BaseModel):
    official_name: str | None = None
    internal_name: str | None = None
    is_extendable: bool | None = None
    boe_alerts_enabled: bool | None = None
    boe_search_terms: str | None = None
    source_url: str | None = None


router = APIRouter(prefix="/collective-agreements", tags=["agreement-header"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{agreement_id}/header", response_model=AgreementHeaderResponse)
def read_agreement_header(agreement_id: int, db: Session = Depends(get_db)):
    agreement = get_collective_agreement(db, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")
    return agreement


@router.put("/{agreement_id}/header", response_model=AgreementHeaderResponse)
def update_agreement_header(agreement_id: int, payload: AgreementHeaderUpdate, db: Session = Depends(get_db)):
    agreement = get_collective_agreement(db, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(agreement, key, value)

    db.commit()
    db.refresh(agreement)
    return agreement
