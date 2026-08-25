from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.training_workspace import TrainingWorkspace
from app.services.auth_service import AuthPrincipal
from app.services.case_scenario_service import reset_assignment_progress
from app.services.workspace_context import bind_workspace, reset_workspace
from app.services.workspace_seed_service import seed_workspace_from_baseline


class WorkspaceResetError(Exception):
    pass


def reset_learner_workspace(db: Session, principal: AuthPrincipal) -> TrainingWorkspace:
    if principal.is_staff or principal.student_id is None or principal.workspace_id is None:
        raise WorkspaceResetError("Solo un alumno con workspace activo puede restablecer su entorno")

    current = (
        db.query(TrainingWorkspace)
        .filter(
            TrainingWorkspace.id == principal.workspace_id,
            TrainingWorkspace.student_id == principal.student_id,
            TrainingWorkspace.status == "active",
        )
        .first()
    )
    if current is None:
        raise WorkspaceResetError("No se ha encontrado el workspace activo del alumno")

    now = datetime.utcnow()
    generation = int(current.reset_generation or 0) + 1

    # La generación anterior queda archivada. Sus filas ERP mantienen el mismo
    # workspace_id, por lo que dejan de ser visibles en cuanto la sesión resuelve
    # el nuevo entorno, sin borrados masivos ni pérdida de trazabilidad.
    current.status = "archived"
    current.student_id = None
    current.last_reset_at = now
    current.updated_at = now
    db.flush()

    fresh = TrainingWorkspace(
        student_id=principal.student_id,
        workspace_code=f"WS-{principal.student_id:06d}-R{generation:03d}",
        status="active",
        seed_version=current.seed_version or "2026.1",
        reset_generation=generation,
        last_reset_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(fresh)
    db.flush()

    assignments = (
        db.query(CaseAssignment)
        .filter(CaseAssignment.student_id == principal.student_id)
        .all()
    )
    for assignment in assignments:
        assignment.workspace_id = fresh.id
    db.commit()

    # El request que ejecuta el reset sigue ligado a la generación anterior.
    # Suspendemos temporalmente ese filtro para leer el baseline global.
    scope_token = bind_workspace(None)
    try:
        seed_workspace_from_baseline(db, fresh)
    finally:
        reset_workspace(scope_token)

    # Reiniciamos el estado ejecutable pero no eliminamos CaseTaskAttempt: el
    # historial pedagógico sobrevive al reset del entorno ERP.
    for assignment in assignments:
        reset_assignment_progress(db, assignment.id)

    db.refresh(fresh)
    return fresh
