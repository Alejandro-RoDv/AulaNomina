from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_dependencies import get_current_principal
from app.db import SessionLocal
from app.services.auth_service import AuthPrincipal
from app.services.workspace_reset_service import WorkspaceResetError, reset_learner_workspace


router = APIRouter(tags=["workspace"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/training-workspace/reset")
def reset_training_workspace(
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    try:
        workspace = reset_learner_workspace(db, principal)
    except WorkspaceResetError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    return {
        "ok": True,
        "message": "Entorno práctico restablecido al estado inicial.",
        "workspace_id": workspace.id,
        "workspace_code": workspace.workspace_code,
        "reset_generation": workspace.reset_generation,
        "last_reset_at": workspace.last_reset_at,
        "attempt_history_preserved": True,
    }
