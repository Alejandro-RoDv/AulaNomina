from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.services.communication_file_workflow import (
    CommunicationEventType,
    CommunicationFileStatus,
    CommunicationFileType,
)


class CommunicationFileCreate(BaseModel):
    company_id: int
    ccc_id: str | None = None
    period: str = Field(min_length=4, max_length=10)
    file_type: CommunicationFileType
    original_filename: str | None = Field(default=None, max_length=255)
    content: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_by: int | None = None

    @field_validator("period")
    @classmethod
    def normalize_period(cls, value: str) -> str:
        return value.strip().upper()


class CommunicationFileUpdate(BaseModel):
    ccc_id: str | None = None
    period: str | None = Field(default=None, min_length=4, max_length=10)
    file_type: CommunicationFileType | None = None
    original_filename: str | None = Field(default=None, max_length=255)
    content: str | None = None
    metadata: dict[str, Any] | None = None
    created_by: int | None = None

    @field_validator("period")
    @classmethod
    def normalize_period(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("El periodo no puede ser nulo cuando se actualiza.")
        return value.strip().upper()

    @field_validator("file_type")
    @classmethod
    def reject_null_file_type(
        cls, value: CommunicationFileType | None
    ) -> CommunicationFileType | None:
        if value is None:
            raise ValueError("El tipo de fichero no puede ser nulo cuando se actualiza.")
        return value


class CommunicationFileGenerateRequest(BaseModel):
    content: str = Field(min_length=1)
    original_filename: str = Field(min_length=1, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_by: int | None = None


class CommunicationFileTransitionRequest(BaseModel):
    status: CommunicationFileStatus
    response_code: str | None = Field(default=None, max_length=100)
    response_message: str | None = None
    response_file_id: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_by: int | None = None


class CommunicationFileResponse(BaseModel):
    id: int
    company_id: int
    ccc_id: str | None
    period: str
    file_type: CommunicationFileType
    status: CommunicationFileStatus
    generated_at: datetime | None
    submitted_at: datetime | None
    processed_at: datetime | None
    original_filename: str | None
    content: str | None
    metadata: dict[str, Any]
    validation_errors: list[dict[str, Any]]
    response_code: str | None
    response_message: str | None
    response_file_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class CommunicationFileEventResponse(BaseModel):
    id: int
    communication_file_id: int
    event_type: CommunicationEventType
    from_status: CommunicationFileStatus | None
    to_status: CommunicationFileStatus | None
    message: str | None
    details: dict[str, Any]
    created_by: int | None
    created_at: datetime
