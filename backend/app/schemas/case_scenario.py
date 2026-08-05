from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


STEP_PROGRESS_STATUSES = {"pending", "in_progress", "completed", "failed"}


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
