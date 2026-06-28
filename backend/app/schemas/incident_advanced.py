from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class IncidentRuleCreate(BaseModel):
    code: str
    name: str
    incident_type: str
    process_type: str | None = None
    agreement_id: int | None = None
    valid_from: date
    valid_to: date | None = None
    priority: int = 100
    configuration: dict[str, Any] = Field(default_factory=dict)
    legal_reference: str | None = None
    actor: str | None = None


class IncidentRuleUpdate(BaseModel):
    name: str | None = None
    incident_type: str | None = None
    process_type: str | None = None
    agreement_id: int | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    priority: int | None = None
    configuration: dict[str, Any] | None = None
    legal_reference: str | None = None
    is_active: bool | None = None
    actor: str | None = None


class IncidentRuleResponse(BaseModel):
    id: int
    code: str
    name: str
    incident_type: str
    process_type: str | None = None
    agreement_id: int | None = None
    valid_from: date
    valid_to: date | None = None
    priority: int
    configuration: dict[str, Any]
    legal_reference: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VacationAdjustmentCreate(BaseModel):
    year: int
    amount: Decimal
    unit: str = "natural_days"
    description: str
    actor: str | None = None


class VacationLedgerEntryResponse(BaseModel):
    id: int
    contract_id: int
    entry_type: str
    unit: str
    amount: Decimal
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None
    source_incident_id: int | None = None
    is_automatic: bool


class VacationBalanceResponse(BaseModel):
    employee_id: int
    year: int
    contracts: list[VacationLedgerEntryResponse]
    accrued: Decimal
    taken: Decimal
    adjustments: Decimal
    balance: Decimal


class IncidentRegularizationResponse(BaseModel):
    id: int
    incident_id: int
    source_payroll_id: int
    target_payroll_id: int | None = None
    target_period_month: int
    target_period_year: int
    status: str
    gross_difference: Decimal
    contribution_difference: Decimal
    taxable_difference: Decimal
    source_key: str
    calculation_trace: dict[str, Any]
    created_by: str | None = None
    created_at: datetime
    processed_at: datetime | None = None

    class Config:
        from_attributes = True
