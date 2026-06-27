from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


ALLOWED_STATUSES = {"active", "suspended", "completed", "cancelled"}


class WageGarnishmentBase(BaseModel):
    employee_id: int
    contract_id: int | None = None
    company_id: int
    reference: str = Field(min_length=1, max_length=120)
    issuing_body: str = Field(min_length=1, max_length=200)
    creditor: str | None = Field(default=None, max_length=200)
    status: str = "active"
    notification_date: date | None = None
    start_date: date
    end_date: date | None = None
    total_debt: Decimal | None = Field(default=None, ge=0)
    withheld_to_date: Decimal = Field(default=Decimal("0"), ge=0)
    monthly_net: Decimal = Field(ge=0)
    smi_annual: Decimal = Field(gt=0)
    reduction_percentage: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    extra_pay_prorated: bool = False
    includes_full_extra_pay: bool = False
    extra_pay_amount: Decimal = Field(default=Decimal("0"), ge=0)
    family_burdens: bool = False
    monthly_garnishable: Decimal = Field(ge=0)
    calculation_snapshot: dict[str, Any]
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        if value not in ALLOWED_STATUSES:
            raise ValueError("Estado de embargo no válido")
        return value

    @model_validator(mode="after")
    def validate_dates_and_options(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("La fecha fin no puede ser anterior a la fecha de inicio")
        if self.extra_pay_prorated and self.includes_full_extra_pay:
            raise ValueError("No se pueden combinar pagas prorrateadas y paga extra completa")
        if self.includes_full_extra_pay and self.extra_pay_amount <= 0:
            raise ValueError("El importe de la paga extra debe ser superior a cero")
        if self.total_debt is not None and self.withheld_to_date > self.total_debt:
            raise ValueError("Lo retenido no puede superar la deuda total")
        return self


class WageGarnishmentCreate(WageGarnishmentBase):
    pass


class WageGarnishmentUpdate(BaseModel):
    employee_id: int | None = None
    contract_id: int | None = None
    company_id: int | None = None
    reference: str | None = Field(default=None, min_length=1, max_length=120)
    issuing_body: str | None = Field(default=None, min_length=1, max_length=200)
    creditor: str | None = Field(default=None, max_length=200)
    status: str | None = None
    notification_date: date | None = None
    start_date: date | None = None
    end_date: date | None = None
    total_debt: Decimal | None = Field(default=None, ge=0)
    withheld_to_date: Decimal | None = Field(default=None, ge=0)
    monthly_net: Decimal | None = Field(default=None, ge=0)
    smi_annual: Decimal | None = Field(default=None, gt=0)
    reduction_percentage: Decimal | None = Field(default=None, ge=0, le=100)
    extra_pay_prorated: bool | None = None
    includes_full_extra_pay: bool | None = None
    extra_pay_amount: Decimal | None = Field(default=None, ge=0)
    family_burdens: bool | None = None
    monthly_garnishable: Decimal | None = Field(default=None, ge=0)
    calculation_snapshot: dict[str, Any] | None = None
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None):
        if value is not None and value not in ALLOWED_STATUSES:
            raise ValueError("Estado de embargo no válido")
        return value


class WageGarnishmentResponse(WageGarnishmentBase):
    id: int
    employee_name: str | None = None
    company_name: str | None = None
    contract_type: str | None = None
    remaining_debt: Decimal | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
