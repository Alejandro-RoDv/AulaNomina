from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.social_security_registration import SocialSecurityRegistration
from app.schemas.social_security_registration import (
    SocialSecurityRegistrationCreate,
    SocialSecurityRegistrationUpdate,
)


def get_social_security_registration(db: Session, contract_id: int):
    return (
        db.query(SocialSecurityRegistration)
        .filter(SocialSecurityRegistration.contract_id == contract_id)
        .first()
    )


def create_social_security_registration(
    db: Session,
    contract_id: int,
    registration: SocialSecurityRegistrationCreate,
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    existing = get_social_security_registration(db, contract_id)
    if existing:
        raise HTTPException(status_code=400, detail="El contrato ya tiene alta SS simulada")

    db_registration = SocialSecurityRegistration(
        contract_id=contract_id,
        **registration.model_dump(),
    )
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)
    return db_registration


def update_social_security_registration(
    db: Session,
    contract_id: int,
    registration: SocialSecurityRegistrationUpdate,
):
    db_registration = get_social_security_registration(db, contract_id)
    if not db_registration:
        raise HTTPException(status_code=404, detail="Alta SS simulada no encontrada")

    update_data = registration.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_registration, key, value)

    db_registration.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_registration)
    return db_registration
