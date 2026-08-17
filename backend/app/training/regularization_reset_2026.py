"""Normalización previa del dataset persistente de B07.

El convenio formativo de retroactivos no pertenece a una empresa y sobrevive al
reset de la demo. Antes de reconstruir el caso se desactiva cualquier tabla que
haya quedado vigente tras A44 para que el seeder pueda restaurar sin conflicto
la tabla original como punto de partida.
"""

from sqlalchemy.orm import Session

from app.models.collective_agreement import CollectiveAgreement, SalaryTable
from app.training.regularization_runtime_cases_2026 import REGULARIZATION_AGREEMENT_CODE


def normalize_regularization_training_tables_2026(db: Session) -> None:
    agreement = db.query(CollectiveAgreement).filter(
        CollectiveAgreement.agreement_code == REGULARIZATION_AGREEMENT_CODE
    ).first()
    if agreement is None:
        return

    changed = False
    for table in db.query(SalaryTable).filter(
        SalaryTable.collective_agreement_id == agreement.id
    ).all():
        if table.status == "active":
            table.status = "historical"
            changed = True
    if changed:
        db.commit()
