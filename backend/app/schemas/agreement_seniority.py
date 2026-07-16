from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


CALCULATION_MODES = {"fixed_amount", "percentage", "table_amount"}
PERCENTAGE_BASES = {"salary_base", "salary_base_plus_agreement", "salary_table_total"}


class AgreementSeniorityRuleBase(BaseModel):
    salary_table_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    code: str = "ANT"
    name: str = "Antigüedad"
    module_years: int = Field(default=3, ge=1, le=50)
    calculation_mode: str = "fixed_amount"
    fixed_amount: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    percentage: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("100.00"))
    percentage_base: str = "salary_base"
    max_modules: Optional[int] = Field(default=None, ge=1, le=100)
    applies_partiality: bool = True
    daily_proration_on_maturity: bool = True
    contributes: bool = True
    taxable: bool = True
    affects_extra_payments: bool = True
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_active: bool = True
    display_order: int = 10
    notes: Optional[str] = None

    @field_validator("calculation_mode")
    @classmethod
    def validate_calculation_mode(cls, value: str):
        if value not in CALCULATION_MODES:
            raise ValueError("Forma de cálculo de antigüedad no válida")
        return value

    @field_validator("percentage_base")
    @classmethod
    def validate_percentage_base(cls, value: str):
        if value not in PERCENTAGE_BASES:
            raise ValueError("Base porcentual de antigüedad no válida")
        return value

    @model_validator(mode="after")
    def validate_amounts_and_dates(self):
        if self.calculation_mode == "fixed_amount" and self.fixed_amount is None:
            raise ValueError("Indica el importe fijo por módulo")
        if self.calculation_mode == "percentage" and self.percentage is None:
            raise ValueError("Indica el porcentaje por módulo")
        if self.effective_from and self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("La fecha final no puede ser anterior a la fecha inicial")
        return self


class AgreementSeniorityRuleCreate(AgreementSeniorityRuleBase):
    pass


class AgreementSeniorityRuleUpdate(BaseModel):
    salary_table_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    module_years: Optional[int] = Field(default=None, ge=1, le=50)
    calculation_mode: Optional[str] = None
    fixed_amount: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    percentage: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("100.00"))
    percentage_base: Optional[str] = None
    max_modules: Optional[int] = Field(default=None, ge=1, le=100)
    applies_partiality: Optional[bool] = None
    daily_proration_on_maturity: Optional[bool] = None
    contributes: Optional[bool] = None
    taxable: Optional[bool] = None
    affects_extra_payments: Optional[bool] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("calculation_mode")
    @classmethod
    def validate_calculation_mode(cls, value: Optional[str]):
        if value is not None and value not in CALCULATION_MODES:
            raise ValueError("Forma de cálculo de antigüedad no válida")
        return value

    @field_validator("percentage_base")
    @classmethod
    def validate_percentage_base(cls, value: Optional[str]):
        if value is not None and value not in PERCENTAGE_BASES:
            raise ValueError("Base porcentual de antigüedad no válida")
        return value


class AgreementSeniorityRuleResponse(AgreementSeniorityRuleBase):
    id: int
    collective_agreement_id: int
    salary_table_name: Optional[str] = None
    professional_category_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SeniorityMaturityResponse(BaseModel):
    module_number: int
    maturity_date: date
    amount: Decimal
    status: str


class ContractSeniorityPreviewResponse(BaseModel):
    contract_id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    contract_code: Optional[str] = None
    seniority_date: date
    seniority_date_source: str
    as_of_date: date
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    module_years: Optional[int] = None
    completed_modules: int = 0
    max_modules: Optional[int] = None
    amount_per_module: Decimal = Decimal("0.00")
    monthly_amount: Decimal = Decimal("0.00")
    next_maturity_date: Optional[date] = None
    capped: bool = False
    eligibility: str
    reason: Optional[str] = None
    maturities: list[SeniorityMaturityResponse] = []
    warnings: list[str] = []


class AgreementSeniorityPreviewResponse(BaseModel):
    collective_agreement_id: int
    as_of_date: date
    total_contracts: int
    eligible_contracts: int
    blocked_contracts: int
    total_monthly_amount: Decimal = Decimal("0.00")
    contracts: list[ContractSeniorityPreviewResponse] = []
