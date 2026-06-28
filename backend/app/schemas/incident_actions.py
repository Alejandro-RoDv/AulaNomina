from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class VersionedIncidentAction(BaseModel):
    expected_version: int = Field(ge=1)
    actor: str | None = None


class IncidentCancelRequest(VersionedIncidentAction):
    reason: str = Field(min_length=3, max_length=2000)


class IncidentProcessRequest(VersionedIncidentAction):
    payroll_id: int
    generated_amount: Decimal = Field(default=Decimal("0"), ge=0)


class IncidentRecalculationRequest(VersionedIncidentAction):
    reason: str = Field(min_length=3, max_length=2000)


class IncidentConfirmationCreate(BaseModel):
    number: str = Field(min_length=1, max_length=100)
    confirmation_date: date
    doctor_number: str | None = Field(default=None, max_length=100)
    confirmation_type: str | None = Field(default=None, max_length=100)
    observations: str | None = Field(default=None, max_length=4000)
    document_id: int | None = None
    status: str = "active"
    actor: str | None = None
    expected_incident_version: int = Field(ge=1)


class IncidentConfirmationUpdate(BaseModel):
    number: str | None = Field(default=None, min_length=1, max_length=100)
    confirmation_date: date | None = None
    doctor_number: str | None = Field(default=None, max_length=100)
    confirmation_type: str | None = Field(default=None, max_length=100)
    observations: str | None = Field(default=None, max_length=4000)
    document_id: int | None = None
    status: str | None = None
    actor: str | None = None
    expected_version: int = Field(ge=1)
    expected_incident_version: int = Field(ge=1)


class IncidentConfirmationCancelRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)
    actor: str | None = None
    expected_version: int = Field(ge=1)
    expected_incident_version: int = Field(ge=1)


class IncidentMonthlySummaryResponse(BaseModel):
    employee_id: int
    contract_id: int | None = None
    year: int
    month: int
    total: int
    pending: int
    processed: int
    cancelled: int
    requires_recalculation: int
    requires_regularization: int
    generated_amount: Decimal
    by_type: dict[str, int]

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: int):
        if value < 1 or value > 12:
            raise ValueError("El mes debe estar entre 1 y 12")
        return value
