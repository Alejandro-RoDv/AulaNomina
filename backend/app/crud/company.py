from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.contract import Contract
from app.schemas.company import CompanyCreate, CompanyUpdate


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


def get_company(db: Session, company_id: int):
    return db.query(Company).filter(Company.id == company_id).first()


def get_company_by_cif(db: Session, cif: str):
    return db.query(Company).filter(Company.cif == cif).first()


def get_company_by_ccc(db: Session, ccc: str):
    return db.query(Company).filter(Company.ccc == ccc).first()


def update_company(db: Session, company_id: int, company_data: CompanyUpdate):
    db_company = get_company(db, company_id)
    if not db_company:
        return None

    update_data = company_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_company, key, value)

    db.commit()
    db.refresh(db_company)
    return db_company


def soft_delete_company(db: Session, company_id: int):
    db_company = get_company(db, company_id)
    if not db_company:
        return None

    db.query(Contract).filter(Contract.company_id == company_id).delete(synchronize_session=False)
    db.delete(db_company)
    db.commit()
    return db_company
