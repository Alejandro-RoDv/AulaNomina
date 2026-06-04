from datetime import date, datetime

from pydantic import BaseModel


class EmployeeBase(BaseModel):
    employee_code: str
    company_id: int | None = None
    center_id: int | None = None
    document_type: str = "DNI"
    dni: str
    nie_prefix: str | None = None
    document_number: str | None = None
    document_letter: str | None = None
    naf: str | None = None
    first_name: str
    last_name: str
    second_last_name: str | None = None
    sex: str | None = None
    birth_date: date | None = None
    nationality: str | None = None
    birth_place: str | None = None
    domicile: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    landline_phone: str | None = None
    mobile_phone: str | None = None
    phone: str | None = None
    fax: str | None = None
    email: str | None = None
    website: str | None = None
    education_level: str | None = None
    academic_title: str | None = None
    academic_title_date: date | None = None
    main_profession: str | None = None
    other_courses: str | None = None
    accreditations: str | None = None
    languages: str | None = None
    representative_role: str | None = None
    representative_nif: str | None = None
    representative_full_name: str | None = None
    observations: str | None = None
    is_active: bool = True


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    employee_code: str | None = None
    company_id: int | None = None
    center_id: int | None = None
    document_type: str | None = None
    dni: str | None = None
    nie_prefix: str | None = None
    document_number: str | None = None
    document_letter: str | None = None
    naf: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    second_last_name: str | None = None
    sex: str | None = None
    birth_date: date | None = None
    nationality: str | None = None
    birth_place: str | None = None
    domicile: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    landline_phone: str | None = None
    mobile_phone: str | None = None
    phone: str | None = None
    fax: str | None = None
    email: str | None = None
    website: str | None = None
    education_level: str | None = None
    academic_title: str | None = None
    academic_title_date: date | None = None
    main_profession: str | None = None
    other_courses: str | None = None
    accreditations: str | None = None
    languages: str | None = None
    representative_role: str | None = None
    representative_nif: str | None = None
    representative_full_name: str | None = None
    observations: str | None = None
    is_active: bool | None = None


class EmployeeResponse(EmployeeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
