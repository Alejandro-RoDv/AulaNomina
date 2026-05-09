from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


class PayrollBase(BaseModel):
    employee_id: int
    contract_id: int
    company_id: Optional[int] = None
    center_id: Optional[int] = None
    period_month: int
    period_year: int
    salary_supplements: Decimal = Decimal("0.00")
    irpf_percentage: Decimal = Decimal("10.00")
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
        allowed_status = {
            "draft",
            "pending",
            "calculated",
            "reviewed",
            "closed",
        }
        if value not in allowed_status:
            raise ValueError("Estado de nómina no válido")
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
    center_id: Optional[int] = None
    period_month: Optional[int] = None
    period_year: Optional[int] = None
    salary_supplements: Optional[Decimal] = None
    irpf_percentage: Optional[Decimal] = None
    status: Optional[str] = None


class PayrollPrepareRequest(BaseModel):
    company_ids: list[int]
    center_id: Optional[int] = None
    period_month: int
    period_year: int
    status: str = "pending"

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
    already_existing: bool = False


class PayrollPrepareResponse(BaseModel):
    period_month: int
    period_year: int
    created_count: int
    existing_count: int
    skipped_count: int
    payrolls: list[PayrollPrepareResponseItem]


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
