from pydantic import BaseModel, field_validator, model_validator
from datetime import date, datetime
from typing import Optional
from decimal import Decimal

from app.schemas.social_security_registration import SocialSecurityRegistrationResponse


class ContractBase(BaseModel):
    employee_id: int
    company_id: Optional[int] = None
    center_id: Optional[int] = None

    contract_type: str
    contract_code: Optional[str] = None
    contract_code_description: Optional[str] = None
    contract_family: Optional[str] = None

    start_date: date
    end_date: Optional[date] = None
    status: Optional[str] = "active"

    contribution_group: Optional[str] = None
    professional_category: Optional[str] = None
    job_position: Optional[str] = None
    collective_agreement_code: Optional[str] = None
    collective_agreement_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    salary_table_row_id: Optional[int] = None

    working_day_type: Optional[str] = None
    weekly_hours: Optional[float] = None
    full_time_weekly_hours: Optional[float] = 40
    annual_agreement_hours: Optional[float] = None
    monthly_hours: Optional[float] = None
    annual_hours: Optional[float] = None
    partiality_coefficient: Optional[float] = None

    monthly_or_daily_contribution: Optional[str] = None
    red_occupation_code: Optional[str] = None
    red_reduction_code: Optional[str] = None

    salary_base: Optional[Decimal] = None
    gross_annual_salary: Optional[Decimal] = None
    pay_schedule: str = "not_prorated_14"

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        allowed_status = {"active", "ended", "deleted"}
        if value not in allowed_status:
            raise ValueError("status debe ser 'active', 'ended' o 'deleted'")
        return value

    @field_validator("contract_type")
    @classmethod
    def validate_contract_type(cls, value):
        if not value or not value.strip():
            raise ValueError("contract_type no puede estar vacío")
        return value.strip()

    @field_validator("pay_schedule")
    @classmethod
    def validate_pay_schedule(cls, value):
        allowed_values = {"prorated_12", "not_prorated_14"}
        if value not in allowed_values:
            raise ValueError("pay_schedule debe ser 'prorated_12' o 'not_prorated_14'")
        return value

    @field_validator("working_day_type")
    @classmethod
    def validate_working_day_type(cls, value):
        if value is None or value == "":
            return None
        allowed_values = {"full_time", "part_time", "fixed_discontinuous"}
        if value not in allowed_values:
            raise ValueError("working_day_type debe ser 'full_time', 'part_time' o 'fixed_discontinuous'")
        return value

    @field_validator("monthly_or_daily_contribution")
    @classmethod
    def validate_monthly_or_daily_contribution(cls, value):
        if value is None or value == "":
            return None
        allowed_values = {"monthly", "daily"}
        if value not in allowed_values:
            raise ValueError("monthly_or_daily_contribution debe ser 'monthly' o 'daily'")
        return value

    @model_validator(mode="after")
    def validate_working_day_consistency(self):
        if self.full_time_weekly_hours is not None and self.full_time_weekly_hours <= 0:
            raise ValueError("full_time_weekly_hours debe ser mayor que 0")

        if self.weekly_hours is not None and self.weekly_hours < 0:
            raise ValueError("weekly_hours no puede ser negativa")

        for field_name in ("annual_agreement_hours", "monthly_hours", "annual_hours"):
            value = getattr(self, field_name)
            if value is not None and value < 0:
                raise ValueError(f"{field_name} no puede ser negativo")

        if self.partiality_coefficient is not None and not 0 <= self.partiality_coefficient <= 100:
            raise ValueError("partiality_coefficient debe estar entre 0 y 100")

        if self.working_day_type == "full_time" and self.partiality_coefficient not in (None, 100):
            raise ValueError("En jornada completa el coeficiente de parcialidad debe ser 100")

        if self.working_day_type == "part_time" and self.weekly_hours and self.full_time_weekly_hours:
            calculated = round((self.weekly_hours / self.full_time_weekly_hours) * 100, 2)
            if self.partiality_coefficient is None:
                self.partiality_coefficient = calculated

        return self


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    company_id: Optional[int] = None
    center_id: Optional[int] = None

    contract_type: Optional[str] = None
    contract_code: Optional[str] = None
    contract_code_description: Optional[str] = None
    contract_family: Optional[str] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

    contribution_group: Optional[str] = None
    professional_category: Optional[str] = None
    job_position: Optional[str] = None
    collective_agreement_code: Optional[str] = None
    collective_agreement_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    salary_table_row_id: Optional[int] = None

    working_day_type: Optional[str] = None
    weekly_hours: Optional[float] = None
    full_time_weekly_hours: Optional[float] = None
    annual_agreement_hours: Optional[float] = None
    monthly_hours: Optional[float] = None
    annual_hours: Optional[float] = None
    partiality_coefficient: Optional[float] = None

    monthly_or_daily_contribution: Optional[str] = None
    red_occupation_code: Optional[str] = None
    red_reduction_code: Optional[str] = None

    salary_base: Optional[Decimal] = None
    gross_annual_salary: Optional[Decimal] = None
    pay_schedule: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is None:
            return value
        allowed_status = {"active", "ended", "deleted"}
        if value not in allowed_status:
            raise ValueError("status debe ser 'active', 'ended' o 'deleted'")
        return value

    @field_validator("pay_schedule")
    @classmethod
    def validate_pay_schedule(cls, value):
        if value is None:
            return value
        allowed_values = {"prorated_12", "not_prorated_14"}
        if value not in allowed_values:
            raise ValueError("pay_schedule debe ser 'prorated_12' o 'not_prorated_14'")
        return value

    @field_validator("working_day_type")
    @classmethod
    def validate_working_day_type(cls, value):
        if value is None or value == "":
            return None
        allowed_values = {"full_time", "part_time", "fixed_discontinuous"}
        if value not in allowed_values:
            raise ValueError("working_day_type debe ser 'full_time', 'part_time' o 'fixed_discontinuous'")
        return value

    @field_validator("monthly_or_daily_contribution")
    @classmethod
    def validate_monthly_or_daily_contribution(cls, value):
        if value is None or value == "":
            return None
        allowed_values = {"monthly", "daily"}
        if value not in allowed_values:
            raise ValueError("monthly_or_daily_contribution debe ser 'monthly' o 'daily'")
        return value


class ContractResponse(BaseModel):
    id: int
    employee_id: int
    company_id: Optional[int] = None
    center_id: Optional[int] = None
    employee_name: Optional[str] = None
    company_name: Optional[str] = None

    contract_type: str
    contract_code: Optional[str] = None
    contract_code_description: Optional[str] = None
    contract_family: Optional[str] = None

    start_date: date
    end_date: Optional[date]
    status: str

    contribution_group: Optional[str] = None
    professional_category: Optional[str] = None
    job_position: Optional[str] = None
    collective_agreement_code: Optional[str] = None
    collective_agreement_id: Optional[int] = None
    collective_agreement_name: Optional[str] = None
    professional_category_id: Optional[int] = None
    salary_table_row_id: Optional[int] = None

    working_day_type: Optional[str] = None
    weekly_hours: Optional[float] = None
    full_time_weekly_hours: Optional[float] = None
    annual_agreement_hours: Optional[float] = None
    monthly_hours: Optional[float] = None
    annual_hours: Optional[float] = None
    partiality_coefficient: Optional[float] = None

    monthly_or_daily_contribution: Optional[str] = None
    red_occupation_code: Optional[str] = None
    red_reduction_code: Optional[str] = None

    salary_base: Optional[Decimal]
    gross_annual_salary: Optional[Decimal] = None
    pay_schedule: str
    created_at: datetime
    ss_registration: Optional[SocialSecurityRegistrationResponse] = None

    class Config:
        from_attributes = True


class ContractSalaryConceptLine(BaseModel):
    id: int
    concept_id: int
    concept_name: Optional[str] = None
    concept_code: Optional[str] = None
    concept_type: Optional[str] = None
    salary_nature: Optional[str] = None
    original_amount: Decimal = Decimal("0.00")
    applied_amount: Decimal = Decimal("0.00")
    applies_workday_percentage: bool = True


class ContractSalarySummaryResponse(BaseModel):
    contract_id: int
    employee_name: Optional[str] = None
    working_day_type: Optional[str] = None
    weekly_hours: Decimal = Decimal("0.00")
    monthly_hours: Decimal = Decimal("0.00")
    annual_hours: Decimal = Decimal("0.00")
    annual_agreement_hours: Decimal = Decimal("0.00")
    full_time_weekly_hours: Decimal = Decimal("40.00")
    partiality_coefficient: Decimal = Decimal("100.00")
    salary_base_theoretical: Decimal = Decimal("0.00")
    salary_base_applied: Decimal = Decimal("0.00")
    permanent_concepts_original: Decimal = Decimal("0.00")
    permanent_concepts_applied: Decimal = Decimal("0.00")
    monthly_remuneration: Decimal = Decimal("0.00")
    annual_remuneration: Decimal = Decimal("0.00")
    estimated_company_social_security: Decimal = Decimal("0.00")
    estimated_company_cost: Decimal = Decimal("0.00")
    concept_lines: list[ContractSalaryConceptLine] = []


class ContractWorkdaySimulationRequest(BaseModel):
    target_weekly_hours: Optional[float] = None
    target_partiality_coefficient: Optional[float] = None
    target_full_time_weekly_hours: Optional[float] = None


class ContractWorkdaySimulationResponse(BaseModel):
    contract_id: int
    before: ContractSalarySummaryResponse
    after: ContractSalarySummaryResponse
    annual_difference: Decimal = Decimal("0.00")
    monthly_difference: Decimal = Decimal("0.00")
