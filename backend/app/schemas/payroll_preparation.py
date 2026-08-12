from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PayrollPreparationEnsureRequest(BaseModel):
    employee_id: int
    contract_id: int
    period_month: int
    period_year: int

    @field_validator("period_month")
    @classmethod
    def validate_period_month(cls, value: int):
        if value < 1 or value > 15:
            raise ValueError("period_month debe estar entre 1 y 15")
        return value

    @field_validator("period_year")
    @classmethod
    def validate_period_year(cls, value: int):
        if value < 2000 or value > 2100:
            raise ValueError("period_year debe estar entre 2000 y 2100")
        return value


class PayrollPreparationLine(BaseModel):
    id: int
    concept_id: int
    code: str
    name: str
    description: Optional[str] = None
    amount: Decimal
    quantity: Decimal = Decimal("1.00")
    unit_price: Decimal = Decimal("0.00")
    concept_type: str
    salary_nature: str
    category: str
    source_type: str
    is_automatic: bool = False
    is_taxable: bool = True
    is_contribution_base: bool = True
    affects_gross: bool = True
    affects_net: bool = True
    display_order: int = 0


class PayrollPreparationPreview(BaseModel):
    payroll_id: int
    gross_salary: Decimal
    contribution_base: Decimal
    professional_base: Decimal
    irpf_base: Decimal
    employee_social_security: Decimal
    irpf: Decimal
    manual_deductions: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    company_total_social_security: Decimal
    company_total_cost: Decimal


class PayrollPreparationResponse(BaseModel):
    payroll_id: int
    status: str
    generated: bool
    employee_id: int
    employee_name: str
    employee_code: Optional[str] = None
    contract_id: int
    contract_code: Optional[str] = None
    company_id: int
    company_name: Optional[str] = None
    center_id: Optional[int] = None
    center_name: Optional[str] = None
    period_month: int
    period_year: int
    lines: list[PayrollPreparationLine] = Field(default_factory=list)
    preview: PayrollPreparationPreview


class PayrollPreparationStatusItem(BaseModel):
    payroll_id: int
    contract_id: int
    employee_id: int
    company_id: int
    status: str
    generated: bool


class PayrollGenerationRequest(BaseModel):
    period_month: int
    period_year: int
    company_ids: list[int] = Field(default_factory=list)
    employee_ids: list[int] = Field(default_factory=list)
    contract_ids: list[int] = Field(default_factory=list)
    center_id: Optional[int] = None

    @field_validator("period_month")
    @classmethod
    def validate_period_month(cls, value: int):
        if value < 1 or value > 19:
            raise ValueError("period_month debe estar entre 1 y 19")
        return value

    @field_validator("period_year")
    @classmethod
    def validate_period_year(cls, value: int):
        if value < 2000 or value > 2100:
            raise ValueError("period_year debe estar entre 2000 y 2100")
        return value


class PayrollGenerationItem(BaseModel):
    payroll_id: Optional[int] = None
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    contract_id: Optional[int] = None
    contract_code: Optional[str] = None
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    status: str
    source: str
    message: Optional[str] = None


class PayrollGenerationResponse(BaseModel):
    period_month: int
    period_year: int
    generated_count: int
    existing_count: int
    skipped_count: int
    items: list[PayrollGenerationItem] = Field(default_factory=list)
