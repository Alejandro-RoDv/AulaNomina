"""Bootstrap aislado del bloque A46-A50."""

from sqlalchemy.orm import Session

from app.models.case_study import CaseStudy
from app.training.termination_runtime_cases_2026 import (
    TERMINATION_SCENARIO_CODES,
    prepare_termination_training_data_2026,
    seed_termination_runtime_assignments_2026,
    seed_termination_runtime_cases_2026,
)


SCENARIO_TRAINING_CODES = {
    "TRAIN-2026-TERM-A46": "A46",
    "TRAIN-2026-TERM-A47": "A47",
    "TRAIN-2026-TERM-A48": "A48",
    "TRAIN-2026-TERM-A49": "A49",
    "TRAIN-2026-TERM-A50": "A50",
}


def _persist_training_codes(db: Session) -> None:
    """Hace que el runtime pueda reconstruir el bloque incluso tras reiniciar el servidor."""
    cases = db.query(CaseStudy).filter(CaseStudy.scenario_code.in_(sorted(TERMINATION_SCENARIO_CODES))).all()
    changed = False
    for case_study in cases:
        code = SCENARIO_TRAINING_CODES.get(case_study.scenario_code)
        if not code:
            continue
        for task in case_study.tasks:
            trigger = dict(task.trigger_condition or {})
            if trigger.get("training_code") == code:
                continue
            trigger["training_code"] = code
            task.trigger_condition = trigger
            changed = True
    if changed:
        db.commit()


def bootstrap_termination_training_2026(db: Session) -> None:
    seed_termination_runtime_cases_2026(db)
    _persist_training_codes(db)
    prepare_termination_training_data_2026(db)
    seed_termination_runtime_assignments_2026(db)
