from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class SmiParameterBase(BaseModel):
    effective_from: date
    effective_to: date | None = None
    daily_amount: Decimal = Field(gt=0)
    monthly_amount: Decimal = Field(gt=0)
    annual_amount: Decimal = Field(gt=0)
    source_reference: str | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_period(self):
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("La fecha fin no puede ser anterior a la fecha de inicio")
        return self


class SmiParameterCreate(SmiParameterBase):
    pass


class SmiParameterUpdate(BaseModel):
    effective_from: date | None = None
    effective_to: date | None = None
    daily_amount: Decimal | None = Field(default=None, gt=0)
    monthly_amount: Decimal | None = Field(default=None, gt=0)
    annual_amount: Decimal | None = Field(default=None, gt=0)
    source_reference: str | None = None
    is_active: bool | None = None


class SmiParameterResponse(SmiParameterBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
