import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.mail import EmailThread, Mailbox
from app.models.student import Student
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    build_assignment_scenario,
    get_assignment_attempts,
    reset_assignment_progress,
    reveal_next_task_hint,
    start_assignment,
    update_assignment_step,
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


def build_scenario(db):
    student = Student(
        student_code="ALU-SCENARIO-001",
        first_name="Alumno",
        last_name="Escenario",
        email="alumno.escenario@aulanomina.local",
    )
    case_study = CaseStudy(
        scenario_code="TEST-CASE-001",
        title="Caso guiado de prueba",
        description="Escenario secuencial de tres pasos.",
        difficulty="intermediate",
        category="payroll",
        status="active",
        initial_state={"period": "2026-08"},
        validation_rules=[{"type": "demo"}],
        completion_message="Caso completado.",
    )
    db.add_all([student, case_study])
    db.flush()

    tasks = [
        CaseTask(
            case_study_id=case_study.id,
            title="Revisar contrato",
            module="contracts",
            expected_action="review_contract",
            trigger_condition={"training_code": "A01"},
            feedback_config={
                "hints": [
                    "Revisa primero los datos identificativos del contrato.",
                    "Comprueba la modalidad y las fechas antes de continuar.",
                ],
                "procedure": "Contratos → abre el contrato del caso → revisa sus datos principales.",
            },
            task_order=1,
            blocking=True,
        ),
        CaseTask(
            case_study_id=case_study.id,
            title="Recalcular nómina",
            module="payrolls",
            expected_action="recalculate_payroll",
            trigger_condition={"training_code": "A02"},
            task_order=2,
            blocking=True,
        ),
        CaseTask(
            case_study_id=case_study.id,
            title="Responder al correo",
            module="general",
            expected_action="reply_mail",
            trigger_condition={"training_code": "A03"},
            task_order=3,
            blocking=True,
        ),
    ]
    db.add_all(tasks)
    db.flush()

    assignment = CaseAssignment(
        case_study_id=case_study.id,
        student_id=student.id,
        assigned_by="Profesor prueba",
        status="assigned",
    )
    mailbox = Mailbox(
        role="student",
        display_name="Alumno Escenario",
        address="scenario@aulanomina.local",
    )
    db.add_all([assignment, mailbox])
    db.flush()

    thread = EmailThread(
        mailbox_id=mailbox.id,
        case_study_id=case_study.id,
        case_assignment_id=assignment.id,
        case_task_id=tasks[0].id,
        subject="Caso guiado",
        folder="inbox",
        status="open",
        priority="normal",
        category="payroll",
        case_reference="TEST-CASE-001",
        expected_actions=[],
        context_actions=[],
    )
    db.add(thread)
    db.commit()
    return assignment, tasks, thread


def test_scenario_starts_with_independent_step_progress(db):
    assignment, tasks, _ = build_scenario(db)

    scenario = start_assignment(db, assignment.id)

    assert scenario["assignment_status"] == "in_progress"
    assert scenario["completion_percentage"] == 0
    assert scenario["steps"][0]["progress_status"] == "in_progress"
    assert scenario["steps"][1]["progress_status"] == "pending"
    assert scenario["steps"][0]["task_id"] == tasks[0].id
    assert scenario["steps"][0]["hints_used"] == 0


def test_blocking_steps_enforce_order_and_advance_automatically(db):
    assignment, tasks, _ = build_scenario(db)
    start_assignment(db, assignment.id)

    with pytest.raises(CaseScenarioError) as exc_info:
        update_assignment_step(
            db,
            assignment.id,
            tasks[1].id,
            CaseTaskProgressUpdate(status="completed"),
        )

    assert exc_info.value.code == "BLOCKING_STEP_PENDING"

    scenario = update_assignment_step(
        db,
        assignment.id,
        tasks[0].id,
        CaseTaskProgressUpdate(
            status="completed",
            student_notes="Contrato revisado.",
            validation_result={"manual_check": True},
        ),
    )

    assert scenario["completion_percentage"] == 33
    assert scenario["steps"][0]["attempts"] == 1
    assert scenario["steps"][1]["progress_status"] == "in_progress"


def test_completing_required_steps_resolves_linked_mail_thread(db):
    assignment, tasks, thread = build_scenario(db)
    start_assignment(db, assignment.id)

    for task in tasks:
        scenario = update_assignment_step(
            db,
            assignment.id,
            task.id,
            CaseTaskProgressUpdate(status="completed", validation_result={"manual_check": True}),
        )

    db.refresh(thread)
    assert scenario["assignment_status"] == "submitted"
    assert scenario["completion_percentage"] == 100
    assert scenario["completed_steps"] == 3
    assert thread.status == "resolved"
    assert thread.case_task_id == tasks[-1].id


def test_attempt_history_survives_progress_reset(db):
    assignment, tasks, _ = build_scenario(db)
    start_assignment(db, assignment.id)
    update_assignment_step(
        db,
        assignment.id,
        tasks[0].id,
        CaseTaskProgressUpdate(
            status="in_progress",
            validation_result={
                "validated_at": "2026-08-17T18:00:00",
                "passed": False,
                "checks": [
                    {"supported": True, "passed": True},
                    {"supported": True, "passed": False},
                ],
            },
        ),
    )
    update_assignment_step(
        db,
        assignment.id,
        tasks[0].id,
        CaseTaskProgressUpdate(
            status="completed",
            validation_result={
                "validated_at": "2026-08-17T18:05:00",
                "passed": True,
                "checks": [
                    {"supported": True, "passed": True},
                    {"supported": True, "passed": True},
                ],
            },
        ),
    )

    attempts = list(reversed(get_assignment_attempts(db, assignment.id, task_id=tasks[0].id)))
    assert [attempt.score for attempt in attempts] == [50, 100]
    assert [attempt.status for attempt in attempts] == ["failed", "completed"]

    reset_assignment_progress(db, assignment.id)
    attempts_after_reset = get_assignment_attempts(db, assignment.id, task_id=tasks[0].id)
    assert len(attempts_after_reset) == 2


def test_progressive_help_reveals_two_hints_then_procedure(db):
    assignment, tasks, _ = build_scenario(db)

    first = reveal_next_task_hint(db, assignment.id, tasks[0].id)
    second = reveal_next_task_hint(db, assignment.id, tasks[0].id)
    procedure = reveal_next_task_hint(db, assignment.id, tasks[0].id)

    assert first["level"] == 1
    assert first["kind"] == "hint"
    assert second["level"] == 2
    assert second["kind"] == "hint"
    assert procedure["level"] == 3
    assert procedure["kind"] == "procedure"
    assert procedure["hints_used"] == 3

    scenario = build_assignment_scenario(db, assignment.id)
    assert scenario["steps"][0]["hints_used"] == 3
    assert scenario["steps"][0]["progress_status"] == "in_progress"


def test_evaluation_tasks_do_not_expose_hints(db):
    assignment, tasks, _ = build_scenario(db)
    tasks[0].trigger_condition = {"training_code": "C01"}
    db.commit()

    with pytest.raises(CaseScenarioError) as exc_info:
        reveal_next_task_hint(db, assignment.id, tasks[0].id)

    assert exc_info.value.code == "HINTS_DISABLED_FOR_EVALUATION"
    assert exc_info.value.status_code == 403


def test_reset_recreates_pending_progress_and_reopens_thread(db):
    assignment, tasks, thread = build_scenario(db)
    start_assignment(db, assignment.id)
    update_assignment_step(
        db,
        assignment.id,
        tasks[0].id,
        CaseTaskProgressUpdate(status="completed"),
    )

    scenario = reset_assignment_progress(db, assignment.id)

    db.refresh(thread)
    assert scenario["assignment_status"] == "assigned"
    assert scenario["completion_percentage"] == 0
    assert {step["progress_status"] for step in scenario["steps"]} == {"pending"}
    assert thread.status == "open"
    assert thread.case_task_id == tasks[0].id


def test_build_scenario_creates_progress_rows_when_missing(db):
    assignment, tasks, _ = build_scenario(db)

    scenario = build_assignment_scenario(db, assignment.id)

    assert scenario["total_steps"] == len(tasks)
    assert all(step["progress_status"] == "pending" for step in scenario["steps"])
