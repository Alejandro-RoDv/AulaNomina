from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
import app.services.workspace_query_scope  # noqa: F401
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.student import Student
from app.models.training_workspace import TrainingWorkspace
from app.models.work_center import WorkCenter
from app.services.auth_service import AuthPrincipal
from app.services.workspace_context import bind_workspace, reset_workspace
from app.services.workspace_reset_service import reset_learner_workspace
from app.services.workspace_seed_service import seed_workspace_from_baseline


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


def _baseline(db):
    company = Company(name="Modelo 190 SL", cif="B12345678", ccc="011234567890", status="alta", is_active=True)
    db.add(company)
    db.flush()
    center = WorkCenter(
        company_id=company.id,
        center_code="GENERAL",
        name="Centro General",
        main_ccc="011234567890",
        is_active=True,
    )
    db.add(center)
    db.flush()
    employee = Employee(
        employee_code="0001",
        company_id=company.id,
        center_id=center.id,
        document_type="DNI",
        dni="12345678Z",
        first_name="Ana",
        last_name="Demo",
        status="active",
        is_active=True,
    )
    db.add(employee)
    db.flush()
    contract = Contract(
        employee_id=employee.id,
        company_id=company.id,
        center_id=center.id,
        contract_type="Indefinido",
        contract_code="100",
        start_date=date(2026, 1, 1),
        status="active",
    )
    db.add(contract)
    db.commit()
    return company, center, employee, contract


def _workspace(db, student_code: str, email: str):
    student = Student(
        student_code=student_code,
        first_name=student_code,
        last_name="Alumno",
        email=email,
        status="active",
        is_active=True,
    )
    db.add(student)
    db.flush()
    workspace = TrainingWorkspace(
        student_id=student.id,
        workspace_code=f"WS-{student_code}",
        status="active",
        seed_version="2026.1",
        reset_generation=0,
    )
    db.add(workspace)
    db.commit()
    return student, workspace


def test_seed_clones_core_domain_and_remaps_foreign_keys(db):
    baseline_company, _, _, _ = _baseline(db)
    _, workspace = _workspace(db, "A01", "a01@example.test")

    assert seed_workspace_from_baseline(db, workspace) is True

    company = db.query(Company).filter(Company.workspace_id == workspace.id).one()
    center = db.query(WorkCenter).filter(WorkCenter.workspace_id == workspace.id).one()
    employee = db.query(Employee).filter(Employee.workspace_id == workspace.id).one()
    contract = db.query(Contract).filter(Contract.workspace_id == workspace.id).one()

    assert company.id != baseline_company.id
    assert company.cif == baseline_company.cif
    assert center.company_id == company.id
    assert employee.company_id == company.id
    assert employee.center_id == center.id
    assert contract.employee_id == employee.id
    assert contract.company_id == company.id
    assert contract.center_id == center.id


def test_two_students_can_use_same_identifiers_without_seeing_each_other(db):
    _baseline(db)
    _, workspace_a = _workspace(db, "A02", "a02@example.test")
    _, workspace_b = _workspace(db, "B02", "b02@example.test")
    seed_workspace_from_baseline(db, workspace_a)
    seed_workspace_from_baseline(db, workspace_b)

    token_a = bind_workspace(workspace_a.id)
    try:
        companies_a = db.query(Company).all()
        assert len(companies_a) == 1
        assert companies_a[0].cif == "B12345678"
        companies_a[0].name = "Modificada solo por A"
        db.commit()
    finally:
        reset_workspace(token_a)

    token_b = bind_workspace(workspace_b.id)
    try:
        companies_b = db.query(Company).all()
        assert len(companies_b) == 1
        assert companies_b[0].cif == "B12345678"
        assert companies_b[0].name == "Modelo 190 SL"

        extra = Company(name="Empresa B", cif="B87654321", ccc="019999999999", status="alta", is_active=True)
        db.add(extra)
        db.commit()
        assert extra.workspace_id == workspace_b.id
    finally:
        reset_workspace(token_b)

    token_a = bind_workspace(workspace_a.id)
    try:
        assert db.query(Company).count() == 1
        assert db.query(Company).one().name == "Modificada solo por A"
    finally:
        reset_workspace(token_a)


def test_workspace_reset_archives_generation_and_restores_baseline(db):
    _baseline(db)
    student, workspace = _workspace(db, "A03", "a03@example.test")
    seed_workspace_from_baseline(db, workspace)

    token = bind_workspace(workspace.id)
    try:
        company = db.query(Company).one()
        company.name = "Cambio del alumno"
        db.commit()

        principal = AuthPrincipal(
            user_id=99,
            email=student.email,
            role="student",
            student_id=student.id,
            student_name=student.full_name,
            workspace_id=workspace.id,
            workspace_code=workspace.workspace_code,
            session_id=77,
        )
        fresh = reset_learner_workspace(db, principal)
    finally:
        reset_workspace(token)

    db.refresh(workspace)
    assert workspace.status == "archived"
    assert workspace.student_id is None
    assert fresh.id != workspace.id
    assert fresh.student_id == student.id
    assert fresh.reset_generation == 1

    fresh_token = bind_workspace(fresh.id)
    try:
        restored = db.query(Company).one()
        assert restored.name == "Modelo 190 SL"
        assert restored.cif == "B12345678"
    finally:
        reset_workspace(fresh_token)
