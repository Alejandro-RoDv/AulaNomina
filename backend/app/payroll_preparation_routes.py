from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.payroll_preparation import (
    PayrollGenerationRequest,
    PayrollGenerationResponse,
    PayrollPreparationEnsureRequest,
    PayrollPreparationResponse,
)
from app.services.payroll_preparation_service import (
    build_preparation_response,
    ensure_preparation,
    generate_payrolls,
    get_preparation,
)

router = APIRouter(tags=["payroll-preparation"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/payroll-preparations/ensure", response_model=PayrollPreparationResponse)
def ensure_payroll_preparation_endpoint(
    request: PayrollPreparationEnsureRequest,
    db: Session = Depends(get_db),
):
    return ensure_preparation(db, request)


@router.get("/payroll-preparations/{payroll_id}", response_model=PayrollPreparationResponse)
def get_payroll_preparation_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    return get_preparation(db, payroll_id)


@router.get("/payroll-preparations/{payroll_id}/preview", response_model=PayrollPreparationResponse)
def preview_payroll_preparation_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    return get_preparation(db, payroll_id)


@router.post("/payroll-generation", response_model=PayrollGenerationResponse)
def generate_payrolls_endpoint(
    request: PayrollGenerationRequest,
    db: Session = Depends(get_db),
):
    return generate_payrolls(db, request)
