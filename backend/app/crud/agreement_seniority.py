from sqlalchemy.orm import Session, joinedload

from app.models.agreement_seniority import AgreementSeniorityRule
from app.schemas.agreement_seniority import AgreementSeniorityRuleCreate, AgreementSeniorityRuleUpdate


def get_seniority_rules(db: Session, agreement_id: int, include_inactive: bool = False):
    query = (
        db.query(AgreementSeniorityRule)
        .options(
            joinedload(AgreementSeniorityRule.salary_table),
            joinedload(AgreementSeniorityRule.professional_category),
        )
        .filter(AgreementSeniorityRule.collective_agreement_id == agreement_id)
    )
    if not include_inactive:
        query = query.filter(AgreementSeniorityRule.is_active == True)
    return query.order_by(
        AgreementSeniorityRule.display_order,
        AgreementSeniorityRule.professional_category_id,
        AgreementSeniorityRule.id,
    ).all()


def get_seniority_rule(db: Session, rule_id: int):
    return (
        db.query(AgreementSeniorityRule)
        .options(
            joinedload(AgreementSeniorityRule.salary_table),
            joinedload(AgreementSeniorityRule.professional_category),
        )
        .filter(AgreementSeniorityRule.id == rule_id)
        .first()
    )


def create_seniority_rule(db: Session, agreement_id: int, payload: AgreementSeniorityRuleCreate):
    rule = AgreementSeniorityRule(
        collective_agreement_id=agreement_id,
        **payload.model_dump(),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return get_seniority_rule(db, rule.id)


def update_seniority_rule(db: Session, rule_id: int, payload: AgreementSeniorityRuleUpdate):
    rule = db.query(AgreementSeniorityRule).filter(AgreementSeniorityRule.id == rule_id).first()
    if not rule:
        return None
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    db.commit()
    db.refresh(rule)
    return get_seniority_rule(db, rule.id)


def deactivate_seniority_rule(db: Session, rule_id: int):
    rule = db.query(AgreementSeniorityRule).filter(AgreementSeniorityRule.id == rule_id).first()
    if not rule:
        return None
    rule.is_active = False
    db.commit()
    db.refresh(rule)
    return rule
