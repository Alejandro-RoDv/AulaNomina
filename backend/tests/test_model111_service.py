from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra todas las tablas
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.model111 import Professional, ProfessionalInvoice
from app.models.payroll import Payroll
from app.schemas.model111 import (
    Model111GenerateRequest,
    Model111PresentationRequest,
    TaxWithholdingAdjustmentCreate,
)
from app.services.model111_demo_service import seed_model111_demo
from app.services.model111_receipt_service import render_model111_form, render_model111_receipt
from app.services.model111_service import (
    Model111DomainError,
    build_model111_preview,
    create_adjustment,
    generate_model111_declaration,
    present_model111_declaration,
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


def build_company_context(db, *, payroll_months=(4, 5, 6), irpf="240.00"):
    company = Company(name="AulaNomina Demo SL", cif="B14999991", bank_iban="ES7620770024003102575766")
    db.add(company)
    db.flush()

    employee = Employee(
        employee_code="M111-001",
        company_id=company.id,
        dni="30000001A",
        first_name="Ana",
        last_name="Demo Fiscal",
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

    for month in payroll_months:
        db.add(
            Payroll(
                employee_id=employee.id,
                contract_id=contract.id,
                company_id=company.id,
                period_month=month,
                period_year=2026,
                irpf_base=Decimal("2000.00"),
                irpf=Decimal(irpf),
                gross_salary=Decimal("2000.00"),
                status="reviewed",
            )
        )

    professional = Professional(
        company_id=company.id,
        nif="B56000111",
        name="Marta",
        surname="Consultoría",
        withholding_rate=Decimal("15.00"),
    )
    db.add(professional)
    db.flush()
    db.add(
        ProfessionalInvoice(
            professional_id=professional.id,
            company_id=company.id,
            invoice_number="PRO-TEST-001",
            invoice_date=date(2026, 4, 10),
            payment_date=date(2026, 4, 20),
            tax_base=Decimal("1600.00"),
            withholding_rate=Decimal("15.00"),
            withholding_amount=Decimal("240.00"),
            total_amount=Decimal("1360.00"),
            status="paid",
        )
    )
    db.commit()
    return company, employee, contract


def test_preview_combines_work_and_professional_sources(db):
    company, _, _ = build_company_context(db)

    preview = build_model111_preview(db, company.id, 2026, "2T")

    assert preview["work"]["perceptors"] == 1
    assert preview["work"]["base"] == Decimal("6000.00")
    assert preview["work"]["withholding"] == Decimal("720.00")
    assert preview["professionals"]["perceptors"] == 1
    assert preview["professionals"]["base"] == Decimal("1600.00")
    assert preview["professionals"]["withholding"] == Decimal("240.00")
    assert preview["result_amount"] == Decimal("960.00")
    assert preview["validations"]["is_valid"] is True


def test_preview_distinguishes_negative_declaration_from_no_activity(db):
    company, _, _ = build_company_context(db, irpf="0.00")
    invoice = db.query(ProfessionalInvoice).one()
    invoice.withholding_amount = Decimal("0.00")
    invoice.withholding_rate = Decimal("0.00")
    invoice.total_amount = invoice.tax_base
    db.commit()

    preview = build_model111_preview(db, company.id, 2026, "2T")

    assert preview["has_operations"] is True
    assert preview["result_type"] == "negative"
    assert preview["result_amount"] == Decimal("0.00")


def test_generated_declaration_can_be_presented_and_is_locked(db):
    company, _, _ = build_company_context(db)
    generated = generate_model111_declaration(
        db,
        Model111GenerateRequest(company_id=company.id, year=2026, period="2T"),
    )

    presented = present_model111_declaration(
        db,
        generated["id"],
        Model111PresentationRequest(payment_method="simulated_nrc"),
    )

    assert presented["status"] == "presented"
    assert presented["locked"] is True
    assert presented["receipt_number"].startswith("111")
    assert presented["nrc"].startswith("NRC111")

    with pytest.raises(Model111DomainError) as error:
        present_model111_declaration(
            db,
            generated["id"],
            Model111PresentationRequest(payment_method="simulated_nrc"),
        )
    assert error.value.code == "DECLARATION_LOCKED"


def test_complementary_uses_previous_presented_result(db):
    company, _, _ = build_company_context(db)
    ordinary = generate_model111_declaration(
        db,
        Model111GenerateRequest(company_id=company.id, year=2026, period="2T"),
    )
    ordinary = present_model111_declaration(
        db,
        ordinary["id"],
        Model111PresentationRequest(payment_method="simulated_nrc"),
    )

    create_adjustment(
        db,
        TaxWithholdingAdjustmentCreate(
            company_id=company.id,
            category="work",
            adjustment_type="arrears",
            source_date=date(2026, 6, 25),
            recipient_nif="30000001A",
            recipient_name="Ana Demo Fiscal",
            base_amount=Decimal("100.00"),
            withholding_amount=Decimal("20.00"),
        ),
    )
    complementary = generate_model111_declaration(
        db,
        Model111GenerateRequest(
            company_id=company.id,
            year=2026,
            period="2T",
            declaration_type="complementary",
            original_declaration_id=ordinary["id"],
        ),
    )

    assert complementary["previous_result"] == Decimal("960.00")
    assert complementary["result_amount"] == Decimal("20.00")
    assert complementary["original_declaration_id"] == ordinary["id"]


def test_demo_seed_builds_three_months_and_three_professional_invoices(db):
    company, _, _ = build_company_context(db, payroll_months=(5,))
    db.query(ProfessionalInvoice).delete()
    db.query(Professional).delete()
    db.commit()

    result = seed_model111_demo(db, company.id)

    preview = result["preview"]
    months = {
        row[0]
        for row in db.query(Payroll.period_month)
        .filter(Payroll.company_id == company.id, Payroll.period_year == 2026)
        .all()
    }
    assert months == {4, 5, 6}
    assert preview["professionals"]["perceptors"] == 3
    assert preview["professionals"]["base"] == Decimal("4800.00")
    assert preview["professionals"]["withholding"] == Decimal("720.00")
    assert preview["validations"]["is_valid"] is True


def test_generated_form_is_available_before_presentation(db):
    company, _, _ = build_company_context(db)
    declaration = generate_model111_declaration(
        db,
        Model111GenerateRequest(company_id=company.id, year=2026, period="2T"),
    )

    html = render_model111_form(db, declaration["id"])

    assert "Retenciones e ingresos a cuenta del IRPF" in html
    assert "<b>111</b>" in html
    assert "SIMULACIÓN EDUCATIVA" in html
    assert "Pendiente de presentación" in html
    assert "data:image/png;base64" in html


def test_receipt_contains_official_structure_frozen_boxes_and_warning(db):
    company, _, _ = build_company_context(db)
    declaration = generate_model111_declaration(
        db,
        Model111GenerateRequest(company_id=company.id, year=2026, period="2T"),
    )
    declaration = present_model111_declaration(
        db,
        declaration["id"],
        Model111PresentationRequest(payment_method="simulated_nrc"),
    )

    html = render_model111_receipt(db, declaration["id"])

    assert "SIMULACIÓN EDUCATIVA" in html
    assert "Retenciones e ingresos a cuenta del IRPF" in html
    assert "Rendimientos del trabajo" in html
    assert "Rendimientos de actividades económicas" in html
    assert "Resultado a ingresar (28 - 29)" in html
    assert "960,00 €" in html
    assert declaration["receipt_number"] in html
    assert "data:image/png;base64" in html
    assert "Anexo formativo del Modelo 111" in html
