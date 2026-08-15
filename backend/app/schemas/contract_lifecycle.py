from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, field_validator


class ContractWorkdayChangeRequest(BaseModel):
    effective_date: date
    weekly_hours: float
    reason: str

    @field_validator("weekly_hours")
    @classmethod
    def validate_weekly_hours(cls, value: float) -> float:
        if value <= 0 or value > 60:
            raise ValueError("weekly_hours debe ser mayor que 0 y no superar 60")
        return value


class ContractExtensionRequest(BaseModel):
    effective_date: date
    new_end_date: date
    reason: str


class ContractLifecycleEventResponse(BaseModel):
    id: int
    contract_id: int
    event_type: str
    effective_date: date
    reason: str | None = None
    previous_state: dict[str, Any]
    new_state: dict[str, Any]
    related_contract_id: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True
