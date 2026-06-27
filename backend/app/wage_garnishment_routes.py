from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud.document import create_document, get_documents_by_wage_garnishment
from app.crud.smi_parameter import (
    create_smi_parameter,
    get_applicable_smi,
    list_smi_parameters,
    update_smi_parameter,
)
from app.crud.wage_garnishment import (
    create_wage_garnishment,
    delete_wage_garnishment,
    get_wage_garnishment,
    get_wage_garnishments,
    update_wage_garnishment,
)
from app.crud.wage_garnishment_movement import (
    create_movement,
    delete_movement,
    list_movements,
    update_movement,
)
from app.db import SessionLocal
from app.schemas.document import DocumentCreate, DocumentResponse
from app.schemas.smi_parameter import SmiParameterCreate, SmiParameterResponse, SmiParameterUpdate
from app.schemas.wage_garnishment import (
    WageGarnishmentCreate,
    WageGarnishmentResponse,
    WageGarnishmentUpdate,
)
from app.schemas.wage_garnishment_movement import (
    WageGarnishmentMovementCreate,
    WageGarnishmentMovementResponse,
    WageGarnishmentMovementUpdate,
)

router = APIRouter(prefix="/wage-garnishments", tags=["wage-garnishments"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/smi/current", response_model=SmiParameterResponse)
def current_smi_endpoint(
    target_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_db),
):
    parameter = get_applicable_smi(db, target_date)
    if not parameter:
        raise HTTPException(status_code=404, detail="No existe un SMI configurado para la fecha indicada")
    return parameter


@router.get("/smi/parameters", response_model=list[SmiParameterResponse])
def list_smi_endpoint(include_inactive: bool = False, db: Session = Depends(get_db)):
    return list_smi_parameters(db, include_inactive=include_inactive)


@router.post("/smi/parameters", response_model=SmiParameterResponse)
def create_smi_endpoint(payload: SmiParameterCreate, db: Session = Depends(get_db)):
    return create_smi_parameter(db, payload)


@router.put("/smi/parameters/{parameter_id}", response_model=SmiParameterResponse)
def update_smi_endpoint(parameter_id: int, payload: SmiParameterUpdate, db: Session = Depends(get_db)):
    parameter = update_smi_parameter(db, parameter_id, payload)
    if not parameter:
        raise HTTPException(status_code=404, detail="Parámetro SMI no encontrado")
    return parameter


@router.post("", response_model=WageGarnishmentResponse)
def create_endpoint(payload: WageGarnishmentCreate, db: Session = Depends(get_db)):
    return create_wage_garnishment(db, payload)


@router.get("", response_model=list[WageGarnishmentResponse])
def list_endpoint(
    company_id: int | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return get_wage_garnishments(
        db,
        company_id=company_id,
        employee_id=employee_id,
        status=status,
        include_archived=include_archived,
    )


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
def delete_endpoint(
    garnishment_id: int,
    reason: str | None = Query(default=None),
    deleted_by: str = Query(default="usuario-demo"),
    db: Session = Depends(get_db),
):
    result = delete_wage_garnishment(db, garnishment_id, reason=reason, deleted_by=deleted_by)
    if not result:
        raise HTTPException(status_code=404, detail="Embargo no encontrado")
    return {"ok": True, **result}


@router.get("/{garnishment_id}/movements", response_model=list[WageGarnishmentMovementResponse])
def list_movements_endpoint(garnishment_id: int, db: Session = Depends(get_db)):
    return list_movements(db, garnishment_id)


@router.post("/{garnishment_id}/movements", response_model=WageGarnishmentMovementResponse)
def create_movement_endpoint(
    garnishment_id: int,
    payload: WageGarnishmentMovementCreate,
    db: Session = Depends(get_db),
):
    return create_movement(db, garnishment_id, payload)


@router.put("/{garnishment_id}/movements/{movement_id}", response_model=WageGarnishmentMovementResponse)
def update_movement_endpoint(
    garnishment_id: int,
    movement_id: int,
    payload: WageGarnishmentMovementUpdate,
    db: Session = Depends(get_db),
):
    movement = update_movement(db, garnishment_id, movement_id, payload)
    if not movement:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    return movement


@router.delete("/{garnishment_id}/movements/{movement_id}")
def delete_movement_endpoint(garnishment_id: int, movement_id: int, db: Session = Depends(get_db)):
    movement = delete_movement(db, garnishment_id, movement_id)
    if not movement:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    return {"ok": True, "deleted_id": movement_id}


@router.get("/{garnishment_id}/documents", response_model=list[DocumentResponse])
def list_documents_endpoint(garnishment_id: int, db: Session = Depends(get_db)):
    if not get_wage_garnishment(db, garnishment_id):
        raise HTTPException(status_code=404, detail="Embargo no encontrado")
    return get_documents_by_wage_garnishment(db, garnishment_id)


@router.post("/{garnishment_id}/documents", response_model=DocumentResponse)
def create_document_endpoint(
    garnishment_id: int,
    payload: DocumentCreate,
    db: Session = Depends(get_db),
):
    if not get_wage_garnishment(db, garnishment_id):
        raise HTTPException(status_code=404, detail="Embargo no encontrado")
    return create_document(db, payload.model_copy(update={"wage_garnishment_id": garnishment_id}))
