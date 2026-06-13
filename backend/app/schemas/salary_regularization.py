from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class SalaryRegularizationPreviewRequest(BaseModel):
    source_table_id: int
    period_from: date
    period_to: date
    contract_ids: list[int] = Field(default_factory=list)
    include_base_salary: bool = True
    include_salary_concepts: bool = True
    include_extra_pay_proration: bool = True
    include_non_salary: bool = False
    positive_only: bool = True

    @model_validator(mode="after")
    def validate_period(self):
        if self.period_to < self.period_from:
            raise ValueError("La fecha final no puede ser anterior a la fecha inicial")
        if self.period_from.year != self.period_to.year:
            raise ValueError("La regularización debe calcularse dentro de un mismo ejercicio")
        return self


class SalaryRegularizationGenerateRequest(SalaryRegularizationPreviewRequest):
    status: str = "pending"
    irpf_mode: str = "auto"
    irpf_percentage: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("100.00"))

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        if value not in {"draft", "pending", "calculated", "reviewed"}:
            raise ValueError("Estado de nómina complementaria no válido")
        return value

    @field_validator("irpf_mode")
    @classmethod
    def validate_irpf_mode(cls, value: str):
        if value not in {"auto", "manual", "voluntary"}:
            raise ValueError("Modo IRPF no válido")
        return value


class SalaryRegularizationLineResponse(BaseModel):
    payroll_id: int
    source_period_month: int
    source_period_year: int
    concept_key: str
    concept_name: str
    line_type: str
    source_amount: Decimal = Decimal("0.00")
    target_amount: Decimal = Decimal("0.00")
    theoretical_difference: Decimal = Decimal("0.00")
    partiality_ratio: Decimal = Decimal("1.0000")
    remuneration_ratio: Decimal = Decimal("1.0000")
    amount: Decimal = Decimal("0.00")
    contributes: bool = True
    taxable: bool = True


class SalaryRegularizationContractResponse(BaseModel):
    contract_id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    contract_code: Optional[str] = None
    professional_category_id: Optional[int] = None
    professional_category_name: Optional[str] = None
    source_salary_table_row_id: Optional[int] = None
    target_salary_table_row_id: Optional[int] = None
    payroll_count: int = 0
    total_difference: Decimal = Decimal("0.00")
    contributory_difference: Decimal = Decimal("0.00")
    taxable_difference: Decimal = Decimal("0.00")
    eligibility: str
    reason: Optional[str] = None
    lines: list[SalaryRegularizationLineResponse] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class SalaryRegularizationPreviewResponse(BaseModel):
    source_table_id: int
    source_table_name: str
    target_table_id: int
    target_table_name: str
    period_from: date
    period_to: date
    exercise: int
    total_contracts: int = 0
    eligible_contracts: int = 0
    blocked_contracts: int = 0
    payrolls_reviewed: int = 0
    total_difference: Decimal = Decimal("0.00")
    contributory_difference: Decimal = Decimal("0.00")
    taxable_difference: Decimal = Decimal("0.00")
    contracts: list[SalaryRegularizationContractResponse] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class SalaryRegularizationGeneratedItem(BaseModel):
    contract_id: int
    employee_id: int
    payroll_id: int
    period_year: int
    gross_salary: Decimal
    employee_social_security: Decimal
    irpf_percentage: Decimal
    irpf: Decimal
    net_salary: Decimal
    created_items: int


class SalaryRegularizationSkippedItem(BaseModel):
    contract_id: Optional[int] = None
    employee_id: Optional[int] = None
    reason: str


class SalaryRegularizationGenerateResponse(BaseModel):
    target_table_id: int
    exercise: int
    selected_contracts: int
    generated_payrolls: int
    skipped_contracts: int
    total_gross: Decimal = Decimal("0.00")
    generated: list[SalaryRegularizationGeneratedItem] = Field(default_factory=list)
    skipped: list[SalaryRegularizationSkippedItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
