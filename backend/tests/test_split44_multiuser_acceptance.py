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
from app.services.workspace_context import bind_workspace, reset_workspace


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


def _workspace(db, code: str):
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
    return workspace


def _create_private_payroll_graph(db, suffix: str, concept_id: int):
    company = Company(
        name=f"Empresa {suffix}",
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
        name=f"Centro {suffix}",
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
        last_name=suffix,
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

    contract_concept = ContractPayrollConcept(
        contract_id=contract.id,
        concept_id=concept_id,
        description="Plus privado",
        quantity=Decimal("1.00"),
        unit_price=Decimal("150.00"),
        amount=Decimal("150.00"),
        is_active=True,
    )
    db.add(contract_concept)

    payroll = Payroll(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        center_id=center.id,
        period_month=9,
        period_year=2026,
        base_salary=Decimal("1500.00"),
        gross_salary=Decimal("1650.00"),
        net_salary=Decimal("1400.00"),
        status="draft",
    )
    db.add(payroll)
    db.flush()

    payroll_item = PayrollItem(
        payroll_id=payroll.id,
        concept_id=concept_id,
        description="Plus privado",
        quantity=Decimal("1.00"),
        unit_price=Decimal("150.00"),
        amount=Decimal("150.00"),
    )
    db.add(payroll_item)
    db.commit()

    return {
        "company": company,
        "contract": contract,
        "contract_concept": contract_concept,
        "payroll": payroll,
        "payroll_item": payroll_item,
    }


def test_two_students_cannot_read_or_mutate_each_others_payroll_children(db):
    concept = PayrollConcept(
        name="Plus convenio",
        code="PLUS-TEST",
        category="COMPLEMENTO",
        concept_type="DEVENGO",
        salary_nature="SALARIAL",
        source_type="SYSTEM",
        calculation_type="FIXED_AMOUNT",
        default_amount=Decimal("150.00"),
        default_unit_price=Decimal("150.00"),
        is_active=True,
    )
    db.add(concept)
    db.commit()

    workspace_a = _workspace(db, "A44")
    workspace_b = _workspace(db, "B44")

    token_a = bind_workspace(workspace_a.id)
    try:
        graph_a = _create_private_payroll_graph(db, "A", concept.id)
        a_contract_concept_id = graph_a["contract_concept"].id
        a_payroll_item_id = graph_a["payroll_item"].id
        a_payroll_id = graph_a["payroll"].id
        assert graph_a["company"].workspace_id == workspace_a.id
        assert graph_a["payroll"].workspace_id == workspace_a.id
    finally:
        reset_workspace(token_a)

    token_b = bind_workspace(workspace_b.id)
    try:
        assert db.query(ContractPayrollConcept).filter(
            ContractPayrollConcept.id == a_contract_concept_id
        ).first() is None
        assert db.query(PayrollItem).filter(PayrollItem.id == a_payroll_item_id).first() is None
        assert db.query(Payroll).filter(Payroll.id == a_payroll_id).first() is None

        updated = db.query(PayrollItem).filter(PayrollItem.id == a_payroll_item_id).update(
            {PayrollItem.amount: Decimal("9999.00")},
            synchronize_session=False,
        )
        assert updated == 0
        db.commit()

        foreign_item = PayrollItem(
            payroll_id=a_payroll_id,
            concept_id=concept.id,
            description="Intento cruzado",
            quantity=Decimal("1.00"),
            unit_price=Decimal("1.00"),
            amount=Decimal("1.00"),
        )
        db.add(foreign_item)
        with pytest.raises(RuntimeError, match="workspace activo"):
            db.commit()
        db.rollback()

        graph_b = _create_private_payroll_graph(db, "B", concept.id)
        assert graph_b["company"].cif == "B12345678"
        assert graph_b["company"].workspace_id == workspace_b.id
        assert db.query(Company).count() == 1
        assert db.query(PayrollItem).count() == 1
    finally:
        reset_workspace(token_b)

    token_a = bind_workspace(workspace_a.id)
    try:
        item_a = db.query(PayrollItem).filter(PayrollItem.id == a_payroll_item_id).one()
        assert item_a.amount == Decimal("150.00")
        assert db.query(Company).count() == 1
        assert db.query(PayrollItem).count() == 1
    finally:
        reset_workspace(token_a)
