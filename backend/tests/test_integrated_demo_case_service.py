from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy
from app.models.mail import EmailThread
from app.services.integrated_demo_case_service import (
    INTEGRATED_SCENARIO_CODE,
    ensure_integrated_demo_case,
)
from app.services.mail_service import get_demo_mailbox


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_integrated_demo_case_is_created_once_with_complete_workflow():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)

        first_thread = ensure_integrated_demo_case(db, mailbox)
        second_thread = ensure_integrated_demo_case(db, mailbox)

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
