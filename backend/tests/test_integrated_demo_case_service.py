from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.fie import FieCommunication
from app.models.incident import Incident
from app.models.mail import EmailMessage, EmailThread
from app.services.fie_case_service import compare_fie_case_communication
from app.services.integrated_demo_case_service import (
    INTEGRATED_SCENARIO_CODE,
    ensure_integrated_demo_case,
)
from app.services.integrated_demo_process_seed import ensure_integrated_fie_communication
from app.services.mail_service import get_demo_mailbox
from app.services.professional_response_service import create_professional_response


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _integrated_assignment(db):
    case_study = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code == INTEGRATED_SCENARIO_CODE)
        .one()
    )
    assignment = (
        db.query(CaseAssignment)
        .filter(CaseAssignment.case_study_id == case_study.id)
        .one()
    )
    return case_study, assignment


def _create_javier_process(db):
    company = Company(name="Fundación AulaNomina", cif="G14999999", ccc="14000000001")
    db.add(company)
    db.flush()
    employee = Employee(
        employee_code="1.2",
        dni="10000002B",
        naf="141000000002",
        first_name="Javier",
        last_name="Romero Sánchez",
        company_id=company.id,
        is_active=True,
        status="active",
    )
    db.add(employee)
    db.flush()
    contract = Contract(
        employee_id=employee.id,
        company_id=company.id,
        contract_type="Temporal",
        start_date=date(2026, 1, 8),
        end_date=date(2026, 6, 30),
        status="active",
    )
    db.add(contract)
    db.flush()
    incident = Incident(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        incident_type="IT común",
        start_date=date(2026, 5, 6),
        end_date=date(2026, 5, 13),
        status="closed",
    )
    db.add(incident)
    db.commit()
    return employee, incident


def test_integrated_demo_case_is_created_once_with_complete_workflow():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)

        first_thread = ensure_integrated_demo_case(db, mailbox)
        second_thread = ensure_integrated_demo_case(db, mailbox)

        case_study, assignment = _integrated_assignment(db)
        threads = (
            db.query(EmailThread)
            .filter(
                EmailThread.mailbox_id == mailbox.id,
                EmailThread.case_reference == INTEGRATED_SCENARIO_CODE,
            )
            .all()
        )

        assert first_thread.id == second_thread.id
        assert len(threads) == 1
        assert case_study.status == "active"
        assert case_study.initial_state["employee"] == "Javier Romero Sánchez"
        assert case_study.initial_state["substitute"] == "Marta Ruiz Córdoba"
        assert len(case_study.tasks) == 10
        assert [task.expected_action for task in case_study.tasks] == [
            "review_fie",
            "create_incident",
            "reconcile_fie",
            "create_employee",
            "create_contract",
            "prepare_affiliation",
            "submit_affiliation",
            "recalculate_payroll",
            "submit_siltra",
            "reply_mail",
        ]
        assert len(assignment.progress_entries) == 10
        assert assignment.status == "assigned"
        assert first_thread.case_assignment_id == assignment.id
        assert first_thread.employee_id is None
        assert len(first_thread.messages) == 1
        assert len(first_thread.messages[0].attachments) == 4
        assert first_thread.messages[0].attachments[0].content_text
        assert "fie-inbox" in first_thread.context_actions
        assert "siltra" in first_thread.context_actions


def test_integrated_fie_is_seeded_and_matches_existing_it():
    with TestingSession() as db:
        employee, incident = _create_javier_process(db)

        first = ensure_integrated_fie_communication(db)
        second = ensure_integrated_fie_communication(db)
        compared = compare_fie_case_communication(db, first.id, actor="Usuario demo")

        db.refresh(incident)
        assert first.id == second.id
        assert db.query(FieCommunication).count() == 1
        assert first.employee_id == employee.id
        assert first.sick_leave_date == date(2026, 5, 6)
        assert incident.incident_type == "IT"
        assert compared.status == "MATCHED"
        assert compared.incident_id == incident.id
        assert compared.reconciliation_result["checks"]


def test_siltra_response_uses_domain_status_and_is_idempotent():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)
        thread = ensure_integrated_demo_case(db, mailbox)
        _case_study, assignment = _integrated_assignment(db)

        message_id = create_professional_response(
            db,
            assignment.id,
            action_code="submit_siltra",
            operation_status="success",
            event_id="siltra-rejected-001",
            validation={"passed": True},
            metadata={
                "domain_status": "REJECTED",
                "response_code": "R9501",
                "response_message": "El NAF es obligatorio.",
                "submission_number": "SILTRA-SIM-2026-000015",
            },
        )
        duplicate_id = create_professional_response(
            db,
            assignment.id,
            action_code="submit_siltra",
            operation_status="success",
            event_id="siltra-rejected-001",
            validation={"passed": True},
            metadata={"domain_status": "REJECTED"},
        )

        message = db.query(EmailMessage).filter(EmailMessage.id == message_id).one()
        db.refresh(thread)

        assert duplicate_id == message_id
        assert message.direction == "incoming"
        assert message.sender_name == "SILTRA simulado"
        assert "rechazada" in message.body_text.lower()
        assert "R9501" in message.body_text
        assert "SILTRA-SIM-2026-000015" in message.body_text
        assert thread.status == "in_progress"
        assert thread.is_read is False
