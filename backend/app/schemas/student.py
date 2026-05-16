from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


STUDENT_STATUSES = {"active", "inactive", "completed"}


class StudentBase(BaseModel):
    student_code: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    education_center: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None
    is_active: bool = True

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value not in STUDENT_STATUSES:
            raise ValueError("Estado de alumno no valido")
        return value


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    student_code: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    education_center: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is not None and value not in STUDENT_STATUSES:
            raise ValueError("Estado de alumno no valido")
        return value


class StudentResponse(StudentBase):
    id: int
    full_name: str
    group_display_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
