from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.services.model190_calculator import Model190DomainError, build_model190_preview
from app.services.model190_reconciliation import build_model190_reconciliation


router = APIRouter(prefix="/model-190", tags=["model-190"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def domain_guard(callback, *args, **kwargs):
    try:
        return callback(*args, **kwargs)
    except Model190DomainError as exc:
        detail = {"code": exc.code, "message": exc.message}
        if exc.context:
            detail["context"] = exc.context
        raise HTTPException(status_code=exc.status_code, detail=detail) from exc


@router.get("/preview")
def get_preview(
    company_id: int = Query(...),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    return domain_guard(build_model190_preview, db, company_id, year)


@router.get("/reconciliation")
def get_reconciliation(
    company_id: int = Query(...),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    return domain_guard(build_model190_reconciliation, db, company_id, year)
