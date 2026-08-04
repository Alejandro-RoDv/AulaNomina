from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.schemas.model190 import Model190DeclarationCreate
from app.services.model190_calculator import Model190DomainError
from app.services.model190_declaration_service import (
    generate_model190_declaration,
    get_model190_declaration,
    get_model190_file,
    list_model190_declarations,
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


def build_payroll_case(db, *, dni="30000001A", gross="2000.00", withholding="240.00"):
    company = Company(name="AulaNomina Demo SL", cif="B14999991")
    db.add(company)
    db.flush()
    employee = Employee(
        employee_code="M190-GEN-001",
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
    db.commit()
    return company, employee, contract, payroll


def test_generation_freezes_recipients_lines_payload_and_files(db):
    company, _, _, payroll = build_payroll_case(db)

    result = generate_model190_declaration(
        db,
        Model190DeclarationCreate(
            company_id=company.id,
            year=2026,
            declaration_type="ordinary",
        ),
    )

    assert result["status"] == "generated"
    assert result["locked"] is True
    assert result["total_recipients"] == 1
    assert result["total_cash_income"] == Decimal("2000.00")
    assert result["total_withholding"] == Decimal("240.00")
    assert len(result["recipients"]) == 1
    assert result["recipients"][0]["lines"][0]["source_id"] == payroll.id
    assert set(result["file_metadata"]) == {"readable", "fixed_width"}
    assert result["file_metadata"]["fixed_width"]["record_count"] == 2
    assert result["file_metadata"]["fixed_width"]["presentable"] is False

    fixed = get_model190_file(db, result["id"], "fixed_width")
    readable = get_model190_file(db, result["id"], "readable")
    records = fixed["content"].splitlines()
    assert len(records) == 2
    assert all(len(record) == 250 for record in records)
    assert records[0].startswith("11902026B14999991")
    assert records[1].startswith("230000001A")
    assert "SIMULACION EDUCATIVA" in readable["content"]
    assert "NO PRESENTABLE ANTE LA AEAT" in readable["content"]


def test_frozen_declaration_does_not_change_when_live_payroll_changes(db):
    company, _, _, payroll = build_payroll_case(db)
    generated = generate_model190_declaration(
        db,
        Model190DeclarationCreate(company_id=company.id, year=2026),
    )
    original_file = get_model190_file(db, generated["id"], "fixed_width")

    payroll.gross_salary = Decimal("9999.00")
    payroll.irpf = Decimal("999.00")
    db.commit()

    frozen = get_model190_declaration(db, generated["id"])
    frozen_file = get_model190_file(db, generated["id"], "fixed_width")
    assert frozen["total_cash_income"] == Decimal("2000.00")
    assert frozen["total_withholding"] == Decimal("240.00")
    assert frozen_file["sha256"] == original_file["sha256"]
    assert frozen_file["content"] == original_file["content"]


def test_duplicate_ordinary_declaration_is_blocked(db):
    company, *_ = build_payroll_case(db)
    request = Model190DeclarationCreate(company_id=company.id, year=2026)
    generate_model190_declaration(db, request)

    with pytest.raises(Model190DomainError) as exc_info:
        generate_model190_declaration(db, request)

    assert exc_info.value.code == "DUPLICATE_ORDINARY_DECLARATION"
    assert exc_info.value.status_code == 409


def test_complementary_declaration_references_frozen_original(db):
    company, _, contract, _ = build_payroll_case(db)
    ordinary = generate_model190_declaration(
        db,
        Model190DeclarationCreate(company_id=company.id, year=2026),
    )

    employee = db.query(Employee).filter(Employee.company_id == company.id).one()
    db.add(
        Payroll(
            employee_id=employee.id,
            contract_id=contract.id,
            company_id=company.id,
            period_month=2,
            period_year=2026,
            gross_salary=Decimal("500.00"),
            irpf_base=Decimal("500.00"),
            irpf=Decimal("50.00"),
            employee_social_security=Decimal("30.00"),
            status="reviewed",
        )
    )
    db.commit()

    complementary = generate_model190_declaration(
        db,
        Model190DeclarationCreate(
            company_id=company.id,
            year=2026,
            declaration_type="complementary",
            original_declaration_id=ordinary["id"],
        ),
    )

    assert complementary["declaration_type"] == "complementary"
    assert complementary["original_declaration_id"] == ordinary["id"]
    assert complementary["total_cash_income"] == Decimal("2500.00")
    assert len(list_model190_declarations(db, company_id=company.id, year=2026)) == 2


def test_blocking_validation_prevents_generation_without_recipient_nif(db):
    company, *_ = build_payroll_case(db, dni="")

    with pytest.raises(Model190DomainError) as exc_info:
        generate_model190_declaration(
            db,
            Model190DeclarationCreate(company_id=company.id, year=2026),
        )

    assert exc_info.value.code == "MODEL190_VALIDATION_FAILED"
    validations = exc_info.value.context["validations"]
    assert validations["is_valid"] is False
    assert any(item["code"] == "RECIPIENT_NIF_REQUIRED" for item in validations["items"])
