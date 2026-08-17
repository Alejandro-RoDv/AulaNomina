from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models.mail import EmailMessage, EmailThread
from app.schemas.mail import EmailThreadUpdate
from app.services.mail_service import get_demo_mailbox, list_threads
from app.services.mail_thread_workflow_service import update_thread
from app.training.activity_mail_2026 import ensure_activity_mail_2026
from app.training.hiring_runtime_cases_2026 import (
    seed_hiring_runtime_assignments_2026,
    seed_hiring_runtime_cases_2026,
)


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_read_toggle_does_not_reorder_inbox():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)
        before = list_threads(db, mailbox.id, folder="inbox")
        thread = next(item for item in before if not item.is_read)
        order_before = [item.id for item in before]
        updated_at_before = thread.updated_at

        read = update_thread(db, thread, EmailThreadUpdate(is_read=True))
        after_read = list_threads(db, mailbox.id, folder="inbox")
        assert read.is_read is True
        assert read.updated_at == updated_at_before
        assert [item.id for item in after_read] == order_before

        unread = update_thread(db, read, EmailThreadUpdate(is_read=False))
        after_unread = list_threads(db, mailbox.id, folder="inbox")
        assert unread.is_read is False
        assert unread.updated_at == updated_at_before
        assert [item.id for item in after_unread] == order_before


def test_activity_mail_suppresses_duplicate_generated_threads():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)
        seed_hiring_runtime_cases_2026(db)
        seed_hiring_runtime_assignments_2026(db)
        ensure_activity_mail_2026(db, mailbox)

        canonical = (
            db.query(EmailThread)
            .filter(EmailThread.mailbox_id == mailbox.id, EmailThread.subject.like("A08 ·%"))
            .order_by(EmailThread.id.asc())
            .first()
        )
        assert canonical is not None
        canonical.folder = "inbox"

        duplicate = EmailThread(
            mailbox_id=mailbox.id,
            subject=canonical.subject,
            preview=canonical.preview,
            folder="inbox",
            status="open",
            priority="normal",
            category="contract",
            case_reference=canonical.case_reference,
            is_read=False,
            expected_actions=list(canonical.expected_actions or []),
            context_actions=list(canonical.context_actions or []),
            related_entity_type="case_study",
            created_at=datetime(2026, 9, 1, 8, 0),
            updated_at=datetime(2026, 9, 1, 8, 0),
        )
        db.add(duplicate)
        db.flush()
        db.add(
            EmailMessage(
                thread_id=duplicate.id,
                sender_name="Dirección de personas",
                sender_address="personas@aulanomina.demo",
                recipient_name=mailbox.display_name,
                recipient_address=mailbox.address,
                body_text="Copia histórica del mismo encargo.",
                sent_at=datetime(2026, 9, 1, 8, 0),
                read_at=None,
                direction="incoming",
                message_type="initial",
            )
        )
        db.commit()

        ensure_activity_mail_2026(db, mailbox)
        a08_threads = (
            db.query(EmailThread)
            .filter(EmailThread.mailbox_id == mailbox.id, EmailThread.subject.like("A08 ·%"))
            .order_by(EmailThread.id.asc())
            .all()
        )

        assert len(a08_threads) == 2
        assert sum(thread.folder == "inbox" for thread in a08_threads) == 1
        suppressed = next(thread for thread in a08_threads if thread.folder == "training_locked")
        assert suppressed.related_entity_type == "training_duplicate"
        assert suppressed.is_read is True
        assert suppressed.status == "resolved"