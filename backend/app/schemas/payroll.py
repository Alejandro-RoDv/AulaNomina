from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


PAYROLL_STATUS_VALUES = {
    "draft",
    "pending",
    "calculated",
    "reviewed",
    "closed",
    "cancelled",
}

IRPF_MODE_VALUES = {"auto", "manual", "voluntary"}


class PayrollBase(BaseModel):
    employee_id: int
    contract_id: int
    company_id: Optional[int] = None
    center_id: Optional[int] = None
    period_month: int
    period_year: int
    salary_supplements: Decimal = Decimal("0.00")
    variable_incentives: Decimal = Decimal("0.00")
    irpf_percentage: Optional[Decimal] = None
    irpf_mode: str = "auto"
    status: str = "pending"

    @field_validator("period_month")
    @classmethod
    def validate_period_month(cls, value):
        if value < 1 or value > 15:
            raise ValueError("period_month debe estar entre 1 y 15")
        return value

    @field_validator("period_year")
    @classmethod
    def validate_period_year(cls, value):
        if value < 2000 or value > 2100:
            raise ValueError("period_year debe estar entre 2000 y 2100")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value not in PAYROLL_STATUS_VALUES:
            raise ValueError("Estado de nómina no válido")
        return value

    @field_validator("irpf_mode")
    @classmethod
    def validate_irpf_mode(cls, value):
        if value not in IRPF_MODE_VALUES:
            raise ValueError("Modo IRPF no válido")
        return value

    @field_validator("salary_supplements", "variable_incentives", "irpf_percentage")
    @classmethod
    def validate_non_negative_amounts(cls, value):
        if value is not None and value < 0:
            raise ValueError("Los importes y porcentajes no pueden ser negativos")
        return value


class PayrollCreate(PayrollBase):
    pass


class PayrollUpdate(BaseModel):
    center_id: Optional[int] = None
    period_month: Optional[int] = None
    period_year: Optional[int] = None
    salary_supplements: Optional[Decimal] = None
    variable_incentives: Optional[Decimal] = None
    irpf_percentage: Optional[Decimal] = None
    irpf_mode: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is None:
            return value
        if value not in PAYROLL_STATUS_VALUES:
            raise ValueError("Estado de nómina no válido")
        return value

    @field_validator("irpf_mode")
    @classmethod
    def validate_irpf_mode(cls, value):
        if value is None:
            return value
        if value not in IRPF_MODE_VALUES:
            raise ValueError("Modo IRPF no válido")
        return value

    @field_validator("salary_supplements", "variable_incentives", "irpf_percentage")
    @classmethod
    def validate_non_negative_amounts(cls, value):
        if value is not None and value < 0:
            raise ValueError("Los importes y porcentajes no pueden ser negativos")
        return value


class PayrollPrepareRequest(BaseModel):
    company_ids: list[int]
    center_id: Optional[int] = None
    period_month: int
    period_year: int
    status: str = "pending"
    irpf_mode: str = "auto"

    @field_validator("company_ids")
    @classmethod
    def validate_company_ids(cls, value):
        if not value:
            raise ValueError("Debes seleccionar al menos una empresa")
        return value

    @field_validator("period_month")
    @classmethod
    def validate_period_month(cls, value):
        if value < 1 or value > 15:
            raise ValueError("period_month debe estar entre 1 y 15")
        return value

    @field_validator("period_year")
    @classmethod
    def validate_period_year(cls, value):
        if value < 2000 or value > 2100:
            raise ValueError("period_year debe estar entre 2000 y 2100")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        allowed_status = {"pending", "calculated", "reviewed", "closed"}
        if value not in allowed_status:
            raise ValueError("Estado de nómina no válido")
        return value

    @field_validator("irpf_mode")
    @classmethod
    def validate_irpf_mode(cls, value):
        if value not in IRPF_MODE_VALUES:
            raise ValueError("Modo IRPF no válido")
        return value


class PayrollPrepareResponseItem(BaseModel):
    payroll_id: Optional[int] = None
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: str
    contract_id: int
    contract_code: Optional[str] = None
    company_id: int
    company_name: Optional[str] = None
    center_id: Optional[int] = None
    center_name: Optional[str] = None
    incident_summary: list[str] = []
    status: str
    gross_salary: Decimal
    seniority_amount: Decimal = Decimal("0.00")
    extra_pay_proration: Decimal = Decimal("0.00")
    contribution_days: int = 30
    incident_days: int = 0
    has_payroll_affecting_incidents: bool = False
    irpf_mode: str = "auto"
    irpf_percentage: Decimal = Decimal("0.00")
    suggested_irpf_percentage: Decimal = Decimal("0.00")
    already_existing: bool = False


class PayrollSkippedItem(BaseModel):
    employee_id: Optional[int] = None
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    contract_id: Optional[int] = None
    contract_code: Optional[str] = None
    reason: str


class PayrollPrepareResponse(BaseModel):
    period_month: int
    period_year: int
    created_count: int
    existing_count: int
    skipped_count: int
    payrolls: list[PayrollPrepareResponseItem]
    skipped: list[PayrollSkippedItem] = []


class PayrollFutureIncentive(BaseModel):
    period_month: int
    period_year: int
    amount: Decimal = Decimal("0.00")
    description: str = "Variable futura"


class PayrollFutureSimulationRequest(BaseModel):
    employee_id: int
    contract_id: int
    periods: list[int]
    period_year: int
    incentives: list[PayrollFutureIncentive] = []
    salary_increase: Decimal = Decimal("0.00")
    irpf_mode: str = "auto"


class PayrollFutureSimulationItem(BaseModel):
    period_month: int
    period_year: int
    base_salary: Decimal
    worked_base_salary: Decimal = Decimal("0.00")
    temporary_disability_benefit: Decimal = Decimal("0.00")
    company_disability_complement: Decimal = Decimal("0.00")
    salary_supplements: Decimal
    seniority_amount: Decimal = Decimal("0.00")
    seniority_lines: list[dict] = []
    seniority_warnings: list[str] = []
    variable_incentives: Decimal
    extra_pay_proration: Decimal = Decimal("0.00")
    extra_pay_proration_source: Optional[str] = None
    extra_pay_proration_lines: list[dict] = []
    extra_pay_proration_warnings: list[str] = []
    gross_salary: Decimal
    contribution_days: int = 30
    worked_days: int = 30
    incident_days: int = 0
    it_days: int = 0
    non_contribution_days: int = 0
    common_contingencies_base: Decimal = Decimal("0.00")
    professional_contingencies_base: Decimal = Decimal("0.00")
    unemployment_training_fogasa_base: Decimal = Decimal("0.00")
    irpf_base: Decimal = Decimal("0.00")
    daily_common_base: Decimal = Decimal("0.00")
    daily_professional_base: Decimal = Decimal("0.00")
    employee_common_contingencies: Decimal = Decimal("0.00")
    employee_unemployment: Decimal = Decimal("0.00")
    employee_training: Decimal = Decimal("0.00")
    employee_mei: Decimal = Decimal("0.00")
    employee_social_security: Decimal
    irpf_percentage: Decimal
    suggested_irpf_percentage: Decimal
    irpf: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    company_common_contingencies: Decimal = Decimal("0.00")
    company_unemployment: Decimal = Decimal("0.00")
    company_fogasa: Decimal = Decimal("0.00")
    company_training: Decimal = Decimal("0.00")
    company_at_ep: Decimal = Decimal("0.00")
    company_mei: Decimal = Decimal("0.00")
    company_total_social_security: Decimal = Decimal("0.00")
    company_total_cost: Decimal = Decimal("0.00")


class PayrollFutureSimulationResponse(BaseModel):
    employee_id: int
    contract_id: int
    items: list[PayrollFutureSimulationItem]


class PayrollResponse(BaseModel):
    id: int
    employee_id: int
    contract_id: int
    company_id: int
    center_id: Optional[int] = None
    employee_name: Optional[str] = None
    company_name: Optional[str] = None
    period_month: int
    period_year: int
    period_label: Optional[str] = None
    base_salary: Decimal
    worked_base_salary: Decimal = Decimal("0.00")
    temporary_disability_benefit: Decimal = Decimal("0.00")
    company_disability_complement: Decimal = Decimal("0.00")
    salary_supplements: Decimal
    seniority_amount: Decimal = Decimal("0.00")
    variable_incentives: Decimal = Decimal("0.00")
    extra_pay_proration: Decimal
    gross_salary: Decimal
    contribution_days: int = 30
    worked_days: int = 30
    incident_days: int = 0
    it_days: int = 0
    non_contribution_days: int = 0
    common_contingencies_base: Decimal = Decimal("0.00")
    professional_contingencies_base: Decimal = Decimal("0.00")
    unemployment_training_fogasa_base: Decimal = Decimal("0.00")
    irpf_base: Decimal = Decimal("0.00")
    daily_common_base: Decimal = Decimal("0.00")
    daily_professional_base: Decimal = Decimal("0.00")
    employee_common_contingencies: Decimal = Decimal("0.00")
    employee_unemployment: Decimal = Decimal("0.00")
    employee_training: Decimal = Decimal("0.00")
    employee_mei: Decimal = Decimal("0.00")
    employee_social_security: Decimal
    irpf_mode: str = "auto"
    irpf_percentage: Decimal = Decimal("0.00")
    suggested_irpf_percentage: Decimal = Decimal("0.00")
    irpf: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    company_common_contingencies: Decimal = Decimal("0.00")
    company_unemployment: Decimal = Decimal("0.00")
    company_fogasa: Decimal = Decimal("0.00")
    company_training: Decimal = Decimal("0.00")
    company_at_ep: Decimal = Decimal("0.00")
    company_mei: Decimal = Decimal("0.00")
    company_total_social_security: Decimal = Decimal("0.00")
    company_total_cost: Decimal = Decimal("0.00")
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
