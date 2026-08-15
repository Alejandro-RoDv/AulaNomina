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
from app.services.training_course_projection_2026 import build_master_activity_course_2026
from app.services.case_scenario_service import (
    CaseScenarioError,
    build_assignment_scenario,
    ensure_assignment_progress,
    reset_assignment_progress,
    start_assignment,
    update_assignment_step,
)
from app.services.case_validation_service import record_assignment_event
from app.services.training_document_review_service import (
    handles_training_document_review,
    validate_training_document_review,
)
from app.services.training_foundation_review_service import (
    handles_training_foundation_review,
    validate_training_foundation_review,
)
from app.services.training_hiring_review_service import (
    handles_training_hiring_review,
    validate_training_hiring_review,
)
from app.services.training_fiscal_review_service import (
    handles_training_fiscal_review,
    validate_training_fiscal_review,
)
from app.services.training_incident_review_service import (
    handles_training_incident_review,
    validate_training_incident_review,
)
from app.services.training_integrated_review_service import (
    handles_training_integrated_review,
    validate_training_integrated_review,
)
from app.services.training_payroll_structure_review_service import (
    handles_training_payroll_structure_review,
    validate_training_payroll_structure_review,
)
from app.services.training_regularization_chain_review_service import (
    handles_training_regularization_review,
    validate_training_regularization_review,
)
from app.services.training_social_security_review_service import (
    handles_training_social_security_review,
    validate_training_social_security_review,
)
from app.services.training_termination_review_service import (
    handles_training_termination_review,
    validate_training_termination_review,
)
from app.services.training_payroll_review_service import validate_training_aware_assignment_step
from app.services.professional_response_service import create_professional_response
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


@router.get("/course-activities")
def read_course_activities(db: Session = Depends(get_db)):
    """Return only master-syllabus activities projected onto executable runtime steps."""
    return build_master_activity_course_2026(db)


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
        assignment = ensure_assignment_progress(db, assignment_id)
        task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
        if task and handles_training_integrated_review(assignment, task):
            return validate_training_integrated_review(db, assignment_id, task_id)
        if task and handles_training_foundation_review(assignment, task):
            return validate_training_foundation_review(db, assignment_id, task_id)
        if task and handles_training_hiring_review(assignment, task):
            return validate_training_hiring_review(db, assignment_id, task_id)
        if task and handles_training_payroll_structure_review(assignment, task):
            return validate_training_payroll_structure_review(db, assignment_id, task_id)
        if task and handles_training_document_review(assignment, task):
            return validate_training_document_review(db, assignment_id, task_id)
        if task and handles_training_termination_review(assignment, task):
            return validate_training_termination_review(db, assignment_id, task_id)
        if task and handles_training_regularization_review(assignment, task):
            return validate_training_regularization_review(db, assignment_id, task_id)
        if task and handles_training_fiscal_review(assignment, task):
            return validate_training_fiscal_review(db, assignment_id, task_id)
        if task and handles_training_social_security_review(assignment, task):
            return validate_training_social_security_review(db, assignment_id, task_id)
        if task and handles_training_incident_review(assignment, task):
            return validate_training_incident_review(db, assignment_id, task_id)
        return validate_training_aware_assignment_step(db, assignment_id, task_id)
    except CaseScenarioError as error:
        _translate_error(error)


@router.post("/{assignment_id}/events", response_model=CaseOperationEventResponse)
def record_assignment_event_endpoint(
    assignment_id: int,
    payload: CaseContextEventCreate,
    db: Session = Depends(get_db),
):
    try:
        result = record_assignment_event(db, assignment_id, payload)
        event_id = str((payload.metadata or {}).get("event_id") or "").strip() or None
        result["professional_message_id"] = create_professional_response(
            db,
            assignment_id,
            action_code=payload.action_code,
            operation_status=payload.operation_status,
            event_id=event_id,
            validation=result.get("validation"),
            metadata=payload.metadata,
        )
        return result
    except CaseScenarioError as error:
        _translate_error(error)


@router.post("/{assignment_id}/reset-progress", response_model=CaseScenarioResponse)
def reset_assignment_scenario(assignment_id: int, db: Session = Depends(get_db)):
    try:
        return reset_assignment_progress(db, assignment_id)
    except CaseScenarioError as error:
        _translate_error(error)
