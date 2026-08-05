from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.mail import (
    EmailMessageCreate,
    EmailThreadResponse,
    EmailThreadUpdate,
    MailboxResponse,
    MailboxStatsResponse,
)
from app.services.mail_service import (
    create_thread_message,
    get_demo_mailbox,
    get_mailbox,
    get_thread,
    list_threads,
    mailbox_stats,
    reset_demo_mailbox,
)


router = APIRouter(prefix="/mail", tags=["mail"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/demo-mailbox", response_model=MailboxResponse)
def read_demo_mailbox(db: Session = Depends(get_db)):
    return get_demo_mailbox(db)


@router.post("/demo-mailbox/reset", response_model=MailboxResponse)
def reset_mailbox(db: Session = Depends(get_db)):
    return reset_demo_mailbox(db)


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
