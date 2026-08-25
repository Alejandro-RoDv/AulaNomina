from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str):
        normalized = (value or "").strip().lower()
        if "@" not in normalized:
            raise ValueError("Email no válido")
        return normalized


class AuthUserResponse(BaseModel):
    id: int
    email: str
    role: str
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    expires_at: datetime


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


class MeResponse(BaseModel):
    id: int
    email: str
    role: str
    student_id: Optional[int] = None
    student_name: Optional[str] = None
