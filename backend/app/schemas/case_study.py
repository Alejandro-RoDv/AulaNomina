from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


CASE_DIFFICULTIES = {"basic", "intermediate", "advanced"}
CASE_STATUSES = {"draft", "active", "archived"}
CASE_CATEGORIES = {
    "payroll",
    "contract",
    "social_security",
    "tax",
    "absence",
    "employee_request",
    "document",
    "general",
}
CASE_CATEGORY_ALIASES = {
    "social-security": "social_security",
    "regularizations": "payroll",
    "terminations": "contract",
}
TASK_MODULES = {
    "employees",
    "contracts",
    "documents",
    "incidents",
    "payrolls",
    "companies",
    "agreements",
    "affiliations",
    "fie",
    "siltra",
    "model111",
    "model190",
    "regularizations",
    "tax",
    "irpf",
    "cra",
    "social-security",
    "terminations",
    "mail",
    "general",
}
TASK_STATUSES = {"pending", "in_progress", "completed"}
TASK_TRIGGER_TYPES = {"manual", "module_event", "mail_response", "system"}


def normalize_case_category(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = CASE_CATEGORY_ALIASES.get(value, value)
    if normalized not in CASE_CATEGORIES:
        raise ValueError("Categoria de caso no valida")
    return normalized


class CaseTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    module: str = "general"
    expected_result: Optional[str] = None
    expected_action: Optional[str] = None
    trigger_type: str = "manual"
    trigger_condition: dict[str, Any] = Field(default_factory=dict)
    validation_rules: list[dict[str, Any]] = Field(default_factory=list)
    message_template: Optional[str] = None
    feedback_config: dict[str, Any] = Field(default_factory=dict)
    task_order: int = 1
    is_required: bool = True
    blocking: bool = True
    status: str = "pending"

    @field_validator("module")
    @classmethod
    def validate_module(cls, value):
        if value not in TASK_MODULES:
            raise ValueError("Modulo de tarea no valido")
        return value

    @field_validator("status")
    @classmethod
    def validate_task_status(cls, value):
        if value not in TASK_STATUSES:
            raise ValueError("Estado de tarea no valido")
        return value

    @field_validator("trigger_type")
    @classmethod
    def validate_trigger_type(cls, value):
        if value not in TASK_TRIGGER_TYPES:
            raise ValueError("Tipo de activacion no valido")
        return value


class CaseTaskCreate(CaseTaskBase):
    pass


class CaseTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    expected_result: Optional[str] = None
    expected_action: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_condition: Optional[dict[str, Any]] = None
    validation_rules: Optional[list[dict[str, Any]]] = None
    message_template: Optional[str] = None
    feedback_config: Optional[dict[str, Any]] = None
    task_order: Optional[int] = None
    is_required: Optional[bool] = None
    blocking: Optional[bool] = None
    status: Optional[str] = None

    @field_validator("module")
    @classmethod
    def validate_module(cls, value):
        if value is not None and value not in TASK_MODULES:
            raise ValueError("Modulo de tarea no valido")
        return value

    @field_validator("status")
    @classmethod
    def validate_task_status(cls, value):
        if value is not None and value not in TASK_STATUSES:
            raise ValueError("Estado de tarea no valido")
        return value

    @field_validator("trigger_type")
    @classmethod
    def validate_trigger_type(cls, value):
        if value is not None and value not in TASK_TRIGGER_TYPES:
            raise ValueError("Tipo de activacion no valido")
        return value


class CaseTaskResponse(CaseTaskBase):
    id: int
    case_study_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CaseStudyBase(BaseModel):
    scenario_code: Optional[str] = None
    title: str
    description: Optional[str] = None
    difficulty: str = "basic"
    category: str = "general"
    company_id: Optional[int] = None
    status: str = "draft"
    initial_state: dict[str, Any] = Field(default_factory=dict)
    validation_rules: list[dict[str, Any]] = Field(default_factory=list)
    completion_message: Optional[str] = None
    created_by: Optional[str] = None

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, value):
        if value not in CASE_DIFFICULTIES:
            raise ValueError("Dificultad no valida")
        return value

    @field_validator("status")
    @classmethod
    def validate_case_status(cls, value):
        if value not in CASE_STATUSES:
            raise ValueError("Estado de caso no valido")
        return value

    @field_validator("category")
    @classmethod
    def validate_category(cls, value):
        return normalize_case_category(value)


class CaseStudyCreate(CaseStudyBase):
    tasks: list[CaseTaskCreate] = Field(default_factory=list)


class CaseStudyUpdate(BaseModel):
    scenario_code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    company_id: Optional[int] = None
    status: Optional[str] = None
    initial_state: Optional[dict[str, Any]] = None
    validation_rules: Optional[list[dict[str, Any]]] = None
    completion_message: Optional[str] = None
    created_by: Optional[str] = None

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, value):
        if value is not None and value not in CASE_DIFFICULTIES:
            raise ValueError("Dificultad no valida")
        return value

    @field_validator("status")
    @classmethod
    def validate_case_status(cls, value):
        if value is not None and value not in CASE_STATUSES:
            raise ValueError("Estado de caso no valido")
        return value

    @field_validator("category")
    @classmethod
    def validate_category(cls, value):
        return normalize_case_category(value)


class CaseStudyResponse(CaseStudyBase):
    id: int
    created_at: datetime
    tasks: list[CaseTaskResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True
