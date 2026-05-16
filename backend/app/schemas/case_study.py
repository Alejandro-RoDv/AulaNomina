from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


CASE_DIFFICULTIES = {"basic", "intermediate", "advanced"}
CASE_STATUSES = {"draft", "active", "archived"}
TASK_MODULES = {"employees", "contracts", "documents", "incidents", "payrolls", "companies", "general"}
TASK_STATUSES = {"pending", "in_progress", "completed"}


class CaseTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    module: str = "general"
    expected_result: Optional[str] = None
    task_order: int = 1
    is_required: bool = True
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


class CaseTaskCreate(CaseTaskBase):
    pass


class CaseTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    expected_result: Optional[str] = None
    task_order: Optional[int] = None
    is_required: Optional[bool] = None
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


class CaseTaskResponse(CaseTaskBase):
    id: int
    case_study_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CaseStudyBase(BaseModel):
    title: str
    description: Optional[str] = None
    difficulty: str = "basic"
    status: str = "draft"
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


class CaseStudyCreate(CaseStudyBase):
    tasks: list[CaseTaskCreate] = []


class CaseStudyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    status: Optional[str] = None
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


class CaseStudyResponse(CaseStudyBase):
    id: int
    created_at: datetime
    tasks: list[CaseTaskResponse] = []

    class Config:
        from_attributes = True
