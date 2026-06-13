from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.crud.agreement_seniority import (
    create_seniority_rule,
    deactivate_seniority_rule,
    get_seniority_rule,
    get_seniority_rules,
    update_seniority_rule,
)
from app.db import SessionLocal
from app.models.collective_agreement import CollectiveAgreement, ProfessionalCategory, SalaryTable
from app.models.contract import Contract
from app.schemas.agreement_seniority import (
    AgreementSeniorityPreviewResponse,
    AgreementSeniorityRuleCreate,
    AgreementSeniorityRuleResponse,
    AgreementSeniorityRuleUpdate,
    ContractSeniorityPreviewResponse,
)
from app.services.agreement_seniority import build_contract_seniority_preview, get_contract_or_404


router = APIRouter(tags=["agreement-seniority"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_agreement(db: Session, agreement_id: int):
    agreement = db.query(CollectiveAgreement).filter(CollectiveAgreement.id == agreement_id).first()
    if not agreement:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")
    return agreement


def validate_scope(db: Session, agreement_id: int, salary_table_id: int | None, category_id: int | None):
    if salary_table_id is not None:
        table = db.query(SalaryTable).filter(SalaryTable.id == salary_table_id).first()
        if not table or table.collective_agreement_id != agreement_id:
            raise HTTPException(status_code=400, detail="La tabla salarial no pertenece al convenio")
    if category_id is not None:
        category = db.query(ProfessionalCategory).filter(ProfessionalCategory.id == category_id).first()
        if not category or category.collective_agreement_id != agreement_id:
            raise HTTPException(status_code=400, detail="La categoría profesional no pertenece al convenio")


@router.get(
    "/collective-agreements/{agreement_id}/seniority-rules",
    response_model=list[AgreementSeniorityRuleResponse],
)
def list_seniority_rules(
    agreement_id: int,
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    ensure_agreement(db, agreement_id)
    return get_seniority_rules(db, agreement_id, include_inactive=include_inactive)


@router.post(
    "/collective-agreements/{agreement_id}/seniority-rules",
    response_model=AgreementSeniorityRuleResponse,
)
def create_seniority_rule_endpoint(
    agreement_id: int,
    payload: AgreementSeniorityRuleCreate,
    db: Session = Depends(get_db),
):
    ensure_agreement(db, agreement_id)
    validate_scope(db, agreement_id, payload.salary_table_id, payload.professional_category_id)
    return create_seniority_rule(db, agreement_id, payload)


@router.put(
    "/collective-agreements/seniority-rules/{rule_id}",
    response_model=AgreementSeniorityRuleResponse,
)
def update_seniority_rule_endpoint(
    rule_id: int,
    payload: AgreementSeniorityRuleUpdate,
    db: Session = Depends(get_db),
):
    rule = get_seniority_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Regla de antigüedad no encontrada")
    data = payload.model_dump(exclude_unset=True)
    validate_scope(
        db,
        rule.collective_agreement_id,
        data.get("salary_table_id", rule.salary_table_id),
        data.get("professional_category_id", rule.professional_category_id),
    )
    return update_seniority_rule(db, rule_id, payload)


@router.delete("/collective-agreements/seniority-rules/{rule_id}")
def deactivate_seniority_rule_endpoint(rule_id: int, db: Session = Depends(get_db)):
    if not deactivate_seniority_rule(db, rule_id):
        raise HTTPException(status_code=404, detail="Regla de antigüedad no encontrada")
    return {"ok": True, "deactivated_id": rule_id}


@router.get(
    "/contracts/{contract_id}/seniority-preview",
    response_model=ContractSeniorityPreviewResponse,
)
def contract_seniority_preview_endpoint(
    contract_id: int,
    as_of: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    effective_date = as_of or date.today()
    return build_contract_seniority_preview(db, get_contract_or_404(db, contract_id), effective_date)


@router.get(
    "/collective-agreements/{agreement_id}/seniority-preview",
    response_model=AgreementSeniorityPreviewResponse,
)
def agreement_seniority_preview_endpoint(
    agreement_id: int,
    as_of: date | None = Query(default=None),
    active_contracts_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    effective_date = as_of or date.today()
    ensure_agreement(db, agreement_id)
    query = (
        db.query(Contract)
        .options(
            joinedload(Contract.employee),
            joinedload(Contract.salary_table_row),
            joinedload(Contract.agreement_professional_category),
        )
        .filter(Contract.collective_agreement_id == agreement_id)
    )
    if active_contracts_only:
        query = query.filter(Contract.status == "active")
    contracts = query.order_by(Contract.employee_id, Contract.id).all()
    items = [build_contract_seniority_preview(db, contract, effective_date) for contract in contracts]
    eligible = [item for item in items if item["eligibility"] == "eligible"]
    return {
        "collective_agreement_id": agreement_id,
        "as_of_date": effective_date,
        "total_contracts": len(items),
        "eligible_contracts": len(eligible),
        "blocked_contracts": len(items) - len(eligible),
        "total_monthly_amount": sum((item["monthly_amount"] for item in eligible), Decimal("0.00")),
        "contracts": items,
    }
