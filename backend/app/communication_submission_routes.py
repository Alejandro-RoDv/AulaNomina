from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.communication_submission import (
    CommunicationSubmissionActionRequest,
    CommunicationSubmissionCreate,
    CommunicationSubmissionDetailResponse,
    CommunicationSubmissionListResponse,
)
from app.services.siltra_simulation_service import (
    CommunicationSubmissionStatus,
    SiltraSimulationDomainError,
    cancel_submission,
    create_submission,
    get_submission,
    list_submissions,
    process_submission,
    send_submission,
    serialize_submission,
    serialize_submission_detail,
    submit_communication_file,
)


router = APIRouter(tags=["communication-submissions"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_404(db: Session, submission_id: int):
    item = get_submission(db, submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Intento de envío no encontrado")
    return item


def _domain_error(error: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


@router.post(
    "/communication-submissions",
    response_model=CommunicationSubmissionDetailResponse,
    status_code=201,
)
def create_submission_endpoint(
    payload: CommunicationSubmissionCreate,
    db: Session = Depends(get_db),
):
    try:
        item = create_submission(
            db,
            payload.communication_file_id,
            created_by=payload.created_by,
        )
        return serialize_submission_detail(item)
    except SiltraSimulationDomainError as error:
        raise _domain_error(error) from error


@router.get(
    "/communication-submissions",
    response_model=CommunicationSubmissionListResponse,
)
def list_submissions_endpoint(
    company_id: int | None = Query(default=None),
    communication_file_id: int | None = Query(default=None),
    status: CommunicationSubmissionStatus | None = Query(default=None),
    period: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = list_submissions(
        db,
        company_id=company_id,
        communication_file_id=communication_file_id,
        status=status,
        period=period,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [serialize_submission(item) for item in items],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get(
    "/communication-submissions/{submission_id}",
    response_model=CommunicationSubmissionDetailResponse,
)
def read_submission_endpoint(submission_id: int, db: Session = Depends(get_db)):
    return serialize_submission_detail(_get_or_404(db, submission_id))


@router.post(
    "/communication-submissions/{submission_id}/send",
    response_model=CommunicationSubmissionDetailResponse,
)
def send_submission_endpoint(
    submission_id: int,
    payload: CommunicationSubmissionActionRequest,
    db: Session = Depends(get_db),
):
    try:
        item = send_submission(
            db,
            _get_or_404(db, submission_id),
            created_by=payload.created_by,
        )
        return serialize_submission_detail(item)
    except SiltraSimulationDomainError as error:
        raise _domain_error(error) from error


@router.post(
    "/communication-submissions/{submission_id}/process",
    response_model=CommunicationSubmissionDetailResponse,
)
def process_submission_endpoint(
    submission_id: int,
    payload: CommunicationSubmissionActionRequest,
    db: Session = Depends(get_db),
):
    try:
        item = process_submission(
            db,
            _get_or_404(db, submission_id),
            created_by=payload.created_by,
        )
        return serialize_submission_detail(item)
    except SiltraSimulationDomainError as error:
        raise _domain_error(error) from error


@router.get(
    "/communication-submissions/{submission_id}/response",
    response_model=CommunicationSubmissionDetailResponse,
)
def read_submission_response_endpoint(
    submission_id: int,
    db: Session = Depends(get_db),
):
    item = _get_or_404(db, submission_id)
    if not item.response_file_id:
        raise HTTPException(status_code=404, detail="El intento todavía no tiene respuesta")
    return serialize_submission_detail(item)


@router.post(
    "/communication-submissions/{submission_id}/cancel",
    response_model=CommunicationSubmissionDetailResponse,
)
def cancel_submission_endpoint(
    submission_id: int,
    payload: CommunicationSubmissionActionRequest,
    db: Session = Depends(get_db),
):
    try:
        item = cancel_submission(
            db,
            _get_or_404(db, submission_id),
            created_by=payload.created_by,
        )
        return serialize_submission_detail(item)
    except SiltraSimulationDomainError as error:
        raise _domain_error(error) from error


@router.post(
    "/communications/{communication_file_id}/submit",
    response_model=CommunicationSubmissionDetailResponse,
)
def submit_communication_file_endpoint(
    communication_file_id: int,
    payload: CommunicationSubmissionActionRequest,
    db: Session = Depends(get_db),
):
    try:
        item = submit_communication_file(
            db,
            communication_file_id,
            created_by=payload.created_by,
        )
        return serialize_submission_detail(item)
    except SiltraSimulationDomainError as error:
        raise _domain_error(error) from error
