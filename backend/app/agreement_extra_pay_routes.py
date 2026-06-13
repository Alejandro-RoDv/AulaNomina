from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.contract_extra_pay_routes import router as contract_extra_pay_router
from app.db import SessionLocal
from app.schemas.agreement_extra_pay import (
    AgreementExtraPayCandidate,
    AgreementExtraPayConceptCreate,
    AgreementExtraPayConceptResponse,
    AgreementExtraPayConceptUpdate,
    AgreementExtraPayCreate,
    AgreementExtraPayPreviewResponse,
    AgreementExtraPayResponse,
    AgreementExtraPayUpdate,
)
from app.services.agreement_extra_pay import (
    _get_extra_pay,
    create_extra_pay,
    create_extra_pay_concept,
    delete_extra_pay,
    delete_extra_pay_concept,
    list_extra_pays,
    preview_extra_pay,
    resolve_extra_pay_candidates,
    update_extra_pay,
    update_extra_pay_concept,
)


router = APIRouter(prefix="/collective-agreements", tags=["agreement-extra-pays"])
router.include_router(contract_extra_pay_router)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{agreement_id}/extra-pays", response_model=list[AgreementExtraPayResponse])
def list_extra_pays_endpoint(
    agreement_id: int,
    salary_table_id: int | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return list_extra_pays(
        db,
        agreement_id,
        salary_table_id=salary_table_id,
        include_inactive=include_inactive,
    )


@router.post("/{agreement_id}/extra-pays", response_model=AgreementExtraPayResponse)
def create_extra_pay_endpoint(
    agreement_id: int,
    payload: AgreementExtraPayCreate,
    db: Session = Depends(get_db),
):
    return create_extra_pay(db, agreement_id, payload)


@router.put("/extra-pays/{extra_pay_id}", response_model=AgreementExtraPayResponse)
def update_extra_pay_endpoint(
    extra_pay_id: int,
    payload: AgreementExtraPayUpdate,
    db: Session = Depends(get_db),
):
    return update_extra_pay(db, extra_pay_id, payload)


@router.delete("/extra-pays/{extra_pay_id}")
def delete_extra_pay_endpoint(extra_pay_id: int, db: Session = Depends(get_db)):
    deleted = delete_extra_pay(db, extra_pay_id)
    return {"ok": True, "deleted_id": deleted.id}


@router.post(
    "/extra-pays/{extra_pay_id}/concepts",
    response_model=AgreementExtraPayConceptResponse,
)
def create_extra_pay_concept_endpoint(
    extra_pay_id: int,
    payload: AgreementExtraPayConceptCreate,
    db: Session = Depends(get_db),
):
    return create_extra_pay_concept(db, extra_pay_id, payload)


@router.put(
    "/extra-pay-concepts/{concept_line_id}",
    response_model=AgreementExtraPayConceptResponse,
)
def update_extra_pay_concept_endpoint(
    concept_line_id: int,
    payload: AgreementExtraPayConceptUpdate,
    db: Session = Depends(get_db),
):
    return update_extra_pay_concept(db, concept_line_id, payload)


@router.delete("/extra-pay-concepts/{concept_line_id}")
def delete_extra_pay_concept_endpoint(concept_line_id: int, db: Session = Depends(get_db)):
    deleted = delete_extra_pay_concept(db, concept_line_id)
    return {"ok": True, "deleted_id": deleted.id}


@router.get(
    "/{agreement_id}/extra-pay-candidates",
    response_model=list[AgreementExtraPayCandidate],
)
def extra_pay_candidates_endpoint(
    agreement_id: int,
    salary_table_id: int = Query(...),
    professional_category_id: int = Query(...),
    db: Session = Depends(get_db),
):
    return resolve_extra_pay_candidates(
        db,
        agreement_id,
        salary_table_id,
        professional_category_id,
    )


@router.get(
    "/extra-pays/{extra_pay_id}/preview",
    response_model=AgreementExtraPayPreviewResponse,
)
def preview_extra_pay_endpoint(
    extra_pay_id: int,
    professional_category_id: int = Query(...),
    salary_table_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    extra_pay = _get_extra_pay(db, extra_pay_id)
    result = preview_extra_pay(
        db,
        extra_pay_id,
        professional_category_id,
        salary_table_id=salary_table_id,
    )
    result.update(
        {
            "payroll_period": extra_pay.payroll_period,
            "apply_partiality": extra_pay.apply_partiality,
            "deduct_it_days": extra_pay.deduct_it_days,
            "deduct_unpaid_absence_days": extra_pay.deduct_unpaid_absence_days,
            "deduct_inactivity_days": extra_pay.deduct_inactivity_days,
        }
    )
    return result
