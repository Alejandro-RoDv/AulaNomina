from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AgreementExtraPayConceptBase(BaseModel):
    professional_category_id: Optional[int] = None
    concept_key: str
    concept_name: str
    calculation_mode: Literal["percentage", "fixed"] = "percentage"
    percentage: Optional[Decimal] = Field(default=Decimal("100.00"), ge=Decimal("0.00"), le=Decimal("1000.00"))
    fixed_amount: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    is_active: bool = True
    display_order: int = Field(default=10, ge=0)
    notes: Optional[str] = None

    @field_validator("concept_key", "concept_name")
    @classmethod
    def validate_required_text(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("El concepto debe tener clave y denominación")
        return value

    @model_validator(mode="after")
    def validate_calculation(self):
        if self.calculation_mode == "percentage" and self.percentage is None:
            raise ValueError("Indica el porcentaje computable")
        if self.calculation_mode == "fixed" and self.fixed_amount is None:
            raise ValueError("Indica el importe fijo computable")
        return self


class AgreementExtraPayConceptCreate(AgreementExtraPayConceptBase):
    pass


class AgreementExtraPayConceptUpdate(BaseModel):
    professional_category_id: Optional[int] = None
    concept_key: Optional[str] = None
    concept_name: Optional[str] = None
    calculation_mode: Optional[Literal["percentage", "fixed"]] = None
    percentage: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"), le=Decimal("1000.00"))
    fixed_amount: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    is_active: Optional[bool] = None
    display_order: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


class AgreementExtraPayConceptResponse(AgreementExtraPayConceptBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    extra_pay_id: int


class AgreementExtraPayBase(BaseModel):
    salary_table_id: Optional[int] = None
    code: Optional[str] = None
    name: str
    payment_month: int = Field(ge=1, le=12)
    accrual_start_month: int = Field(ge=1, le=12)
    accrual_end_month: int = Field(ge=1, le=12)
    accrual_months: int = Field(default=6, ge=1, le=12)
    proration_allowed: bool = True
    proration_default: bool = False
    is_active: bool = True
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("La paga extraordinaria debe tener nombre")
        return value

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: Optional[str]):
        return value.strip().upper() if value and value.strip() else None

    @model_validator(mode="after")
    def validate_proration(self):
        if self.proration_default and not self.proration_allowed:
            raise ValueError("No puede marcarse prorrateo por defecto cuando no está permitido")
        return self


class AgreementExtraPayCreate(AgreementExtraPayBase):
    concept_lines: list[AgreementExtraPayConceptCreate] = Field(default_factory=list)


class AgreementExtraPayUpdate(BaseModel):
    salary_table_id: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    payment_month: Optional[int] = Field(default=None, ge=1, le=12)
    accrual_start_month: Optional[int] = Field(default=None, ge=1, le=12)
    accrual_end_month: Optional[int] = Field(default=None, ge=1, le=12)
    accrual_months: Optional[int] = Field(default=None, ge=1, le=12)
    proration_allowed: Optional[bool] = None
    proration_default: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class AgreementExtraPayResponse(AgreementExtraPayBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collective_agreement_id: int
    concept_lines: list[AgreementExtraPayConceptResponse] = Field(default_factory=list)


class AgreementExtraPayCandidate(BaseModel):
    concept_key: str
    name: str
    amount: Decimal = Decimal("0.00")
    character: str = "salarial"
    source: str
    salary_table_id: Optional[int] = None
    professional_category_id: Optional[int] = None


class AgreementExtraPayPreviewLine(BaseModel):
    concept_line_id: int
    concept_key: str
    concept_name: str
    professional_category_id: Optional[int] = None
    base_amount: Decimal = Decimal("0.00")
    calculation_mode: str
    percentage: Optional[Decimal] = None
    fixed_amount: Optional[Decimal] = None
    computed_amount: Decimal = Decimal("0.00")
    resolved: bool = True
    warning: Optional[str] = None


class AgreementExtraPayPreviewResponse(BaseModel):
    extra_pay_id: int
    extra_pay_name: str
    salary_table_id: Optional[int] = None
    professional_category_id: Optional[int] = None
    payment_month: int
    accrual_start_month: int
    accrual_end_month: int
    accrual_months: int
    proration_allowed: bool
    proration_default: bool
    total_amount: Decimal = Decimal("0.00")
    monthly_proration_amount: Decimal = Decimal("0.00")
    included_lines: int = 0
    unresolved_lines: int = 0
    lines: list[AgreementExtraPayPreviewLine] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
