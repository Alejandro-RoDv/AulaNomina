import json
from datetime import date
from decimal import Decimal

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
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept, PayrollItem
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
    company = Company(
        name="Empresa laboratorio",
        cif="B12345678",
        ccc="011234567890",
        status="alta",
        is_active=True,
    )
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
    db.flush()
    concept = PayrollConcept(
        name="Salario base",
        code="BASE-S44",
        category="SALARIO_BASE",
        concept_type="DEVENGO",
        salary_nature="SALARIAL",
        source_type="SYSTEM",
        calculation_type="FIXED_AMOUNT",
        default_amount=Decimal("1200.00"),
        default_unit_price=Decimal("1200.00"),
        is_active=True,
    )
    db.add(concept)
    db.flush()
    contract_line = ContractPayrollConcept(
        contract_id=contract.id,
        concept_id=concept.id,
        description="Salario base",
        quantity=Decimal("1.00"),
        unit_price=Decimal("1200.00"),
        amount=Decimal("1200.00"),
        is_active=True,
    )
    db.add(contract_line)
    payroll = Payroll(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        center_id=center.id,
        period_month=9,
        period_year=2026,
        status="draft",
    )
    db.add(payroll)
    db.flush()
    payroll_item = PayrollItem(
        payroll_id=payroll.id,
        concept_id=concept.id,
        description="Salario base",
        quantity=Decimal("1.00"),
        unit_price=Decimal("1200.00"),
        amount=Decimal("1200.00"),
    )
    db.add(payroll_item)
    db.commit()
    return company, employee, contract, payroll


def _workspace(db, code):
    student = Student(
        student_code=code,
        first_name=code,
        last_name="Alumno",
        email=f"{code.lower()}@example.test",
        status="active",
        is_active=True,
    )
    db.add(student)
    db.flush()
    workspace = TrainingWorkspace(
        student_id=student.id,
        workspace_code=f"WS-{code}",
        status="active",
        seed_version="2026.1",
        reset_generation=0,
    )
    db.add(workspace)
    db.commit()
    return student, workspace


def _principal(student, workspace, user_id):
    return AuthPrincipal(
        user_id=user_id,
        email=student.email,
        role="student",
        student_id=student.id,
        student_name=student.full_name,
        workspace_id=workspace.id,
        workspace_code=workspace.workspace_code,
        session_id=user_id,
    )


def test_two_students_do_not_share_salary_or_payroll_child_records(db):
    _baseline(db)
    _, workspace_a = _workspace(db, "A44")
    _, workspace_b = _workspace(db, "B44")
    seed_workspace_from_baseline(db, workspace_a)
    seed_workspace_from_baseline(db, workspace_b)

    token_a = bind_workspace(workspace_a.id)
    try:
        contract_line_a = db.query(ContractPayrollConcept).one()
        payroll_item_a = db.query(PayrollItem).one()
        contract_line_a.amount = Decimal("1600.00")
        payroll_item_a.amount = Decimal("1600.00")
        db.commit()
        ids_a = (contract_line_a.id, payroll_item_a.id)
    finally:
        reset_workspace(token_a)

    token_b = bind_workspace(workspace_b.id)
    try:
        contract_line_b = db.query(ContractPayrollConcept).one()
        payroll_item_b = db.query(PayrollItem).one()
        assert contract_line_b.id != ids_a[0]
        assert payroll_item_b.id != ids_a[1]
        assert contract_line_b.amount == Decimal("1200.00")
        assert payroll_item_b.amount == Decimal("1200.00")
    finally:
        reset_workspace(token_b)


def test_cross_workspace_child_reference_is_rejected_on_write(db):
    _baseline(db)
    _, workspace_a = _workspace(db, "A45")
    _, workspace_b = _workspace(db, "B45")
    seed_workspace_from_baseline(db, workspace_a)
    seed_workspace_from_baseline(db, workspace_b)

    token_b = bind_workspace(workspace_b.id)
    try:
        payroll_b_id = db.query(Payroll.id).scalar()
    finally:
        reset_workspace(token_b)

    token_a = bind_workspace(workspace_a.id)
    try:
        concept_id = db.query(PayrollConcept.id).filter(PayrollConcept.code == "BASE-S44").scalar()
        foreign_item = PayrollItem(
            payroll_id=payroll_b_id,
            concept_id=concept_id,
            description="Intento cruzado",
            quantity=Decimal("1.00"),
            unit_price=Decimal("10.00"),
            amount=Decimal("10.00"),
        )
        db.add(foreign_item)
        with pytest.raises(RuntimeError, match="workspace activo"):
            db.commit()
        db.rollback()
        assert db.query(PayrollItem).count() == 1
    finally:
        reset_workspace(token_a)


def test_reset_of_student_a_does_not_change_student_b_and_preserves_tutorial(db):
    _baseline(db)
    student_a, workspace_a = _workspace(db, "A46")
    _, workspace_b = _workspace(db, "B46")
    seed_workspace_from_baseline(db, workspace_a)
    seed_workspace_from_baseline(db, workspace_b)

    tutorial_state = {
        "phase": "familiarization",
        "slideIndex": 3,
        "familiarizationIndex": 2,
        "completed": False,
        "dismissed": True,
    }
    workspace_a.tutorial_state = json.dumps(tutorial_state)
    db.commit()

    token_b = bind_workspace(workspace_b.id)
    try:
        company_b = db.query(Company).one()
        company_b.name = "Cambio privado de B"
        db.commit()
        company_b_id = company_b.id
    finally:
        reset_workspace(token_b)

    token_a = bind_workspace(workspace_a.id)
    try:
        company_a = db.query(Company).one()
        company_a.name = "Cambio privado de A"
        db.commit()
        fresh = reset_learner_workspace(db, _principal(student_a, workspace_a, 4600))
    finally:
        reset_workspace(token_a)

    assert json.loads(fresh.tutorial_state) == tutorial_state

    fresh_token = bind_workspace(fresh.id)
    try:
        assert db.query(Company).one().name == "Empresa laboratorio"
    finally:
        reset_workspace(fresh_token)

    token_b = bind_workspace(workspace_b.id)
    try:
        company_b = db.query(Company).one()
        assert company_b.id == company_b_id
        assert company_b.name == "Cambio privado de B"
    finally:
        reset_workspace(token_b)
