from sqlalchemy.orm import Session

from app.models.tax_profile import TaxProfile
from app.schemas.tax_profile import TaxProfileCreate, TaxProfileUpdate


def get_tax_profiles(db: Session):
    return db.query(TaxProfile).order_by(TaxProfile.id.desc()).all()


def get_tax_profile(db: Session, tax_profile_id: int):
    return db.query(TaxProfile).filter(TaxProfile.id == tax_profile_id).first()


def get_tax_profile_by_employee(db: Session, employee_id: int):
    return db.query(TaxProfile).filter(TaxProfile.employee_id == employee_id).first()


def create_tax_profile(db: Session, tax_profile: TaxProfileCreate):
    db_tax_profile = TaxProfile(**tax_profile.model_dump())
    db.add(db_tax_profile)
    db.commit()
    db.refresh(db_tax_profile)
    return db_tax_profile


def upsert_tax_profile(db: Session, employee_id: int, tax_profile_data: TaxProfileUpdate):
    tax_profile = get_tax_profile_by_employee(db, employee_id)
    update_data = tax_profile_data.model_dump(exclude_unset=True)

    if not tax_profile:
        tax_profile = TaxProfile(employee_id=employee_id, **update_data)
        db.add(tax_profile)
    else:
        for field, value in update_data.items():
            setattr(tax_profile, field, value)

    db.commit()
    db.refresh(tax_profile)
    return tax_profile


def delete_tax_profile(db: Session, tax_profile_id: int):
    tax_profile = get_tax_profile(db, tax_profile_id)
    if not tax_profile:
        return None

    db.delete(tax_profile)
    db.commit()
    return tax_profile
