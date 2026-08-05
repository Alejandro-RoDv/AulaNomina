from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.schemas.mail import EmailMessageCreate, EmailThreadUpdate
from app.services.mail_service import (
    create_thread_message,
    get_demo_mailbox,
    get_thread,
    list_threads,
    mailbox_stats,
    update_thread,
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


def test_demo_mailbox_is_seeded_once_with_expected_folders():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)
        second_call = get_demo_mailbox(db)
        threads = list_threads(db, mailbox.id)
        stats = mailbox_stats(db, mailbox.id)

        assert second_call.id == mailbox.id
        assert len(threads) == 8
        assert stats["inbox"] == 5
        assert stats["sent"] == 1
        assert stats["drafts"] == 1
        assert stats["archive"] == 1
        assert stats["unread"] == 3


def test_threads_can_be_filtered_by_folder_status_and_search():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)

        inbox = list_threads(db, mailbox.id, folder="inbox")
        resolved = list_threads(db, mailbox.id, status="resolved")
        fie = list_threads(db, mailbox.id, search="FIE")

        assert len(inbox) == 5
        assert len(resolved) == 3
        assert len(fie) == 1
        assert fie[0].case_reference == "IT-2026-008"
        assert len(fie[0].messages[0].attachments) == 2


def test_marking_thread_as_read_updates_incoming_messages():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)
        thread = list_threads(db, mailbox.id, search="NOM-2026-014")[0]

        updated = update_thread(db, thread, EmailThreadUpdate(is_read=True, status="in_progress"))

        assert updated.is_read is True
        assert updated.status == "in_progress"
        assert updated.messages[0].read_at is not None
        assert mailbox_stats(db, mailbox.id)["unread"] == 2


def test_archiving_and_replying_persist_the_conversation():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)
        thread = list_threads(db, mailbox.id, search="ALT-2026-021")[0]

        archived = update_thread(db, thread, EmailThreadUpdate(folder="archive"))
        assert archived.folder == "archive"

        replied = create_thread_message(
            db,
            archived,
            EmailMessageCreate(
                sender_name="Usuario demo",
                sender_address="usuario.demo@aulanomina.local",
                recipient_name="Dirección del centro Norte",
                recipient_address="direccion.norte@empresa-demo.es",
                body_text="Alta y contrato revisados. El movimiento queda preparado para afiliación.",
            ),
        )

        reloaded = get_thread(db, replied.id)
        latest_message = max(reloaded.messages, key=lambda message: message.id)
        assert len(reloaded.messages) == 2
        assert latest_message.direction == "outgoing"
        assert latest_message.message_type == "reply"
        assert reloaded.preview.startswith("Alta y contrato revisados")
        assert reloaded.status == "in_progress"


def test_draft_and_send_move_thread_between_persistent_folders():
    with TestingSession() as db:
        mailbox = get_demo_mailbox(db)
        thread = list_threads(db, mailbox.id, search="NOM-2026-014")[0]

        drafted = create_thread_message(
            db,
            thread,
            EmailMessageCreate(
                sender_name="Usuario demo",
                sender_address="usuario.demo@aulanomina.local",
                recipient_name="Administración",
                recipient_address="administracion@empresa-demo.es",
                body_text="He revisado la antigüedad y estoy preparando la regularización.",
                message_type="draft",
            ),
        )

        latest_draft = max(drafted.messages, key=lambda message: message.id)
        assert drafted.folder == "drafts"
        assert drafted.status == "in_progress"
        assert latest_draft.message_type == "draft"
        assert latest_draft.body_text.startswith("He revisado la antigüedad")
        assert mailbox_stats(db, mailbox.id)["drafts"] == 2

        sent = create_thread_message(
            db,
            drafted,
            EmailMessageCreate(
                sender_name="Usuario demo",
                sender_address="usuario.demo@aulanomina.local",
                recipient_name="Administración",
                recipient_address="administracion@empresa-demo.es",
                body_text="La antigüedad ha sido corregida y la nómina recalculada.",
                message_type="reply",
            ),
        )

        latest_reply = max(sent.messages, key=lambda message: message.id)
        assert sent.folder == "sent"
        assert latest_reply.message_type == "reply"
        assert latest_reply.body_text.startswith("La antigüedad ha sido corregida")
        assert sent.preview.startswith("La antigüedad ha sido corregida")
        assert mailbox_stats(db, mailbox.id)["sent"] == 2
