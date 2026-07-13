import re
from enum import Enum


class CommunicationFileType(str, Enum):
    SOCIAL_SECURITY_SETTLEMENT = "SOCIAL_SECURITY_SETTLEMENT"
    CRA = "CRA"
    FIE = "FIE"
    MASS_REGISTRATION = "MASS_REGISTRATION"
    MASS_TERMINATION = "MASS_TERMINATION"
    AEAT_111 = "AEAT_111"
    AEAT_190 = "AEAT_190"


class CommunicationFileStatus(str, Enum):
    DRAFT = "DRAFT"
    VALIDATING = "VALIDATING"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    READY = "READY"
    GENERATED = "GENERATED"
    SENT = "SENT"
    PROCESSING = "PROCESSING"
    ACCEPTED = "ACCEPTED"
    ACCEPTED_WITH_WARNINGS = "ACCEPTED_WITH_WARNINGS"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class CommunicationEventType(str, Enum):
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    STATUS_CHANGED = "STATUS_CHANGED"
    VALIDATED = "VALIDATED"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    GENERATED = "GENERATED"
    RESPONSE_LINKED = "RESPONSE_LINKED"


MONTHLY_PERIOD = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
QUARTERLY_PERIOD = re.compile(r"^\d{4}-Q[1-4]$")
ANNUAL_PERIOD = re.compile(r"^\d{4}$")

CCC_REQUIRED_TYPES = {
    CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT,
    CommunicationFileType.CRA,
    CommunicationFileType.FIE,
    CommunicationFileType.MASS_REGISTRATION,
    CommunicationFileType.MASS_TERMINATION,
}

ALLOWED_TRANSITIONS = {
    CommunicationFileStatus.DRAFT: {
        CommunicationFileStatus.VALIDATING,
        CommunicationFileStatus.CANCELLED,
    },
    CommunicationFileStatus.VALIDATING: {
        CommunicationFileStatus.VALIDATION_ERROR,
        CommunicationFileStatus.READY,
        CommunicationFileStatus.CANCELLED,
    },
    CommunicationFileStatus.VALIDATION_ERROR: {
        CommunicationFileStatus.DRAFT,
        CommunicationFileStatus.VALIDATING,
        CommunicationFileStatus.CANCELLED,
    },
    CommunicationFileStatus.READY: {
        CommunicationFileStatus.GENERATED,
        CommunicationFileStatus.CANCELLED,
    },
    CommunicationFileStatus.GENERATED: {
        CommunicationFileStatus.SENT,
        CommunicationFileStatus.CANCELLED,
    },
    CommunicationFileStatus.SENT: {
        CommunicationFileStatus.PROCESSING,
        CommunicationFileStatus.ACCEPTED,
        CommunicationFileStatus.ACCEPTED_WITH_WARNINGS,
        CommunicationFileStatus.REJECTED,
    },
    CommunicationFileStatus.PROCESSING: {
        CommunicationFileStatus.ACCEPTED,
        CommunicationFileStatus.ACCEPTED_WITH_WARNINGS,
        CommunicationFileStatus.REJECTED,
    },
    CommunicationFileStatus.REJECTED: {
        CommunicationFileStatus.DRAFT,
        CommunicationFileStatus.CANCELLED,
    },
    CommunicationFileStatus.ACCEPTED: set(),
    CommunicationFileStatus.ACCEPTED_WITH_WARNINGS: set(),
    CommunicationFileStatus.CANCELLED: set(),
}


class InvalidCommunicationTransition(ValueError):
    pass


def normalize_ccc(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = "".join(character for character in value.strip().upper() if character.isalnum())
    return normalized or None


def period_is_valid(file_type: CommunicationFileType | str, period: str) -> bool:
    normalized_type = CommunicationFileType(file_type)
    normalized_period = (period or "").strip().upper()

    if normalized_type == CommunicationFileType.AEAT_190:
        return bool(ANNUAL_PERIOD.fullmatch(normalized_period))
    if normalized_type == CommunicationFileType.AEAT_111:
        return bool(
            MONTHLY_PERIOD.fullmatch(normalized_period)
            or QUARTERLY_PERIOD.fullmatch(normalized_period)
        )
    return bool(MONTHLY_PERIOD.fullmatch(normalized_period))


def ccc_is_required(file_type: CommunicationFileType | str) -> bool:
    return CommunicationFileType(file_type) in CCC_REQUIRED_TYPES


def validate_transition(
    current_status: CommunicationFileStatus | str,
    target_status: CommunicationFileStatus | str,
) -> None:
    current = CommunicationFileStatus(current_status)
    target = CommunicationFileStatus(target_status)
    if target not in ALLOWED_TRANSITIONS[current]:
        raise InvalidCommunicationTransition(
            f"Transición no permitida: {current.value} -> {target.value}"
        )
