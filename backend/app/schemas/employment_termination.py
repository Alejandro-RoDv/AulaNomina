from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


TERMINATION_REASON_CODES = {
    "voluntary_resignation",
    "temporary_expiry",
    "disciplinary_dismissal",
    "objective_dismissal",
    "unfair_dismissal",
    "other",
}


class EmploymentTerminationInput(BaseModel):
    reason_code: str
    effective_date: date
    communication_date: Optional[date] = None
    document_reference: Optional[str] = None
    annual_salary_reference: Optional[Decimal] = None
    monthly_salary_reference: Optional[Decimal] = None
    pending_salary_days: Decimal = Decimal("0.00")
    unused_vacation_days: Decimal = Decimal("0.00")
    extra_pay_amount: Decimal = Decimal("0.00")
    other_amount: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    created_by: str = "usuario-demo"

    @field_validator("reason_code")
    @classmethod
    def validate_reason_code(cls, value):
        normalized = str(value or "").strip().lower()
        if normalized not in TERMINATION_REASON_CODES:
            raise ValueError("reason_code no es una causa de extinción soportada")
        return normalized

    @field_validator(
        "annual_salary_reference",
        "monthly_salary_reference",
        "pending_salary_days",
        "unused_vacation_days",
        "extra_pay_amount",
        "other_amount",
    )
    @classmethod
    def validate_non_negative(cls, value):
        if value is not None and Decimal(str(value)) < 0:
            raise ValueError("Los importes y días de liquidación no pueden ser negativos")
        return value

    @model_validator(mode="after")
    def validate_communication_date(self):
        if self.communication_date and self.communication_date > self.effective_date:
            raise ValueError("communication_date no puede ser posterior a effective_date")
        return self


class EmploymentTerminationPreviewRequest(EmploymentTerminationInput):
    contract_id: int


class EmploymentTerminationCreate(EmploymentTerminationInput):
    contract_id: int


class EmploymentTerminationUpdate(BaseModel):
    reason_code: Optional[str] = None
    effective_date: Optional[date] = None
    communication_date: Optional[date] = None
    document_reference: Optional[str] = None
    annual_salary_reference: Optional[Decimal] = None
    monthly_salary_reference: Optional[Decimal] = None
    pending_salary_days: Optional[Decimal] = None
    unused_vacation_days: Optional[Decimal] = None
    extra_pay_amount: Optional[Decimal] = None
    other_amount: Optional[Decimal] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None

    @field_validator("reason_code")
    @classmethod
    def validate_reason_code(cls, value):
        if value is None:
            return None
        normalized = str(value or "").strip().lower()
        if normalized not in TERMINATION_REASON_CODES:
            raise ValueError("reason_code no es una causa de extinción soportada")
        return normalized

    @field_validator(
        "annual_salary_reference",
        "monthly_salary_reference",
        "pending_salary_days",
        "unused_vacation_days",
        "extra_pay_amount",
        "other_amount",
    )
    @classmethod
    def validate_non_negative(cls, value):
        if value is not None and Decimal(str(value)) < 0:
            raise ValueError("Los importes y días de liquidación no pueden ser negativos")
        return value


class EmploymentTerminationPreviewResponse(BaseModel):
    contract_id: int
    employee_id: int
    employee_name: Optional[str] = None
    company_id: int
    center_id: Optional[int] = None
    reason_code: str
    ss_situation_code: str
    effective_date: date
    communication_date: Optional[date] = None
    document_reference: Optional[str] = None
    annual_salary_reference: Decimal
    monthly_salary_reference: Decimal
    indemnity_daily_salary: Decimal
    service_months: int
    indemnity_days_per_year: Decimal
    indemnity_days: Decimal
    indemnity_amount: Decimal
    pending_salary_days: Decimal
    pending_salary_amount: Decimal
    unused_vacation_days: Decimal
    vacation_amount: Decimal
    extra_pay_amount: Decimal
    other_amount: Decimal
    total_settlement: Decimal
    legal_reference: str
    warnings: list[str] = []
    calculation_trace: dict = {}


class EmploymentTerminationResponse(EmploymentTerminationPreviewResponse):
    id: int
    contract_code: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
