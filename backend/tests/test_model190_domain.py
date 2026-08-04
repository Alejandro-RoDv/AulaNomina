from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra tablas y schema patches
from app.db import Base
from app.models.company import Company
from app.models.model111 import TaxWithholdingAdjustment
from app.models.model190 import (
    Model190Declaration,
    Model190Recipient,
    Model190RecipientLine,
    Model190RecipientOverride,
    Tax190Key,
    Tax190Subkey,
)
from app.schemas.model190 import Model190DeclarationCreate, Model190RecipientOverrideUpsert


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_model190_tables_and_supported_catalogue_are_created(db):
    table_names = set(inspect(db.get_bind()).get_table_names())

    assert {
        "tax_190_keys",
        "tax_190_subkeys",
        "model_190_declarations",
        "model_190_recipients",
        "model_190_recipient_lines",
        "model_190_recipient_overrides",
    }.issubset(table_names)

    keys = {(item.code, item.recipient_type) for item in db.query(Tax190Key).all()}
    subkeys = {(item.key_code, item.code) for item in db.query(Tax190Subkey).all()}

    assert ("A", "employee") in keys
    assert ("G", "professional") in keys
    assert ("G", "01") in subkeys
    assert ("G", "03") in subkeys
    assert ("A", "01") not in subkeys


def test_adjustment_accepts_model190_classification_and_accrual_data(db):
    company = Company(name="AulaNomina Demo SL", cif="B14999991")
    db.add(company)
    db.flush()

    adjustment = TaxWithholdingAdjustment(
        company_id=company.id,
        category="work",
        adjustment_type="arrears",
        source_date=date(2026, 2, 15),
        recipient_nif="30000001A",
        recipient_name="Ana Demo Fiscal",
        base_amount=Decimal("850.00"),
        withholding_amount=Decimal("102.00"),
        model190_key="A",
        accrual_year=2025,
        deductible_expense_amount=Decimal("54.00"),
        status="confirmed",
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)

    assert adjustment.model190_key == "A"
    assert adjustment.model190_subkey is None
    assert adjustment.accrual_year == 2025
    assert adjustment.deductible_expense_amount == Decimal("54.00")


def test_declaration_freezes_recipient_and_source_traceability(db):
    company = Company(name="AulaNomina Demo SL", cif="B14999991")
    db.add(company)
    db.flush()

    declaration = Model190Declaration(
        company_id=company.id,
        year=2026,
        declaration_type="ordinary",
        status="generated",
        total_recipients=1,
        total_cash_income=Decimal("54000.00"),
        total_withholding=Decimal("20487.60"),
        total_deductible_expenses=Decimal("3240.00"),
        payload="{}",
    )
    recipient = Model190Recipient(
        declaration=declaration,
        recipient_type="employee",
        nif="35012145F",
        name="Ricardo",
        surname="Pérez",
        key="A",
        subkey=None,
        cash_income=Decimal("54000.00"),
        cash_withholding=Decimal("20487.60"),
        deductible_expenses=Decimal("3240.00"),
        accrual_year=2026,
        province_code="14",
    )
    recipient.lines.append(
        Model190RecipientLine(
            source_type="payroll",
            source_id=1,
            source_label="Nómina enero 2026",
            source_date=date(2026, 1, 31),
            amount_type="cash",
            gross_amount=Decimal("4500.00"),
            withholding_amount=Decimal("1707.30"),
            deductible_expense_amount=Decimal("270.00"),
            quarter="1T",
        )
    )
    db.add(declaration)
    db.commit()
    db.refresh(recipient)

    assert recipient.full_name == "Ricardo Pérez"
    assert recipient.declaration.year == 2026
    assert recipient.lines[0].source_label == "Nómina enero 2026"
    assert recipient.lines[0].quarter == "1T"


def test_override_is_unique_per_annual_recipient(db):
    company = Company(name="AulaNomina Demo SL", cif="B14999991")
    db.add(company)
    db.flush()

    override = Model190RecipientOverride(
        company_id=company.id,
        year=2026,
        recipient_type="professional",
        recipient_id=7,
        key="G",
        subkey="03",
        accrual_year=2026,
        confirmed=True,
    )
    db.add(override)
    db.commit()

    assert override.key == "G"
    assert override.subkey == "03"
    assert override.confirmed is True


def test_model190_schemas_normalize_classification_and_require_original():
    override = Model190RecipientOverrideUpsert(
        company_id=1,
        year=2026,
        recipient_type="professional",
        recipient_id=7,
        key="g",
        subkey="3",
        province_code="4",
    )

    assert override.key == "G"
    assert override.subkey == "03"
    assert override.province_code == "04"

    with pytest.raises(ValidationError):
        Model190DeclarationCreate(
            company_id=1,
            year=2026,
            declaration_type="substitutive",
        )
