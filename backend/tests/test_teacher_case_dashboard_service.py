from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.mail import EmailMessage, EmailThread, Mailbox
from app.models.student import Student
from app.services.case_scenario_service import start_assignment
from app.services.teacher_case_dashboard_service import (
    get_teacher_case_dashboard,
    get_teacher_case_detail,
)


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


def build_teacher_case(db):
    student = Student(
        student_code="ALU-TEACHER-001",
        first_name="Lucía",
        last_name="Moreno",
        email="lucia.moreno@aulanomina.local",
    )
    case_study = CaseStudy(
        scenario_code="DOC-TRACE-001",
        title="Caso con trazabilidad docente",
        description="Caso utilizado para revisar operaciones, intentos y mensajes.",
        difficulty="intermediate",
        category="absence",
        status="active",
    )
    db.add_all([student, case_study])
    db.flush()

    first_task = CaseTask(
        case_study_id=case_study.id,
        title="Registrar incidencia",
        module="incidents",
        expected_action="create_incident",
        task_order=1,
        blocking=True,
    )
    second_task = CaseTask(
        case_study_id=case_study.id,
        title="Recalcular nómina",
        module="payrolls",
        expected_action="recalculate_payroll",
        task_order=2,
        blocking=True,
    )
    db.add_all([first_task, second_task])
    db.flush()

    assignment = CaseAssignment(
        case_study_id=case_study.id,
        student_id=student.id,
        assigned_by="Profesora Demo",
        assigned_at=datetime.utcnow() - timedelta(hours=2),
        due_date=datetime.utcnow() + timedelta(days=4),
        status="assigned",
    )
    mailbox = Mailbox(
        role="student",
        display_name="Lucía Moreno",
        address="lucia.trace@aulanomina.local",
    )
    db.add_all([assignment, mailbox])
    db.flush()

    thread = EmailThread(
        mailbox_id=mailbox.id,
        case_study_id=case_study.id,
        case_assignment_id=assignment.id,
        case_task_id=first_task.id,
        subject="Caso docente trazable",
        folder="inbox",
        status="in_progress",
        category="absence",
        expected_actions=[],
        context_actions=[],
    )
    db.add(thread)
    db.flush()
    db.add(
        EmailMessage(
            thread_id=thread.id,
            sender_name="Tutor automático · AulaNomina",
            sender_address="tutor@aulanomina.local",
            recipient_name="Lucía Moreno",
            recipient_address=mailbox.address,
            body_text="La incidencia todavía no coincide con la fecha esperada.",
            direction="incoming",
            message_type="system",
            sent_at=datetime.utcnow() - timedelta(minutes=20),
        )
    )
    db.commit()

    scenario = start_assignment(db, assignment.id)
    progress = assignment.progress_entries[0]
    progress.validation_result = {
        "mode": "automatic",
        "validated_at": (datetime.utcnow() - timedelta(minutes=18)).isoformat(),
        "passed": False,
        "manual_required": False,
        "checks": [{"message": "La fecha de inicio no coincide.", "passed": False}],
        "events": [
            {
                "event_id": "evt-failed-001",
                "event_type": "operation_error",
                "action_code": "create_incident",
                "target": "incidents",
                "recorded_at": (datetime.utcnow() - timedelta(minutes=22)).isoformat(),
                "metadata": {"success": False, "status": 422, "path": "/incidents"},
            },
            {
                "event_id": "evt-success-001",
                "event_type": "operation_completed",
                "action_code": "create_incident",
                "target": "incidents",
                "recorded_at": (datetime.utcnow() - timedelta(minutes=19)).isoformat(),
                "metadata": {"success": True, "status": 200, "path": "/incidents"},
            },
        ],
    }
    progress.attempts = 1
    db.commit()
    return assignment, first_task, second_task, scenario


def test_teacher_dashboard_aggregates_progress_failures_and_feedback(db):
    assignment, _, _, _ = build_teacher_case(db)

    dashboard = get_teacher_case_dashboard(db)

    assert dashboard["metrics"]["total_assignments"] == 1
    assert dashboard["metrics"]["in_progress"] == 1
    assert dashboard["metrics"]["failed_operations"] == 1
    assert dashboard["metrics"]["tutor_messages"] == 1
    assert dashboard["assignments"][0]["assignment_id"] == assignment.id
    assert dashboard["assignments"][0]["current_step_title"] == "Registrar incidencia"
    assert dashboard["assignments"][0]["elapsed_minutes"] > 0


def test_teacher_dashboard_filters_by_search_status_and_assignee(db):
    build_teacher_case(db)

    matched = get_teacher_case_dashboard(
        db,
        status="in_progress",
        assignee_type="student",
        search="Lucia Moreno",
    )
    missing = get_teacher_case_dashboard(db, search="modelo 190")

    assert len(matched["assignments"]) == 1
    assert missing["metrics"]["total_assignments"] == 0


def test_teacher_detail_builds_steps_and_reverse_chronology(db):
    assignment, first_task, _, _ = build_teacher_case(db)

    detail = get_teacher_case_detail(db, assignment.id)

    assert detail["scenario_code"] == "DOC-TRACE-001"
    assert detail["failed_operations"] == 1
    assert detail["tutor_messages"] == 1
    assert len(detail["steps"]) == 2
    first_step = next(step for step in detail["steps"] if step["task_id"] == first_task.id)
    assert first_step["event_count"] == 2
    assert first_step["failed_operations"] == 1
    assert first_step["last_validation"]["passed"] is False
    assert any(item["entry_type"] == "operation_error" for item in detail["timeline"])
    assert any(item["entry_type"] == "tutor_message" for item in detail["timeline"])
    timestamps = [item["timestamp"] for item in detail["timeline"]]
    assert timestamps == sorted(timestamps, reverse=True)
