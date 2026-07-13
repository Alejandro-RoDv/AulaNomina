from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud.communication_file import (
    CommunicationFileDomainError,
    create_communication_file,
    generate_communication_file,
    get_communication_file,
    get_communication_file_events,
    get_communication_files,
    serialize_communication_event,
    serialize_communication_file,
    transition_communication_file,
    update_communication_file,
    validate_communication_file,
)
from app.db import SessionLocal
from app.schemas.communication_file import (
    CommunicationFileCreate,
    CommunicationFileEventResponse,
    CommunicationFileGenerateRequest,
    CommunicationFileResponse,
    CommunicationFileTransitionRequest,
    CommunicationFileUpdate,
)
from app.services.communication_file_workflow import (
    CommunicationFileStatus,
    CommunicationFileType,
    InvalidCommunicationTransition,
)


router = APIRouter(prefix="/communications", tags=["communications"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_404(db: Session, communication_file_id: int):
    item = get_communication_file(db, communication_file_id)
    if not item:
        raise HTTPException(status_code=404, detail="Comunicación no encontrada")
    return item


def _domain_error(error: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


@router.post("", response_model=CommunicationFileResponse, status_code=201)
def create_communication_file_endpoint(
    payload: CommunicationFileCreate,
    db: Session = Depends(get_db),
):
    try:
        return serialize_communication_file(create_communication_file(db, payload))
    except CommunicationFileDomainError as error:
        raise _domain_error(error) from error


@router.get("", response_model=list[CommunicationFileResponse])
def list_communication_files_endpoint(
    company_id: int | None = Query(default=None),
    ccc_id: str | None = Query(default=None),
    period: str | None = Query(default=None),
    file_type: CommunicationFileType | None = Query(default=None),
    status: CommunicationFileStatus | None = Query(default=None),
    db: Session = Depends(get_db),
):
    items = get_communication_files(
        db,
        company_id=company_id,
        ccc_id=ccc_id,
        period=period,
        file_type=file_type,
        status=status,
    )
    return [serialize_communication_file(item) for item in items]


@router.get("/{communication_file_id}", response_model=CommunicationFileResponse)
def read_communication_file_endpoint(
    communication_file_id: int,
    db: Session = Depends(get_db),
):
    return serialize_communication_file(_get_or_404(db, communication_file_id))


@router.put("/{communication_file_id}", response_model=CommunicationFileResponse)
def update_communication_file_endpoint(
    communication_file_id: int,
    payload: CommunicationFileUpdate,
    db: Session = Depends(get_db),
):
    item = _get_or_404(db, communication_file_id)
    try:
        return serialize_communication_file(update_communication_file(db, item, payload))
    except (CommunicationFileDomainError, InvalidCommunicationTransition) as error:
        raise _domain_error(error) from error


@router.post("/{communication_file_id}/validate", response_model=CommunicationFileResponse)
def validate_communication_file_endpoint(
    communication_file_id: int,
    created_by: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    item = _get_or_404(db, communication_file_id)
    try:
        return serialize_communication_file(
            validate_communication_file(db, item, created_by=created_by)
        )
    except CommunicationFileDomainError as error:
        raise _domain_error(error) from error


@router.post("/{communication_file_id}/generate", response_model=CommunicationFileResponse)
def generate_communication_file_endpoint(
    communication_file_id: int,
    payload: CommunicationFileGenerateRequest,
    db: Session = Depends(get_db),
):
    item = _get_or_404(db, communication_file_id)
    try:
        return serialize_communication_file(generate_communication_file(db, item, payload))
    except (CommunicationFileDomainError, InvalidCommunicationTransition) as error:
        raise _domain_error(error) from error


@router.post("/{communication_file_id}/transition", response_model=CommunicationFileResponse)
def transition_communication_file_endpoint(
    communication_file_id: int,
    payload: CommunicationFileTransitionRequest,
    db: Session = Depends(get_db),
):
    item = _get_or_404(db, communication_file_id)
    try:
        return serialize_communication_file(transition_communication_file(db, item, payload))
    except (CommunicationFileDomainError, InvalidCommunicationTransition) as error:
        raise _domain_error(error) from error


@router.get(
    "/{communication_file_id}/events",
    response_model=list[CommunicationFileEventResponse],
)
def list_communication_file_events_endpoint(
    communication_file_id: int,
    db: Session = Depends(get_db),
):
    _get_or_404(db, communication_file_id)
    return [
        serialize_communication_event(event)
        for event in get_communication_file_events(db, communication_file_id)
    ]
