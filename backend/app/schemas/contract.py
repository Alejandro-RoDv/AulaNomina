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
    seniority_date: Optional[date] = None
    seniority_criterion: Optional[str] = None
    end_date: Optional[date] = None
    termination_reason: Optional[str] = None
    status: Optional[str] = "active"

    transformation_from_contract_id: Optional[int] = None
    transformation_date: Optional[date] = None
    transformation_reason: Optional[str] = None

    bonus_type: Optional[str] = None
    bonus_start_date: Optional[date] = None
    bonus_end_date: Optional[date] = None
    bonus_fixed_fee: Optional[Decimal] = None
    bonus_observations: Optional[str] = None

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
    ordinary_hours: Optional[float] = None
    ordinary_hours_period: Optional[str] = None
    comparison_reference_type: Optional[str] = None
    comparison_hours: Optional[float] = None
    work_distribution: Optional[str] = None
    pay_accrual_mode: Optional[str] = None
    contribution_hours_mode: Optional[str] = None

    legal_workday_reduction_cause: Optional[str] = None
    legal_workday_reduction_start: Optional[date] = None
    legal_workday_reduction_end: Optional[date] = None
    legal_workday_reduction_percentage: Optional[float] = None
    inactivity_start_date: Optional[date] = None
    inactivity_return_date: Optional[date] = None
    inactivity_start_communication_date: Optional[date] = None
    inactivity_return_communication_date: Optional[date] = None

    works_holidays: bool = False
    holiday_scope: Optional[str] = None
    holiday_only_service_days: bool = False
    schedule_notes: Optional[str] = None

    health_card_number: Optional[str] = None
    subrogation: bool = False
    subrogation_company_origin: Optional[str] = None
    subrogation_date: Optional[date] = None
    recognized_seniority_date: Optional[date] = None
    affects_extra_payments: bool = False

    relation_type: Optional[str] = None
    representation_type: Optional[str] = None
    relation_subtype: Optional[str] = None
    registration_number: Optional[str] = None
    authorization_number: Optional[str] = None
    red_key: Optional[str] = None
    red_cont: Optional[str] = None
    cno_code: Optional[str] = None
    cno_description: Optional[str] = None
    company_cnae: Optional[str] = None
    occupation: Optional[str] = None
    it_rate: Optional[float] = None
    ims_rate: Optional[float] = None
    function_description: Optional[str] = None
    section: Optional[str] = None
    group_name: Optional[str] = None
    contract_registry_number: Optional[str] = None
    contract_registry_date: Optional[date] = None
    contract_registry_office: Optional[str] = None
    contract_registry_status: Optional[str] = "not_registered"

    monthly_or_daily_contribution: Optional[str] = None
    red_occupation_code: Optional[str] = None
    red_reduction_code: Optional[str] = None

    salary_base: Optional[Decimal] = None
    gross_annual_salary: Optional[Decimal] = None
    pay_schedule: str = "not_prorated_14"

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        allowed_status = {"draft", "active", "ended", "deleted", "transformed", "replaced", "cancelled"}
        if value not in allowed_status:
            raise ValueError("status debe ser draft, active, ended, deleted, transformed, replaced o cancelled")
        return value

    @field_validator("contract_registry_status")
    @classmethod
    def validate_contract_registry_status(cls, value):
        if value is None or value == "":
            return "not_registered"
        allowed_values = {"not_registered", "pending", "registered", "rejected"}
        if value not in allowed_values:
            raise ValueError("contract_registry_status debe ser not_registered, pending, registered o rejected")
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
    def validate_contract_dates(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValueError("end_date no puede ser anterior a start_date")
        if self.bonus_end_date and self.bonus_start_date and self.bonus_end_date < self.bonus_start_date:
            raise ValueError("bonus_end_date no puede ser anterior a bonus_start_date")
        if self.legal_workday_reduction_end and self.legal_workday_reduction_start and self.legal_workday_reduction_end < self.legal_workday_reduction_start:
            raise ValueError("legal_workday_reduction_end no puede ser anterior a legal_workday_reduction_start")
        return self


class ContractCreate(ContractBase):
    pass


class ContractUpdate(ContractBase):
    employee_id: Optional[int] = None
    contract_type: Optional[str] = None
    start_date: Optional[date] = None


class ContractResponse(ContractBase):
    id: int
    employee_name: Optional[str] = None
    company_name: Optional[str] = None
    collective_agreement_name: Optional[str] = None
    ss_registration: Optional[SocialSecurityRegistrationResponse] = None
    created_at: datetime

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
