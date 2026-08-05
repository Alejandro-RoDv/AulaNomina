from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models.company import Company
from app.models.employee import Employee
from app.models.model190 import Model190Declaration
from app.models.payroll import Payroll
from app.schemas.model190 import Model190DeclarationCreate, Model190PresentationRequest
from app.services.model190_declaration_service import generate_model190_declaration
from app.services.model190_document_service import (
    render_model190_annual_summary,
    render_model190_certificate,
    render_model190_recipient_relation,
)
from app.services.model190_file_service import validate_model190_import
from app.services.model190_presentation_service import present_model190_declaration
from app.services.model190_validation import Model190DomainError


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def create_company(db):
    company = Company(
        name="AulaNomina Documentos SL",
        cif="B14999991",
        address="Avenida de la Formación 12",
        city="Córdoba",
        province="Córdoba",
        postal_code="14001",
        phone="957000190",
        email="fiscal@aulanomina.local",
        legal_representative="Responsable AulaNomina",
        main_ccc="14123456789",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def create_payroll_case(db, company, *, code, dni, first_name, last_name, gross, withholding):
    employee = Employee(
        employee_code=code,
        dni=dni,
        first_name=first_name,
        last_name=last_name,
        email=f"{code.lower()}@aulanomina.local",
        company_id=company.id,
        is_active=True,
    )
    db.add(employee)
    db.flush()
    payroll = Payroll(
        employee_id=employee.id,
        company_id=company.id,
        period="2026-01",
        payroll_type="ordinary",
        status="closed",
        gross_salary=Decimal(gross),
        irpf=Decimal(withholding),
        social_security=Decimal("100.00"),
        other_deductions=Decimal("0.00"),
        net_salary=Decimal(gross) - Decimal(withholding) - Decimal("100.00"),
        irpf_base=Decimal(gross),
        irpf_percentage=Decimal("10.00"),
    )
    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    return employee, payroll


def build_declaration_case(db):
    company = create_company(db)
    employee, payroll = create_payroll_case(
        db,
        company,
        code="M190-DOC-001",
        dni="30000001A",
        first_name="Ana",
        last_name="Demo Documento",
        gross="2000.00",
        withholding="240.00",
    )
    create_payroll_case(
        db,
        company,
        code="M190-DOC-002",
        dni="30000002B",
        first_name="Luis",
        last_name="Prueba",
        gross="1500.00",
        withholding="150.00",
    )
    db.commit()
    declaration = generate_model190_declaration(
        db,
        Model190DeclarationCreate(company_id=company.id, year=2026),
    )
    return company, employee, payroll, declaration


def present_declaration(db, declaration):
    report = validate_model190_import(db, declaration["id"])
    return present_model190_declaration(
        db,
        declaration["id"],
        Model190PresentationRequest(
            file_sha256=report["sha256"],
            signer_name="Responsable AulaNomina",
            certificate_alias="Certificado Centro Educativo",
            confirm_information=True,
        ),
    )


def test_annual_summary_and_relation_use_frozen_snapshot(db):
    _, _, payroll, declaration = build_declaration_case(db)
    payroll.gross_salary = Decimal("9999.00")
    payroll.irpf = Decimal("999.00")
    db.commit()

    summary = render_model190_annual_summary(db, declaration["id"])
    relation = render_model190_recipient_relation(db, declaration["id"])

    assert "Modelo 190 · Resumen anual" in summary
    assert "AulaNomina Documentos SL" in summary
    assert "2.500,00 €" in summary
    assert "9.999,00 €" not in summary
    assert "RELACIÓN NOMINATIVA SIN VALIDEZ FISCAL" in relation
    assert "30000001A" in relation
    assert "2025" in relation
    assert "2026" in relation


def test_certificate_requires_presented_declaration(db):
    _, _, _, declaration = build_declaration_case(db)
    recipient_id = declaration["recipients"][0]["id"]

    with pytest.raises(Model190DomainError) as exc_info:
        render_model190_certificate(db, declaration["id"], recipient_id)

    assert exc_info.value.code == "DECLARATION_NOT_PRESENTED"
    assert exc_info.value.status_code == 409


def test_certificate_groups_all_rows_for_same_nif(db):
    _, _, _, declaration = build_declaration_case(db)
    recipient = declaration["recipients"][0]
    present_declaration(db, declaration)

    certificate = render_model190_certificate(db, declaration["id"], recipient["id"])

    assert "CERTIFICADO DE RETENCIONES E INGRESOS A CUENTA" in certificate
    assert "AulaNomina Documentos SL" in certificate
    assert recipient["nif"] in certificate
    assert "2025" in certificate
    assert "2026" in certificate
    assert "Firma simulada" in certificate


def test_certificate_rejects_recipient_from_other_declaration(db):
    company, _, _, first_declaration = build_declaration_case(db)
    other_employee, other_payroll = create_payroll_case(
        db,
        company,
        code="M190-DOC-003",
        dni="30000003C",
        first_name="Marta",
        last_name="Otro ejercicio",
        gross="1200.00",
        withholding="120.00",
    )
    other_payroll.period = "2025-01"
    db.commit()
    second_declaration = generate_model190_declaration(
        db,
        Model190DeclarationCreate(company_id=company.id, year=2025),
    )
    present_declaration(db, first_declaration)

    with pytest.raises(Model190DomainError) as exc_info:
        render_model190_certificate(
            db,
            first_declaration["id"],
            second_declaration["recipients"][0]["id"],
        )

    assert exc_info.value.code == "RECIPIENT_NOT_IN_DECLARATION"
    assert exc_info.value.status_code == 404
    assert other_employee.id is not None


def test_presented_snapshot_is_used_after_recipient_mutation(db):
    _, _, _, declaration = build_declaration_case(db)
    present_declaration(db, declaration)
    declaration_model = db.get(Model190Declaration, declaration["id"])
    recipient = declaration_model.recipients[0]
    frozen_name = recipient.full_name
    recipient.full_name = "Nombre modificado después de presentar"
    db.commit()

    relation = render_model190_recipient_relation(db, declaration["id"])

    assert frozen_name in relation
    assert "Nombre modificado después de presentar" not in relation


def test_certificate_contains_issue_date_and_educational_notice(db):
    _, _, _, declaration = build_declaration_case(db)
    recipient_id = declaration["recipients"][0]["id"]
    present_declaration(db, declaration)

    certificate = render_model190_certificate(db, declaration["id"], recipient_id)

    assert str(date.today().year) in certificate
    assert "DOCUMENTO EDUCATIVO · SIN VALIDEZ FISCAL" in certificate
