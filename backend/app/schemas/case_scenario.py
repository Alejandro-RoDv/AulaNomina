from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


STEP_PROGRESS_STATUSES = {"pending", "in_progress", "completed", "failed"}
CASE_OPERATION_STATUSES = {"opened", "success", "error"}


class CaseTaskProgressUpdate(BaseModel):
    status: str
    student_notes: Optional[str] = None
    validation_result: dict[str, Any] = Field(default_factory=dict)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value not in STEP_PROGRESS_STATUSES:
            raise ValueError("Estado de progreso no valido")
        return value


class CaseContextEventCreate(BaseModel):
    task_id: Optional[int] = None
    event_type: str
    action_code: Optional[str] = None
    target: Optional[str] = None
    operation_status: str = "opened"
    response_summary: Optional[str] = None
    auto_validate: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, value):
        if not value or not value.strip():
            raise ValueError("El tipo de evento es obligatorio")
        return value.strip()

    @field_validator("operation_status")
    @classmethod
    def validate_operation_status(cls, value):
        if value not in CASE_OPERATION_STATUSES:
            raise ValueError("Estado de operacion no valido")
        return value


class CaseScenarioStepResponse(BaseModel):
    task_id: int
    title: str
    description: Optional[str] = None
    module: str
    expected_result: Optional[str] = None
    expected_action: Optional[str] = None
    trigger_type: str
    trigger_condition: dict[str, Any] = Field(default_factory=dict)
    validation_rules: list[dict[str, Any]] = Field(default_factory=list)
    message_template: Optional[str] = None
    task_order: int
    is_required: bool
    blocking: bool
    progress_id: int
    progress_status: str
    attempts: int
    validation_result: dict[str, Any] = Field(default_factory=dict)
    student_notes: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class CaseScenarioResponse(BaseModel):
    assignment_id: int
    case_study_id: int
    scenario_code: Optional[str] = None
    title: str
    description: Optional[str] = None
    difficulty: str
    category: str
    assignment_status: str
    assignee_name: str
    assignee_type: str
    initial_state: dict[str, Any] = Field(default_factory=dict)
    validation_rules: list[dict[str, Any]] = Field(default_factory=list)
    completion_message: Optional[str] = None
    total_steps: int
    completed_steps: int
    failed_steps: int
    current_task_order: int
    completion_percentage: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    steps: list[CaseScenarioStepResponse] = Field(default_factory=list)


class CaseStepValidationResponse(BaseModel):
    passed: bool
    manual_required: bool = False
    message: str
    checks: list[dict[str, Any]] = Field(default_factory=list)
    scenario: CaseScenarioResponse


class CaseOperationEventResponse(BaseModel):
    event_recorded: bool = True
    feedback_message_id: Optional[int] = None
    validation: Optional[CaseStepValidationResponse] = None
    scenario: CaseScenarioResponse
