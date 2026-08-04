from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra tablas y schema patches
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.model111 import (
    Professional,
    ProfessionalInvoice,
    TaxWithholdingAdjustment,
)
from app.models.model190 import Model190RecipientOverride
from app.models.payroll import Payroll
from app.services.model190_calculator import (
    build_model190_preview,
    professional_subkey,
    quarter_for_month,
)


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


def build_company(db):
    company = Company(name="AulaNomina Demo SL", cif="B14999991")
    db.add(company)
    db.flush()
    return company


def build_employee(db, company, *, dni="30000001A", code="M190-001"):
    employee = Employee(
        employee_code=code,
        company_id=company.id,
        dni=dni,
        first_name="Ana",
        last_name="Demo",
        second_last_name="Fiscal",
        province="14",
    )
    db.add(employee)
    db.flush()
    return employee


def build_contract(db, company, employee, *, start=date(2025, 1, 1)):
    contract = Contract(
        employee_id=employee.id,
        company_id=company.id,
        contract_type="Indefinido",
        start_date=start,
        status="active",
    )
    db.add(contract)
    db.flush()
    return contract


def add_payroll(
    db,
    company,
    employee,
    contract,
    *,
    month,
    gross="2000.00",
    withholding="240.00",
    social_security="130.00",
    status="reviewed",
):
    item = Payroll(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        period_month=month,
        period_year=2026,
        gross_salary=Decimal(gross),
        irpf_base=Decimal(gross),
        irpf=Decimal(withholding),
        employee_social_security=Decimal(social_security),
        status=status,
    )
    db.add(item)
    return item


def add_professional_invoice(
    db,
    company,
    *,
    nif="B56000111",
    rate="15.00",
    status="paid",
    payment_date=date(2026, 4, 20),
):
    professional = Professional(
        company_id=company.id,
        nif=nif,
        name="Marta",
        surname="Consultoría",
        withholding_rate=Decimal(rate),
        province_code="14",
    )
    db.add(professional)
    db.flush()
    invoice = ProfessionalInvoice(
        professional_id=professional.id,
        company_id=company.id,
        invoice_number=f"PRO-{professional.id:03d}",
        invoice_date=date(2026, 4, 10),
        payment_date=payment_date,
        tax_base=Decimal("1600.00"),
        withholding_rate=Decimal(rate),
        withholding_amount=Decimal("240.00"),
        total_amount=Decimal("1360.00"),
        status=status,
    )
    db.add(invoice)
    db.flush()
    return professional, invoice


def test_preview_aggregates_payrolls_invoices_and_prior_year_arrears(db):
    company = build_company(db)
    employee = build_employee(db, company)
    contract = build_contract(db, company, employee)
    add_payroll(db, company, employee, contract, month=1)
    add_payroll(db, company, employee, contract, month=2)
    add_professional_invoice(db, company)
    db.add(
        TaxWithholdingAdjustment(
            company_id=company.id,
            category="work",
            adjustment_type="arrears",
            source_date=date(2026, 9, 15),
            recipient_nif=employee.dni,
            recipient_name="Ana Demo Fiscal",
            base_amount=Decimal("500.00"),
            withholding_amount=Decimal("75.00"),
            model190_key="A",
            accrual_year=2025,
            deductible_expense_amount=Decimal("20.00"),
            status="confirmed",
        )
    )
    db.commit()

    preview = build_model190_preview(db, company.id, 2026)

    assert preview["totals"]["total_recipients"] == 3
    assert preview["totals"]["unique_nifs"] == 2
    assert preview["totals"]["total_cash_income"] == Decimal("6100.00")
    assert preview["totals"]["total_withholding"] == Decimal("795.00")
    assert preview["totals"]["total_deductible_expenses"] == Decimal("280.00")
    assert preview["source_count"] == 4

    employee_rows = [
        item for item in preview["recipients"] if item["nif"] == employee.dni
    ]
    assert {item["accrual_year"] for item in employee_rows} == {2025, 2026}
    arrears = next(item for item in employee_rows if item["accrual_year"] == 2025)
    assert arrears["cash_income"] == Decimal("500.00")
    assert arrears["lines"][0]["source_type"] == "arrears"


def test_two_contracts_for_same_employee_share_one_annual_recipient(db):
    company = build_company(db)
    employee = build_employee(db, company)
    first_contract = build_contract(db, company, employee)
    second_contract = build_contract(
        db,
        company,
        employee,
        start=date(2026, 7, 1),
    )
    add_payroll(db, company, employee, first_contract, month=6)
    add_payroll(db, company, employee, second_contract, month=7)
    db.commit()

    preview = build_model190_preview(db, company.id, 2026)

    assert preview["totals"]["total_recipients"] == 1
    recipient = preview["recipients"][0]
    assert recipient["source_count"] == 2
    assert {line["contract_id"] for line in recipient["lines"]} == {
        first_contract.id,
        second_contract.id,
    }
    assert recipient["cash_income"] == Decimal("4000.00")


def test_professional_override_changes_automatic_subkey(db):
    company = build_company(db)
    professional, _ = add_professional_invoice(db, company, rate="15.00")
    db.add(
        Model190RecipientOverride(
            company_id=company.id,
            year=2026,
            recipient_type="professional",
            recipient_id=professional.id,
            key="G",
            subkey="03",
            confirmed=True,
        )
    )
    db.commit()

    preview = build_model190_preview(db, company.id, 2026)
    recipient = preview["recipients"][0]

    assert professional_subkey(Decimal("15.00")) == "01"
    assert recipient["key"] == "G"
    assert recipient["subkey"] == "03"
    assert recipient["classification_source"] == "override"
    assert recipient["classification_confirmed"] is True


def test_unclassified_economic_adjustment_uses_supported_default(db):
    company = build_company(db)
    db.add(
        TaxWithholdingAdjustment(
            company_id=company.id,
            category="economic_activity",
            adjustment_type="manual",
            source_date=date(2026, 11, 10),
            recipient_nif="B56000999",
            recipient_name="Consultoría sin ficha",
            base_amount=Decimal("900.00"),
            withholding_amount=Decimal("135.00"),
            status="confirmed",
        )
    )
    db.commit()

    preview = build_model190_preview(db, company.id, 2026)
    recipient = preview["recipients"][0]

    assert recipient["recipient_type"] == "professional"
    assert recipient["key"] == "G"
    assert recipient["subkey"] == "01"
    assert recipient["classification_source"] == "automatic"


def test_draft_payrolls_unpaid_invoices_and_draft_adjustments_are_excluded(db):
    company = build_company(db)
    employee = build_employee(db, company)
    contract = build_contract(db, company, employee)
    add_payroll(
        db,
        company,
        employee,
        contract,
        month=1,
        status="draft",
    )
    add_professional_invoice(
        db,
        company,
        status="confirmed",
        payment_date=None,
    )
    db.add(
        TaxWithholdingAdjustment(
            company_id=company.id,
            category="work",
            adjustment_type="manual",
            source_date=date(2026, 3, 10),
            recipient_nif=employee.dni,
            recipient_name="Ana Demo Fiscal",
            base_amount=Decimal("100.00"),
            withholding_amount=Decimal("10.00"),
            status="draft",
        )
    )
    db.commit()

    preview = build_model190_preview(db, company.id, 2026)

    assert preview["has_operations"] is False
    assert preview["source_count"] == 0
    assert preview["recipients"] == []
    assert preview["totals"]["total_cash_income"] == Decimal("0.00")


def test_special_payroll_periods_map_to_their_fiscal_quarter():
    assert quarter_for_month(7) == "3T"
    assert quarter_for_month(12) == "4T"
