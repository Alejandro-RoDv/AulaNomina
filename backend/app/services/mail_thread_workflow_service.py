from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.mail import EmailMessage, EmailThread
from app.schemas.mail import EmailMessageCreate, EmailThreadUpdate
from app.services.mail_service import create_message, get_thread


def capture_mailbox_view_state(db: Session, mailbox_id: int) -> dict[int, dict]:
    """Captura estado controlado por el usuario antes de ejecutar upserts demo."""
    return {
        thread.id: {
            "folder": thread.folder,
            "is_read": thread.is_read,
            "updated_at": thread.updated_at,
        }
        for thread in db.query(EmailThread).filter(EmailThread.mailbox_id == mailbox_id).all()
    }


def restore_mailbox_view_state(db: Session, state: dict[int, dict]) -> None:
    """Evita que un reseed idempotente reabra o reordene correos ya existentes."""
    if not state:
        return
    threads = db.query(EmailThread).filter(EmailThread.id.in_(list(state))).all()
    for thread in threads:
        previous = state.get(thread.id)
        if not previous:
            continue
        thread.folder = previous["folder"]
        thread.is_read = previous["is_read"]
        thread.updated_at = previous["updated_at"]
    db.commit()


def update_thread(db: Session, thread: EmailThread, payload: EmailThreadUpdate) -> EmailThread:
    """Actualiza metadatos del hilo sin alterar su orden cronológico.

    ``updated_at`` representa la última actividad real de conversación y se usa
    para ordenar el buzón. Marcar leído/no leído, archivar o cambiar prioridad no
    debe convertir el hilo en el más reciente ni provocar saltos en la lista.
    """
    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(thread, field, value)

    if "is_read" in values:
        read_at = datetime.utcnow() if values["is_read"] else None
        for message in thread.messages:
            if message.direction == "incoming":
                message.read_at = read_at

    db.commit()
    return get_thread(db, thread.id)


def create_thread_message(
    db: Session,
    thread: EmailThread,
    payload: EmailMessageCreate,
) -> EmailThread:
    # create_message conserva el contrato de persistencia y adjuntos de la rama.
    create_message(db, thread, payload)
    thread = get_thread(db, thread.id)

    thread.preview = (payload.body_text or "").strip()[:220]
    thread.updated_at = datetime.utcnow()
    thread.is_read = True

    if payload.message_type == "draft":
        thread.folder = "drafts"
        thread.status = "in_progress"
    elif payload.direction == "outgoing":
        if thread.folder in {"drafts", "trash"}:
            thread.folder = "sent"
        if thread.status != "resolved":
            thread.status = "in_progress"

    db.commit()
    return get_thread(db, thread.id)


def mailbox_stats(db: Session, mailbox_id: int) -> dict[str, int]:
    threads = db.query(EmailThread).filter(EmailThread.mailbox_id == mailbox_id).all()
    visible_threads = [
        item
        for item in threads
        if item.folder != "training_locked" and item.related_entity_type != "training_duplicate"
    ]
    result = {
        "total": len(visible_threads),
        "unread": sum(1 for item in visible_threads if item.folder == "inbox" and not item.is_read),
        "inbox": 0,
        "sent": 0,
        "drafts": 0,
        "archive": 0,
        "trash": 0,
        "pending": 0,
        "in_progress": 0,
        "waiting": 0,
        "resolved": 0,
    }
    for thread in visible_threads:
        if thread.folder in result:
            result[thread.folder] += 1
        if thread.status == "open":
            result["pending"] += 1
        elif thread.status in result:
            result[thread.status] += 1
    return result