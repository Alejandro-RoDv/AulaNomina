from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


PAYMENT_STATUSES = {"pending", "withheld", "paid", "cancelled"}


class WageGarnishmentMovementBase(BaseModel):
    payroll_id: int | None = None
    period_year: int = Field(ge=2000, le=2100)
    period_month: int = Field(ge=1, le=12)
    payroll_date: date | None = None
    monthly_net: Decimal = Field(ge=0)
    smi_annual: Decimal = Field(gt=0)
    calculated_amount: Decimal | None = Field(default=None, ge=0)
    withheld_amount: Decimal = Field(ge=0)
    paid_date: date | None = None
    payment_status: str = "pending"
    notes: str | None = None

    @field_validator("payment_status")
    @classmethod
    def validate_payment_status(cls, value: str):
        if value not in PAYMENT_STATUSES:
            raise ValueError("Estado de pago no válido")
        return value


class WageGarnishmentMovementCreate(WageGarnishmentMovementBase):
    pass


class WageGarnishmentMovementUpdate(BaseModel):
    payroll_id: int | None = None
    payroll_date: date | None = None
    monthly_net: Decimal | None = Field(default=None, ge=0)
    smi_annual: Decimal | None = Field(default=None, gt=0)
    calculated_amount: Decimal | None = Field(default=None, ge=0)
    withheld_amount: Decimal | None = Field(default=None, ge=0)
    paid_date: date | None = None
    payment_status: str | None = None
    notes: str | None = None

    @field_validator("payment_status")
    @classmethod
    def validate_payment_status(cls, value: str | None):
        if value is not None and value not in PAYMENT_STATUSES:
            raise ValueError("Estado de pago no válido")
        return value


class WageGarnishmentMovementResponse(WageGarnishmentMovementBase):
    id: int
    wage_garnishment_id: int
    calculated_amount: Decimal
    balance_after: Decimal | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
