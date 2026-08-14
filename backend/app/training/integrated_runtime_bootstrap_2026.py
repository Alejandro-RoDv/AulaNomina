"""Bootstrap de B10 · casos integrales."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.case_study import CaseStudy
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept, PayrollItem
from app.models.work_center import WorkCenter
from app.services.integrated_demo_case_service import _ensure_assignment, _ensure_case_study
from app.services.integrated_demo_process_seed import ensure_integrated_fie_communication
from app.training.integrated_runtime_cases_2026 import (
    INTEGRATED_SCENARIO_CODES,
    seed_integrated_runtime_assignments_2026,
    seed_integrated_runtime_cases_2026,
)


SUPERSEDED_SCENARIOS = {"IT-2026-008", "NOM-2026-014"}
DEMO_COMPANY_CIF = "G14999999"
C03_DNI = "31000003D"
C03_NAF = "143100000003"


def _archive_superseded_integral_cases(db: Session) -> None:
    rows = db.query(CaseStudy).filter(CaseStudy.scenario_code.in_(sorted(SUPERSEDED_SCENARIOS))).all()
    changed = False
    for case_study in rows:
        if case_study.status != "archived":
            case_study.status = "archived"
            changed = True
    if changed:
        db.commit()


def _ensure_c02(db: Session) -> None:
    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    case_study = _ensure_case_study(db, company.id if company else None)
    _ensure_assignment(db, case_study)
    ensure_integrated_fie_communication(db, reset=False)
    db.commit()


def _clear_c03_student_work(db: Session, contract: Contract, payroll: Payroll | None) -> None:
    """El reset de demo debe devolver C03 al estado previo a la reclamación."""
    antiguedad_rows = (
        db.query(ContractPayrollConcept)
        .join(PayrollConcept, ContractPayrollConcept.concept_id == PayrollConcept.id)
        .filter(
            ContractPayrollConcept.contract_id == contract.id,
            (
                PayrollConcept.name.ilike("%antig%")
                | PayrollConcept.code.ilike("%antig%")
                | ContractPayrollConcept.description.ilike("%antig%")
            ),
        )
        .all()
    )
    for row in antiguedad_rows:
        db.delete(row)

    # La nómina semilla de C03 nace sin líneas: cualquier PayrollItem posterior
    # procede de cálculos/correcciones realizados durante el ejercicio.
    if payroll is not None:
        db.query(PayrollItem).filter(PayrollItem.payroll_id == payroll.id).delete(synchronize_session=False)


def _prepare_c03_baseline(db: Session) -> None:
    """Crea el expediente reclamado, pero no la corrección ni el retroactivo."""
    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    if company is None:
        return
    center = (
        db.query(WorkCenter)
        .filter(WorkCenter.company_id == company.id, WorkCenter.center_code == "1.1")
        .first()
    )
    employee = db.query(Employee).filter(Employee.dni == C03_DNI).first()
    employee_values = {
        "employee_code": "C03.1",
        "company_id": company.id,
        "center_id": center.id if center else None,
        "dni": C03_DNI,
        "naf": C03_NAF,
        "first_name": "Ana",
        "last_name": "Martín García",
        "birth_date": date(1991, 7, 12),
        "nationality": "Española",
        "email": "ana.martin@aulanomina.demo",
        "is_active": True,
        "status": "active",
    }
    if employee is None:
        employee = Employee(**employee_values)
        db.add(employee)
        db.flush()
    else:
        for field, value in employee_values.items():
            setattr(employee, field, value)

    contract = (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id, Contract.start_date == date(2026, 1, 1))
        .first()
    )
    contract_values = {
        "employee_id": employee.id,
        "company_id": company.id,
        "center_id": center.id if center else None,
        "contract_type": "Indefinido",
        "contract_family": "indefinite",
        "contract_code": "100",
        "start_date": date(2026, 1, 1),
        "seniority_date": date(2026, 7, 1),
        "recognized_seniority_date": date(2026, 7, 1),
        "status": "active",
        "working_day_type": "full_time",
        "weekly_hours": 40,
        "full_time_weekly_hours": 40,
        "partiality_coefficient": 100,
        "salary_base": Decimal("1700.00"),
        "gross_annual_salary": Decimal("23800.00"),
        "pay_schedule": "not_prorated_14",
    }
    if contract is None:
        contract = Contract(**contract_values)
        db.add(contract)
        db.flush()
    else:
        for field, value in contract_values.items():
            setattr(contract, field, value)

    payroll = (
        db.query(Payroll)
        .filter(
            Payroll.employee_id == employee.id,
            Payroll.contract_id == contract.id,
            Payroll.period_year == 2026,
            Payroll.period_month == 7,
        )
        .first()
    )
    _clear_c03_student_work(db, contract, payroll)

    payroll_values = {
        "employee_id": employee.id,
        "contract_id": contract.id,
        "company_id": company.id,
        "center_id": center.id if center else None,
        "period_year": 2026,
        "period_month": 7,
        "base_salary": Decimal("1700.00"),
        "worked_base_salary": Decimal("1700.00"),
        "salary_supplements": Decimal("0.00"),
        "seniority_amount": Decimal("0.00"),
        "gross_salary": Decimal("1700.00"),
        "common_contingencies_base": Decimal("1700.00"),
        "professional_contingencies_base": Decimal("1700.00"),
        "unemployment_training_fogasa_base": Decimal("1700.00"),
        "irpf_base": Decimal("1700.00"),
        "calculation_version": 0,
        "calculation_engine_version": None,
        "calculation_fingerprint": None,
        "last_calculated_at": None,
        "status": "draft",
    }
    if payroll is None:
        payroll = Payroll(**payroll_values)
        db.add(payroll)
    else:
        for field, value in payroll_values.items():
            setattr(payroll, field, value)
    db.commit()


def bootstrap_integrated_training_2026(db: Session) -> None:
    """Activa C01-C06 y retira los dos itinerarios cortos sustituidos por B10."""
    _archive_superseded_integral_cases(db)
    seed_integrated_runtime_cases_2026(db)
    seed_integrated_runtime_assignments_2026(db)
    _prepare_c03_baseline(db)
    _ensure_c02(db)


def integrated_scenario_map_2026() -> dict[str, str]:
    return dict(INTEGRATED_SCENARIO_CODES)
