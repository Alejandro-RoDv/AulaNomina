from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.services.communication_file_workflow import normalize_ccc


class SocialSecuritySettlementStatus(str, Enum):
    DRAFT = "DRAFT"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    READY = "READY"
    CONFIRMED = "CONFIRMED"
    GENERATED = "GENERATED"
    CANCELLED = "CANCELLED"


class SocialSecuritySettlementPrepareRequest(BaseModel):
    company_id: int
    ccc_id: str = Field(min_length=6, max_length=32)
    period_year: int = Field(ge=2000, le=2100)
    period_month: int = Field(ge=1, le=12)
    created_by: int | None = None

    @field_validator("ccc_id")
    @classmethod
    def normalize_ccc_id(cls, value: str) -> str:
        normalized = normalize_ccc(value)
        if not normalized:
            raise ValueError("El CCC es obligatorio")
        return normalized


class SocialSecuritySettlementActionRequest(BaseModel):
    created_by: int | None = None


class SocialSecuritySettlementLineResponse(BaseModel):
    id: int
    payroll_id: int
    employee_id: int
    contract_id: int
    center_id: int | None
    employee_code: str | None
    employee_name: str
    document: str | None
    naf: str | None
    contribution_group: str | None
    payroll_status: str
    contribution_days: int

    common_contingencies_base: Decimal
    professional_contingencies_base: Decimal
    unemployment_training_fogasa_base: Decimal
    overtime_base: Decimal

    employee_common_contingencies: Decimal
    employee_unemployment: Decimal
    employee_training: Decimal
    employee_mei: Decimal
    employee_total: Decimal

    company_common_contingencies: Decimal
    company_unemployment: Decimal
    company_fogasa: Decimal
    company_training: Decimal
    company_at_ep: Decimal
    company_mei: Decimal
    company_total: Decimal

    bonuses: Decimal
    reductions: Decimal
    total_due: Decimal
    validation_errors: list[dict[str, Any]]


class SocialSecuritySettlementResponse(BaseModel):
    id: int
    company_id: int
    ccc_id: str
    period_year: int
    period_month: int
    status: SocialSecuritySettlementStatus

    worker_count: int
    contribution_days: int
    common_contingencies_base: Decimal
    professional_contingencies_base: Decimal
    unemployment_training_fogasa_base: Decimal
    overtime_base: Decimal

    employee_common_contingencies: Decimal
    employee_unemployment: Decimal
    employee_training: Decimal
    employee_mei: Decimal
    employee_total: Decimal

    company_common_contingencies: Decimal
    company_unemployment: Decimal
    company_fogasa: Decimal
    company_training: Decimal
    company_at_ep: Decimal
    company_mei: Decimal
    company_total: Decimal

    bonuses: Decimal
    reductions: Decimal
    total_due: Decimal
    validation_errors: list[dict[str, Any]]
    communication_file_id: int | None
    prepared_at: datetime
    confirmed_at: datetime | None
    generated_at: datetime | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    lines: list[SocialSecuritySettlementLineResponse] = Field(default_factory=list)


class CompanyCccOptionResponse(BaseModel):
    ccc_id: str
    source: str
    source_id: int
    label: str
