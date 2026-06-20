from datetime import datetime

from pydantic import BaseModel, Field


class CompanyBankAccountCreate(BaseModel):
    label: str = Field(default="Cuenta bancaria", min_length=1, max_length=120)
    iban: str = Field(min_length=10, max_length=40)
    is_fallback: bool = False
    is_simulated: bool = True
    notes: str | None = None


class CompanyBankAccountUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    iban: str | None = Field(default=None, min_length=10, max_length=40)
    is_fallback: bool | None = None
    is_simulated: bool | None = None
    notes: str | None = None


class CompanyBankAccountResponse(BaseModel):
    id: int
    company_id: int
    label: str
    iban: str
    country_code: str
    entity_code: str | None = None
    branch_code: str | None = None
    control_digits: str | None = None
    account_number: str | None = None
    is_fallback: bool
    is_simulated: bool
    is_active: bool
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaymentAssignmentUpdate(BaseModel):
    account_id: int


class PaymentOperationResponse(BaseModel):
    operation_code: str
    operation_label: str
    service_group: str
    priority: int
    account_id: int | None = None
    effective_account_id: int | None = None
    assignment_source: str


class CompanyBankingResponse(BaseModel):
    company_id: int
    accounts: list[CompanyBankAccountResponse]
    operations: list[PaymentOperationResponse]
