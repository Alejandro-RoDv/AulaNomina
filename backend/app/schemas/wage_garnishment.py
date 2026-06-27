from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


ALLOWED_STATUSES = {"draft", "active", "suspended", "completed", "cancelled"}


class WageGarnishmentBase(BaseModel):
    employee_id: int
    contract_id: int | None = None
    company_id: int
    reference: str = Field(min_length=1, max_length=120)
    issuing_body: str = Field(min_length=1, max_length=200)
    creditor: str | None = Field(default=None, max_length=200)
    status: str = "draft"
    priority: int = Field(default=1, ge=1)
    notification_date: date | None = None
    start_date: date
    end_date: date | None = None
    total_debt: Decimal | None = Field(default=None, ge=0)
    withheld_to_date: Decimal = Field(default=Decimal("0"), ge=0)
    monthly_net: Decimal = Field(ge=0)
    smi_annual: Decimal = Field(gt=0)
    reduction_percentage: Decimal = Field(default=Decimal("0"), ge=0, le=15)
    reduction_authorized: bool = False
    reduction_authorization_date: date | None = None
    reduction_authorization_reference: str | None = Field(default=None, max_length=180)
    extra_pay_prorated: bool = False
    includes_full_extra_pay: bool = False
    extra_pay_amount: Decimal = Field(default=Decimal("0"), ge=0)
    family_burdens: bool = False
    monthly_garnishable: Decimal | None = Field(default=None, ge=0)
    calculation_snapshot: dict[str, Any] | None = None
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
        if self.reduction_percentage > 0 and not self.reduction_authorized:
            raise ValueError("La reducción debe estar autorizada por el órgano ejecutante")
        if self.reduction_authorized and self.reduction_percentage not in {Decimal("10"), Decimal("15")}:
            raise ValueError("La reducción autorizada debe ser del 10 % o del 15 %")
        if self.reduction_authorized and not self.reduction_authorization_reference:
            raise ValueError("Debe informarse la referencia de la resolución que autoriza la reducción")
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
    priority: int | None = Field(default=None, ge=1)
    notification_date: date | None = None
    start_date: date | None = None
    end_date: date | None = None
    total_debt: Decimal | None = Field(default=None, ge=0)
    withheld_to_date: Decimal | None = Field(default=None, ge=0)
    monthly_net: Decimal | None = Field(default=None, ge=0)
    smi_annual: Decimal | None = Field(default=None, gt=0)
    reduction_percentage: Decimal | None = Field(default=None, ge=0, le=15)
    reduction_authorized: bool | None = None
    reduction_authorization_date: date | None = None
    reduction_authorization_reference: str | None = Field(default=None, max_length=180)
    extra_pay_prorated: bool | None = None
    includes_full_extra_pay: bool | None = None
    extra_pay_amount: Decimal | None = Field(default=None, ge=0)
    family_burdens: bool | None = None
    monthly_garnishable: Decimal | None = Field(default=None, ge=0)
    calculation_snapshot: dict[str, Any] | None = None
    notes: str | None = None
    updated_by: str | None = Field(default="usuario-demo", max_length=120)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None):
        if value is not None and value not in ALLOWED_STATUSES:
            raise ValueError("Estado de embargo no válido")
        return value


class WageGarnishmentResponse(WageGarnishmentBase):
    id: int
    monthly_garnishable: Decimal
    calculation_snapshot: dict[str, Any]
    employee_name: str | None = None
    company_name: str | None = None
    contract_type: str | None = None
    remaining_debt: Decimal | None = None
    movement_count: int = 0
    document_count: int = 0
    archived: bool = False
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    deleted_reason: str | None = None
    created_by: str
    updated_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
