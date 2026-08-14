"""Bootstrap aislado del bloque A51-A54."""

from sqlalchemy.orm import Session

from app.training.document_runtime_cases_2026 import (
    prepare_document_training_data_2026,
    seed_document_runtime_assignments_2026,
    seed_document_runtime_cases_2026,
)


def bootstrap_document_training_2026(db: Session) -> None:
    """Restaura casos, asignaciones y evidencias del bloque documental."""
    seed_document_runtime_cases_2026(db)
    seed_document_runtime_assignments_2026(db)
    prepare_document_training_data_2026(db)
