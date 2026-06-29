from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


INCIDENT_TYPES = {
    "IT",
    "RECAIDA",
    "NACIMIENTO_CUIDADO",
    "RIESGO_EMBARAZO",
    "RIESGO_LACTANCIA",
    "CUIDADO_MENOR",
    "VACACIONES",
    "AUSENCIA",
    "PERMISO_RETRIBUIDO",
    "PERMISO_NO_RETRIBUIDO",
    "SUSPENSION",
    "SANCION",
    "HORAS_EXTRA",
    "MOVIMIENTO",
}

INCIDENT_STATUSES = {
    "draft",
    "open",
    "pending",
    "validated",
    "processed",
    "closed",
    "regularized",
    "cancelled",
}

INCIDENT_CREATE_STATUSES = {"draft", "open"}
INCIDENT_DIRECT_UPDATE_STATUSES = {"draft", "open", "pending", "validated"}
INCIDENT_ACTION_ONLY_STATUSES = INCIDENT_STATUSES - INCIDENT_DIRECT_UPDATE_STATUSES


class IncidentAuditResponse(BaseModel):
    id: int
    action: str
    version: int
    actor: str | None = None
    reason: str | None = None
    previous_values: dict[str, Any] | None = None
    new_values: dict[str, Any] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class IncidentConfirmationBase(BaseModel):
    number: str
    confirmation_date: date
    doctor_number: str | None = None
    confirmation_type: str | None = None
    observations: str | None = None
    document_id: int | None = None
    status: str = "active"


class IncidentConfirmationResponse(IncidentConfirmationBase):
    id: int
    is_cancelled: bool = False
    cancellation_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    version: int

    class Config:
        from_attributes = True


class IncidentBase(BaseModel):
    employee_id: int
    contract_id: int
    company_id: int
    center_id: int | None = None
    incident_type: str
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = None
    status: str = "open"
    unit_type: str | None = None
    hours: Decimal | None = None
    days: Decimal | None = None
    paid: bool | None = None
    payroll_effect: str = "pending"
    processed_payroll_id: int | None = None
    generated_amount: Decimal | None = None
    overlap_override: bool = False
    overlap_reason: str | None = None
    origin: str = "manual"
    details: dict[str, Any] = Field(default_factory=dict)
    created_by: str | None = None
    updated_by: str | None = None

    @field_validator("incident_type")
    @classmethod
    def validate_type(cls, value: str):
        if value not in INCIDENT_TYPES:
            raise ValueError("Tipo de incidencia no válido")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        if value not in INCIDENT_STATUSES:
            raise ValueError("Estado de incidencia no válido")
        return value

    @field_validator("hours")
    @classmethod
    def validate_hours(cls, value: Decimal | None):
        if value is not None and (value < 0 or value > 24):
            raise ValueError("Las horas deben estar entre 0 y 24")
        return value

    @field_validator("days", "generated_amount")
    @classmethod
    def validate_non_negative(cls, value: Decimal | None):
        if value is not None and value < 0:
            raise ValueError("El valor no puede ser negativo")
        return value

    @model_validator(mode="after")
    def validate_dates_and_override(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("La fecha final no puede ser anterior a la inicial")
        if self.overlap_override and not (self.overlap_reason or "").strip():
            raise ValueError("Debe indicar el motivo para autorizar un solapamiento")
        if self.incident_type == "HORAS_EXTRA" and self.hours is None:
            raise ValueError("Las horas extraordinarias requieren número de horas")
        return self


class IncidentCreate(IncidentBase):
    @model_validator(mode="after")
    def validate_initial_status(self):
        if self.status not in INCIDENT_CREATE_STATUSES:
            raise ValueError(
                "Una incidencia nueva solo puede crearse en estado draft u open; "
                "los estados operativos se alcanzan mediante acciones controladas"
            )
        if self.processed_payroll_id is not None or self.generated_amount is not None:
            raise ValueError(
                "Una incidencia nueva no puede vincularse directamente a una nómina procesada"
            )
        return self


class IncidentUpdate(BaseModel):
    center_id: int | None = None
    incident_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None
    status: Optional[str] = None
    unit_type: str | None = None
    hours: Decimal | None = None
    days: Decimal | None = None
    paid: bool | None = None
    payroll_effect: str | None = None
    processed_payroll_id: int | None = None
    generated_amount: Decimal | None = None
    overlap_override: bool | None = None
    overlap_reason: str | None = None
    origin: str | None = None
    details: dict[str, Any] | None = None
    updated_by: str | None = None
    change_reason: str | None = None
    expected_version: int | None = None

    @field_validator("incident_type")
    @classmethod
    def validate_type(cls, value: str | None):
        if value is not None and value not in INCIDENT_TYPES:
            raise ValueError("Tipo de incidencia no válido")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None):
        if value is not None and value not in INCIDENT_DIRECT_UPDATE_STATUSES:
            raise ValueError(
                "Este estado solo puede alcanzarse mediante una acción controlada "
                "de procesado, cierre, regularización o anulación"
            )
        return value

    @field_validator("processed_payroll_id", "generated_amount")
    @classmethod
    def validate_processing_fields(cls, value):
        if value is not None:
            raise ValueError(
                "Los datos de procesamiento de nómina no pueden modificarse mediante la edición general"
            )
        return value

    @field_validator("hours")
    @classmethod
    def validate_hours(cls, value: Decimal | None):
        if value is not None and (value < 0 or value > 24):
            raise ValueError("Las horas deben estar entre 0 y 24")
        return value

    @field_validator("days")
    @classmethod
    def validate_non_negative(cls, value: Decimal | None):
        if value is not None and value < 0:
            raise ValueError("El valor no puede ser negativo")
        return value


class IncidentResponse(BaseModel):
    id: int
    employee_id: int
    contract_id: int
    company_id: int
    center_id: int | None = None
    employee_name: Optional[str]
    company_name: Optional[str]
    contract_type: Optional[str]
    incident_type: str
    payroll_effect_label: Optional[str] = None
    affects_payroll: bool = False
    reduces_worked_days: bool = False
    reduces_contribution_days: bool = False
    impacted_payrolls_count: int = 0
    has_impacted_payrolls: bool = False
    payroll_message: Optional[str] = None
    start_date: date
    end_date: Optional[date]
    description: Optional[str]
    status: str
    unit_type: str | None = None
    hours: Decimal | None = None
    days: Decimal | None = None
    paid: bool | None = None
    payroll_effect: str = "pending"
    processed_payroll_id: int | None = None
    generated_amount: Decimal | None = None
    processed_at: datetime | None = None
    is_cancelled: bool = False
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    requires_recalculation: bool = False
    requires_regularization: bool = False
    overlap_override: bool = False
    overlap_reason: str | None = None
    origin: str = "manual"
    details: dict[str, Any] = Field(default_factory=dict)
    created_by: str | None = None
    updated_by: str | None = None
    version: int = 1
    created_at: datetime
    updated_at: datetime | None = None
    audit_entries: list[IncidentAuditResponse] = Field(default_factory=list)
    confirmations: list[IncidentConfirmationResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True
