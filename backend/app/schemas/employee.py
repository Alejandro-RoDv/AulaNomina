from datetime import date, datetime

from pydantic import BaseModel


class EmployeeBase(BaseModel):
    employee_code: str
    dni: str
    naf: str | None = None
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    is_active: bool = True


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    employee_code: str | None = None
    dni: str | None = None
    naf: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    is_active: bool | None = None


class EmployeeResponse(EmployeeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
