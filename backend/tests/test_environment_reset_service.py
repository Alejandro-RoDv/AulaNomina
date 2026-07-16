from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registra todas las tablas en Base
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.environment_reset_service import clear_company_workspace


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_clear_workspace_deletes_payroll_children_before_companies(db):
    concept = PayrollConcept(name="Salario base", code="SYSTEM_BASE", is_system=True)
    company = Company(name="Empresa antigua", cif="B12345678", ccc="14123456789")
    db.add_all([concept, company])
    db.flush()

    employee = Employee(
        employee_code="1",
        company_id=company.id,
        dni="12345678Z",
        first_name="Ana",
        last_name="Prueba",
    )
    db.add(employee)
    db.flush()

    contract = Contract(
        employee_id=employee.id,
        company_id=company.id,
        contract_type="Indefinido",
        start_date=date(2026, 1, 1),
    )
    db.add(contract)
    db.flush()

    payroll = Payroll(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        period_month=7,
        period_year=2026,
    )
    db.add(payroll)
    db.flush()

    db.add(PayrollItem(payroll_id=payroll.id, concept_id=concept.id, amount=1000))
    db.commit()

    result = clear_company_workspace(db)

    assert result["companies_deleted"] == 1
    assert db.query(PayrollItem).count() == 0
    assert db.query(Payroll).count() == 0
    assert db.query(Contract).count() == 0
    assert db.query(Employee).count() == 0
    assert db.query(Company).count() == 0
    assert db.query(PayrollConcept).count() == 1
