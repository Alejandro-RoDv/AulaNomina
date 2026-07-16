from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.communication_file import CommunicationFileResponse
from app.schemas.communication_submission import CommunicationSubmissionDetailResponse


AffiliationMovementType = Literal["ALTA", "MODIFICACION", "BAJA"]


class AffiliationCandidateResponse(BaseModel):
    movement_key: str
    movement_type: AffiliationMovementType
    effective_date: date
    reason: str
    contract_id: int
    employee_id: int
    employee_name: str
    company_id: int
    company_name: str
    center_id: int | None = None
    center_name: str | None = None
    collective_agreement_id: int | None = None
    collective_agreement_name: str | None = None
    dni: str | None = None
    naf: str | None = None
    ccc: str | None = None
    contribution_group: str | None = None
    contract_code: str | None = None
    current_external_status: str


class AffiliationCandidateListResponse(BaseModel):
    items: list[AffiliationCandidateResponse]
    total: int


class AffiliationDraftCreate(BaseModel):
    movement_keys: list[str] = Field(min_length=1)
    created_by: int | None = None

    @field_validator("movement_keys")
    @classmethod
    def normalize_keys(cls, value: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(item.strip() for item in value if item and item.strip()))
        if not cleaned:
            raise ValueError("Seleccione al menos un movimiento.")
        return cleaned


class AffiliationDraftMovementUpdate(AffiliationDraftCreate):
    pass


class AffiliationActionRequest(BaseModel):
    created_by: int | None = None


class AffiliationDraftResponse(CommunicationFileResponse):
    movements: list[AffiliationCandidateResponse] = Field(default_factory=list)
    movement_count: int = 0
    company_count: int = 0
    ccc_count: int = 0
    date_from: date | None = None
    date_to: date | None = None
    latest_submission_id: int | None = None
    latest_submission_status: str | None = None


class AffiliationDraftListResponse(BaseModel):
    items: list[AffiliationDraftResponse]
    total: int


class AffiliationSendResponse(BaseModel):
    submission: CommunicationSubmissionDetailResponse
    response_available_after_ms: int = 1600
    sent_at: datetime
