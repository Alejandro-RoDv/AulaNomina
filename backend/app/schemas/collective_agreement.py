from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


class CollectiveAgreementBase(BaseModel):
    name: str
    agreement_code: Optional[str] = None
    sector: Optional[str] = None
    territorial_scope: Optional[str] = None
    functional_scope: Optional[str] = None
    personal_scope: Optional[str] = None
    publication_date: Optional[date] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    status: str = "draft"
    source_url: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        if not value or not value.strip():
            raise ValueError("El nombre del convenio no puede estar vacío")
        return value.strip()

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        allowed_values = {"draft", "active", "expired", "extended", "archived"}
        if value not in allowed_values:
            raise ValueError("status debe ser 'draft', 'active', 'expired', 'extended' o 'archived'")
        return value

    @model_validator(mode="after")
    def validate_dates(self):
        if self.effective_from and self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("effective_to no puede ser anterior a effective_from")
        return self


class CollectiveAgreementCreate(CollectiveAgreementBase):
    pass


class CollectiveAgreementUpdate(BaseModel):
    name: Optional[str] = None
    agreement_code: Optional[str] = None
    sector: Optional[str] = None
    territorial_scope: Optional[str] = None
    functional_scope: Optional[str] = None
    personal_scope: Optional[str] = None
    publication_date: Optional[date] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    status: Optional[str] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        if value is None:
            return value
        if not value.strip():
            raise ValueError("El nombre del convenio no puede estar vacío")
        return value.strip()

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is None:
            return value
        allowed_values = {"draft", "active", "expired", "extended", "archived"}
        if value not in allowed_values:
            raise ValueError("status debe ser 'draft', 'active', 'expired', 'extended' o 'archived'")
        return value


class ProfessionalGroupBase(BaseModel):
    code: Optional[str] = None
    name: str
    description: Optional[str] = None
    display_order: int = 1

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        if not value or not value.strip():
            raise ValueError("El nombre del grupo profesional no puede estar vacío")
        return value.strip()


class ProfessionalGroupCreate(ProfessionalGroupBase):
    pass


class ProfessionalGroupUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None


class ProfessionalGroupResponse(ProfessionalGroupBase):
    id: int
    collective_agreement_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProfessionalCategoryBase(BaseModel):
    professional_group_id: Optional[int] = None
    code: Optional[str] = None
    name: str
    subgroup: Optional[str] = None
    level: Optional[str] = None
    functional_description: Optional[str] = None
    required_qualification: Optional[str] = None
    notes: Optional[str] = None
    display_order: int = 1

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        if not value or not value.strip():
            raise ValueError("El nombre de la categoría profesional no puede estar vacío")
        return value.strip()


class ProfessionalCategoryCreate(ProfessionalCategoryBase):
    pass


class ProfessionalCategoryUpdate(BaseModel):
    professional_group_id: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    subgroup: Optional[str] = None
    level: Optional[str] = None
    functional_description: Optional[str] = None
    required_qualification: Optional[str] = None
    notes: Optional[str] = None
    display_order: Optional[int] = None


class ProfessionalCategoryResponse(ProfessionalCategoryBase):
    id: int
    collective_agreement_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SalaryTableBase(BaseModel):
    name: str
    year: Optional[int] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    number_of_payments: int = 14
    amount_type: str = "monthly"
    status: str = "active"
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        if not value or not value.strip():
            raise ValueError("El nombre de la tabla salarial no puede estar vacío")
        return value.strip()

    @field_validator("amount_type")
    @classmethod
    def validate_amount_type(cls, value: str):
        allowed_values = {"monthly", "annual", "daily", "hourly"}
        if value not in allowed_values:
            raise ValueError("amount_type debe ser 'monthly', 'annual', 'daily' o 'hourly'")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        allowed_values = {"draft", "active", "historical", "pending_review"}
        if value not in allowed_values:
            raise ValueError("status debe ser 'draft', 'active', 'historical' o 'pending_review'")
        return value


class SalaryTableCreate(SalaryTableBase):
    pass


class SalaryTableUpdate(BaseModel):
    name: Optional[str] = None
    year: Optional[int] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    number_of_payments: Optional[int] = None
    amount_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class SalaryTableResponse(SalaryTableBase):
    id: int
    collective_agreement_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SalaryTableRowBase(BaseModel):
    professional_category_id: Optional[int] = None
    professional_group_id: Optional[int] = None
    category_name: Optional[str] = None
    group_name: Optional[str] = None
    level: Optional[str] = None
    base_salary: Optional[Decimal] = None
    seniority_amount: Optional[Decimal] = None
    specific_complement: Optional[Decimal] = None
    agreement_plus: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    amount_unit: str = "monthly"
    notes: Optional[str] = None

    @field_validator("amount_unit")
    @classmethod
    def validate_amount_unit(cls, value: str):
        allowed_values = {"monthly", "annual", "daily", "hourly"}
        if value not in allowed_values:
            raise ValueError("amount_unit debe ser 'monthly', 'annual', 'daily' o 'hourly'")
        return value


class SalaryTableRowCreate(SalaryTableRowBase):
    pass


class SalaryTableRowUpdate(BaseModel):
    professional_category_id: Optional[int] = None
    professional_group_id: Optional[int] = None
    category_name: Optional[str] = None
    group_name: Optional[str] = None
    level: Optional[str] = None
    base_salary: Optional[Decimal] = None
    seniority_amount: Optional[Decimal] = None
    specific_complement: Optional[Decimal] = None
    agreement_plus: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    amount_unit: Optional[str] = None
    notes: Optional[str] = None


class SalaryTableRowResponse(SalaryTableRowBase):
    id: int
    salary_table_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SalaryTableDetailResponse(SalaryTableResponse):
    rows: list[SalaryTableRowResponse] = []


class AgreementComplementBase(BaseModel):
    professional_category_id: Optional[int] = None
    name: str
    complement_type: Optional[str] = None
    amount: Optional[Decimal] = None
    percentage: Optional[Decimal] = None
    periodicity: Optional[str] = None
    number_of_payments: Optional[int] = None
    contribution_treatment: Optional[str] = None
    tax_treatment: Optional[str] = None
    application_conditions: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        if not value or not value.strip():
            raise ValueError("El nombre del complemento no puede estar vacío")
        return value.strip()


class AgreementComplementCreate(AgreementComplementBase):
    pass


class AgreementComplementUpdate(BaseModel):
    professional_category_id: Optional[int] = None
    name: Optional[str] = None
    complement_type: Optional[str] = None
    amount: Optional[Decimal] = None
    percentage: Optional[Decimal] = None
    periodicity: Optional[str] = None
    number_of_payments: Optional[int] = None
    contribution_treatment: Optional[str] = None
    tax_treatment: Optional[str] = None
    application_conditions: Optional[str] = None
    notes: Optional[str] = None


class AgreementComplementResponse(AgreementComplementBase):
    id: int
    collective_agreement_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class WorkTimeRuleBase(BaseModel):
    professional_group_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    name: str
    annual_hours: Optional[Decimal] = None
    weekly_hours: Optional[Decimal] = None
    daily_max_hours: Optional[Decimal] = None
    distribution_type: Optional[str] = None
    rest_between_shifts_hours: Optional[Decimal] = None
    weekly_rest: Optional[str] = None
    special_periods: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        if not value or not value.strip():
            raise ValueError("El nombre de la regla de jornada no puede estar vacío")
        return value.strip()


class WorkTimeRuleCreate(WorkTimeRuleBase):
    pass


class WorkTimeRuleUpdate(BaseModel):
    professional_group_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    name: Optional[str] = None
    annual_hours: Optional[Decimal] = None
    weekly_hours: Optional[Decimal] = None
    daily_max_hours: Optional[Decimal] = None
    distribution_type: Optional[str] = None
    rest_between_shifts_hours: Optional[Decimal] = None
    weekly_rest: Optional[str] = None
    special_periods: Optional[str] = None
    notes: Optional[str] = None


class WorkTimeRuleResponse(WorkTimeRuleBase):
    id: int
    collective_agreement_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class VacationRuleBase(BaseModel):
    professional_group_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    name: str
    natural_days: Optional[int] = None
    working_days: Optional[int] = None
    preferred_period: Optional[str] = None
    accrual_period: Optional[str] = None
    proportional_rule: Optional[str] = None
    it_overlap_rule: Optional[str] = None
    termination_compensation_rule: Optional[str] = None
    notes: Optional[str] = None


class VacationRuleCreate(VacationRuleBase):
    pass


class VacationRuleUpdate(BaseModel):
    professional_group_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    name: Optional[str] = None
    natural_days: Optional[int] = None
    working_days: Optional[int] = None
    preferred_period: Optional[str] = None
    accrual_period: Optional[str] = None
    proportional_rule: Optional[str] = None
    it_overlap_rule: Optional[str] = None
    termination_compensation_rule: Optional[str] = None
    notes: Optional[str] = None


class VacationRuleResponse(VacationRuleBase):
    id: int
    collective_agreement_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class LeaveRuleBase(BaseModel):
    professional_group_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    name: str
    leave_type: str
    cause: Optional[str] = None
    duration: Optional[Decimal] = None
    duration_unit: Optional[str] = None
    paid: bool = True
    requires_notice: bool = False
    requires_justification: bool = True
    displacement_extension: Optional[str] = None
    salary_treatment: Optional[str] = None
    notes: Optional[str] = None


class LeaveRuleCreate(LeaveRuleBase):
    pass


class LeaveRuleUpdate(BaseModel):
    professional_group_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    name: Optional[str] = None
    leave_type: Optional[str] = None
    cause: Optional[str] = None
    duration: Optional[Decimal] = None
    duration_unit: Optional[str] = None
    paid: Optional[bool] = None
    requires_notice: Optional[bool] = None
    requires_justification: Optional[bool] = None
    displacement_extension: Optional[str] = None
    salary_treatment: Optional[str] = None
    notes: Optional[str] = None


class LeaveRuleResponse(LeaveRuleBase):
    id: int
    collective_agreement_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CollectiveAgreementResponse(CollectiveAgreementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CollectiveAgreementDetailResponse(CollectiveAgreementResponse):
    professional_groups: list[ProfessionalGroupResponse] = []
    professional_categories: list[ProfessionalCategoryResponse] = []
    salary_tables: list[SalaryTableDetailResponse] = []
    complements: list[AgreementComplementResponse] = []
    work_time_rules: list[WorkTimeRuleResponse] = []
    vacation_rules: list[VacationRuleResponse] = []
    leave_rules: list[LeaveRuleResponse] = []
