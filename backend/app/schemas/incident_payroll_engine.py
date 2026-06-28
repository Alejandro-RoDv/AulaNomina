from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class IncidentPayrollProcessRequest(BaseModel):
    actor: str | None = None


class PayrollSegmentResponse(BaseModel):
    id: int
    payroll_id: int
    incident_id: int | None = None
    rule_id: int | None = None
    segment_key: str
    segment_type: str
    start_date: date
    end_date: date
    calendar_days: int
    payroll_days: Decimal
    process_day_from: int | None = None
    process_day_to: int | None = None
    salary_percentage: Decimal
    benefit_percentage: Decimal
    complement_percentage: Decimal
    contribution_treatment: str
    daily_salary_base: Decimal
    daily_regulatory_base: Decimal
    salary_amount: Decimal
    benefit_amount: Decimal
    complement_amount: Decimal
    deduction_amount: Decimal
    calculation_trace: dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class IncidentPayrollProcessResponse(BaseModel):
    payroll_id: int
    segments: int
    created_items: int
    updated_items: int
    deleted_items: int
    worked_base_salary: Decimal
    temporary_disability_benefit: Decimal
    company_disability_complement: Decimal
    salary_deductions: Decimal
    overtime_amount: Decimal
    worked_days: int
    incident_days: int
    it_days: int
    contribution_days: int
    warnings: list[str] = Field(default_factory=list)


class IncidentPayrollPreviewResponse(BaseModel):
    payroll_id: int
    period_start: date
    period_end: date
    segments: list[dict[str, Any]]
    warnings: list[str]
    worked_base_salary: Decimal
    temporary_disability_benefit: Decimal
    company_disability_complement: Decimal
    salary_deductions: Decimal
    overtime_amount: Decimal
    worked_days: int
    incident_days: int
    it_days: int
    non_contribution_days: int
    contribution_days: int
