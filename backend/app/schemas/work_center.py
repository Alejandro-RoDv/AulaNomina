from datetime import datetime

from pydantic import BaseModel, field_validator


class WorkCenterBase(BaseModel):
    company_id: int
    center_code: str
    name: str
    general_ccc: str | None = None
    main_ccc: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    collective_agreement: str | None = None
    phone: str | None = None
    fax: str | None = None
    mobile: str | None = None
    contact_email: str | None = None
    web_url: str | None = None
    is_active: bool = True

    @field_validator("center_code")
    @classmethod
    def validate_center_code(cls, value):
        if not value or not value.strip():
            raise ValueError("center_code no puede estar vacio")
        return value.strip()

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        if not value or not value.strip():
            raise ValueError("name no puede estar vacio")
        return value.strip()


class WorkCenterCreate(WorkCenterBase):
    pass


class WorkCenterUpdate(BaseModel):
    company_id: int | None = None
    center_code: str | None = None
    name: str | None = None
    general_ccc: str | None = None
    main_ccc: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    collective_agreement: str | None = None
    phone: str | None = None
    fax: str | None = None
    mobile: str | None = None
    contact_email: str | None = None
    web_url: str | None = None
    is_active: bool | None = None

    @field_validator("center_code")
    @classmethod
    def validate_center_code(cls, value):
        if value is None:
            return value
        if not value.strip():
            raise ValueError("center_code no puede estar vacio")
        return value.strip()

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        if value is None:
            return value
        if not value.strip():
            raise ValueError("name no puede estar vacio")
        return value.strip()


class WorkCenterResponse(WorkCenterBase):
    id: int
    company_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
