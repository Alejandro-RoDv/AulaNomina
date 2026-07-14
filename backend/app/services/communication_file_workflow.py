import re
from enum import Enum


class CommunicationFileType(str, Enum):
    SOCIAL_SECURITY_SETTLEMENT = "SOCIAL_SECURITY_SETTLEMENT"
    SILTRA_RESPONSE = "SILTRA_RESPONSE"
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
    CommunicationFileType.SILTRA_RESPONSE,
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
        CommunicationFileStatus.CANCELLED,
    },
    CommunicationFileStatus.PROCESSING: {
        CommunicationFileStatus.ACCEPTED,
        CommunicationFileStatus.ACCEPTED_WITH_WARNINGS,
        CommunicationFileStatus.REJECTED,
    },
    CommunicationFileStatus.ACCEPTED: set(),
    CommunicationFileStatus.ACCEPTED_WITH_WARNINGS: set(),
    CommunicationFileStatus.REJECTED: set(),
    CommunicationFileStatus.CANCELLED: set(),
}


class InvalidCommunicationTransition(ValueError):
    pass


def normalize_ccc(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"[^0-9A-Za-z]", "", value).upper()
    return normalized or None


def period_is_valid(file_type: CommunicationFileType, period: str) -> bool:
    if file_type in {
        CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT,
        CommunicationFileType.SILTRA_RESPONSE,
        CommunicationFileType.CRA,
        CommunicationFileType.FIE,
        CommunicationFileType.MASS_REGISTRATION,
        CommunicationFileType.MASS_TERMINATION,
    }:
        return bool(MONTHLY_PERIOD.fullmatch(period))
    if file_type == CommunicationFileType.AEAT_111:
        return bool(MONTHLY_PERIOD.fullmatch(period) or QUARTERLY_PERIOD.fullmatch(period))
    if file_type == CommunicationFileType.AEAT_190:
        return bool(ANNUAL_PERIOD.fullmatch(period))
    return False


def ccc_is_required(file_type: CommunicationFileType) -> bool:
    return file_type in CCC_REQUIRED_TYPES


def validate_transition(
    current_status: CommunicationFileStatus,
    next_status: CommunicationFileStatus,
) -> None:
    allowed = ALLOWED_TRANSITIONS[current_status]
    if next_status not in allowed:
        raise InvalidCommunicationTransition(
            f"Transición no permitida: {current_status.value} -> {next_status.value}"
        )
