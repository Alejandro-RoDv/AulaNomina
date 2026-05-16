from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


GROUP_STATUSES = {"active", "inactive", "completed"}


class StudentGroupBase(BaseModel):
    group_code: Optional[str] = None
    name: str
    academic_year: Optional[str] = None
    education_center: Optional[str] = None
    teacher_name: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None
    is_active: bool = True

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value not in GROUP_STATUSES:
            raise ValueError("Estado de grupo no valido")
        return value


class StudentGroupCreate(StudentGroupBase):
    pass


class StudentGroupUpdate(BaseModel):
    group_code: Optional[str] = None
    name: Optional[str] = None
    academic_year: Optional[str] = None
    education_center: Optional[str] = None
    teacher_name: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is not None and value not in GROUP_STATUSES:
            raise ValueError("Estado de grupo no valido")
        return value


class StudentGroupResponse(StudentGroupBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
