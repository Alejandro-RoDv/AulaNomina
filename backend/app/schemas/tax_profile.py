from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class TaxProfileBase(BaseModel):
    birth_year: int | None = Field(default=None, ge=1906, le=2026)
    autonomous_community: str = "andalucia"
    family_situation: str = "situation_3"
    spouse_nif: str | None = None
    employment_situation: str = "active"
    contract_category: str = "general"

    children_count: int = Field(default=0, ge=0)
    descendants: list[dict[str, Any]] = Field(default_factory=list)
    ascendants_in_care: int = Field(default=0, ge=0)
    ascendants: list[dict[str, Any]] = Field(default_factory=list)

    employee_disability: bool = False
    disability_degree: str = "none"
    reduced_mobility: bool = False
    descendants_disability: bool = False

    geographic_mobility: bool = False
    ceuta_melilla_residence: bool = False
    ceuta_melilla_income: bool = False
    home_loan: bool = False

    compensatory_pension: float = Field(default=0, ge=0)
    child_support_annuity: float = Field(default=0, ge=0)
    irregular_income_18_2: float = Field(default=0, ge=0, le=90000)
    irregular_income_18_3: float = Field(default=0, ge=0)
    social_security_contributions: float = Field(default=0, ge=0)

    contract_type: str | None = None
    contract_start_date: date | None = None
    expected_annual_salary: float = Field(default=0, ge=0)
    manual_regularization: bool = False
    voluntary_irpf: float | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class TaxProfileCreate(TaxProfileBase):
    employee_id: int


class TaxProfileUpdate(TaxProfileBase):
    pass


class TaxProfileResponse(TaxProfileBase):
    id: int
    employee_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IrpfCalculationInput(TaxProfileBase):
    pass


class IrpfCalculationResponse(BaseModel):
    suggested_irpf: float
    annual_withholding: float
    cuota: float
    base: float
    minimum_personal_family: float
    net_work_income: float
    reduced_net_work_income: float
    deductible_expenses: float
    reduction_work_income: float
    exempt: bool
    applied_minimum_limit: bool
    details: dict[str, Any]
