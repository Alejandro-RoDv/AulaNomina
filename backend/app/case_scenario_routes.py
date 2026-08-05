from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.case_scenario import (
    CaseContextEventCreate,
    CaseOperationEventResponse,
    CaseScenarioResponse,
    CaseStepValidationResponse,
    CaseTaskProgressUpdate,
)
from app.schemas.teacher_case_dashboard import (
    TeacherCaseDashboardResponse,
    TeacherCaseDetailResponse,
)
from app.services.case_scenario_service import (
    CaseScenarioError,
    build_assignment_scenario,
    reset_assignment_progress,
    start_assignment,
    update_assignment_step,
)
from app.services.case_validation_service import (
    record_assignment_event,
    validate_assignment_step,
)
from app.services.teacher_case_dashboard_service import (
    get_teacher_case_dashboard,
    get_teacher_case_detail,
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


@router.get("/teacher-dashboard", response_model=TeacherCaseDashboardResponse)
def read_teacher_case_dashboard(
    status: str | None = Query(default=None),
    assignee_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return get_teacher_case_dashboard(
        db,
        status=status,
        assignee_type=assignee_type,
        search=search,
    )


@router.get("/{assignment_id}/teacher-detail", response_model=TeacherCaseDetailResponse)
def read_teacher_case_detail(assignment_id: int, db: Session = Depends(get_db)):
    try:
        return get_teacher_case_detail(db, assignment_id)
    except CaseScenarioError as error:
        _translate_error(error)


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


@router.post(
    "/{assignment_id}/steps/{task_id}/validate",
    response_model=CaseStepValidationResponse,
)
def validate_assignment_step_endpoint(
    assignment_id: int,
    task_id: int,
    db: Session = Depends(get_db),
):
    try:
        return validate_assignment_step(db, assignment_id, task_id)
    except CaseScenarioError as error:
        _translate_error(error)


@router.post("/{assignment_id}/events", response_model=CaseOperationEventResponse)
def record_assignment_event_endpoint(
    assignment_id: int,
    payload: CaseContextEventCreate,
    db: Session = Depends(get_db),
):
    try:
        return record_assignment_event(db, assignment_id, payload)
    except CaseScenarioError as error:
        _translate_error(error)


@router.post("/{assignment_id}/reset-progress", response_model=CaseScenarioResponse)
def reset_assignment_scenario(assignment_id: int, db: Session = Depends(get_db)):
    try:
        return reset_assignment_progress(db, assignment_id)
    except CaseScenarioError as error:
        _translate_error(error)
