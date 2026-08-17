from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.schemas.mail import (
    EmailAttachmentPreviewResponse,
    EmailMessageCreate,
    EmailThreadCreate,
    EmailThreadResponse,
    EmailThreadUpdate,
    MailboxResponse,
    MailboxStatsResponse,
)
from app.services.case_scenario_service import reset_assignment_progress
from app.services.integrated_demo_case_service import ensure_integrated_demo_case
from app.services.integrated_demo_process_seed import ensure_integrated_fie_communication
from app.services.mail_attachment_service import attachment_download, attachment_preview
from app.services.mail_service import (
    create_thread,
    get_attachment,
    get_demo_mailbox,
    get_mailbox,
    get_thread,
    list_threads,
    reset_demo_mailbox,
)
from app.services.mail_thread_workflow_service import (
    capture_mailbox_view_state,
    create_thread_message,
    mailbox_stats,
    restore_mailbox_view_state,
    update_thread,
)
from app.training.activity_mail_2026 import ensure_activity_mail_2026
from app.training.document_runtime_bootstrap_2026 import bootstrap_document_training_2026
from app.training.integrated_runtime_mail_2026 import ensure_integrated_training_mail_2026


router = APIRouter(prefix="/mail", tags=["mail"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _prepare_demo_mailbox(db: Session, *, reset: bool = False):
    mailbox = reset_demo_mailbox(db) if reset else get_demo_mailbox(db)
    if reset:
        bootstrap_document_training_2026(db)
        mailbox = get_demo_mailbox(db, seed_if_empty=False)

    # Los upserts demo actualizan contenido y relaciones, pero una recarga normal
    # no debe reabrir correos leídos, devolver archivados al inbox ni reordenar la
    # bandeja. En un reset explícito sí se parte del estado docente inicial.
    view_state = {} if reset else capture_mailbox_view_state(db, mailbox.id)

    ensure_integrated_fie_communication(db, reset=reset)
    integrated_thread = ensure_integrated_demo_case(db, mailbox)
    if reset and integrated_thread.case_assignment_id:
        reset_assignment_progress(db, integrated_thread.case_assignment_id)
    ensure_integrated_training_mail_2026(db, mailbox)

    if view_state:
        restore_mailbox_view_state(db, view_state)

    # Se ejecuta después de restaurar el estado para que la limpieza de duplicados
    # formativos tenga prioridad sobre estados heredados de migraciones antiguas.
    ensure_activity_mail_2026(db, mailbox)
    return mailbox


@router.get("/demo-mailbox", response_model=MailboxResponse)
def read_demo_mailbox(db: Session = Depends(get_db)):
    return _prepare_demo_mailbox(db)


@router.post("/demo-mailbox/reset", response_model=MailboxResponse)
def reset_mailbox(db: Session = Depends(get_db)):
    return _prepare_demo_mailbox(db, reset=True)


@router.get("/mailboxes/{mailbox_id}/threads", response_model=list[EmailThreadResponse])
def read_mailbox_threads(
    mailbox_id: int,
    folder: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
):
    if not get_mailbox(db, mailbox_id):
        raise HTTPException(status_code=404, detail="Buzón no encontrado")
    return list_threads(db, mailbox_id, folder=folder, status=status, search=search)


@router.post("/mailboxes/{mailbox_id}/threads", response_model=EmailThreadResponse, status_code=201)
def post_mailbox_thread(
    mailbox_id: int,
    payload: EmailThreadCreate,
    db: Session = Depends(get_db),
):
    mailbox = get_mailbox(db, mailbox_id)
    if not mailbox:
        raise HTTPException(status_code=404, detail="Buzón no encontrado")
    return create_thread(db, mailbox, payload)


@router.get("/mailboxes/{mailbox_id}/stats", response_model=MailboxStatsResponse)
def read_mailbox_stats(mailbox_id: int, db: Session = Depends(get_db)):
    if not get_mailbox(db, mailbox_id):
        raise HTTPException(status_code=404, detail="Buzón no encontrado")
    return mailbox_stats(db, mailbox_id)


@router.get("/threads/{thread_id}", response_model=EmailThreadResponse)
def read_thread(thread_id: int, db: Session = Depends(get_db)):
    thread = get_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Hilo de correo no encontrado")
    return thread


@router.patch("/threads/{thread_id}", response_model=EmailThreadResponse)
def patch_thread(thread_id: int, payload: EmailThreadUpdate, db: Session = Depends(get_db)):
    thread = get_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Hilo de correo no encontrado")
    return update_thread(db, thread, payload)


@router.post("/threads/{thread_id}/messages", response_model=EmailThreadResponse)
def post_thread_message(thread_id: int, payload: EmailMessageCreate, db: Session = Depends(get_db)):
    thread = get_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Hilo de correo no encontrado")
    return create_thread_message(db, thread, payload)


@router.get("/attachments/{attachment_id}/preview", response_model=EmailAttachmentPreviewResponse)
def read_attachment_preview(attachment_id: int, db: Session = Depends(get_db)):
    attachment = get_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    return attachment_preview(attachment)


@router.get("/attachments/{attachment_id}/candidate-documents", response_model=list[DocumentResponse])
def read_attachment_candidate_documents(attachment_id: int, db: Session = Depends(get_db)):
    attachment = get_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    thread = attachment.message.thread if attachment.message else None
    if not thread or not thread.employee_id:
        return []
    return (
        db.query(Document)
        .filter(Document.employee_id == thread.employee_id)
        .order_by(Document.document_type.asc(), Document.id.asc())
        .all()
    )


@router.post("/attachments/{attachment_id}/link-document/{document_id}", response_model=EmailAttachmentPreviewResponse)
def link_attachment_to_document(
    attachment_id: int,
    document_id: int,
    db: Session = Depends(get_db),
):
    attachment = get_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Documento ERP no encontrado")

    thread = attachment.message.thread if attachment.message else None
    if thread and thread.employee_id and document.employee_id != thread.employee_id:
        raise HTTPException(
            status_code=400,
            detail="El documento seleccionado no pertenece al trabajador relacionado con este correo",
        )
    attachment.linked_document_id = document.id
    db.commit()
    db.refresh(attachment)
    return attachment_preview(attachment)


@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: int, db: Session = Depends(get_db)):
    attachment = get_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    content, media_type = attachment_download(attachment)
    filename = quote(attachment.filename)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )