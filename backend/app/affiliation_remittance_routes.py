from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.communication_submission import CommunicationSubmission
from app.schemas.affiliation_remittance import (
    AffiliationActionRequest,
    AffiliationCandidateListResponse,
    AffiliationDraftCreate,
    AffiliationDraftListResponse,
    AffiliationDraftMovementUpdate,
    AffiliationDraftResponse,
    AffiliationSendResponse,
)
from app.schemas.communication_submission import CommunicationSubmissionDetailResponse
from app.services.affiliation_remittance_service import (
    AffiliationRemittanceDomainError,
    add_movements,
    create_draft,
    generate_draft,
    get_draft,
    list_candidates,
    list_drafts,
    process_affiliation_submission,
    remove_movement,
    send_draft,
    serialize_draft,
    serialize_submission_detail,
)
from app.services.communication_file_workflow import CommunicationFileStatus


router = APIRouter(prefix="/affiliation-remittances", tags=["affiliation-remittances"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _domain_error(error: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


def _draft_or_404(db: Session, draft_id: int):
    source = get_draft(db, draft_id)
    if not source:
        raise HTTPException(status_code=404, detail="Borrador de afiliación no encontrado")
    return source


def _submission_or_404(db: Session, submission_id: int):
    submission = (
        db.query(CommunicationSubmission)
        .filter(CommunicationSubmission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Envío de afiliación no encontrado")
    return submission


@router.get("/candidates", response_model=AffiliationCandidateListResponse)
def list_affiliation_candidates_endpoint(
    date_from: date = Query(...),
    date_to: date = Query(...),
    movement_type: str | None = Query(default=None),
    company_id: int | None = Query(default=None),
    collective_agreement_id: int | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    try:
        items = list_candidates(
            db,
            date_from=date_from,
            date_to=date_to,
            movement_type=movement_type,
            company_id=company_id,
            collective_agreement_id=collective_agreement_id,
            employee_id=employee_id,
        )
        return {"items": items, "total": len(items)}
    except AffiliationRemittanceDomainError as error:
        raise _domain_error(error) from error


@router.get("", response_model=AffiliationDraftListResponse)
def list_affiliation_drafts_endpoint(
    status: CommunicationFileStatus | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = list_drafts(
        db,
        status=status.value if status else None,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [serialize_draft(db, item) for item in items],
        "total": total,
    }


@router.post("", response_model=AffiliationDraftResponse, status_code=201)
def create_affiliation_draft_endpoint(
    payload: AffiliationDraftCreate,
    db: Session = Depends(get_db),
):
    try:
        return serialize_draft(
            db,
            create_draft(db, payload.movement_keys, created_by=payload.created_by),
        )
    except AffiliationRemittanceDomainError as error:
        raise _domain_error(error) from error


@router.post(
    "/submissions/{submission_id}/receive",
    response_model=CommunicationSubmissionDetailResponse,
)
def receive_affiliation_response_endpoint(
    submission_id: int,
    payload: AffiliationActionRequest,
    db: Session = Depends(get_db),
):
    try:
        submission = process_affiliation_submission(
            db,
            _submission_or_404(db, submission_id),
            created_by=payload.created_by,
        )
        return serialize_submission_detail(submission)
    except AffiliationRemittanceDomainError as error:
        raise _domain_error(error) from error


@router.get("/{draft_id}", response_model=AffiliationDraftResponse)
def read_affiliation_draft_endpoint(draft_id: int, db: Session = Depends(get_db)):
    return serialize_draft(db, _draft_or_404(db, draft_id))


@router.post("/{draft_id}/movements", response_model=AffiliationDraftResponse)
def add_affiliation_movements_endpoint(
    draft_id: int,
    payload: AffiliationDraftMovementUpdate,
    db: Session = Depends(get_db),
):
    try:
        source = add_movements(
            db,
            _draft_or_404(db, draft_id),
            payload.movement_keys,
            created_by=payload.created_by,
        )
        return serialize_draft(db, source)
    except AffiliationRemittanceDomainError as error:
        raise _domain_error(error) from error


@router.delete("/{draft_id}/movements/{movement_key:path}", response_model=AffiliationDraftResponse)
def remove_affiliation_movement_endpoint(
    draft_id: int,
    movement_key: str,
    created_by: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    try:
        source = remove_movement(
            db,
            _draft_or_404(db, draft_id),
            movement_key,
            created_by=created_by,
        )
        return serialize_draft(db, source)
    except AffiliationRemittanceDomainError as error:
        raise _domain_error(error) from error


@router.post("/{draft_id}/generate", response_model=AffiliationDraftResponse)
def generate_affiliation_draft_endpoint(
    draft_id: int,
    payload: AffiliationActionRequest,
    db: Session = Depends(get_db),
):
    try:
        source = generate_draft(
            db,
            _draft_or_404(db, draft_id),
            created_by=payload.created_by,
        )
        return serialize_draft(db, source)
    except AffiliationRemittanceDomainError as error:
        raise _domain_error(error) from error


@router.post("/{draft_id}/send", response_model=AffiliationSendResponse)
def send_affiliation_draft_endpoint(
    draft_id: int,
    payload: AffiliationActionRequest,
    db: Session = Depends(get_db),
):
    try:
        submission = send_draft(
            db,
            _draft_or_404(db, draft_id),
            created_by=payload.created_by,
        )
        return {
            "submission": serialize_submission_detail(submission),
            "response_available_after_ms": 1600,
            "sent_at": datetime.utcnow(),
        }
    except AffiliationRemittanceDomainError as error:
        raise _domain_error(error) from error
