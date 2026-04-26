from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.company import CompanyCreate


def create_company(db: Session, company: CompanyCreate):
    db_company = Company(**company.model_dump())
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company


def get_companies(db: Session):
    return db.query(Company).filter(Company.is_active == True).all()


def get_companies_all(db: Session):
    return db.query(Company).all()


def get_company_by_cif(db: Session, cif: str):
    return db.query(Company).filter(Company.cif == cif).first()
