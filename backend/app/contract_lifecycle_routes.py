from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.contract_lifecycle import (
    ContractExtensionRequest,
    ContractLifecycleEventResponse,
    ContractWorkdayChangeRequest,
)
from app.services.contract_lifecycle_service import (
    ContractLifecycleError,
    list_contract_lifecycle_events,
    register_contract_extension,
    register_workday_change,
)


router = APIRouter(prefix="/contracts", tags=["contracts"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{contract_id}/lifecycle", response_model=list[ContractLifecycleEventResponse])
def contract_lifecycle(contract_id: int, db: Session = Depends(get_db)):
    try:
        return list_contract_lifecycle_events(db, contract_id)
    except ContractLifecycleError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{contract_id}/lifecycle/workday-change", response_model=ContractLifecycleEventResponse)
def contract_workday_change(
    contract_id: int,
    payload: ContractWorkdayChangeRequest,
    db: Session = Depends(get_db),
):
    try:
        return register_workday_change(db, contract_id, payload)
    except ContractLifecycleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{contract_id}/lifecycle/extension", response_model=ContractLifecycleEventResponse)
def contract_extension(
    contract_id: int,
    payload: ContractExtensionRequest,
    db: Session = Depends(get_db),
):
    try:
        return register_contract_extension(db, contract_id, payload)
    except ContractLifecycleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
