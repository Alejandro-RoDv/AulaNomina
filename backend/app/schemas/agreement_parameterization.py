from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class AgreementConceptCatalogBase(BaseModel):
    catalog_type: str
    code: Optional[str] = None
    name: str
    description: Optional[str] = None
    default_nature: Optional[str] = None
    default_payment_type: Optional[str] = None
    default_calculation_type: Optional[str] = None
    default_contributes: bool = True
    default_taxable: bool = True
    default_cra_code: Optional[str] = None
    is_system: bool = False
    is_active: bool = True
    notes: Optional[str] = None

    @field_validator("catalog_type")
    @classmethod
    def validate_catalog_type(cls, value: str):
        if value not in {"salary", "non_salary", "deduction"}:
            raise ValueError("catalog_type debe ser salary, non_salary o deduction")
        return value


class AgreementConceptCatalogCreate(AgreementConceptCatalogBase):
    pass


class AgreementConceptCatalogUpdate(BaseModel):
    catalog_type: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    default_nature: Optional[str] = None
    default_payment_type: Optional[str] = None
    default_calculation_type: Optional[str] = None
    default_contributes: Optional[bool] = None
    default_taxable: Optional[bool] = None
    default_cra_code: Optional[str] = None
    is_system: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class AgreementConceptCatalogResponse(AgreementConceptCatalogBase):
    id: int
    collective_agreement_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgreementSalaryConceptBase(BaseModel):
    professional_category_id: Optional[int] = None
    concept_catalog_id: Optional[int] = None
    character: str = "salarial"
    name: str
    scope: str = "global"
    amount: Optional[Decimal] = None
    payment_type: Optional[str] = None
    calculation_type: str = "manual"
    contributes: bool = True
    taxable: bool = True
    cra_code: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class AgreementSalaryConceptCreate(AgreementSalaryConceptBase):
    pass


class AgreementSalaryConceptUpdate(BaseModel):
    professional_category_id: Optional[int] = None
    concept_catalog_id: Optional[int] = None
    character: Optional[str] = None
    name: Optional[str] = None
    scope: Optional[str] = None
    amount: Optional[Decimal] = None
    payment_type: Optional[str] = None
    calculation_type: Optional[str] = None
    contributes: Optional[bool] = None
    taxable: Optional[bool] = None
    cra_code: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class AgreementSalaryConceptResponse(AgreementSalaryConceptBase):
    id: int
    collective_agreement_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgreementRuleDetailBase(BaseModel):
    detail_type: str = "line"
    code: Optional[str] = None
    name: str
    display_order: int = 1
    professional_category_id: Optional[int] = None
    concept_catalog_id: Optional[int] = None
    amount: Optional[Decimal] = None
    percentage: Optional[Decimal] = None
    company_percentage: Optional[Decimal] = None
    worker_percentage: Optional[Decimal] = None
    total_percentage: Optional[Decimal] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    options: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    notes: Optional[str] = None


class AgreementRuleDetailCreate(AgreementRuleDetailBase):
    pass


class AgreementRuleDetailUpdate(BaseModel):
    detail_type: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    display_order: Optional[int] = None
    professional_category_id: Optional[int] = None
    concept_catalog_id: Optional[int] = None
    amount: Optional[Decimal] = None
    percentage: Optional[Decimal] = None
    company_percentage: Optional[Decimal] = None
    worker_percentage: Optional[Decimal] = None
    total_percentage: Optional[Decimal] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    options: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class AgreementRuleDetailResponse(AgreementRuleDetailBase):
    id: int
    rule_header_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgreementRuleHeaderBase(BaseModel):
    rule_type: str
    code: Optional[str] = None
    name: str
    scope: str = "global"
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_default: bool = False
    is_active: bool = True
    options: dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None


class AgreementRuleHeaderCreate(AgreementRuleHeaderBase):
    details: list[AgreementRuleDetailCreate] = Field(default_factory=list)


class AgreementRuleHeaderUpdate(BaseModel):
    rule_type: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    scope: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    options: Optional[dict[str, Any]] = None
    notes: Optional[str] = None


class AgreementRuleHeaderResponse(AgreementRuleHeaderBase):
    id: int
    collective_agreement_id: int
    created_at: datetime
    updated_at: datetime
    details: list[AgreementRuleDetailResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class AgreementParameterizationResponse(BaseModel):
    rule_headers: list[AgreementRuleHeaderResponse] = Field(default_factory=list)
    salary_concepts: list[AgreementSalaryConceptResponse] = Field(default_factory=list)
    concept_catalog: list[AgreementConceptCatalogResponse] = Field(default_factory=list)
