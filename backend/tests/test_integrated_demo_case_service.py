from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy
from app.models.mail import EmailMessage, EmailThread
from app.services.integrated_demo_case_service import (
    INTEGRATED_SCENARIO_CODE,
    ensure_integrated_demo_case,
)
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
