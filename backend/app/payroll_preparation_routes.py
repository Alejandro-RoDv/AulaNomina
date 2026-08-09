from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.payroll_salary_structure import PayrollItem
from app.schemas.payroll_preparation import (
    PayrollGenerationRequest,
    PayrollGenerationResponse,
    PayrollPreparationEnsureRequest,
    PayrollPreparationResponse,
)
from app.services.payroll_preparation_service import (
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


def expose_prepared_items_in_receipt(db: Session, payroll_ids: list[int]) -> None:
    """Tag manual/permanent preparation lines so the existing receipt uses them.

    The receipt renderer prefers ENGINE-prefixed items when a payroll has canonical
    engine lines. Prepared lines do not originally have a source key, so without
    this tag they would disappear from the generated receipt even though their
    amounts were used for generation.
    """
    if not payroll_ids:
        return
    items = db.query(PayrollItem).filter(
        PayrollItem.payroll_id.in_(payroll_ids),
        PayrollItem.source_key == None,
    ).all()
    for item in items:
        item.source_key = f"ENGINE:{item.payroll_id}:PREP:{item.id}"
    if items:
        db.commit()


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
    result = generate_payrolls(db, request)
    generated_ids = [
        int(item["payroll_id"])
        for item in result.get("items", [])
        if item.get("payroll_id") and item.get("source") in {"prepared", "automatic"}
    ]
    expose_prepared_items_in_receipt(db, generated_ids)
    return result
