from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.crud.social_security_registration import (
    create_social_security_registration,
    get_social_security_registration,
    update_social_security_registration,
)
from app.schemas.social_security_registration import (
    SocialSecurityRegistrationCreate,
    SocialSecurityRegistrationResponse,
    SocialSecurityRegistrationUpdate,
)

router = APIRouter(prefix="/contracts", tags=["social-security-registration"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get(
    "/{contract_id}/social-security-registration",
    response_model=SocialSecurityRegistrationResponse | None,
)
def get_social_security_registration_endpoint(contract_id: int, db: Session = Depends(get_db)):
    return get_social_security_registration(db, contract_id)


@router.post(
    "/{contract_id}/social-security-registration",
    response_model=SocialSecurityRegistrationResponse,
)
def create_social_security_registration_endpoint(
    contract_id: int,
    registration: SocialSecurityRegistrationCreate,
    db: Session = Depends(get_db),
):
    return create_social_security_registration(db, contract_id, registration)


@router.put(
    "/{contract_id}/social-security-registration",
    response_model=SocialSecurityRegistrationResponse,
)
def update_social_security_registration_endpoint(
    contract_id: int,
    registration: SocialSecurityRegistrationUpdate,
    db: Session = Depends(get_db),
):
    return update_social_security_registration(db, contract_id, registration)
