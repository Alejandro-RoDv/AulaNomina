from datetime import date, datetime
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
    Model111Declaration,
    Model111Line,
    Professional,
    ProfessionalInvoice,
)
from app.models.payroll import Payroll
from app.services.model190_reconciliation import build_model190_reconciliation


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


def add_employee_payroll(
    db,
    company,
    *,
    month=1,
    gross="2000.00",
    irpf_base="2000.00",
    withholding="240.00",
    employee_code="M190-REC-001",
    dni="30000001A",
):
    employee = Employee(
        employee_code=employee_code,
        company_id=company.id,
        dni=dni,
        first_name="Ana",
        last_name="Demo",
        second_last_name="Fiscal",
        province="14",
    )
    db.add(employee)
    db.flush()
    contract = Contract(
        employee_id=employee.id,
        company_id=company.id,
        contract_type="Indefinido",
        start_date=date(2025, 1, 1),
        status="active",
    )
    db.add(contract)
    db.flush()
    payroll = Payroll(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        period_month=month,
        period_year=2026,
        gross_salary=Decimal(gross),
        irpf_base=Decimal(irpf_base),
        irpf=Decimal(withholding),
        employee_social_security=Decimal("127.00"),
        status="reviewed",
    )
    db.add(payroll)
    db.flush()
    return employee, payroll


def add_professional_invoice(db, company):
    professional = Professional(
        company_id=company.id,
        nif="B56000111",
        name="Marta",
        surname="Consultoría",
        withholding_rate=Decimal("15.00"),
        province_code="14",
    )
    db.add(professional)
    db.flush()
    invoice = ProfessionalInvoice(
        professional_id=professional.id,
        company_id=company.id,
        invoice_number="PRO-REC-001",
        invoice_date=date(2026, 2, 10),
        payment_date=date(2026, 2, 20),
        tax_base=Decimal("1000.00"),
        withholding_rate=Decimal("15.00"),
        withholding_amount=Decimal("150.00"),
        total_amount=Decimal("850.00"),
        status="paid",
    )
    db.add(invoice)
    db.flush()
    return professional, invoice


def quarter_bounds(period):
    values = {
        "1T": (date(2026, 1, 1), date(2026, 3, 31)),
        "2T": (date(2026, 4, 1), date(2026, 6, 30)),
        "3T": (date(2026, 7, 1), date(2026, 9, 30)),
        "4T": (date(2026, 10, 1), date(2026, 12, 31)),
    }
    return values[period]


def add_model111(
    db,
    company,
    *,
    period,
    status="presented",
    declaration_type="ordinary",
    work_base="0.00",
    work_withholding="0.00",
    work_perceptors=0,
    professional_base="0.00",
    professional_withholding="0.00",
    professional_perceptors=0,
    lines=(),
    presented_at=None,
):
    start, end = quarter_bounds(period)
    total = Decimal(work_withholding) + Decimal(professional_withholding)
    declaration = Model111Declaration(
        company_id=company.id,
        year=2026,
        period=period,
        period_type="quarterly",
        period_start=start,
        period_end=end,
        declaration_type=declaration_type,
        status=status,
        result_type="negative" if total == 0 else "payable",
        work_perceptors=work_perceptors,
        work_base=Decimal(work_base),
        work_withholding=Decimal(work_withholding),
        professional_perceptors=professional_perceptors,
        professional_base=Decimal(professional_base),
        professional_withholding=Decimal(professional_withholding),
        total_withholding=total,
        previous_result=Decimal("0.00"),
        result_amount=total,
        payload_json="{}",
        generated_at=presented_at or datetime(2026, 4, 10, 10, 0),
        presented_at=presented_at if status == "presented" else None,
        locked=status == "presented",
    )
    declaration.lines = [Model111Line(**item) for item in lines]
    db.add(declaration)
    db.flush()
    return declaration


def test_reconciliation_balances_work_and_professional_documents(db):
    company = build_company(db)
    employee, payroll = add_employee_payroll(db, company)
    professional, invoice = add_professional_invoice(db, company)
    declaration = add_model111(
        db,
        company,
        period="1T",
        work_base="2000.00",
        work_withholding="240.00",
        work_perceptors=1,
        professional_base="1000.00",
        professional_withholding="150.00",
        professional_perceptors=1,
        presented_at=datetime(2026, 4, 20, 12, 0),
        lines=(
            {
                "category": "work",
                "source_type": "payroll",
                "source_id": payroll.id,
                "source_date": date(2026, 1, 31),
                "source_label": "Nómina 01/2026",
                "recipient_key": f"employee:{employee.id}",
                "recipient_nif": employee.dni,
                "recipient_name": "Ana Demo Fiscal",
                "base_amount": Decimal("2000.00"),
                "withholding_amount": Decimal("240.00"),
            },
            {
                "category": "economic_activity",
                "source_type": "professional_invoice",
                "source_id": invoice.id,
                "source_date": invoice.payment_date,
                "source_label": "Factura PRO-REC-001",
                "recipient_key": f"professional:{professional.id}",
                "recipient_nif": professional.nif,
                "recipient_name": professional.full_name,
                "base_amount": Decimal("1000.00"),
                "withholding_amount": Decimal("150.00"),
            },
        ),
    )
    db.commit()

    result = build_model190_reconciliation(db, company.id, 2026)
    first_quarter = result["quarters"][0]

    assert first_quarter["declaration"]["id"] == declaration.id
    assert first_quarter["is_balanced"] is True
    assert first_quarter["differences"]["work"]["withholding"] == Decimal("0.00")
    assert first_quarter["differences"]["economic_activity"]["income"] == Decimal("0.00")
    assert first_quarter["documents"]["only_in_model190"] == []
    assert first_quarter["documents"]["only_in_model111"] == []
    assert len(first_quarter["drill_down"]["recipients"]) == 2


def test_generated_but_not_presented_model111_does_not_count_as_declared(db):
    company = build_company(db)
    _, payroll = add_employee_payroll(db, company, month=5)
    pending = add_model111(
        db,
        company,
        period="2T",
        status="generated",
        work_base="2000.00",
        work_withholding="240.00",
        work_perceptors=1,
        lines=(
            {
                "category": "work",
                "source_type": "payroll",
                "source_id": payroll.id,
                "source_date": date(2026, 5, 31),
                "source_label": "Nómina 05/2026",
                "recipient_key": "employee:1",
                "recipient_nif": "30000001A",
                "recipient_name": "Ana Demo Fiscal",
                "base_amount": Decimal("2000.00"),
                "withholding_amount": Decimal("240.00"),
            },
        ),
    )
    db.commit()

    result = build_model190_reconciliation(db, company.id, 2026)
    second_quarter = result["quarters"][1]
    codes = {item["code"] for item in second_quarter["alerts"]}

    assert second_quarter["declaration"] is None
    assert second_quarter["pending_declaration"]["id"] == pending.id
    assert second_quarter["model111"]["work"]["withholding"] == Decimal("0.00")
    assert second_quarter["differences"]["work"]["withholding"] == Decimal("240.00")
    assert "MODEL111_NOT_PRESENTED" in codes
    assert "DOCUMENTS_ONLY_IN_MODEL190" in codes


def test_equal_quarter_totals_do_not_hide_different_source_documents(db):
    company = build_company(db)
    _, payroll = add_employee_payroll(db, company, month=8)
    add_model111(
        db,
        company,
        period="3T",
        work_base="2000.00",
        work_withholding="240.00",
        work_perceptors=1,
        presented_at=datetime(2026, 10, 20, 12, 0),
        lines=(
            {
                "category": "work",
                "source_type": "payroll",
                "source_id": payroll.id + 999,
                "source_date": date(2026, 8, 31),
                "source_label": "Nómina externa no localizada",
                "recipient_key": "employee:missing",
                "recipient_nif": "30000001A",
                "recipient_name": "Ana Demo Fiscal",
                "base_amount": Decimal("2000.00"),
                "withholding_amount": Decimal("240.00"),
            },
        ),
    )
    db.commit()

    result = build_model190_reconciliation(db, company.id, 2026)
    third_quarter = result["quarters"][2]

    assert third_quarter["differences"]["work"]["income"] == Decimal("0.00")
    assert third_quarter["differences"]["work"]["withholding"] == Decimal("0.00")
    assert third_quarter["is_balanced"] is False
    assert len(third_quarter["documents"]["only_in_model190"]) == 1
    assert len(third_quarter["documents"]["only_in_model111"]) == 1


def test_latest_presented_complementary_is_the_effective_quarter_snapshot(db):
    company = build_company(db)
    employee, payroll = add_employee_payroll(db, company, month=11)
    ordinary = add_model111(
        db,
        company,
        period="4T",
        work_base="1800.00",
        work_withholding="200.00",
        work_perceptors=1,
        presented_at=datetime(2027, 1, 10, 10, 0),
        lines=(
            {
                "category": "work",
                "source_type": "payroll",
                "source_id": payroll.id,
                "source_date": date(2026, 11, 30),
                "source_label": "Nómina 11/2026",
                "recipient_key": f"employee:{employee.id}",
                "recipient_nif": employee.dni,
                "recipient_name": "Ana Demo Fiscal",
                "base_amount": Decimal("1800.00"),
                "withholding_amount": Decimal("200.00"),
            },
        ),
    )
    complementary = add_model111(
        db,
        company,
        period="4T",
        declaration_type="complementary",
        work_base="2000.00",
        work_withholding="240.00",
        work_perceptors=1,
        presented_at=datetime(2027, 1, 20, 10, 0),
        lines=(
            {
                "category": "work",
                "source_type": "payroll",
                "source_id": payroll.id,
                "source_date": date(2026, 11, 30),
                "source_label": "Nómina 11/2026",
                "recipient_key": f"employee:{employee.id}",
                "recipient_nif": employee.dni,
                "recipient_name": "Ana Demo Fiscal",
                "base_amount": Decimal("2000.00"),
                "withholding_amount": Decimal("240.00"),
            },
        ),
    )
    complementary.original_declaration_id = ordinary.id
    db.commit()

    result = build_model190_reconciliation(db, company.id, 2026)
    fourth_quarter = result["quarters"][3]

    assert fourth_quarter["declaration"]["id"] == complementary.id
    assert fourth_quarter["declaration"]["declaration_type"] == "complementary"
    assert fourth_quarter["model111"]["work"]["withholding"] == Decimal("240.00")
    assert fourth_quarter["is_balanced"] is True
