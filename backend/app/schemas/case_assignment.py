from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


ASSIGNMENT_STATUSES = {"assigned", "in_progress", "submitted", "reviewed", "approved", "needs_revision"}


class CaseAssignmentBase(BaseModel):
    case_study_id: int
    student_id: Optional[int] = None
    group_id: Optional[int] = None
    assigned_by: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str = "assigned"
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value not in ASSIGNMENT_STATUSES:
            raise ValueError("Estado de asignacion no valido")
        return value

    @model_validator(mode="after")
    def validate_assignee(self):
        if not self.student_id and not self.group_id:
            raise ValueError("La asignacion debe tener alumno o grupo")
        if self.student_id and self.group_id:
            raise ValueError("La asignacion solo puede tener alumno o grupo, no ambos")
        return self


class CaseAssignmentCreate(CaseAssignmentBase):
    pass


class CaseAssignmentUpdate(BaseModel):
    case_study_id: Optional[int] = None
    student_id: Optional[int] = None
    group_id: Optional[int] = None
    assigned_by: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is not None and value not in ASSIGNMENT_STATUSES:
            raise ValueError("Estado de asignacion no valido")
        return value


class CaseAssignmentResponse(CaseAssignmentBase):
    id: int
    case_title: Optional[str] = None
    student_name: Optional[str] = None
    group_name: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_type: str = "none"
    assigned_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True
