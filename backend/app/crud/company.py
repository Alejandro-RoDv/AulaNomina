from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_bank_account import CompanyBankAccount, CompanyPaymentAssignment
from app.models.contract import Contract
from app.models.work_center import WorkCenter
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.services.ccc_service import canonical_ccc, ccc_parts, compose_ccc


def _company_ccc(data: dict, current: Company | None = None) -> tuple[str | None, str | None, str | None]:
    has_ccc_update = any(key in data for key in {"ccc", "ccc_regime", "ccc_code"})
    if not has_ccc_update and current is not None:
        return current.ccc, current.ccc_regime, current.ccc_code
    raw = data.get("ccc")
    raw_regime, raw_code = ccc_parts(raw)
    regime = data.get("ccc_regime") if "ccc_regime" in data else raw_regime
    code = data.get("ccc_code") if "ccc_code" in data else raw_code
    if not regime and current is not None:
        regime = current.ccc_regime or ccc_parts(current.ccc)[0]
    if not code and current is not None:
        code = current.ccc_code or ccc_parts(current.ccc)[1]
    ccc = compose_ccc(regime, code) if regime or code else canonical_ccc(raw)
    return ccc, regime, code


def create_company(db: Session, company: CompanyCreate):
    data = company.model_dump()
    data["ccc"], data["ccc_regime"], data["ccc_code"] = _company_ccc(data)
    db_company = Company(**data)
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
    target = canonical_ccc(ccc)
    for company in db.query(Company).all():
        try:
            if canonical_ccc(company.ccc) == target:
                return company
        except ValueError:
            continue
    return None


def update_company(db: Session, company_id: int, company_data: CompanyUpdate):
    db_company = get_company(db, company_id)
    if not db_company:
        return None

    update_data = company_data.model_dump(exclude_unset=True)
    old_ccc = db_company.ccc
    new_ccc, regime, code = _company_ccc(update_data, db_company)
    if any(key in update_data for key in {"ccc", "ccc_regime", "ccc_code"}):
        update_data.update({"ccc": new_ccc, "ccc_regime": regime, "ccc_code": code})
    for key, value in update_data.items():
        setattr(db_company, key, value)

    if new_ccc != old_ccc:
        db.query(WorkCenter).filter(WorkCenter.company_id == company_id).update(
            {WorkCenter.general_ccc: new_ccc}, synchronize_session=False
        )
    db.commit()
    db.refresh(db_company)
    return db_company


def soft_delete_company(db: Session, company_id: int):
    db_company = get_company(db, company_id)
    if not db_company:
        return None

    db.query(CompanyPaymentAssignment).filter(
        CompanyPaymentAssignment.company_id == company_id
    ).delete(synchronize_session=False)
    db.query(CompanyBankAccount).filter(
        CompanyBankAccount.company_id == company_id
    ).delete(synchronize_session=False)
    db.query(Contract).filter(
        Contract.company_id == company_id
    ).delete(synchronize_session=False)
    db.delete(db_company)
    db.commit()
    return db_company
