"""Bootstrap aislado del bloque A46-A50."""

from sqlalchemy.orm import Session

from app.models.case_progress import CaseTaskProgress
from app.models.case_study import CaseStudy
from app.services.case_scenario_service import ensure_assignment_progress
from app.training.termination_runtime_cases_2026 import (
    TERMINATION_SCENARIO_CODES,
    prepare_termination_training_data_2026,
    seed_termination_runtime_assignments_2026,
    seed_termination_runtime_cases_2026,
)


MULTISTEP_SCENARIOS = {
    "TRAIN-2026-TERM-A46",
    "TRAIN-2026-TERM-A47",
    "TRAIN-2026-TERM-A48",
    "TRAIN-2026-TERM-A50",
}


def _normalize_task_training_codes(db: Session) -> None:
    """Los casos multistep se resuelven por scenario_code; A49 conserva código explícito."""
    cases = db.query(CaseStudy).filter(CaseStudy.scenario_code.in_(sorted(TERMINATION_SCENARIO_CODES))).all()
    changed = False
    for case_study in cases:
        for task in case_study.tasks:
            trigger = dict(task.trigger_condition or {})
            if case_study.scenario_code in MULTISTEP_SCENARIOS and trigger.pop("training_code", None):
                task.trigger_condition = trigger
                changed = True
    if changed:
        db.commit()


def _reset_termination_assignment_progress(db: Session) -> None:
    cases = db.query(CaseStudy).filter(CaseStudy.scenario_code.in_(sorted(TERMINATION_SCENARIO_CODES))).all()
    assignment_ids = [assignment.id for case_study in cases for assignment in case_study.assignments]
    if not assignment_ids:
        return
    db.query(CaseTaskProgress).filter(CaseTaskProgress.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
    for case_study in cases:
        for assignment in case_study.assignments:
            assignment.status = "assigned"
            assignment.started_at = None
            assignment.completed_at = None
            assignment.current_task_order = 1
            assignment.completion_percentage = 0
    db.commit()
    for assignment_id in assignment_ids:
        ensure_assignment_progress(db, assignment_id)


def bootstrap_termination_training_2026(db: Session) -> None:
    seed_termination_runtime_cases_2026(db)
    _normalize_task_training_codes(db)
    prepare_termination_training_data_2026(db)
    seed_termination_runtime_assignments_2026(db)
    _reset_termination_assignment_progress(db)
