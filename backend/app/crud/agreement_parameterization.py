from sqlalchemy.orm import Session, selectinload

from app.models.agreement_parameterization import (
    AgreementConceptCatalog,
    AgreementRuleDetail,
    AgreementRuleHeader,
    AgreementSalaryConcept,
)
from app.schemas.agreement_parameterization import (
    AgreementConceptCatalogCreate,
    AgreementConceptCatalogUpdate,
    AgreementRuleDetailCreate,
    AgreementRuleDetailUpdate,
    AgreementRuleHeaderCreate,
    AgreementRuleHeaderUpdate,
    AgreementSalaryConceptCreate,
    AgreementSalaryConceptUpdate,
)


def get_parameterization(db: Session, agreement_id: int):
    rule_headers = (
        db.query(AgreementRuleHeader)
        .options(selectinload(AgreementRuleHeader.details))
        .filter(AgreementRuleHeader.collective_agreement_id == agreement_id)
        .order_by(AgreementRuleHeader.rule_type, AgreementRuleHeader.name)
        .all()
    )
    salary_concepts = (
        db.query(AgreementSalaryConcept)
        .filter(AgreementSalaryConcept.collective_agreement_id == agreement_id)
        .order_by(AgreementSalaryConcept.character, AgreementSalaryConcept.name)
        .all()
    )
    concept_catalog = (
        db.query(AgreementConceptCatalog)
        .filter(AgreementConceptCatalog.collective_agreement_id == agreement_id)
        .order_by(AgreementConceptCatalog.catalog_type, AgreementConceptCatalog.code, AgreementConceptCatalog.name)
        .all()
    )
    return {
        "rule_headers": rule_headers,
        "salary_concepts": salary_concepts,
        "concept_catalog": concept_catalog,
    }


def create_rule_header(db: Session, agreement_id: int, payload: AgreementRuleHeaderCreate):
    data = payload.model_dump(exclude={"details"})
    db_rule = AgreementRuleHeader(collective_agreement_id=agreement_id, **data)
    db.add(db_rule)
    db.flush()
    for detail in payload.details:
        db.add(AgreementRuleDetail(rule_header_id=db_rule.id, **detail.model_dump()))
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_rule_header(db: Session, rule_id: int):
    return (
        db.query(AgreementRuleHeader)
        .options(selectinload(AgreementRuleHeader.details))
        .filter(AgreementRuleHeader.id == rule_id)
        .first()
    )


def update_rule_header(db: Session, rule_id: int, payload: AgreementRuleHeaderUpdate):
    db_rule = get_rule_header(db, rule_id)
    if not db_rule:
        return None
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_rule, key, value)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def delete_rule_header(db: Session, rule_id: int):
    db_rule = get_rule_header(db, rule_id)
    if not db_rule:
        return None
    db.delete(db_rule)
    db.commit()
    return db_rule


def create_rule_detail(db: Session, rule_id: int, payload: AgreementRuleDetailCreate):
    db_detail = AgreementRuleDetail(rule_header_id=rule_id, **payload.model_dump())
    db.add(db_detail)
    db.commit()
    db.refresh(db_detail)
    return db_detail


def get_rule_detail(db: Session, detail_id: int):
    return db.query(AgreementRuleDetail).filter(AgreementRuleDetail.id == detail_id).first()


def update_rule_detail(db: Session, detail_id: int, payload: AgreementRuleDetailUpdate):
    db_detail = get_rule_detail(db, detail_id)
    if not db_detail:
        return None
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_detail, key, value)
    db.commit()
    db.refresh(db_detail)
    return db_detail


def delete_rule_detail(db: Session, detail_id: int):
    db_detail = get_rule_detail(db, detail_id)
    if not db_detail:
        return None
    db.delete(db_detail)
    db.commit()
    return db_detail


def create_catalog_item(db: Session, agreement_id: int, payload: AgreementConceptCatalogCreate):
    db_item = AgreementConceptCatalog(collective_agreement_id=agreement_id, **payload.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def get_catalog_item(db: Session, item_id: int):
    return db.query(AgreementConceptCatalog).filter(AgreementConceptCatalog.id == item_id).first()


def update_catalog_item(db: Session, item_id: int, payload: AgreementConceptCatalogUpdate):
    db_item = get_catalog_item(db, item_id)
    if not db_item:
        return None
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)
    db.commit()
    db.refresh(db_item)
    return db_item


def deactivate_catalog_item(db: Session, item_id: int):
    db_item = get_catalog_item(db, item_id)
    if not db_item:
        return None
    db_item.is_active = False
    db.commit()
    db.refresh(db_item)
    return db_item


def create_salary_concept(db: Session, agreement_id: int, payload: AgreementSalaryConceptCreate):
    db_concept = AgreementSalaryConcept(collective_agreement_id=agreement_id, **payload.model_dump())
    db.add(db_concept)
    db.commit()
    db.refresh(db_concept)
    return db_concept


def get_salary_concept(db: Session, concept_id: int):
    return db.query(AgreementSalaryConcept).filter(AgreementSalaryConcept.id == concept_id).first()


def update_salary_concept(db: Session, concept_id: int, payload: AgreementSalaryConceptUpdate):
    db_concept = get_salary_concept(db, concept_id)
    if not db_concept:
        return None
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_concept, key, value)
    db.commit()
    db.refresh(db_concept)
    return db_concept


def delete_salary_concept(db: Session, concept_id: int):
    db_concept = get_salary_concept(db, concept_id)
    if not db_concept:
        return None
    db.delete(db_concept)
    db.commit()
    return db_concept
