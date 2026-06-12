from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud.agreement_parameterization import (
    create_catalog_item,
    create_rule_detail,
    create_rule_header,
    create_salary_concept,
    deactivate_catalog_item,
    delete_rule_detail,
    delete_rule_header,
    delete_salary_concept,
    get_catalog_item,
    get_parameterization,
    get_rule_detail,
    get_rule_header,
    get_salary_concept,
    update_catalog_item,
    update_rule_detail,
    update_rule_header,
    update_salary_concept,
)
from app.crud.collective_agreement import get_collective_agreement
from app.db import SessionLocal
from app.schemas.agreement_parameterization import (
    AgreementConceptCatalogCreate,
    AgreementConceptCatalogResponse,
    AgreementConceptCatalogUpdate,
    AgreementParameterizationResponse,
    AgreementRuleDetailCreate,
    AgreementRuleDetailResponse,
    AgreementRuleDetailUpdate,
    AgreementRuleHeaderCreate,
    AgreementRuleHeaderResponse,
    AgreementRuleHeaderUpdate,
    AgreementSalaryConceptCreate,
    AgreementSalaryConceptResponse,
    AgreementSalaryConceptUpdate,
)
from app.seed_agreement_parameterization import seed_agreement_parameterization

router = APIRouter(prefix="/collective-agreements", tags=["agreement-parameterization"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_agreement(db: Session, agreement_id: int):
    agreement = get_collective_agreement(db, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")
    return agreement


@router.get("/{agreement_id}/parameterization", response_model=AgreementParameterizationResponse)
def read_parameterization(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement(db, agreement_id)
    return get_parameterization(db, agreement_id)


@router.post("/{agreement_id}/parameterization/seed")
def seed_parameterization(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement(db, agreement_id)
    result = seed_agreement_parameterization(db, agreement_id)
    return {"ok": True, "agreement_id": agreement_id, **result}


@router.post("/{agreement_id}/rule-headers", response_model=AgreementRuleHeaderResponse)
def create_rule_header_endpoint(agreement_id: int, payload: AgreementRuleHeaderCreate, db: Session = Depends(get_db)):
    ensure_agreement(db, agreement_id)
    return create_rule_header(db, agreement_id, payload)


@router.put("/rule-headers/{rule_id}", response_model=AgreementRuleHeaderResponse)
def update_rule_header_endpoint(rule_id: int, payload: AgreementRuleHeaderUpdate, db: Session = Depends(get_db)):
    updated = update_rule_header(db, rule_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return updated


@router.delete("/rule-headers/{rule_id}")
def delete_rule_header_endpoint(rule_id: int, db: Session = Depends(get_db)):
    deleted = delete_rule_header(db, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return {"ok": True, "deleted_id": rule_id}


@router.post("/rule-headers/{rule_id}/details", response_model=AgreementRuleDetailResponse)
def create_rule_detail_endpoint(rule_id: int, payload: AgreementRuleDetailCreate, db: Session = Depends(get_db)):
    if not get_rule_header(db, rule_id):
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return create_rule_detail(db, rule_id, payload)


@router.put("/rule-details/{detail_id}", response_model=AgreementRuleDetailResponse)
def update_rule_detail_endpoint(detail_id: int, payload: AgreementRuleDetailUpdate, db: Session = Depends(get_db)):
    updated = update_rule_detail(db, detail_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Detalle no encontrado")
    return updated


@router.delete("/rule-details/{detail_id}")
def delete_rule_detail_endpoint(detail_id: int, db: Session = Depends(get_db)):
    deleted = delete_rule_detail(db, detail_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Detalle no encontrado")
    return {"ok": True, "deleted_id": detail_id}


@router.post("/{agreement_id}/concept-catalog", response_model=AgreementConceptCatalogResponse)
def create_catalog_item_endpoint(agreement_id: int, payload: AgreementConceptCatalogCreate, db: Session = Depends(get_db)):
    ensure_agreement(db, agreement_id)
    return create_catalog_item(db, agreement_id, payload)


@router.put("/concept-catalog/{item_id}", response_model=AgreementConceptCatalogResponse)
def update_catalog_item_endpoint(item_id: int, payload: AgreementConceptCatalogUpdate, db: Session = Depends(get_db)):
    updated = update_catalog_item(db, item_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Concepto de catálogo no encontrado")
    return updated


@router.delete("/concept-catalog/{item_id}")
def deactivate_catalog_item_endpoint(item_id: int, db: Session = Depends(get_db)):
    if not get_catalog_item(db, item_id):
        raise HTTPException(status_code=404, detail="Concepto de catálogo no encontrado")
    updated = deactivate_catalog_item(db, item_id)
    return {"ok": True, "deactivated_id": updated.id}


@router.post("/{agreement_id}/salary-concepts", response_model=AgreementSalaryConceptResponse)
def create_salary_concept_endpoint(agreement_id: int, payload: AgreementSalaryConceptCreate, db: Session = Depends(get_db)):
    ensure_agreement(db, agreement_id)
    return create_salary_concept(db, agreement_id, payload)


@router.put("/salary-concepts/{concept_id}", response_model=AgreementSalaryConceptResponse)
def update_salary_concept_endpoint(concept_id: int, payload: AgreementSalaryConceptUpdate, db: Session = Depends(get_db)):
    updated = update_salary_concept(db, concept_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Concepto salarial no encontrado")
    return updated


@router.delete("/salary-concepts/{concept_id}")
def delete_salary_concept_endpoint(concept_id: int, db: Session = Depends(get_db)):
    if not get_salary_concept(db, concept_id):
        raise HTTPException(status_code=404, detail="Concepto salarial no encontrado")
    deleted = delete_salary_concept(db, concept_id)
    return {"ok": True, "deleted_id": deleted.id}
