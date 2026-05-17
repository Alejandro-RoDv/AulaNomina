from datetime import date, datetime

from pydantic import BaseModel, Field


class TaxProfileBase(BaseModel):
    family_situation: str = "general"
    children_count: int = Field(default=0, ge=0)
    employee_disability: bool = False
    descendants_disability: bool = False
    ascendants_in_care: int = Field(default=0, ge=0)
    geographic_mobility: bool = False
    compensatory_pension: float = Field(default=0, ge=0)
    child_support_annuity: float = Field(default=0, ge=0)
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
