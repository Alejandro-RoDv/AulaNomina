from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.catalogs.cra_codes import CRA_CODE_BY_VALUE


class CraConceptMappingUpdate(BaseModel):
    cra_code: str
    base_indicator: str = "I"
    is_active: bool = True
    notes: Optional[str] = None

    @field_validator("cra_code")
    @classmethod
    def validate_cra_code(cls, value: str):
        normalized = str(value or "").strip().zfill(4)
        if normalized not in CRA_CODE_BY_VALUE:
            raise ValueError("Clave CRA no válida")
        return normalized

    @field_validator("base_indicator")
    @classmethod
    def validate_base_indicator(cls, value: str):
        normalized = str(value or "").strip().upper()
        if normalized not in {"I", "E"}:
            raise ValueError("El indicador de base debe ser I o E")
        return normalized


class CraConceptMappingResponse(BaseModel):
    id: int
    payroll_concept_id: int
    concept_name: Optional[str] = None
    concept_code: Optional[str] = None
    concept_type: Optional[str] = None
    category: Optional[str] = None
    cra_code: str
    cra_name: Optional[str] = None
    base_indicator: str
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CraPreviewRequest(BaseModel):
    company_id: int
    ccc_id: str
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


class CraRecordResponse(BaseModel):
    cra_code: str
    cra_name: str
    base_indicator: str
    amount: Decimal
    action: str = "A"


class CraWorkerResponse(BaseModel):
    employee_id: int
    employee_name: str
    naf: Optional[str] = None
    payroll_id: int
    records: list[CraRecordResponse] = []
    total_amount: Decimal = Decimal("0.00")


class CraUnmappedConceptResponse(BaseModel):
    payroll_concept_id: int
    concept_code: Optional[str] = None
    concept_name: str
    amount: Decimal


class CraPreviewResponse(BaseModel):
    company_id: int
    company_name: str
    ccc_id: str
    period: str
    payroll_count: int
    worker_count: int
    record_count: int
    total_amount: Decimal
    workers: list[CraWorkerResponse] = []
    unmapped_concepts: list[CraUnmappedConceptResponse] = []
    warnings: list[str] = []


class CraGenerateRequest(CraPreviewRequest):
    created_by: Optional[int] = None


class CraSendRequest(BaseModel):
    created_by: Optional[int] = None
