from pydantic import BaseModel, field_validator
from datetime import date, datetime
from typing import Optional
from decimal import Decimal


class ContractBase(BaseModel):
    employee_id: int
    company_id: Optional[int] = None
    contract_type: str
    start_date: date
    end_date: Optional[date] = None
    status: Optional[str] = "active"
    salary_base: Optional[Decimal] = None
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


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    company_id: Optional[int] = None
    contract_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    salary_base: Optional[Decimal] = None
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


class ContractResponse(BaseModel):
    id: int
    employee_id: int
    company_id: Optional[int] = None
    employee_name: Optional[str] = None
    company_name: Optional[str] = None
    contract_type: str
    start_date: date
    end_date: Optional[date]
    status: str
    salary_base: Optional[Decimal]
    pay_schedule: str
    created_at: datetime

    class Config:
        from_attributes = True
