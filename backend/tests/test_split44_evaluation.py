import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.student import Student
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import ensure_assignment_progress, update_assignment_step
from app.services.evaluation_policy_service import evaluation_code_for_case, evaluation_code_for_task
from app.services.evaluation_result_service import get_evaluation_result


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


def build_evaluation(db):
    student = Student(
        student_code="EVAL-S44",
        first_name="Clara",
        last_name="Evaluación",
        email="clara.eval@aulanomina.test",
    )
    case = CaseStudy(
        scenario_code="TRAIN-2026-INT-C01",
        title="C01 · Nueva incorporación completa",
        description="Evaluación integral.",
        difficulty="advanced",
        category="general",
        status="active",
        initial_state={"training_sequence": ["C01"]},
        validation_rules=[],
    )
    db.add_all([student, case])
    db.flush()

    tasks = [
        CaseTask(
            case_study_id=case.id,
            title="Construir expediente",
            module="employees",
            expected_action="review_integrated_c01_employee",
            expected_result="Expediente correcto",
            trigger_type="system",
            trigger_condition={"capstone": True, "validation_interaction": "explicit_review"},
            task_order=1,
            blocking=True,
        ),
        CaseTask(
            case_study_id=case.id,
            title="Formalizar contrato",
            module="contracts",
            expected_action="review_integrated_c01_contract",
            expected_result="Contrato correcto",
            trigger_type="system",
            trigger_condition={"capstone": True, "validation_interaction": "explicit_review"},
            task_order=2,
            blocking=True,
        ),
        CaseTask(
            case_study_id=case.id,
            title="Primera nómina",
            module="payrolls",
            expected_action="review_integrated_c01_payroll",
            expected_result="Nómina correcta",
            trigger_type="system",
            trigger_condition={"capstone": True, "validation_interaction": "explicit_review"},
            task_order=3,
            blocking=True,
        ),
    ]
    db.add_all(tasks)
    db.flush()

    assignment = CaseAssignment(
        case_study_id=case.id,
        student_id=student.id,
        assigned_by="Tutor",
        status="assigned",
    )
    db.add(assignment)
    db.commit()
    ensure_assignment_progress(db, assignment.id)
    return assignment, case, tasks


def validation_result(*states, stamp):
    return {
        "validated_at": stamp,
        "passed": all(states),
        "checks": [
            {"supported": True, "passed": state, "message": f"Criterio {index}"}
            for index, state in enumerate(states, start=1)
        ],
    }


def test_capstone_is_detected_without_explicit_training_code(db):
    _, case, tasks = build_evaluation(db)

    assert evaluation_code_for_case(case) == "C01"
    assert evaluation_code_for_task(tasks[0]) == "C01"
    assert "training_code" not in tasks[0].trigger_condition


def test_evaluation_requires_completion_even_when_partial_average_reaches_pass_mark(db):
    assignment, _, tasks = build_evaluation(db)

    update_assignment_step(
        db,
        assignment.id,
        tasks[0].id,
        CaseTaskProgressUpdate(
            status="completed",
            validation_result=validation_result(True, False, stamp="2026-08-25T12:00:00"),
        ),
    )
    update_assignment_step(
        db,
        assignment.id,
        tasks[1].id,
        CaseTaskProgressUpdate(
            status="completed",
            validation_result=validation_result(True, stamp="2026-08-25T12:05:00"),
        ),
    )

    result = get_evaluation_result(db, assignment.id)

    assert result["evaluation_code"] == "C01"
    assert result["completed_tasks"] == 2
    assert result["total_tasks"] == 3
    assert result["score"] == 50
    assert result["passed"] is False
    assert result["status"] == "in_progress"
    assert [section["label"] for section in result["sections"]] == ["Expediente", "Contratación", "Nómina"]
    assert [section["score"] for section in result["sections"]] == [50, 100, 0]


def test_completed_evaluation_returns_final_score_and_passed_state(db):
    assignment, _, tasks = build_evaluation(db)

    for index, task in enumerate(tasks, start=1):
        update_assignment_step(
            db,
            assignment.id,
            task.id,
            CaseTaskProgressUpdate(
                status="completed",
                validation_result=validation_result(True, stamp=f"2026-08-25T12:0{index}:00"),
            ),
        )

    result = get_evaluation_result(db, assignment.id)

    assert result["completed_tasks"] == 3
    assert result["score"] == 100
    assert result["passed"] is True
    assert result["status"] == "completed"
