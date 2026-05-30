from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


CONCEPT_TYPE_VALUES = {"DEVENGO", "DEDUCCION", "BASE_INFORMATIVA"}
SALARY_NATURE_VALUES = {"SALARIAL", "EXTRASALARIAL", "INFORMATIVA"}
CONCEPT_CATEGORY_VALUES = {
    "BASE",
    "COMPLEMENTO",
    "PLUS",
    "EXTRA",
    "PAGA_EXTRA",
    "DIETA",
    "KILOMETRAJE",
    "DEDUCCION",
    "EMBARGO",
    "ANTICIPO",
    "BASE_INFORMATIVA",
    "OTRO",
}


class PayrollConceptBase(BaseModel):
    name: str
    code: str
    category: str = "OTRO"
    concept_type: str = "DEVENGO"
    salary_nature: str = "SALARIAL"
    is_taxable: bool = True
    is_contribution_base: bool = True
    is_active: bool = True
    display_order: int = 0
    notes: Optional[str] = None

    @field_validator("name", "code")
    @classmethod
    def validate_required_text(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("El campo no puede estar vacío")
        return value

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value):
        return value.strip().upper().replace(" ", "_")

    @field_validator("category")
    @classmethod
    def validate_category(cls, value):
        value = value.upper()
        if value not in CONCEPT_CATEGORY_VALUES:
            raise ValueError("Categoría de concepto no válida")
        return value

    @field_validator("concept_type")
    @classmethod
    def validate_concept_type(cls, value):
        value = value.upper()
        if value not in CONCEPT_TYPE_VALUES:
            raise ValueError("Tipo de concepto no válido")
        return value

    @field_validator("salary_nature")
    @classmethod
    def validate_salary_nature(cls, value):
        value = value.upper()
        if value not in SALARY_NATURE_VALUES:
            raise ValueError("Naturaleza salarial no válida")
        return value


class PayrollConceptCreate(PayrollConceptBase):
    pass


class PayrollConceptUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    concept_type: Optional[str] = None
    salary_nature: Optional[str] = None
    is_taxable: Optional[bool] = None
    is_contribution_base: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("name", "code")
    @classmethod
    def validate_optional_text(cls, value):
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("El campo no puede estar vacío")
        return value

    @field_validator("code")
    @classmethod
    def normalize_optional_code(cls, value):
        if value is None:
            return value
        return value.strip().upper().replace(" ", "_")

    @field_validator("category")
    @classmethod
    def validate_optional_category(cls, value):
        if value is None:
            return value
        value = value.upper()
        if value not in CONCEPT_CATEGORY_VALUES:
            raise ValueError("Categoría de concepto no válida")
        return value

    @field_validator("concept_type")
    @classmethod
    def validate_optional_concept_type(cls, value):
        if value is None:
            return value
        value = value.upper()
        if value not in CONCEPT_TYPE_VALUES:
            raise ValueError("Tipo de concepto no válido")
        return value

    @field_validator("salary_nature")
    @classmethod
    def validate_optional_salary_nature(cls, value):
        if value is None:
            return value
        value = value.upper()
        if value not in SALARY_NATURE_VALUES:
            raise ValueError("Naturaleza salarial no válida")
        return value


class PayrollConceptResponse(PayrollConceptBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PayrollItemBase(BaseModel):
    concept_id: int
    description: Optional[str] = None
    quantity: Decimal = Decimal("1.00")
    unit_price: Decimal = Decimal("0.00")
    amount: Optional[Decimal] = None
    display_order: int = 0
    notes: Optional[str] = None

    @field_validator("quantity", "unit_price", "amount")
    @classmethod
    def validate_amounts(cls, value):
        if value is not None and value < 0:
            raise ValueError("Los importes y unidades no pueden ser negativos")
        return value


class PayrollItemCreate(PayrollItemBase):
    pass


class PayrollItemUpdate(BaseModel):
    concept_id: Optional[int] = None
    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    display_order: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("quantity", "unit_price", "amount")
    @classmethod
    def validate_optional_amounts(cls, value):
        if value is not None and value < 0:
            raise ValueError("Los importes y unidades no pueden ser negativos")
        return value


class PayrollItemResponse(BaseModel):
    id: int
    payroll_id: int
    concept_id: int
    concept_name: Optional[str] = None
    concept_code: Optional[str] = None
    concept_type: Optional[str] = None
    category: Optional[str] = None
    salary_nature: Optional[str] = None
    description: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    display_order: int = 0
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PayrollBreakdownResponse(BaseModel):
    payroll_id: int
    devengos_salariales: list[PayrollItemResponse] = []
    devengos_extrasalariales: list[PayrollItemResponse] = []
    deducciones: list[PayrollItemResponse] = []
    bases_informativas: list[PayrollItemResponse] = []
    total_devengos: Decimal = Decimal("0.00")
    total_deducciones: Decimal = Decimal("0.00")
    neto_manual: Decimal = Decimal("0.00")
