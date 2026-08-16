import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.employee import Employee
from app.models.mail import EmailMessage, EmailThread, Mailbox
from app.models.student import Student
from app.schemas.case_scenario import CaseContextEventCreate
from app.services.case_scenario_service import start_assignment
from app.services.case_validation_service import (
    record_assignment_event,
    validate_assignment_step,
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


def build_assignment(db, *, expected_action="create_employee", validation_rules=None):
    student = Student(
        student_code=f"ALU-VALIDATION-{expected_action}",
        first_name="Alumno",
        last_name="Validación",
        email=f"{expected_action}@aulanomina.local",
    )
    case_study = CaseStudy(
        scenario_code=f"VALIDATION-{expected_action}",
        title="Caso de validación",
        difficulty="basic",
        category="contract",
        status="active",
        initial_state={"substitute": "Laura Sánchez"},
        completion_message="Caso completado.",
    )
    db.add_all([student, case_study])
    db.flush()

    task = CaseTask(
        case_study_id=case_study.id,
        title="Paso comprobable",
        module="employees",
        expected_action=expected_action,
        validation_rules=validation_rules or [],
        task_order=1,
        blocking=True,
    )
    db.add(task)
    db.flush()

    assignment = CaseAssignment(
        case_study_id=case_study.id,
        student_id=student.id,
        assigned_by="Profesor prueba",
        status="assigned",
    )
    mailbox = Mailbox(
        role="student",
        display_name="Alumno Validación",
        address=f"mail-{expected_action}@aulanomina.local",
    )
    db.add_all([assignment, mailbox])
    db.flush()

    thread = EmailThread(
        mailbox_id=mailbox.id,
        case_study_id=case_study.id,
        case_assignment_id=assignment.id,
        case_task_id=task.id,
        subject="Caso automático",
        preview="Caso pendiente",
        folder="inbox",
        status="open",
        priority="normal",
        category="contract",
        case_reference=case_study.scenario_code,
        expected_actions=[task.title],
        context_actions=[expected_action],
    )
    db.add(thread)
    db.commit()
    return assignment, task


def test_employee_exists_completes_step_automatically(db):
    assignment, task = build_assignment(db)
    db.add(
        Employee(
            employee_code="9001",
            dni="00000001R",
            first_name="Laura",
            last_name="Sánchez",
            is_active=True,
        )
    )
    db.commit()
    start_assignment(db, assignment.id)

    result = validate_assignment_step(db, assignment.id, task.id)

    assert result["passed"] is True
    assert result["manual_required"] is False
    assert result["scenario"]["completion_percentage"] == 100
    assert result["scenario"]["assignment_status"] == "submitted"
    assert result["checks"][0]["evidence"]["employee_id"] is not None


def test_unsupported_rule_keeps_step_open_for_manual_confirmation(db):
    assignment, task = build_assignment(db, expected_action="unsupported_training_action")
    start_assignment(db, assignment.id)

    result = validate_assignment_step(db, assignment.id, task.id)

    assert result["passed"] is False
    assert result["manual_required"] is True
    assert result["scenario"]["completion_percentage"] == 0
    assert result["scenario"]["steps"][0]["progress_status"] == "in_progress"


def test_module_open_event_is_persisted_in_step_evidence(db):
    assignment, task = build_assignment(db)
    start_assignment(db, assignment.id)

    result = record_assignment_event(
        db,
        assignment.id,
        CaseContextEventCreate(
            task_id=task.id,
            event_type="module_opened",
            action_code="create_employee",
            target="employees",
            operation_status="opened",
            auto_validate=False,
            metadata={"source": "mail"},
        ),
    )

    validation_result = result["scenario"]["steps"][0]["validation_result"]
    assert result["feedback_message_id"] is None
    assert validation_result["events"][0]["event_type"] == "module_opened"
    assert validation_result["events"][0]["action_code"] == "create_employee"
    assert validation_result["events"][0]["metadata"]["source"] == "mail"


def test_successful_module_operation_validates_and_sends_feedback(db):
    assignment, task = build_assignment(db)
    db.add(
        Employee(
            employee_code="9002",
            dni="00000002W",
            first_name="Laura",
            last_name="Sánchez",
            is_active=True,
        )
    )
    db.commit()
    start_assignment(db, assignment.id)

    result = record_assignment_event(
        db,
        assignment.id,
        CaseContextEventCreate(
            task_id=task.id,
            event_type="module_operation",
            action_code="create_employee",
            target="/employees",
            operation_status="success",
            response_summary="Alta de Laura Sánchez",
            metadata={"event_id": "employee-success-001", "resource_id": 9002},
        ),
    )

    feedback = db.query(EmailMessage).filter(EmailMessage.id == result["feedback_message_id"]).one()
    assert result["validation"]["passed"] is True
    assert result["scenario"]["completion_percentage"] == 100
    assert feedback.direction == "system"
    assert feedback.message_type == "automatic"
    assert "se ha comprobado correctamente" in feedback.body_text


def test_failed_module_operation_marks_attempt_and_sends_feedback(db):
    assignment, task = build_assignment(db)
    start_assignment(db, assignment.id)

    result = record_assignment_event(
        db,
        assignment.id,
        CaseContextEventCreate(
            task_id=task.id,
            event_type="module_operation",
            action_code="create_employee",
            target="/employees",
            operation_status="error",
            response_summary="Alta rechazada por datos incompletos",
            metadata={"event_id": "employee-error-001", "http_status": 422},
        ),
    )

    feedback = db.query(EmailMessage).filter(EmailMessage.id == result["feedback_message_id"]).one()
    step = result["scenario"]["steps"][0]
    assert result["validation"] is None
    assert step["progress_status"] == "failed"
    assert step["attempts"] == 1
    assert "no se ha completado correctamente" in feedback.body_text


def test_task_can_use_compact_custom_tutor_message(db):
    assignment, task = build_assignment(db)
    task.feedback_config = {
        "criteria": ["Trabajador correcto", "Alta activa"],
        "success": "{accion} completada en {paso}.",
    }
    db.add(
        Employee(
            employee_code="9003",
            dni="00000003A",
            first_name="Laura",
            last_name="Sánchez",
            is_active=True,
        )
    )
    db.commit()
    start_assignment(db, assignment.id)

    result = record_assignment_event(
        db,
        assignment.id,
        CaseContextEventCreate(
            task_id=task.id,
            event_type="module_operation",
            action_code="create_employee",
            target="/employees",
            operation_status="success",
            response_summary="Alta de Laura Sánchez",
            metadata={"event_id": "employee-custom-feedback-001", "resource_id": 9003},
        ),
    )

    feedback = db.query(EmailMessage).filter(EmailMessage.id == result["feedback_message_id"]).one()
    assert feedback.body_text == "Alta de Laura Sánchez completada en Paso comprobable."
    assert task.feedback_config["criteria"] == ["Trabajador correcto", "Alta activa"]
