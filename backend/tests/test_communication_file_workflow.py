import pytest

from app.services.communication_file_workflow import (
    CommunicationFileStatus,
    CommunicationFileType,
    InvalidCommunicationTransition,
    ccc_is_required,
    normalize_ccc,
    period_is_valid,
    validate_transition,
)


def test_normalize_ccc_removes_visual_separators():
    assert normalize_ccc(" 01 / 1234567-89 ") == "01123456789"
    assert normalize_ccc(None) is None


def test_social_security_files_require_monthly_period_and_ccc():
    assert period_is_valid(CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT, "2026-08")
    assert not period_is_valid(CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT, "2026-Q3")
    assert ccc_is_required(CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT)
    assert ccc_is_required(CommunicationFileType.CRA)


def test_aeat_periods_use_their_own_periodicity():
    assert period_is_valid(CommunicationFileType.AEAT_111, "2026-Q3")
    assert period_is_valid(CommunicationFileType.AEAT_111, "2026-08")
    assert period_is_valid(CommunicationFileType.AEAT_190, "2026")
    assert not period_is_valid(CommunicationFileType.AEAT_190, "2026-12")
    assert not ccc_is_required(CommunicationFileType.AEAT_190)


def test_happy_path_reaches_generated_without_sent_state():
    validate_transition(CommunicationFileStatus.DRAFT, CommunicationFileStatus.VALIDATING)
    validate_transition(CommunicationFileStatus.VALIDATING, CommunicationFileStatus.READY)
    validate_transition(CommunicationFileStatus.READY, CommunicationFileStatus.GENERATED)


def test_invalid_transition_is_rejected():
    with pytest.raises(InvalidCommunicationTransition):
        validate_transition(CommunicationFileStatus.DRAFT, CommunicationFileStatus.SENT)

    with pytest.raises(InvalidCommunicationTransition):
        validate_transition(CommunicationFileStatus.ACCEPTED, CommunicationFileStatus.DRAFT)
