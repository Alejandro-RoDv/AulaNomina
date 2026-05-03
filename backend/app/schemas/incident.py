from pydantic import BaseModel, field_validator
from datetime import date, datetime
from typing import Optional


class IncidentBase(BaseModel):
    employee_id: int
    contract_id: int
    company_id: int
    incident_type: str
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = None
    status: Optional[str] = "open"

    @field_validator("incident_type")
    @classmethod
    def validate_type(cls, value):
        allowed = {
            "IT",
            "RECAIDA",
            "VACACIONES",
            "AUSENCIA",
            "PERMISO_RETRIBUIDO",
            "PERMISO_NO_RETRIBUIDO",
        }
        if value not in allowed:
            raise ValueError("Tipo de incidencia no válido")
        return value


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdate(BaseModel):
    incident_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None
    status: Optional[str] = None


class IncidentResponse(BaseModel):
    id: int
    employee_id: int
    contract_id: int
    company_id: int
    employee_name: Optional[str]
    company_name: Optional[str]
    contract_type: Optional[str]
    incident_type: str
    start_date: date
    end_date: Optional[date]
    description: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
