from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


CORRECTION_STATUSES = {"pending_review", "reviewed", "approved", "needs_revision"}


class CorrectionBase(BaseModel):
    case_study_id: int
    student_name: str
    student_group: Optional[str] = None
    status: str = "pending_review"
    grade: Optional[float] = None
    teacher_feedback: Optional[str] = None
    reviewed_by: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value not in CORRECTION_STATUSES:
            raise ValueError("Estado de correccion no valido")
        return value

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, value):
        if value is not None and (value < 0 or value > 10):
            raise ValueError("La nota debe estar entre 0 y 10")
        return value


class CorrectionCreate(CorrectionBase):
    pass


class CorrectionUpdate(BaseModel):
    case_study_id: Optional[int] = None
    student_name: Optional[str] = None
    student_group: Optional[str] = None
    status: Optional[str] = None
    grade: Optional[float] = None
    teacher_feedback: Optional[str] = None
    reviewed_by: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is not None and value not in CORRECTION_STATUSES:
            raise ValueError("Estado de correccion no valido")
        return value

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, value):
        if value is not None and (value < 0 or value > 10):
            raise ValueError("La nota debe estar entre 0 y 10")
        return value


class CorrectionResponse(CorrectionBase):
    id: int
    case_title: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
