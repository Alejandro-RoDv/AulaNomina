from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


class PayrollBase(BaseModel):
    employee_id: int
    contract_id: int
    company_id: Optional[int] = None
    period_month: int
    period_year: int
    salary_supplements: Decimal = Decimal("0.00")
    irpf_percentage: Decimal = Decimal("10.00")
    status: str = "draft"

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
        allowed_status = {"draft", "calculated", "closed"}
        if value not in allowed_status:
            raise ValueError("status debe ser 'draft', 'calculated' o 'closed'")
        return value

    @field_validator("salary_supplements", "irpf_percentage")
    @classmethod
    def validate_non_negative_amounts(cls, value):
        if value is not None and value < 0:
            raise ValueError("Los importes y porcentajes no pueden ser negativos")
        return value


class PayrollCreate(PayrollBase):
    pass


class PayrollUpdate(BaseModel):
    period_month: Optional[int] = None
    period_year: Optional[int] = None
    salary_supplements: Optional[Decimal] = None
    irpf_percentage: Optional[Decimal] = None
    status: Optional[str] = None

    @field_validator("period_month")
    @classmethod
    def validate_period_month(cls, value):
        if value is not None and (value < 1 or value > 15):
            raise ValueError("period_month debe estar entre 1 y 15")
        return value

    @field_validator("period_year")
    @classmethod
    def validate_period_year(cls, value):
        if value is not None and (value < 2000 or value > 2100):
            raise ValueError("period_year debe estar entre 2000 y 2100")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is None:
            return value
        allowed_status = {"draft", "calculated", "closed"}
        if value not in allowed_status:
            raise ValueError("status debe ser 'draft', 'calculated' o 'closed'")
        return value

    @field_validator("salary_supplements", "irpf_percentage")
    @classmethod
    def validate_non_negative_amounts(cls, value):
        if value is not None and value < 0:
            raise ValueError("Los importes y porcentajes no pueden ser negativos")
        return value


class PayrollResponse(BaseModel):
    id: int
    employee_id: int
    contract_id: int
    company_id: int
    employee_name: Optional[str] = None
    company_name: Optional[str] = None
    period_month: int
    period_year: int
    period_label: Optional[str] = None
    base_salary: Decimal
    salary_supplements: Decimal
    extra_pay_proration: Decimal
    gross_salary: Decimal
    employee_social_security: Decimal
    irpf: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
