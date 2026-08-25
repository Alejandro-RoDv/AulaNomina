from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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
