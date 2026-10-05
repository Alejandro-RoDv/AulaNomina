from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_dependencies import get_optional_principal
from app.db import SessionLocal
from app.schemas.evaluation import EvaluationResultResponse
from app.services.auth_service import AuthPrincipal
from app.services.case_scenario_service import CaseScenarioError
from app.services.evaluation_result_service import get_evaluation_result
from app.services.learner_scope_service import assert_assignment_access


router = APIRouter(prefix="/case-assignments", tags=["teaching-evaluations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{assignment_id}/evaluation-result", response_model=EvaluationResultResponse)
def read_evaluation_result(
    assignment_id: int,
    db: Session = Depends(get_db),
    principal: AuthPrincipal | None = Depends(get_optional_principal),
):
    assert_assignment_access(db, principal, assignment_id)
    try:
        return get_evaluation_result(db, assignment_id)
    except CaseScenarioError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={"code": error.code, "message": error.message},
        ) from error
