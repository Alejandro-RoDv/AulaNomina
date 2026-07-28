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
    "UNMATCHED_WORKER",
    "DUPLICATE",
    "APPLIED",
    "IGNORED",
    "ERROR",
}

FIE_PRIORITIES = {"NORMAL", "HIGH", "URGENT"}

FIE_PAYROLL_IMPACTS = {
    "NO_IMPACT",
    "PENDING_RECALCULATION",
    "RECALCULATED",
    "REGULARIZATION_REQUIRED",
}

FIE_RESOLUTION_ACTIONS = {
    "LINK_INCIDENT",
    "CREATE_INCIDENT",
    "UPDATE_INCIDENT",
    "ADD_CONFIRMATION",
    "CLOSE_INCIDENT",
    "CANCEL_INCIDENT",
    "CREATE_RELAPSE",
    "MARK_FOR_REVIEW",
    "IGNORE_DUPLICATE",
}

FIE_SIMULATION_SCENARIOS = {
    "AUTO",
    "AUTO_INTERNAL_INCIDENT",
    "DATE_MISMATCH",
    "UNKNOWN_WORKER",
    "NO_ACTIVE_CONTRACT",
    "CONFIRMATION_WITHOUT_PROCESS",
    "DISCHARGE_WITHOUT_PROCESS",
    "RELAPSE_WITHOUT_PREVIOUS",
    "DUPLICATE",
}


class FieSimulationRequest(BaseModel):
    company_id: int
    employee_id: int | None = None
    external_worker_name: str | None = None
    external_nif: str | None = None
    external_naf: str | None = None
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
    priority: str = "NORMAL"
    notes: str | None = None
    created_by: str | None = None

    @model_validator(mode="after")
    def validate_communication(self):
        if self.communication_type not in FIE_COMMUNICATION_TYPES:
            raise ValueError("Tipo de comunicación FIE no válido")
        if self.result_scenario not in FIE_SIMULATION_SCENARIOS:
            raise ValueError("Escenario de simulación FIE no válido")
        if self.priority not in FIE_PRIORITIES:
            raise ValueError("Prioridad FIE no válida")
        if self.estimated_duration is not None and self.estimated_duration < 0:
            raise ValueError("La duración estimada no puede ser negativa")
        if self.result_scenario != "UNKNOWN_WORKER" and self.employee_id is None:
            raise ValueError("Debe seleccionarse un trabajador salvo en el escenario no identificado")
        if self.result_scenario == "UNKNOWN_WORKER":
            self.employee_id = None
            self.external_worker_name = self.external_worker_name or "Trabajador no identificado"
            self.external_naf = self.external_naf or "NAF-DESCONOCIDO"
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


class FieResolutionRequest(FieActionRequest):
    action: str
    incident_id: int | None = None
    allow_date_override: bool = False

    @model_validator(mode="after")
    def validate_action(self):
        if self.action not in FIE_RESOLUTION_ACTIONS:
            raise ValueError("Acción de resolución FIE no válida")
        return self


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
    employee_id: int | None = None
    contract_id: int | None = None
    incident_id: int | None = None
    company_name: str | None = None
    employee_name: str | None = None
    external_worker_name: str | None = None
    external_nif: str | None = None
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
    priority: str
    received_at: datetime
    read_at: datetime | None = None
    is_read: bool = False
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
