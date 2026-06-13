from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ContractExtraPayIncidentBreakdown(BaseModel):
    incident_id: Optional[int] = None
    incident_type: str
    label: str
    start_date: date
    end_date: date
    overlapping_days: int
    deducted_days: int
    deducted: bool


class ContractExtraPayPreviewLine(BaseModel):
    concept_line_id: int
    concept_key: str
    concept_name: str
    calculation_mode: str
    percentage: Optional[Decimal] = None
    fixed_amount: Optional[Decimal] = None
    table_base_amount: Decimal = Decimal("0.00")
    contract_base_amount: Decimal = Decimal("0.00")
    base_source: str
    full_time_amount: Decimal = Decimal("0.00")
    after_partiality_amount: Decimal = Decimal("0.00")
    final_amount: Decimal = Decimal("0.00")
    warning: Optional[str] = None


class ContractExtraPayPreviewResponse(BaseModel):
    extra_pay_id: int
    extra_pay_name: str
    payroll_period: int
    period_year: int
    contract_id: int
    contract_code: Optional[str] = None
    employee_id: int
    employee_name: Optional[str] = None
    company_id: Optional[int] = None
    salary_table_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    accrual_start_date: date
    accrual_end_date: date
    total_period_days: int
    contract_overlap_days: int
    excluded_it_days: int
    excluded_unpaid_absence_days: int
    excluded_inactivity_days: int
    excluded_total_days: int
    accrued_days: int
    accrual_ratio: Decimal
    partiality_percentage: Decimal
    partiality_ratio: Decimal
    theoretical_full_time_amount: Decimal
    contract_full_period_amount: Decimal
    final_amount: Decimal
    proration_monthly_amount: Decimal
    already_generated_payroll_id: Optional[int] = None
    can_generate: bool
    generation_block_reason: Optional[str] = None
    incident_breakdown: list[ContractExtraPayIncidentBreakdown] = Field(default_factory=list)
    lines: list[ContractExtraPayPreviewLine] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ContractExtraPayPayrollCreateRequest(BaseModel):
    period_year: int = Field(ge=1900, le=2200)
    irpf_percentage: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("100.00"))
    status: Literal["draft", "pending"] = "pending"


class ContractExtraPayPayrollCreateResponse(BaseModel):
    payroll_id: int
    contract_id: int
    employee_id: int
    extra_pay_id: int
    period_month: int
    period_year: int
    status: str
    gross_salary: Decimal
    irpf_percentage: Decimal
    irpf: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    created_items: int
    warnings: list[str] = Field(default_factory=list)
