from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MODEL190_DECLARATION_TYPES = {"ordinary", "complementary", "substitutive"}
MODEL190_DECLARATION_STATUSES = {"draft", "generated", "validated", "presented", "cancelled"}
MODEL190_RECIPIENT_TYPES = {"employee", "professional"}
MODEL190_SOURCE_TYPES = {"payroll", "professional_invoice", "adjustment", "arrears", "regularization"}
MODEL190_AMOUNT_TYPES = {"cash", "in_kind", "deductible_expense", "reduction"}
MODEL190_QUARTERS = {"1T", "2T", "3T", "4T"}


def _normalize_key(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip().upper()
    if len(normalized) != 1 or not normalized.isalpha():
        raise ValueError("La clave del Modelo 190 debe contener una letra")
    return normalized


def _normalize_subkey(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    normalized = value.strip().zfill(2)
    if len(normalized) != 2 or not normalized.isdigit():
        raise ValueError("La subclave del Modelo 190 debe contener dos dígitos")
    return normalized


class Tax190KeyBase(BaseModel):
    code: str
    name: str = Field(..., min_length=1, max_length=160)
    description: Optional[str] = None
    recipient_type: str
    valid_from: int = Field(..., ge=2000, le=2100)
    valid_to: Optional[int] = Field(default=None, ge=2000, le=2100)
    active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = _normalize_key(value)
        assert normalized is not None
        return normalized

    @field_validator("recipient_type")
    @classmethod
    def validate_recipient_type(cls, value: str) -> str:
        if value not in MODEL190_RECIPIENT_TYPES:
            raise ValueError("Tipo de perceptor del catálogo no válido")
        return value

    @model_validator(mode="after")
    def validate_period(self):
        if self.valid_to is not None and self.valid_to < self.valid_from:
            raise ValueError("El final de vigencia no puede ser anterior al inicio")
        return self


class Tax190KeyResponse(Tax190KeyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Tax190SubkeyBase(BaseModel):
    key_code: str
    code: str
    name: str = Field(..., min_length=1, max_length=180)
    description: Optional[str] = None
    valid_from: int = Field(..., ge=2000, le=2100)
    valid_to: Optional[int] = Field(default=None, ge=2000, le=2100)
    active: bool = True

    @field_validator("key_code")
    @classmethod
    def normalize_key_code(cls, value: str) -> str:
        normalized = _normalize_key(value)
        assert normalized is not None
        return normalized

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = _normalize_subkey(value)
        assert normalized is not None
        return normalized

    @model_validator(mode="after")
    def validate_period(self):
        if self.valid_to is not None and self.valid_to < self.valid_from:
            raise ValueError("El final de vigencia no puede ser anterior al inicio")
        return self


class Tax190SubkeyResponse(Tax190SubkeyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Model190DeclarationCreate(BaseModel):
    company_id: int
    year: int = Field(..., ge=2000, le=2100)
    declaration_type: str = "ordinary"
    original_declaration_id: Optional[int] = None

    @field_validator("declaration_type")
    @classmethod
    def validate_declaration_type(cls, value: str) -> str:
        if value not in MODEL190_DECLARATION_TYPES:
            raise ValueError("Tipo de declaración del Modelo 190 no válido")
        return value

    @model_validator(mode="after")
    def validate_original_declaration(self):
        if self.declaration_type in {"complementary", "substitutive"} and not self.original_declaration_id:
            raise ValueError("La declaración complementaria o sustitutiva requiere una declaración original")
        if self.declaration_type == "ordinary" and self.original_declaration_id is not None:
            raise ValueError("La declaración ordinaria no puede indicar una declaración original")
        return self


class Model190PresentationRequest(BaseModel):
    file_sha256: str = Field(..., min_length=64, max_length=64)
    signer_name: str = Field(..., min_length=2, max_length=160)
    certificate_alias: str = Field(
        default="Certificado AulaNomina Demo",
        min_length=2,
        max_length=160,
    )
    confirm_information: bool = False

    @field_validator("file_sha256")
    @classmethod
    def validate_file_sha256(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) != 64 or any(character not in "0123456789abcdef" for character in normalized):
            raise ValueError("La huella SHA-256 del fichero no es válida")
        return normalized

    @model_validator(mode="after")
    def validate_confirmation(self):
        if not self.confirm_information:
            raise ValueError("Debes confirmar la declaración informativa antes de firmar")
        return self


class Model190RecipientLineResponse(BaseModel):
    id: int
    model190_recipient_id: int
    source_type: str
    source_id: Optional[int]
    source_label: str
    source_date: date
    amount_type: str
    gross_amount: Decimal
    withholding_amount: Decimal
    deductible_expense_amount: Decimal
    model111_declaration_id: Optional[int]
    quarter: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class Model190RecipientResponse(BaseModel):
    id: int
    declaration_id: int
    recipient_type: str
    employee_id: Optional[int]
    professional_id: Optional[int]
    nif: str
    name: str
    surname: Optional[str]
    full_name: str
    key: str
    subkey: Optional[str]
    cash_income: Decimal
    cash_withholding: Decimal
    in_kind_income: Decimal
    in_kind_payment_on_account: Decimal
    in_kind_payment_repercuted: Decimal
    deductible_expenses: Decimal
    reductions: Decimal
    accrual_year: int
    province_code: Optional[str]
    created_at: datetime
    lines: list[Model190RecipientLineResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class Model190DeclarationResponse(BaseModel):
    id: int
    company_id: int
    year: int
    declaration_type: str
    original_declaration_id: Optional[int]
    status: str
    generated_at: Optional[datetime]
    presented_at: Optional[datetime]
    locked: bool
    total_recipients: int
    total_cash_income: Decimal
    total_in_kind_income: Decimal
    total_withholding: Decimal
    total_deductible_expenses: Decimal
    payload: Optional[str]
    validation_result: Optional[str]
    receipt_number: Optional[str]
    csv: Optional[str]
    presentation_reference: Optional[str]
    created_at: datetime
    updated_at: datetime
    recipients: list[Model190RecipientResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class Model190RecipientOverrideUpsert(BaseModel):
    company_id: int
    year: int = Field(..., ge=2000, le=2100)
    recipient_type: str
    recipient_id: int
    key: Optional[str] = None
    subkey: Optional[str] = None
    accrual_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    province_code: Optional[str] = Field(default=None, max_length=2)
    notes: Optional[str] = None
    confirmed: bool = False

    @field_validator("recipient_type")
    @classmethod
    def validate_recipient_type(cls, value: str) -> str:
        if value not in MODEL190_RECIPIENT_TYPES:
            raise ValueError("Tipo de perceptor no válido")
        return value

    @field_validator("key")
    @classmethod
    def normalize_key(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_key(value)

    @field_validator("subkey")
    @classmethod
    def normalize_subkey(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_subkey(value)

    @field_validator("province_code")
    @classmethod
    def normalize_province_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return None
        normalized = value.strip().zfill(2)
        if len(normalized) != 2 or not normalized.isdigit():
            raise ValueError("El código de provincia debe contener dos dígitos")
        return normalized


class Model190RecipientOverrideResponse(Model190RecipientOverrideUpsert):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
