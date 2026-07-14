from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.communication_file import CommunicationFileResponse
from app.services.siltra_simulation_service import CommunicationSubmissionStatus


class CommunicationSubmissionCreate(BaseModel):
    communication_file_id: int
    created_by: int | None = None


class CommunicationSubmissionActionRequest(BaseModel):
    created_by: int | None = None


class CommunicationSubmissionMessageResponse(BaseModel):
    code: str
    severity: str
    message: str
    employee_id: int | None = None
    employee_name: str | None = None
    naf: str | None = None
    payroll_id: int | None = None
    field: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    recommendation: str | None = None


class CommunicationSubmissionResponse(BaseModel):
    id: int
    communication_file_id: int
    company_id: int
    submission_number: str
    attempt_number: int
    status: CommunicationSubmissionStatus
    submitted_at: datetime | None
    processing_started_at: datetime | None
    processed_at: datetime | None
    response_code: str | None
    response_message: str | None
    response_file_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    error_count: int = 0
    warning_count: int = 0
    message_count: int = 0


class CommunicationSubmissionListResponse(BaseModel):
    items: list[CommunicationSubmissionResponse]
    total: int
    limit: int
    offset: int


class CommunicationSubmissionDetailResponse(CommunicationSubmissionResponse):
    source_file: CommunicationFileResponse
    response_file: CommunicationFileResponse | None = None
    messages: list[CommunicationSubmissionMessageResponse]
    history: list[dict[str, Any]] = Field(default_factory=list)
    settlement_id: int | None = None
    company_name: str | None = None
