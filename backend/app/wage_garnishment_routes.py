from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud.wage_garnishment import (
    create_wage_garnishment,
    delete_wage_garnishment,
    get_wage_garnishment,
    get_wage_garnishments,
    update_wage_garnishment,
)
from app.db import SessionLocal
from app.schemas.wage_garnishment import (
    WageGarnishmentCreate,
    WageGarnishmentResponse,
    WageGarnishmentUpdate,
)

router = APIRouter(prefix="/wage-garnishments", tags=["wage-garnishments"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=WageGarnishmentResponse)
def create_endpoint(payload: WageGarnishmentCreate, db: Session = Depends(get_db)):
    return create_wage_garnishment(db, payload)


@router.get("", response_model=list[WageGarnishmentResponse])
def list_endpoint(
    company_id: int | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return get_wage_garnishments(db, company_id=company_id, employee_id=employee_id, status=status)


@router.get("/{garnishment_id}", response_model=WageGarnishmentResponse)
def get_endpoint(garnishment_id: int, db: Session = Depends(get_db)):
    record = get_wage_garnishment(db, garnishment_id)
    if not record:
        raise HTTPException(status_code=404, detail="Embargo no encontrado")
    return record


@router.put("/{garnishment_id}", response_model=WageGarnishmentResponse)
def update_endpoint(
    garnishment_id: int,
    payload: WageGarnishmentUpdate,
    db: Session = Depends(get_db),
):
    record = update_wage_garnishment(db, garnishment_id, payload)
    if not record:
        raise HTTPException(status_code=404, detail="Embargo no encontrado")
    return record


@router.delete("/{garnishment_id}")
def delete_endpoint(garnishment_id: int, db: Session = Depends(get_db)):
    record = delete_wage_garnishment(db, garnishment_id)
    if not record:
        raise HTTPException(status_code=404, detail="Embargo no encontrado")
    return {"ok": True, "deleted_id": garnishment_id}
