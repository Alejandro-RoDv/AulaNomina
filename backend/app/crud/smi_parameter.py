from datetime import date

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.smi_parameter import SmiParameter
from app.schemas.smi_parameter import SmiParameterCreate, SmiParameterUpdate


def list_smi_parameters(db: Session, include_inactive: bool = False):
    query = db.query(SmiParameter)
    if not include_inactive:
        query = query.filter(SmiParameter.is_active.is_(True))
    return query.order_by(SmiParameter.effective_from.desc()).all()


def get_applicable_smi(db: Session, target_date: date):
    return (
        db.query(SmiParameter)
        .filter(
            SmiParameter.is_active.is_(True),
            SmiParameter.effective_from <= target_date,
            or_(SmiParameter.effective_to.is_(None), SmiParameter.effective_to >= target_date),
        )
        .order_by(SmiParameter.effective_from.desc())
        .first()
    )


def _validate_no_overlap(
    db: Session,
    effective_from: date,
    effective_to: date | None,
    exclude_id: int | None = None,
):
    end_value = effective_to or date.max
    query = db.query(SmiParameter).filter(
        SmiParameter.is_active.is_(True),
        SmiParameter.effective_from <= end_value,
        or_(SmiParameter.effective_to.is_(None), SmiParameter.effective_to >= effective_from),
    )
    if exclude_id is not None:
        query = query.filter(SmiParameter.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=400, detail="El periodo del SMI se solapa con otro parámetro activo")


def create_smi_parameter(db: Session, payload: SmiParameterCreate):
    _validate_no_overlap(db, payload.effective_from, payload.effective_to)
    record = SmiParameter(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_smi_parameter(db: Session, parameter_id: int, payload: SmiParameterUpdate):
    record = db.query(SmiParameter).filter(SmiParameter.id == parameter_id).first()
    if not record:
        return None
    update_data = payload.model_dump(exclude_unset=True)
    effective_from = update_data.get("effective_from", record.effective_from)
    effective_to = update_data.get("effective_to", record.effective_to)
    is_active = update_data.get("is_active", record.is_active)
    if is_active:
        _validate_no_overlap(db, effective_from, effective_to, exclude_id=record.id)
    for key, value in update_data.items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record
