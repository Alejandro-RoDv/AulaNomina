from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.incident_advanced import IncidentRegularization
from app.models.incident_calculation import IncidentCalculationRule
from app.schemas.incident_advanced import (
    IncidentRegularizationResponse,
    IncidentRuleCreate,
    IncidentRuleResponse,
    IncidentRuleUpdate,
    VacationAdjustmentCreate,
    VacationBalanceResponse,
)
from app.services.incident_regularization import generate_incident_regularization
from app.services.vacation_balance import add_vacation_adjustment, vacation_balance


router = APIRouter(tags=["incident-advanced"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/calculation-rules", response_model=list[IncidentRuleResponse])
def list_calculation_rules(
    agreement_id: int | None = None,
    incident_type: str | None = None,
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    query = db.query(IncidentCalculationRule)
    if agreement_id is not None:
        query = query.filter(IncidentCalculationRule.agreement_id == agreement_id)
    if incident_type:
        query = query.filter(IncidentCalculationRule.incident_type == incident_type)
    if not include_inactive:
        query = query.filter(IncidentCalculationRule.is_active.is_(True))
    return query.order_by(IncidentCalculationRule.incident_type, IncidentCalculationRule.priority.desc(), IncidentCalculationRule.valid_from.desc()).all()


@router.post("/calculation-rules", response_model=IncidentRuleResponse)
def create_calculation_rule(payload: IncidentRuleCreate, db: Session = Depends(get_db)):
    if db.query(IncidentCalculationRule).filter(IncidentCalculationRule.code == payload.code).first():
        raise HTTPException(status_code=409, detail="Ya existe una regla con ese código")
    if payload.valid_to and payload.valid_to < payload.valid_from:
        raise HTTPException(status_code=400, detail="La fecha fin no puede ser anterior a la fecha inicial")
    values = payload.model_dump(exclude={"actor"})
    rule = IncidentCalculationRule(**values, is_active=True)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/calculation-rules/{rule_id}", response_model=IncidentRuleResponse)
def update_calculation_rule(rule_id: int, payload: IncidentRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(IncidentCalculationRule).filter(IncidentCalculationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    values = payload.model_dump(exclude_unset=True, exclude={"actor"})
    next_from = values.get("valid_from", rule.valid_from)
    next_to = values.get("valid_to", rule.valid_to)
    if next_to and next_to < next_from:
        raise HTTPException(status_code=400, detail="La fecha fin no puede ser anterior a la fecha inicial")
    for field, value in values.items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/calculation-rules/{rule_id}/deactivate", response_model=IncidentRuleResponse)
def deactivate_calculation_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(IncidentCalculationRule).filter(IncidentCalculationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    rule.is_active = False
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/employees/{employee_id}/vacation-balance", response_model=VacationBalanceResponse)
def get_vacation_balance(
    employee_id: int,
    year: int,
    contract_id: int | None = None,
    db: Session = Depends(get_db),
):
    return vacation_balance(db, employee_id, year, contract_id)


@router.post("/contracts/{contract_id}/vacation-adjustments")
def create_vacation_adjustment(
    contract_id: int,
    payload: VacationAdjustmentCreate,
    db: Session = Depends(get_db),
):
    entry = add_vacation_adjustment(
        db,
        contract_id,
        payload.year,
        payload.amount,
        payload.unit,
        payload.description,
        payload.actor,
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return {"id": entry.id, "contract_id": entry.contract_id, "amount": entry.amount, "year": entry.year}


@router.post("/{incident_id}/generate-regularization", response_model=IncidentRegularizationResponse)
def create_incident_regularization(
    incident_id: int,
    actor: str | None = None,
    db: Session = Depends(get_db),
):
    return generate_incident_regularization(db, incident_id, actor=actor)


@router.get("/{incident_id}/regularizations", response_model=list[IncidentRegularizationResponse])
def list_incident_regularizations(incident_id: int, db: Session = Depends(get_db)):
    return (
        db.query(IncidentRegularization)
        .filter(IncidentRegularization.incident_id == incident_id)
        .order_by(IncidentRegularization.created_at.desc(), IncidentRegularization.id.desc())
        .all()
    )
