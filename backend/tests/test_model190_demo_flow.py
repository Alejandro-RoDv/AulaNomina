from decimal import Decimal
import io
import zipfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.model111 import Model111Declaration, ProfessionalInvoice, TaxWithholdingAdjustment
from app.models.model190 import Model190Declaration, Model190RecipientOverride
from app.models.payroll import Payroll
from app.schemas.model190 import Model190DeclarationCreate, Model190PresentationRequest
from app.services.model190_declaration_service import generate_model190_declaration
from app.services.model190_demo_service import (
    DEMO_COMPANY_NIF,
    DEMO_EMPLOYEE_CODES,
    DEMO_LATE_ADJUSTMENT_NOTE,
    correct_model190_demo,
    get_model190_demo_status,
    seed_model190_demo,
)
from app.services.model190_document_service import (
    build_model190_certificates_archive,
    render_model190_annual_summary,
    render_model190_recipient_relation,
)
from app.services.model190_presentation_service import (
    present_model190_declaration,
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


def test_demo_seed_creates_guided_error_and_is_idempotent(db):
    first = seed_model190_demo(db)

    assert first["company"]["cif"] == DEMO_COMPANY_NIF
    assert first["stage"] == "needs_correction"
    assert first["prepared"] is True
    assert first["validation"]["is_valid"] is False
    assert "RECIPIENT_SUBKEY_INVALID" in first["validation"]["codes"]
    assert first["reconciliation"]["is_balanced"] is False
    assert first["reconciliation"]["quarter_status"]["2T"] is False
    assert first["preview"]["unique_nifs"] == 4

    company_id = first["company_id"]
    assert (
        db.query(Employee)
        .filter(
            Employee.company_id == company_id,
            Employee.employee_code.in_(tuple(DEMO_EMPLOYEE_CODES.values())),
        )
        .count()
        == 3
    )
    ana = (
        db.query(Employee)
        .filter(Employee.employee_code == DEMO_EMPLOYEE_CODES["ana"])
        .one()
    )
    assert db.query(Contract).filter(Contract.employee_id == ana.id).count() == 2
    assert (
        db.query(Model111Declaration)
        .filter(
            Model111Declaration.company_id == company_id,
            Model111Declaration.year == 2026,
            Model111Declaration.status == "presented",
        )
        .count()
        == 4
    )
    assert (
        db.query(TaxWithholdingAdjustment)
        .filter(TaxWithholdingAdjustment.notes == DEMO_LATE_ADJUSTMENT_NOTE)
        .count()
        == 1
    )

    counts = {
        "employees": db.query(Employee).count(),
        "contracts": db.query(Contract).count(),
        "payrolls": db.query(Payroll).count(),
        "invoices": db.query(ProfessionalInvoice).count(),
        "adjustments": db.query(TaxWithholdingAdjustment).count(),
        "declarations111": db.query(Model111Declaration).count(),
        "overrides": db.query(Model190RecipientOverride).count(),
    }
    second = seed_model190_demo(db)
    assert second["stage"] == "needs_correction"
    assert counts == {
        "employees": db.query(Employee).count(),
        "contracts": db.query(Contract).count(),
        "payrolls": db.query(Payroll).count(),
        "invoices": db.query(ProfessionalInvoice).count(),
        "adjustments": db.query(TaxWithholdingAdjustment).count(),
        "declarations111": db.query(Model111Declaration).count(),
        "overrides": db.query(Model190RecipientOverride).count(),
    }


def test_demo_correction_generation_presentation_and_documents(db):
    seeded = seed_model190_demo(db)
    company_id = seeded["company_id"]

    corrected = correct_model190_demo(db, company_id)

    assert corrected["stage"] == "ready_to_generate"
    assert corrected["validation"]["is_valid"] is True
    assert corrected["reconciliation"]["is_balanced"] is True
    assert all(corrected["reconciliation"]["quarter_status"].values())
    assert corrected["preview"]["recipients"] == 6
    assert (
        db.query(Model111Declaration)
        .filter(
            Model111Declaration.company_id == company_id,
            Model111Declaration.year == 2026,
            Model111Declaration.period == "2T",
            Model111Declaration.declaration_type == "complementary",
            Model111Declaration.status == "presented",
        )
        .count()
        == 1
    )

    corrected_again = correct_model190_demo(db, company_id)
    assert corrected_again["stage"] == "ready_to_generate"
    assert (
        db.query(Model111Declaration)
        .filter(
            Model111Declaration.company_id == company_id,
            Model111Declaration.period == "2T",
            Model111Declaration.declaration_type == "complementary",
        )
        .count()
        == 1
    )

    generated = generate_model190_declaration(
        db,
        Model190DeclarationCreate(
            company_id=company_id,
            year=2026,
            declaration_type="ordinary",
        ),
    )
    assert generated["status"] == "generated"
    assert generated["total_recipients"] == 6
    assert generated["total_cash_income"] > Decimal("0.00")

    import_report = validate_model190_import(db, generated["id"])
    assert import_report["can_present"] is True
    assert import_report["error_records"] == 0

    presented = present_model190_declaration(
        db,
        generated["id"],
        Model190PresentationRequest(
            file_sha256=import_report["sha256"],
            signer_name="Responsable Caso Demo 190",
            certificate_alias="Certificado AulaNomina Demo Integral",
            confirm_information=True,
        ),
    )
    assert presented["status"] == "presented"
    assert presented["receipt_number"].startswith("190")

    status = get_model190_demo_status(db, company_id)
    assert status["stage"] == "presented"
    assert status["declaration"]["id"] == generated["id"]

    summary = render_model190_annual_summary(db, generated["id"])
    relation = render_model190_recipient_relation(db, generated["id"])
    receipt = render_model190_receipt(db, generated["id"])
    archive = build_model190_certificates_archive(db, generated["id"])

    assert "Modelo 190 · Resumen anual" in summary
    assert "AulaNomina Demo Modelo 190 SL" in summary
    assert "Relación de perceptores" in relation
    assert "JUSTIFICANTE SIN VALIDEZ FISCAL" in receipt
    assert archive["certificate_count"] == 4
    assert len(archive["sha256"]) == 64
    with zipfile.ZipFile(io.BytesIO(archive["content"])) as bundle:
        html_files = [name for name in bundle.namelist() if name.endswith(".html")]
        assert len(html_files) == 4
        assert "manifest-certificados.csv" in bundle.namelist()

    assert db.query(Model190Declaration).filter_by(id=generated["id"]).one().status == "presented"
