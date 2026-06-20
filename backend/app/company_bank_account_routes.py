from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud.company import get_company
from app.crud.company_bank_account import assign_payment_operation, build_payment_operations, create_company_bank_account, delete_company_bank_account, get_company_bank_accounts, unassign_payment_operation, update_company_bank_account
from app.db import SessionLocal
from app.schemas.company_bank_account import CompanyBankAccountCreate, CompanyBankAccountResponse, CompanyBankAccountUpdate, CompanyBankingResponse, PaymentAssignmentUpdate

router = APIRouter(tags=["company-banking"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_company(db: Session, company_id: int):
    if not get_company(db, company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")


@router.get("/{company_id}/banking", response_model=CompanyBankingResponse)
def read_company_banking(company_id: int, db: Session = Depends(get_db)):
    ensure_company(db, company_id)
    return {"company_id": company_id, "accounts": get_company_bank_accounts(db, company_id), "operations": build_payment_operations(db, company_id)}


@router.post("/{company_id}/bank-accounts", response_model=CompanyBankAccountResponse)
def create_bank_account(company_id: int, payload: CompanyBankAccountCreate, db: Session = Depends(get_db)):
    ensure_company(db, company_id)
    try:
        return create_company_bank_account(db, company_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.put("/{company_id}/bank-accounts/{account_id}", response_model=CompanyBankAccountResponse)
def update_bank_account(company_id: int, account_id: int, payload: CompanyBankAccountUpdate, db: Session = Depends(get_db)):
    ensure_company(db, company_id)
    try:
        account = update_company_bank_account(db, company_id, account_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    return account


@router.delete("/{company_id}/bank-accounts/{account_id}")
def remove_bank_account(company_id: int, account_id: int, db: Session = Depends(get_db)):
    ensure_company(db, company_id)
    if not delete_company_bank_account(db, company_id, account_id):
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    return {"ok": True}


@router.put("/{company_id}/payment-operations/{operation_code}")
def assign_operation(company_id: int, operation_code: str, payload: PaymentAssignmentUpdate, db: Session = Depends(get_db)):
    ensure_company(db, company_id)
    try:
        assignment = assign_payment_operation(db, company_id, operation_code, payload.account_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"ok": True, "operation_code": assignment.operation_code, "account_id": assignment.account_id}


@router.delete("/{company_id}/payment-operations/{operation_code}")
def unassign_operation(company_id: int, operation_code: str, db: Session = Depends(get_db)):
    ensure_company(db, company_id)
    return {"ok": True, "removed": unassign_payment_operation(db, company_id, operation_code)}
