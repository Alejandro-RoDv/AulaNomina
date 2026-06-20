import re

from sqlalchemy.orm import Session

from app.models.company_bank_account import CompanyBankAccount, CompanyPaymentAssignment
from app.schemas.company_bank_account import CompanyBankAccountCreate, CompanyBankAccountUpdate


PAYMENT_OPERATIONS = [
    ("ccc_main_debit", "Cargo en cuenta liquidaciones CCC principal", "Seguridad Social", 10),
    ("ccc_main_credit", "Abono cuenta liquidaciones saldo acreedor", "Seguridad Social", 20),
    ("ccc_admin_debit", "Cargo en cuenta liquidaciones CCC Administración", "CCC secundarios", 30),
    ("ccc_admin_credit", "Abono cuenta liquidaciones saldo acreedor Administración", "CCC secundarios", 40),
    ("ccc_training_debit", "Cargo en cuenta liquidaciones CCC Formación", "CCC secundarios", 50),
    ("ccc_training_credit", "Abono cuenta liquidaciones saldo acreedor Formación", "CCC secundarios", 60),
    ("ccc_scholar_debit", "Cargo en cuenta liquidaciones CCC Becarios", "CCC secundarios", 70),
    ("ccc_scholar_credit", "Abono cuenta liquidaciones saldo acreedor Becarios", "CCC secundarios", 80),
    ("payroll_transfer", "Transferencia de nóminas", "Nóminas", 90),
    ("model_111", "Retenciones Modelo 111", "Fiscalidad", 100),
    ("professional_fees", "Facturación de honorarios", "Facturación", 110),
]

OPERATION_CODES = {item[0] for item in PAYMENT_OPERATIONS}


def normalize_spanish_iban(value: str) -> dict[str, str]:
    iban = re.sub(r"[\s-]+", "", value or "").upper()
    if len(iban) != 24 or not iban.startswith("ES"):
        raise ValueError("El IBAN debe comenzar por ES y contener 24 posiciones")
    if not re.fullmatch(r"ES[A-Z0-9]{22}", iban):
        raise ValueError("El IBAN solo puede contener letras y números")

    return {
        "iban": iban,
        "country_code": iban[:2],
        "entity_code": iban[4:8],
        "branch_code": iban[8:12],
        "control_digits": iban[12:14],
        "account_number": iban[14:24],
    }


def get_company_bank_accounts(db: Session, company_id: int) -> list[CompanyBankAccount]:
    return (
        db.query(CompanyBankAccount)
        .filter(
            CompanyBankAccount.company_id == company_id,
            CompanyBankAccount.is_active == True,
        )
        .order_by(CompanyBankAccount.is_fallback.desc(), CompanyBankAccount.id.asc())
        .all()
    )


def get_company_bank_account(db: Session, company_id: int, account_id: int) -> CompanyBankAccount | None:
    return (
        db.query(CompanyBankAccount)
        .filter(
            CompanyBankAccount.id == account_id,
            CompanyBankAccount.company_id == company_id,
            CompanyBankAccount.is_active == True,
        )
        .first()
    )


def _clear_fallback(db: Session, company_id: int, except_account_id: int | None = None) -> None:
    query = db.query(CompanyBankAccount).filter(
        CompanyBankAccount.company_id == company_id,
        CompanyBankAccount.is_fallback == True,
    )
    if except_account_id is not None:
        query = query.filter(CompanyBankAccount.id != except_account_id)
    query.update({CompanyBankAccount.is_fallback: False}, synchronize_session=False)


def create_company_bank_account(
    db: Session,
    company_id: int,
    payload: CompanyBankAccountCreate,
) -> CompanyBankAccount:
    iban_data = normalize_spanish_iban(payload.iban)
    existing = (
        db.query(CompanyBankAccount)
        .filter(
            CompanyBankAccount.company_id == company_id,
            CompanyBankAccount.iban == iban_data["iban"],
        )
        .first()
    )
    if existing and existing.is_active:
        raise ValueError("La empresa ya tiene registrada esta cuenta bancaria")

    if payload.is_fallback:
        _clear_fallback(db, company_id)

    if existing:
        account = existing
        account.is_active = True
        account.label = payload.label
        account.is_fallback = payload.is_fallback
        account.is_simulated = payload.is_simulated
        account.notes = payload.notes
        for key, value in iban_data.items():
            setattr(account, key, value)
    else:
        account = CompanyBankAccount(
            company_id=company_id,
            label=payload.label,
            is_fallback=payload.is_fallback,
            is_simulated=payload.is_simulated,
            notes=payload.notes,
            **iban_data,
        )
        db.add(account)

    db.commit()
    db.refresh(account)
    return account


def update_company_bank_account(
    db: Session,
    company_id: int,
    account_id: int,
    payload: CompanyBankAccountUpdate,
) -> CompanyBankAccount | None:
    account = get_company_bank_account(db, company_id, account_id)
    if not account:
        return None

    values = payload.model_dump(exclude_unset=True)
    if "iban" in values:
        iban_data = normalize_spanish_iban(values.pop("iban"))
        duplicate = (
            db.query(CompanyBankAccount)
            .filter(
                CompanyBankAccount.company_id == company_id,
                CompanyBankAccount.iban == iban_data["iban"],
                CompanyBankAccount.id != account_id,
                CompanyBankAccount.is_active == True,
            )
            .first()
        )
        if duplicate:
            raise ValueError("La empresa ya tiene registrada esta cuenta bancaria")
        for key, value in iban_data.items():
            setattr(account, key, value)

    if values.get("is_fallback") is True:
        _clear_fallback(db, company_id, except_account_id=account_id)

    for key, value in values.items():
        setattr(account, key, value)

    db.commit()
    db.refresh(account)
    return account


def delete_company_bank_account(db: Session, company_id: int, account_id: int) -> bool:
    account = get_company_bank_account(db, company_id, account_id)
    if not account:
        return False

    db.query(CompanyPaymentAssignment).filter(
        CompanyPaymentAssignment.company_id == company_id,
        CompanyPaymentAssignment.account_id == account_id,
    ).delete(synchronize_session=False)
    account.is_active = False
    account.is_fallback = False
    db.commit()
    return True


def assign_payment_operation(
    db: Session,
    company_id: int,
    operation_code: str,
    account_id: int,
) -> CompanyPaymentAssignment:
    if operation_code not in OPERATION_CODES:
        raise ValueError("Operación bancaria no reconocida")

    account = get_company_bank_account(db, company_id, account_id)
    if not account:
        raise ValueError("Cuenta bancaria no encontrada para esta empresa")

    assignment = (
        db.query(CompanyPaymentAssignment)
        .filter(
            CompanyPaymentAssignment.company_id == company_id,
            CompanyPaymentAssignment.operation_code == operation_code,
        )
        .first()
    )
    if assignment:
        assignment.account_id = account_id
    else:
        assignment = CompanyPaymentAssignment(
            company_id=company_id,
            operation_code=operation_code,
            account_id=account_id,
        )
        db.add(assignment)

    db.commit()
    db.refresh(assignment)
    return assignment


def unassign_payment_operation(db: Session, company_id: int, operation_code: str) -> bool:
    assignment = (
        db.query(CompanyPaymentAssignment)
        .filter(
            CompanyPaymentAssignment.company_id == company_id,
            CompanyPaymentAssignment.operation_code == operation_code,
        )
        .first()
    )
    if not assignment:
        return False
    db.delete(assignment)
    db.commit()
    return True


def build_payment_operations(db: Session, company_id: int) -> list[dict]:
    assignments = {
        item.operation_code: item.account_id
        for item in db.query(CompanyPaymentAssignment)
        .filter(CompanyPaymentAssignment.company_id == company_id)
        .all()
    }
    fallback = (
        db.query(CompanyBankAccount)
        .filter(
            CompanyBankAccount.company_id == company_id,
            CompanyBankAccount.is_active == True,
            CompanyBankAccount.is_fallback == True,
        )
        .first()
    )

    result = []
    for code, label, group, priority in PAYMENT_OPERATIONS:
        direct_account_id = assignments.get(code)
        effective_account_id = direct_account_id or (fallback.id if fallback else None)
        source = "direct" if direct_account_id else ("fallback" if fallback else "none")
        result.append(
            {
                "operation_code": code,
                "operation_label": label,
                "service_group": group,
                "priority": priority,
                "account_id": direct_account_id,
                "effective_account_id": effective_account_id,
                "assignment_source": source,
            }
        )
    return result
