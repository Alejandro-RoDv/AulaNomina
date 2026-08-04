from datetime import date
from decimal import Decimal
import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.model190 import Model190Declaration
from app.models.payroll import Payroll
from app.schemas.model190 import Model190DeclarationCreate, Model190PresentationRequest
from app.services.model190_calculator import Model190DomainError
from app.services.model190_declaration_service import (
    generate_model190_declaration,
    get_model190_file,
)
from app.services.model190_presentation_service import (
    build_model190_error_report,
    present_model190_declaration,
    validate_model190_file_content,
    validate_model190_import,
)
from app.services.model190_receipt_service import render_model190_receipt


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


def build_generated_declaration(db):
    company = Company(name="AulaNomina Demo SL", cif="B14999991")
    db.add(company)
    db.flush()
    employee = Employee(
        employee_code="M190-AEAT-001",
        company_id=company.id,
        dni="30000001A",
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
        start_date=date(2026, 1, 1),
        status="active",
    )
    db.add(contract)
    db.flush()
    db.add(
        Payroll(
            employee_id=employee.id,
            contract_id=contract.id,
            company_id=company.id,
            period_month=1,
            period_year=2026,
            gross_salary=Decimal("2000.00"),
            irpf_base=Decimal("2000.00"),
            irpf=Decimal("240.00"),
            employee_social_security=Decimal("130.00"),
            status="reviewed",
        )
    )
    db.commit()
    declaration = generate_model190_declaration(
        db,
        Model190DeclarationCreate(company_id=company.id, year=2026),
    )
    return company, declaration


def test_import_validation_reads_frozen_fixed_width_file(db):
    _, declaration = build_generated_declaration(db)

    report = validate_model190_import(db, declaration["id"])

    assert report["records_read"] == 2
    assert report["correct_records"] == 2
    assert report["error_records"] == 0
    assert report["errors"] == []
    assert report["can_present"] is True
    assert report["sha256"] == declaration["file_metadata"]["fixed_width"]["sha256"]


def test_presentation_sets_receipt_csv_signature_and_justification(db):
    _, declaration = build_generated_declaration(db)
    report = validate_model190_import(db, declaration["id"])

    presented = present_model190_declaration(
        db,
        declaration["id"],
        Model190PresentationRequest(
            file_sha256=report["sha256"],
            signer_name="Alejandro Responsable Demo",
            certificate_alias="Certificado AulaNomina Centro Educativo",
            confirm_information=True,
        ),
    )

    assert presented["status"] == "presented"
    assert presented["locked"] is True
    assert presented["presented_at"] is not None
    assert presented["receipt_number"].startswith("190")
    assert len(presented["csv"]) == 24
    assert presented["presentation_reference"].startswith("AULANOMINA-190-2026-")
    assert presented["presentation_validation"]["error_records"] == 0

    stored = db.query(Model190Declaration).filter_by(id=declaration["id"]).one()
    payload = json.loads(stored.payload)
    assert payload["presentation"]["signature"]["signer_name"] == "Alejandro Responsable Demo"
    assert payload["presentation"]["file_sha256"] == report["sha256"]

    receipt = render_model190_receipt(db, declaration["id"])
    assert "JUSTIFICANTE SIN VALIDEZ FISCAL" in receipt
    assert presented["receipt_number"] in receipt
    assert "Firma electrónica simulada" in receipt


def test_second_presentation_is_blocked(db):
    _, declaration = build_generated_declaration(db)
    report = validate_model190_import(db, declaration["id"])
    request = Model190PresentationRequest(
        file_sha256=report["sha256"],
        signer_name="Responsable Demo",
        confirm_information=True,
    )
    present_model190_declaration(db, declaration["id"], request)

    with pytest.raises(Model190DomainError) as exc_info:
        present_model190_declaration(db, declaration["id"], request)

    assert exc_info.value.code == "DECLARATION_ALREADY_PRESENTED"
    assert exc_info.value.status_code == 409


def test_signed_hash_must_match_imported_file(db):
    _, declaration = build_generated_declaration(db)

    with pytest.raises(Model190DomainError) as exc_info:
        present_model190_declaration(
            db,
            declaration["id"],
            Model190PresentationRequest(
                file_sha256="0" * 64,
                signer_name="Responsable Demo",
                confirm_information=True,
            ),
        )

    assert exc_info.value.code == "FILE_HASH_MISMATCH"


def test_parser_reports_nif_key_amount_subkey_accrual_and_duplicate_errors(db):
    _, declaration = build_generated_declaration(db)
    fixed = get_model190_file(db, declaration["id"], "fixed_width")
    header, recipient = fixed["content"].splitlines()

    invalid = recipient
    invalid = invalid[:1] + "BAD      " + invalid[10:]
    invalid = invalid[:50] + "Z99" + "2200" + invalid[57:]
    invalid = invalid[:59] + "INVALID-AMOUNT!" + invalid[74:]
    content = "\r\n".join([header, invalid, invalid]) + "\r\n"

    report = validate_model190_file_content(
        content,
        expected_year=2026,
        expected_company_nif="B14999991",
        expected_declaration_type="ordinary",
        expected_recipients=1,
        expected_cash_income=Decimal("2000.00"),
        expected_withholding=Decimal("240.00"),
        expected_deductible_expenses=Decimal("130.00"),
        valid_keys={"A", "G"},
        valid_subkeys={("G", "01"), ("G", "03")},
    )
    codes = {item["code"] for item in report["errors"]}

    assert report["can_present"] is False
    assert "RECIPIENT_NIF_INVALID" in codes
    assert "KEY_NOT_ALLOWED" in codes
    assert "SUBKEY_INCOMPATIBLE" in codes
    assert "ACCRUAL_YEAR_INVALID" in codes
    assert "AMOUNT_FORMAT_INVALID" in codes
    assert "DUPLICATE_RECIPIENT" in codes
    assert "PHYSICAL_RECORD_COUNT_MISMATCH" in codes


def test_error_report_is_downloadable_even_when_import_is_correct(db):
    _, declaration = build_generated_declaration(db)

    report = build_model190_error_report(db, declaration["id"])

    assert report["error_count"] == 0
    assert report["filename"].endswith("-errores-simulados.txt")
    assert "No se han detectado errores de importacion." in report["content"]
