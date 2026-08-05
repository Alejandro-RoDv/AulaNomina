from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.case_scenario import (
    CaseScenarioResponse,
    CaseTaskProgressUpdate,
)
from app.services.case_scenario_service import (
    CaseScenarioError,
    build_assignment_scenario,
    reset_assignment_progress,
    start_assignment,
    update_assignment_step,
)


router = APIRouter(prefix="/case-assignments", tags=["teaching-scenarios"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _translate_error(error: CaseScenarioError):
    raise HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": error.message},
    ) from error


@router.get("/{assignment_id}/scenario", response_model=CaseScenarioResponse)
def read_assignment_scenario(assignment_id: int, db: Session = Depends(get_db)):
    try:
        return build_assignment_scenario(db, assignment_id)
    except CaseScenarioError as error:
        _translate_error(error)


@router.post("/{assignment_id}/start", response_model=CaseScenarioResponse)
def start_assignment_scenario(assignment_id: int, db: Session = Depends(get_db)):
    try:
        return start_assignment(db, assignment_id)
    except CaseScenarioError as error:
        _translate_error(error)


@router.patch("/{assignment_id}/steps/{task_id}", response_model=CaseScenarioResponse)
def patch_assignment_step(
    assignment_id: int,
    task_id: int,
    payload: CaseTaskProgressUpdate,
    db: Session = Depends(get_db),
):
    try:
        return update_assignment_step(db, assignment_id, task_id, payload)
    except CaseScenarioError as error:
        _translate_error(error)


@router.post("/{assignment_id}/reset-progress", response_model=CaseScenarioResponse)
def reset_assignment_scenario(assignment_id: int, db: Session = Depends(get_db)):
    try:
        return reset_assignment_progress(db, assignment_id)
    except CaseScenarioError as error:
        _translate_error(error)
