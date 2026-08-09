from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.schemas.payroll_preparation import (
    PayrollGenerationRequest,
    PayrollGenerationResponse,
    PayrollPreparationEnsureRequest,
    PayrollPreparationResponse,
    PayrollPreparationStatusItem,
)
from app.services.payroll_preparation_service import (
    GENERATED_STATUSES,
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


def normalize_preparation_sources(db: Session, payroll_id: int) -> None:
    """Keep inherited contract lines separate from explicit monthly adjustments.

    Older drafts may have source_type unset even when the description already tells us
    whether the line came from the permanent contract configuration or from the
    monthly preparation editor. Normalizing them makes the overrides-first UI stable
    across existing demo data and newly created drafts.
    """
    items = db.query(PayrollItem).filter(
        PayrollItem.payroll_id == payroll_id,
        PayrollItem.source_key == None,
    ).all()
    changed = False
    for item in items:
        description = str(item.description or "").lower()
        if "permanente" in description and "contrato" in description:
            if item.source_type != "contract":
                item.source_type = "contract"
                changed = True
            continue
        if "concepto mensual informado en preparación" in description or "ajuste mensual" in description:
            if item.source_type != "manual":
                item.source_type = "manual"
                changed = True
    if changed:
        db.commit()


def expose_prepared_items_in_receipt(db: Session, payroll_ids: list[int]) -> None:
    """Tag manual/permanent preparation lines so the existing receipt uses them."""
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
    result = ensure_preparation(db, request)
    normalize_preparation_sources(db, int(result["payroll_id"]))
    return get_preparation(db, int(result["payroll_id"]))


@router.get("/payroll-preparations", response_model=list[PayrollPreparationStatusItem])
def list_payroll_preparations_endpoint(
    period_month: int = Query(..., ge=1, le=15),
    period_year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    payrolls = db.query(Payroll).filter(
        Payroll.period_month == period_month,
        Payroll.period_year == period_year,
        Payroll.status != "cancelled",
    ).order_by(Payroll.id.desc()).all()
    return [
        {
            "payroll_id": payroll.id,
            "contract_id": payroll.contract_id,
            "employee_id": payroll.employee_id,
            "company_id": payroll.company_id,
            "status": payroll.status,
            "generated": payroll.status in GENERATED_STATUSES,
        }
        for payroll in payrolls
    ]


@router.get("/payroll-preparations/{payroll_id}", response_model=PayrollPreparationResponse)
def get_payroll_preparation_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    normalize_preparation_sources(db, payroll_id)
    return get_preparation(db, payroll_id)


@router.get("/payroll-preparations/{payroll_id}/preview", response_model=PayrollPreparationResponse)
def preview_payroll_preparation_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    normalize_preparation_sources(db, payroll_id)
    return get_preparation(db, payroll_id)


@router.post("/payroll-preparations/{payroll_id}/reopen", response_model=PayrollPreparationResponse)
def reopen_payroll_preparation_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")

    payroll.status = "draft"
    db.commit()
    db.refresh(payroll)
    normalize_preparation_sources(db, payroll_id)
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
