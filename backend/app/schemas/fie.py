from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


FIE_COMMUNICATION_TYPES = {
    "SICK_LEAVE",
    "CONFIRMATION",
    "MEDICAL_DISCHARGE",
    "MODIFICATION",
    "CANCELLATION",
    "RELAPSE",
}

FIE_STATUSES = {
    "RECEIVED",
    "PENDING_REVIEW",
    "MATCHED",
    "DISCREPANCY",
    "APPLIED",
    "IGNORED",
    "ERROR",
}

FIE_PAYROLL_IMPACTS = {
    "NO_IMPACT",
    "PENDING_RECALCULATION",
    "RECALCULATED",
    "REGULARIZATION_REQUIRED",
}


class FieSimulationRequest(BaseModel):
    company_id: int
    employee_id: int
    communication_type: str
    event_date: date
    ccc_id: str | None = None
    process_reference: str | None = None
    previous_process_reference: str | None = None
    contingency_type: str | None = "COMMON_DISEASE"
    sick_leave_date: date | None = None
    confirmation_date: date | None = None
    medical_discharge_date: date | None = None
    relapse_date: date | None = None
    estimated_duration: int | None = None
    result_scenario: str = "AUTO"
    notes: str | None = None
    created_by: str | None = None

    @model_validator(mode="after")
    def validate_communication(self):
        if self.communication_type not in FIE_COMMUNICATION_TYPES:
            raise ValueError("Tipo de comunicación FIE no válido")
        if self.estimated_duration is not None and self.estimated_duration < 0:
            raise ValueError("La duración estimada no puede ser negativa")
        if self.communication_type == "SICK_LEAVE" and not self.sick_leave_date:
            self.sick_leave_date = self.event_date
        if self.communication_type == "CONFIRMATION" and not self.confirmation_date:
            self.confirmation_date = self.event_date
        if self.communication_type == "MEDICAL_DISCHARGE" and not self.medical_discharge_date:
            self.medical_discharge_date = self.event_date
        if self.communication_type == "RELAPSE" and not self.relapse_date:
            self.relapse_date = self.event_date
        return self


class FieActionRequest(BaseModel):
    actor: str | None = None
    notes: str | None = None


class FieProcessingEventResponse(BaseModel):
    id: int
    communication_id: int
    event_type: str
    actor: str | None = None
    detail: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    class Config:
        from_attributes = True


class FieCommunicationResponse(BaseModel):
    id: int
    company_id: int
    employee_id: int
    contract_id: int | None = None
    incident_id: int | None = None
    company_name: str | None = None
    employee_name: str | None = None
    incident_status: str | None = None
    ccc_id: str | None = None
    naf: str | None = None
    external_message_id: str
    process_reference: str
    previous_process_reference: str | None = None
    communication_type: str
    contingency_type: str | None = None
    event_date: date
    sick_leave_date: date | None = None
    confirmation_date: date | None = None
    medical_discharge_date: date | None = None
    relapse_date: date | None = None
    estimated_duration: int | None = None
    source: str
    received_at: datetime
    status: str
    reconciliation_result: dict[str, Any] = Field(default_factory=dict)
    payroll_impact: str
    raw_content: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    events: list[FieProcessingEventResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True
