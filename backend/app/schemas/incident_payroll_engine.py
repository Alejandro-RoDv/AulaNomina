from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator


class IncidentPayrollProcessRequest(BaseModel):
    actor: str | None = None
    expected_version: int | None = None

    @field_validator("expected_version")
    @classmethod
    def validate_expected_version(cls, value):
        if value is not None and value < 0:
            raise ValueError("expected_version no puede ser negativo")
        return value


class ContributionBaseOverridesRequest(BaseModel):
    common_contingencies_base_override: Decimal | None = None
    professional_contingencies_base_override: Decimal | None = None
    unemployment_training_fogasa_base_override: Decimal | None = None
    actor: str | None = None
    expected_version: int | None = None

    @field_validator(
        "common_contingencies_base_override",
        "professional_contingencies_base_override",
        "unemployment_training_fogasa_base_override",
    )
    @classmethod
    def validate_non_negative_override(cls, value):
        if value is not None and value < 0:
            raise ValueError("Las bases forzadas no pueden ser negativas")
        return value

    @field_validator("expected_version")
    @classmethod
    def validate_override_expected_version(cls, value):
        if value is not None and value < 0:
            raise ValueError("expected_version no puede ser negativo")
        return value


class PayrollComponentAdjustmentResponse(BaseModel):
    field: str
    original_amount: Decimal
    factor: Decimal
    adjusted_amount: Decimal
    reduction_amount: Decimal


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
    calculation_version: int
    calculation_fingerprint: str | None = None
    segments: int
    created_items: int
    updated_items: int
    deleted_items: int
    changed_incidents: int = 0
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
    component_adjustments: list[PayrollComponentAdjustmentResponse] = Field(default_factory=list)
    adjusted_components: dict[str, Decimal] = Field(default_factory=dict)
    contribution_base_resolution: dict[str, Any] = Field(default_factory=dict)


class IncidentPayrollPreviewResponse(BaseModel):
    payroll_id: int
    calculation_version: int = 0
    period_start: date
    period_end: date
    segments: list[dict[str, Any]]
    warnings: list[str]
    component_factors: dict[str, Decimal] = Field(default_factory=dict)
    component_adjustments: list[PayrollComponentAdjustmentResponse] = Field(default_factory=list)
    adjusted_components: dict[str, Decimal] = Field(default_factory=dict)
    contribution_base_resolution: dict[str, Any] = Field(default_factory=dict)
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
