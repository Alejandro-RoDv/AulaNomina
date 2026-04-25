from pydantic import BaseModel
from datetime import date, datetime


class EmployeeBase(BaseModel):
    employee_code: str
    first_name: str
    last_name: str
    dni: str
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    hire_date: date | None = None
    status: str = "active"


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    employee_code: str
    first_name: str
    last_name: str
    dni: str
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    hire_date: date | None = None
    status: str


class EmployeeResponse(EmployeeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True