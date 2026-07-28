from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.fie import FieProcessingEvent
from app.models.incident import Incident
from app.services.fie_pending_service import (
    check_new_fie_communications,
    generate_pending_fie_communications,
)


def build_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def seed_pending_incident(db):
    company = Company(name="Empresa FIE", cif="B12345678", ccc="14123456789")
    db.add(company)
    db.flush()

    employee = Employee(
        employee_code="9001",
        company_id=company.id,
        dni="12345678Z",
        naf="141234567890",
        first_name="María",
        last_name="López",
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

    incident = Incident(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        incident_type="IT",
        start_date=date(2026, 9, 3),
        status="open",
    )
    db.add(incident)
    db.commit()
    return company, employee, contract, incident


def test_pending_generation_creates_one_message_and_avoids_duplicates():
    db = build_session()
    company, _, _, incident = seed_pending_incident(db)

    first_batch = generate_pending_fie_communications(db, company_id=company.id)
    second_batch = generate_pending_fie_communications(db, company_id=company.id)

    assert len(first_batch) == 1
    assert first_batch[0].incident_id == incident.id
    assert first_batch[0].communication_type == "SICK_LEAVE"
    assert first_batch[0].process_reference == f"IT-2026-{incident.id:06d}"
    assert second_batch == []

    db.close()


def test_explicit_inss_check_returns_summary_and_audit_event():
    db = build_session()
    company, _, _, _ = seed_pending_incident(db)

    first_result = check_new_fie_communications(
        db,
        company_id=company.id,
        actor="Alumno demo",
        limit=50,
    )
    second_result = check_new_fie_communications(
        db,
        company_id=company.id,
        actor="Alumno demo",
        limit=50,
    )

    assert first_result["received_count"] == 1
    assert first_result["identified_count"] == 1
    assert first_result["unmatched_count"] == 0
    assert first_result["pending_review_count"] == 1
    assert first_result["communications"][0].is_read is False
    assert second_result["received_count"] == 0
    assert second_result["message"] == "No hay nuevas comunicaciones disponibles."

    query_events = db.query(FieProcessingEvent).filter(FieProcessingEvent.event_type == "INSS_QUERY").all()
    assert len(query_events) == 1
    assert query_events[0].actor == "Alumno demo"
    assert query_events[0].payload["company_id"] == company.id

    db.close()
