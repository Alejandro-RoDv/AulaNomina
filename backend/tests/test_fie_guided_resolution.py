from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.schemas.fie import FieResolutionRequest, FieSimulationRequest
from app.services.fie_case_service import compare_fie_case_communication
from app.services.fie_enhanced_service import resolve_fie_communication, simulate_fie_communication_enhanced


def build_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def seed_worker(db):
    company = Company(name="Empresa conciliación FIE", cif="B87654321", ccc="14111222333")
    db.add(company)
    db.flush()
    employee = Employee(
        employee_code="FIE-01",
        company_id=company.id,
        dni="87654321X",
        naf="141112223344",
        first_name="Lucía",
        last_name="Martín",
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
    db.commit()
    return company, employee, contract


def test_unknown_worker_is_kept_as_unmatched_inbox_item():
    db = build_session()
    company, _, _ = seed_worker(db)
    communication = simulate_fie_communication_enhanced(
        db,
        FieSimulationRequest(
            company_id=company.id,
            employee_id=None,
            external_worker_name="Persona externa",
            external_nif="00000000T",
            external_naf="999999999999",
            communication_type="SICK_LEAVE",
            event_date=date(2026, 7, 10),
            result_scenario="UNKNOWN_WORKER",
        ),
    )

    compared = compare_fie_case_communication(db, communication.id, actor="Docente")

    assert compared.status == "UNMATCHED_WORKER"
    assert compared.employee_id is None
    assert compared.reconciliation_result["issue_code"] == "WORKER_NOT_FOUND"
    assert compared.reconciliation_result["available_actions"] == ["MARK_FOR_REVIEW"]
    db.close()


def test_duplicate_communication_is_detected_and_can_be_discarded():
    db = build_session()
    company, employee, _ = seed_worker(db)
    common = dict(
        company_id=company.id,
        employee_id=employee.id,
        communication_type="SICK_LEAVE",
        event_date=date(2026, 7, 11),
        process_reference="IT-DUPLICATE-01",
    )
    simulate_fie_communication_enhanced(db, FieSimulationRequest(**common))
    duplicate = simulate_fie_communication_enhanced(
        db,
        FieSimulationRequest(**common, result_scenario="DUPLICATE"),
    )

    compared = compare_fie_case_communication(db, duplicate.id, actor="Docente")

    assert compared.status == "DUPLICATE"
    assert compared.reconciliation_result["issue_code"] == "DUPLICATE_COMMUNICATION"
    assert "IGNORE_DUPLICATE" in compared.reconciliation_result["available_actions"]
    db.close()


def test_date_mismatch_proposes_and_applies_a_valid_update_action():
    db = build_session()
    company, employee, contract = seed_worker(db)
    incident = Incident(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        incident_type="IT",
        start_date=date(2026, 7, 12),
        status="open",
    )
    db.add(incident)
    db.commit()

    communication = simulate_fie_communication_enhanced(
        db,
        FieSimulationRequest(
            company_id=company.id,
            employee_id=employee.id,
            communication_type="SICK_LEAVE",
            event_date=date(2026, 7, 12),
            sick_leave_date=date(2026, 7, 12),
            result_scenario="DATE_MISMATCH",
        ),
    )
    compared = compare_fie_case_communication(db, communication.id, actor="Alumno")

    assert compared.status == "DISCREPANCY"
    assert compared.reconciliation_result["recommended_action"] == "UPDATE_INCIDENT"
    assert set(compared.reconciliation_result["available_actions"]).issubset(
        {
            "LINK_INCIDENT",
            "CREATE_INCIDENT",
            "UPDATE_INCIDENT",
            "ADD_CONFIRMATION",
            "CLOSE_INCIDENT",
            "CANCEL_INCIDENT",
            "CREATE_RELAPSE",
            "MARK_FOR_REVIEW",
            "IGNORE_DUPLICATE",
        }
    )

    resolved = resolve_fie_communication(
        db,
        communication.id,
        FieResolutionRequest(
            action="UPDATE_INCIDENT",
            incident_id=incident.id,
            allow_date_override=True,
            actor="Alumno",
            notes="Se acepta la fecha comunicada por el INSS simulado.",
        ),
    )
    db.refresh(incident)

    assert resolved.status == "APPLIED"
    assert incident.start_date == date(2026, 7, 10)
    assert resolved.reconciliation_result["applied_action"] == "UPDATE_INCIDENT"
    db.close()
