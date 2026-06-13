from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.contract_extra_pay import (
    ContractExtraPayPayrollCreateRequest,
    ContractExtraPayPayrollCreateResponse,
    ContractExtraPayPreviewResponse,
)
from app.services.contract_extra_pay_generation import create_contract_extra_payroll
from app.services.contract_extra_pay_preview import preview_contract_extra_pay


router = APIRouter(
    prefix="/collective-agreements/extra-pays",
    tags=["contract-extra-pays"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get(
    "/{extra_pay_id}/contracts/{contract_id}/preview",
    response_model=ContractExtraPayPreviewResponse,
)
def preview_contract_extra_pay_endpoint(
    extra_pay_id: int,
    contract_id: int,
    period_year: int = Query(..., ge=1900, le=2200),
    db: Session = Depends(get_db),
):
    return preview_contract_extra_pay(db, extra_pay_id, contract_id, period_year)


@router.post(
    "/{extra_pay_id}/contracts/{contract_id}/payroll",
    response_model=ContractExtraPayPayrollCreateResponse,
)
def create_contract_extra_payroll_endpoint(
    extra_pay_id: int,
    contract_id: int,
    payload: ContractExtraPayPayrollCreateRequest,
    db: Session = Depends(get_db),
):
    return create_contract_extra_payroll(db, extra_pay_id, contract_id, payload)
