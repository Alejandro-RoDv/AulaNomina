from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class CompanyPreferencesPayload(BaseModel):
    general: dict[str, Any] = Field(default_factory=dict)
    contribution: dict[str, Any] = Field(default_factory=dict)
    withholding: dict[str, Any] = Field(default_factory=dict)
    payroll: dict[str, Any] = Field(default_factory=dict)
    documents: dict[str, Any] = Field(default_factory=dict)
    corporate_identity: dict[str, Any] = Field(default_factory=dict)
    language: dict[str, Any] = Field(default_factory=dict)
    inherited_from_company_id: int | None = None
    effective_from: date | None = None
    updated_by: str | None = None


class CompanyPreferencesResponse(CompanyPreferencesPayload):
    id: int
    company_id: int
    schema_version: int
    updated_at: datetime
