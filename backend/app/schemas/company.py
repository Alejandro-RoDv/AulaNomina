from datetime import datetime

from pydantic import BaseModel


class CompanyCreate(BaseModel):
    name: str
    cif: str
    ccc: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    cif: str | None = None
    ccc: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    is_active: bool | None = None


class CompanyResponse(BaseModel):
    id: int
    name: str
    cif: str
    ccc: str | None
    address: str | None
    city: str | None
    province: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
