"""Bootstrap aislado del bloque A51-A54."""

from sqlalchemy.orm import Session

from app.models.case_study import CaseStudy
from app.training.document_runtime_cases_2026 import (
    DOCUMENT_SCENARIO_CODES,
    prepare_document_training_data_2026,
    seed_document_runtime_assignments_2026,
    seed_document_runtime_cases_2026,
)


LEGACY_DOCUMENT_CASE_TITLE = "Expediente documental incompleto"


def _archive_superseded_document_case(db: Session) -> None:
    legacy_cases = db.query(CaseStudy).filter(CaseStudy.title == LEGACY_DOCUMENT_CASE_TITLE).all()
    changed = False
    for case_study in legacy_cases:
        if case_study.scenario_code in DOCUMENT_SCENARIO_CODES:
            continue
        if case_study.status != "archived":
            case_study.status = "archived"
            changed = True
    if changed:
        db.commit()


def bootstrap_document_training_2026(db: Session) -> None:
    """Restaura casos, asignaciones y evidencias del bloque documental."""
    _archive_superseded_document_case(db)
    seed_document_runtime_cases_2026(db)
    seed_document_runtime_assignments_2026(db)
    prepare_document_training_data_2026(db)
