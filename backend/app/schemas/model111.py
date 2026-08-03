from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PROFESSIONAL_ACTIVITY_TYPES = {
    "professional",
    "agricultural",
    "livestock",
    "forestry",
    "objective_estimation",
    "other_economic_activity",
}
INVOICE_STATUSES = {"draft", "confirmed", "paid", "cancelled"}
ADJUSTMENT_CATEGORIES = {"work", "economic_activity"}
ADJUSTMENT_TYPES = {"manual", "regularization", "arrears"}
ADJUSTMENT_STATUSES = {"draft", "confirmed", "cancelled"}
PERIOD_VALUES = {"1T", "2T", "3T", "4T", *{f"{month:02d}" for month in range(1, 13)}}
PAYMENT_METHODS = {"simulated_nrc", "direct_debit", "debt_acknowledgement", "negative"}


class ProfessionalBase(BaseModel):
    company_id: int
    nif: str = Field(..., min_length=3, max_length=20)
    name: str = Field(..., min_length=1, max_length=120)
    surname: Optional[str] = Field(default=None, max_length=180)
    activity_type: str = "professional"
    withholding_rate: Decimal = Decimal("15.00")
    address: Optional[str] = Field(default=None, max_length=255)
    province_code: Optional[str] = Field(default=None, max_length=2)
    active: bool = True

    @field_validator("nif")
    @classmethod
    def normalize_nif(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("activity_type")
    @classmethod
    def validate_activity_type(cls, value: str) -> str:
        if value not in PROFESSIONAL_ACTIVITY_TYPES:
            raise ValueError("Tipo de actividad profesional no válido")
        return value

    @field_validator("withholding_rate")
    @classmethod
    def validate_rate(cls, value: Decimal) -> Decimal:
        if value < 0 or value > 100:
            raise ValueError("El porcentaje de retención debe estar entre 0 y 100")
        return value


class ProfessionalCreate(ProfessionalBase):
    pass


class ProfessionalUpdate(BaseModel):
    nif: Optional[str] = Field(default=None, min_length=3, max_length=20)
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    surname: Optional[str] = Field(default=None, max_length=180)
    activity_type: Optional[str] = None
    withholding_rate: Optional[Decimal] = None
    address: Optional[str] = Field(default=None, max_length=255)
    province_code: Optional[str] = Field(default=None, max_length=2)
    active: Optional[bool] = None

    @field_validator("nif")
    @classmethod
    def normalize_nif(cls, value: Optional[str]) -> Optional[str]:
        return value.strip().upper() if value else value

    @field_validator("activity_type")
    @classmethod
    def validate_activity_type(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in PROFESSIONAL_ACTIVITY_TYPES:
            raise ValueError("Tipo de actividad profesional no válido")
        return value

    @field_validator("withholding_rate")
    @classmethod
    def validate_rate(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is not None and (value < 0 or value > 100):
            raise ValueError("El porcentaje de retención debe estar entre 0 y 100")
        return value


class ProfessionalResponse(ProfessionalBase):
    id: int
    full_name: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfessionalInvoiceBase(BaseModel):
    professional_id: int
    company_id: int
    invoice_number: str = Field(..., min_length=1, max_length=80)
    invoice_date: date
    payment_date: Optional[date] = None
    tax_base: Decimal = Decimal("0.00")
    withholding_rate: Decimal = Decimal("15.00")
    withholding_amount: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    status: str = "draft"
    notes: Optional[str] = None

    @field_validator("invoice_number")
    @classmethod
    def normalize_number(cls, value: str) -> str:
        return value.strip()

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in INVOICE_STATUSES:
            raise ValueError("Estado de factura no válido")
        return value

    @field_validator("tax_base", "withholding_rate", "withholding_amount", "total_amount")
    @classmethod
    def validate_non_negative(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is not None and value < 0:
            raise ValueError("Los importes de la factura no pueden ser negativos")
        return value

    @field_validator("withholding_rate")
    @classmethod
    def validate_invoice_rate(cls, value: Decimal) -> Decimal:
        if value > 100:
            raise ValueError("El porcentaje de retención debe estar entre 0 y 100")
        return value

    @model_validator(mode="after")
    def validate_payment_date(self):
        if self.status == "paid" and self.payment_date is None:
            raise ValueError("Una factura pagada debe indicar la fecha de pago")
        return self


class ProfessionalInvoiceCreate(ProfessionalInvoiceBase):
    pass


class ProfessionalInvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = Field(default=None, min_length=1, max_length=80)
    invoice_date: Optional[date] = None
    payment_date: Optional[date] = None
    tax_base: Optional[Decimal] = None
    withholding_rate: Optional[Decimal] = None
    withholding_amount: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    status: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in INVOICE_STATUSES:
            raise ValueError("Estado de factura no válido")
        return value

    @field_validator("tax_base", "withholding_rate", "withholding_amount", "total_amount")
    @classmethod
    def validate_non_negative(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is not None and value < 0:
            raise ValueError("Los importes de la factura no pueden ser negativos")
        return value


class ProfessionalInvoiceResponse(BaseModel):
    id: int
    professional_id: int
    company_id: int
    professional_name: str
    professional_nif: str
    invoice_number: str
    invoice_date: date
    payment_date: Optional[date]
    fiscal_date: date
    tax_base: Decimal
    withholding_rate: Decimal
    withholding_amount: Decimal
    total_amount: Decimal
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaxWithholdingAdjustmentCreate(BaseModel):
    company_id: int
    category: str
    adjustment_type: str = "manual"
    source_date: date
    recipient_nif: str = Field(..., min_length=3, max_length=20)
    recipient_name: str = Field(..., min_length=1, max_length=255)
    base_amount: Decimal = Decimal("0.00")
    withholding_amount: Decimal = Decimal("0.00")
    status: str = "confirmed"
    notes: Optional[str] = None

    @field_validator("recipient_nif")
    @classmethod
    def normalize_nif(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        if value not in ADJUSTMENT_CATEGORIES:
            raise ValueError("Categoría de ajuste no válida")
        return value

    @field_validator("adjustment_type")
    @classmethod
    def validate_adjustment_type(cls, value: str) -> str:
        if value not in ADJUSTMENT_TYPES:
            raise ValueError("Tipo de ajuste no válido")
        return value

    @field_validator("status")
    @classmethod
    def validate_adjustment_status(cls, value: str) -> str:
        if value not in ADJUSTMENT_STATUSES:
            raise ValueError("Estado de ajuste no válido")
        return value

    @model_validator(mode="after")
    def validate_negative_amounts(self):
        if self.adjustment_type != "regularization" and (
            self.base_amount < 0 or self.withholding_amount < 0
        ):
            raise ValueError("Solo una regularización puede contener importes negativos")
        return self


class TaxWithholdingAdjustmentResponse(TaxWithholdingAdjustmentCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Model111GenerateRequest(BaseModel):
    company_id: int
    year: int = Field(..., ge=2000, le=2100)
    period: str
    declaration_type: str = "ordinary"
    original_declaration_id: Optional[int] = None

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: str) -> str:
        normalized = value.upper().strip()
        if normalized not in PERIOD_VALUES:
            raise ValueError("Periodo no válido")
        return normalized

    @field_validator("declaration_type")
    @classmethod
    def validate_declaration_type(cls, value: str) -> str:
        if value not in {"ordinary", "complementary"}:
            raise ValueError("Tipo de declaración no válido")
        return value

    @model_validator(mode="after")
    def validate_original(self):
        if self.declaration_type == "complementary" and not self.original_declaration_id:
            raise ValueError("La declaración complementaria requiere la declaración original")
        return self


class Model111PresentationRequest(BaseModel):
    payment_method: str
    nrc: Optional[str] = Field(default=None, max_length=40)

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, value: str) -> str:
        if value not in PAYMENT_METHODS:
            raise ValueError("Forma de ingreso no válida")
        return value
