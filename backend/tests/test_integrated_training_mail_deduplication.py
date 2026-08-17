from app.models.mail import EmailMessage, EmailThread
from app.training.integrated_runtime_mail_2026 import _suppress_integrated_duplicates, _thread_rank


def _incoming_message():
    return EmailMessage(direction="incoming", message_type="initial")


def _outgoing_reply():
    return EmailMessage(direction="outgoing", message_type="reply")


def test_integrated_mail_deduplication_preserves_student_conversation():
    historical = EmailThread(
        id=101,
        folder="inbox",
        status="open",
        related_entity_type="case_study",
        is_read=False,
    )
    historical.messages = [_incoming_message()]

    answered = EmailThread(
        id=102,
        folder="inbox",
        status="in_progress",
        related_entity_type="case_study",
        is_read=True,
    )
    answered.messages = [_incoming_message(), _outgoing_reply()]

    candidates = sorted([historical, answered], key=_thread_rank)
    keep = _suppress_integrated_duplicates(candidates)

    assert keep is answered
    assert historical.folder == "training_locked"
    assert historical.status == "resolved"
    assert historical.related_entity_type == "training_duplicate"
    assert historical.is_read is True


def test_integrated_mail_deduplication_prefers_visible_canonical_thread():
    canonical = EmailThread(
        id=201,
        folder="inbox",
        status="open",
        related_entity_type="case_study",
        is_read=False,
    )
    canonical.messages = [_incoming_message()]

    old_duplicate = EmailThread(
        id=202,
        folder="training_locked",
        status="resolved",
        related_entity_type="training_duplicate",
        is_read=True,
    )
    old_duplicate.messages = [_incoming_message()]

    candidates = sorted([old_duplicate, canonical], key=_thread_rank)
    keep = _suppress_integrated_duplicates(candidates)

    assert keep is canonical
    assert old_duplicate.folder == "training_locked"
    assert old_duplicate.related_entity_type == "training_duplicate"
