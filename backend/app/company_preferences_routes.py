from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud.company import get_company
from app.crud.company_preferences import (
    create_default_company_preferences,
    get_company_preferences,
    serialize_company_preferences,
    upsert_company_preferences,
)
from app.db import SessionLocal
from app.schemas.company_preferences import (
    CompanyPreferencesPayload,
    CompanyPreferencesResponse,
)


router = APIRouter(prefix="/companies", tags=["company-preferences"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_company(db: Session, company_id: int) -> None:
    if not get_company(db, company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")


@router.get("/{company_id}/preferences", response_model=CompanyPreferencesResponse)
def read_company_preferences(company_id: int, db: Session = Depends(get_db)):
    _ensure_company(db, company_id)
    preferences = get_company_preferences(db, company_id)
    if not preferences:
        preferences = create_default_company_preferences(db, company_id)
    return serialize_company_preferences(preferences)


@router.put("/{company_id}/preferences", response_model=CompanyPreferencesResponse)
def update_company_preferences(
    company_id: int,
    payload: CompanyPreferencesPayload,
    db: Session = Depends(get_db),
):
    _ensure_company(db, company_id)
    if payload.inherited_from_company_id:
        _ensure_company(db, payload.inherited_from_company_id)
        if payload.inherited_from_company_id == company_id:
            raise HTTPException(status_code=400, detail="Una empresa no puede heredar sus propias preferencias")

    preferences = upsert_company_preferences(db, company_id, payload)
    return serialize_company_preferences(preferences)
