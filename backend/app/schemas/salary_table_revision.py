from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.collective_agreement import SalaryTableDetailResponse


class SalaryTableRevisionRequest(BaseModel):
    name: str
    year: int = Field(ge=1900, le=2200)
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    status: str = "draft"
    increment_percentage: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("1000.00"))
    copy_rows: bool = True
    copy_concepts: bool = True
    copy_extra_pays: bool = True
    copy_seniority_rules: bool = True
    increase_non_salary: bool = False
    mark_source_historical: bool = False
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("El nombre de la nueva tabla no puede estar vacío")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        allowed = {"draft", "historical", "pending_review"}
        if value not in allowed:
            raise ValueError("La activación debe realizarse desde el flujo controlado de tablas salariales")
        return value

    @model_validator(mode="after")
    def validate_dates(self):
        if self.effective_from and self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("La fecha final no puede ser anterior a la fecha inicial")
        return self


class SalaryTableRevisionResponse(BaseModel):
    source_table_id: int
    source_status: str
    salary_table: SalaryTableDetailResponse
    copied_rows: int = 0
    copied_concepts: int = 0
    copied_extra_pays: int = 0
    copied_extra_pay_lines: int = 0
    copied_seniority_rules: int = 0
    increased_rows: int = 0
    increased_concepts: int = 0
    increment_percentage: Decimal = Decimal("0.00")
    warnings: list[str] = Field(default_factory=list)
