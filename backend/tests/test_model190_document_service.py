from datetime import date
from decimal import Decimal
import csv
import io
import zipfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.model111 import TaxWithholdingAdjustment
from app.models.payroll import Payroll
from app.schemas.model190 import Model190DeclarationCreate, Model190PresentationRequest
from app.services.model190_calculator import Model190DomainError
from app.services.model190_declaration_service import generate_model190_declaration
from app.services.model190_document_service import (
    build_model190_certificates_archive,
    render_model190_annual_summary,
    render_model190_certificate,
    render_model190_certificate_directory,
    render_model190_recipient_relation,
)
from app.services.model190_presentation_service import (
    present_model190_declaration,
    validate_model190_import,
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


def add_employee_payroll(
    db,
    company,
    *,
    code: str,
    dni: str,
    first_name: str,
    last_name: str,
    gross: str,
    withholding: str,
):
    employee = Employee(
        employee_code=code,
        company_id=company.id,
        dni=dni,
        first_name=first_name,
        last_name=last_name,
        second_last_name="Documento",
        province="14",
    )
    db.add(employee)
    db.flush()
    contract = Contract(
        employee_id=employee.id,
        company_id=company.id,
        contract_type="Indefinido",
        start_date=date(2026, 1, 1),
        status="active",
    )
    db.add(contract)
    db.flush()
    payroll = Payroll(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        period_month=1,
        period_year=2026,
        gross_salary=Decimal(gross),
        irpf_base=Decimal(gross),
        irpf=Decimal(withholding),
        employee_social_security=Decimal("130.00"),
        status="reviewed",
    )
    db.add(payroll)
    db.flush()
    return employee, payroll


def build_declaration_case(db, *, second_employee: bool = False, arrears: bool = True):
    company = Company(
        name="AulaNomina Documentos SL",
        cif="B14999991",
        address="Avenida de la Formación 1",
        city="Córdoba",
        province="Córdoba",
    )
    db.add(company)
    db.flush()
    employee, payroll = add_employee_payroll(
        db,
        company,
        code="M190-DOC-001",
        dni="30000001A",
        first_name="Ana",
        last_name="Demo",
        gross="2000.00",
        withholding="240.00",
    )
    if arrears:
        db.add(
            TaxWithholdingAdjustment(
                company_id=company.id,
                category="work",
                adjustment_type="arrears",
                source_date=date(2026, 9, 15),
                recipient_nif=employee.dni,
                recipient_name="Ana Demo Documento",
                base_amount=Decimal("500.00"),
                withholding_amount=Decimal("75.00"),
                model190_key="A",
                accrual_year=2025,
                deductible_expense_amount=Decimal("20.00"),
                status="confirmed",
            )
        )
    if second_employee:
        add_employee_payroll(
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
    presented = present_declaration(db, declaration)
    recipient_id = presented["recipients"][0]["id"]

    certificate = render_model190_certificate(db, declaration["id"], recipient_id)
    directory = render_model190_certificate_directory(db, declaration["id"])

    assert "Certificado de retenciones e ingresos a cuenta" in certificate
    assert "30000001A" in certificate
    assert "2.500,00 €" in certificate
    assert "315,00 €" in certificate
    assert ">2025<" in certificate
    assert ">2026<" in certificate
    assert "Responsable AulaNomina" in certificate
    assert presented["receipt_number"] in certificate
    assert directory.count("Abrir certificado") == 1
    assert f"/model-190/declarations/{declaration['id']}/certificates.zip" in directory


def test_certificate_archive_contains_one_html_per_unique_nif_and_manifest(db):
    _, _, _, declaration = build_declaration_case(db, second_employee=True)
    present_declaration(db, declaration)

    archive = build_model190_certificates_archive(db, declaration["id"])

    assert archive["certificate_count"] == 2
    assert archive["filename"].endswith("-simulados.zip")
    assert len(archive["sha256"]) == 64

    with zipfile.ZipFile(io.BytesIO(archive["content"])) as bundle:
        names = bundle.namelist()
        certificate_names = [name for name in names if name.endswith(".html")]
        assert len(certificate_names) == 2
        assert "manifest-certificados.csv" in names
        assert "LEEME.txt" in names
        manifest = bundle.read("manifest-certificados.csv").decode("utf-8-sig")
        rows = list(csv.reader(io.StringIO(manifest), delimiter=";"))
        assert rows[0][0:3] == ["NIF", "Perceptor", "Lineas"]
        assert {row[0] for row in rows[1:]} == {"30000001A", "30000002B"}
        ana_row = next(row for row in rows[1:] if row[0] == "30000001A")
        assert ana_row[2] == "2"
        assert ana_row[3] == "2500.00"
