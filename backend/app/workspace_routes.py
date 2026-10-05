import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_dependencies import get_current_principal
from app.db import SessionLocal
from app.models.training_workspace import TrainingWorkspace
from app.schemas.workspace import TutorialState, TutorialStateResponse
from app.services.auth_service import AuthPrincipal
from app.services.workspace_reset_service import WorkspaceResetError, reset_learner_workspace


router = APIRouter(tags=["workspace"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _learner_workspace(db: Session, principal: AuthPrincipal) -> TrainingWorkspace:
    if principal.is_staff or principal.student_id is None or principal.workspace_id is None:
        raise HTTPException(status_code=409, detail="El usuario no tiene un workspace formativo activo")

    workspace = (
        db.query(TrainingWorkspace)
        .filter(
            TrainingWorkspace.id == principal.workspace_id,
            TrainingWorkspace.student_id == principal.student_id,
            TrainingWorkspace.status == "active",
        )
        .first()
    )
    if workspace is None:
        raise HTTPException(status_code=409, detail="No se ha encontrado el workspace formativo activo")
    return workspace


def _decode_tutorial_state(workspace: TrainingWorkspace) -> TutorialState:
    try:
        payload = json.loads(workspace.tutorial_state or "{}")
        return TutorialState.model_validate(payload)
    except (TypeError, ValueError, json.JSONDecodeError):
        return TutorialState()


@router.get("/training-workspace/tutorial-state", response_model=TutorialStateResponse)
def get_tutorial_state(
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    workspace = _learner_workspace(db, principal)
    state = _decode_tutorial_state(workspace)
    return TutorialStateResponse(workspace_id=workspace.id, **state.model_dump())


@router.put("/training-workspace/tutorial-state", response_model=TutorialStateResponse)
def update_tutorial_state(
    payload: TutorialState,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    workspace = _learner_workspace(db, principal)
    workspace.tutorial_state = json.dumps(payload.model_dump(), ensure_ascii=False)
    db.commit()
    db.refresh(workspace)
    return TutorialStateResponse(workspace_id=workspace.id, **payload.model_dump())


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
