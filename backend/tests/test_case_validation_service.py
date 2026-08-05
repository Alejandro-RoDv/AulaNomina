import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.employee import Employee
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
    db.add(assignment)
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
    assignment, task = build_assignment(db, expected_action="create_regularization")
    start_assignment(db, assignment.id)

    result = validate_assignment_step(db, assignment.id, task.id)

    assert result["passed"] is False
    assert result["manual_required"] is True
    assert result["scenario"]["completion_percentage"] == 0
    assert result["scenario"]["steps"][0]["progress_status"] == "in_progress"


def test_module_open_event_is_persisted_in_step_evidence(db):
    assignment, task = build_assignment(db)
    start_assignment(db, assignment.id)

    scenario = record_assignment_event(
        db,
        assignment.id,
        CaseContextEventCreate(
            task_id=task.id,
            event_type="module_opened",
            action_code="create_employee",
            target="employees",
            metadata={"source": "mail"},
        ),
    )

    validation_result = scenario["steps"][0]["validation_result"]
    assert validation_result["events"][0]["event_type"] == "module_opened"
    assert validation_result["events"][0]["action_code"] == "create_employee"
    assert validation_result["events"][0]["metadata"]["source"] == "mail"
