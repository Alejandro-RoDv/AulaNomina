from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator


DOCUMENT_TYPES = {
    "DNI_NIE",
    "NAF",
    "SIGNED_CONTRACT",
    "MODEL_145",
    "SEXUAL_OFFENCES_CERTIFICATE",
    "CONFIDENTIALITY_COMMITMENT",
    "DATA_CONSENT",
    "DEGREE_CERTIFICATE",
    "WAGE_GARNISHMENT_ORDER",
    "WAGE_GARNISHMENT_MODIFICATION",
    "WAGE_GARNISHMENT_SUSPENSION",
    "WAGE_GARNISHMENT_RELEASE",
    "WAGE_GARNISHMENT_PAYMENT_RECEIPT",
    "OTHER",
}

DOCUMENT_STATUSES = {
    "pending",
    "received",
    "expired",
    "not_applicable",
}


class DocumentBase(BaseModel):
    employee_id: int
    company_id: Optional[int] = None
    center_id: Optional[int] = None
    wage_garnishment_id: Optional[int] = None
    document_type: str
    document_name: str
    status: str = "pending"
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("document_type")
    @classmethod
    def validate_document_type(cls, value):
        if value not in DOCUMENT_TYPES:
            raise ValueError("Tipo documental no valido")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value not in DOCUMENT_STATUSES:
            raise ValueError("Estado documental no valido")
        return value


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    center_id: Optional[int] = None
    wage_garnishment_id: Optional[int] = None
    document_type: Optional[str] = None
    document_name: Optional[str] = None
    status: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("document_type")
    @classmethod
    def validate_document_type(cls, value):
        if value is not None and value not in DOCUMENT_TYPES:
            raise ValueError("Tipo documental no valido")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is not None and value not in DOCUMENT_STATUSES:
            raise ValueError("Estado documental no valido")
        return value


class DocumentResponse(BaseModel):
    id: int
    employee_id: int
    company_id: int
    center_id: Optional[int] = None
    wage_garnishment_id: Optional[int] = None
    document_type: str
    document_name: str
    status: str
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    employee_name: Optional[str] = None
    company_name: Optional[str] = None
    center_name: Optional[str] = None

    class Config:
        from_attributes = True
