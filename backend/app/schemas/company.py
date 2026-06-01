from datetime import date, datetime

from pydantic import BaseModel


class CompanyBase(BaseModel):
    name: str
    cif: str
    ccc: str | None = None
    ccc_regime: str | None = None
    ccc_code: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    status: str = "alta"
    registration_date: date | None = None
    deregistration_date: date | None = None
    main_collective_agreement: str | None = None
    is_cooperative: bool = False
    special_work_income_withholding: bool = False
    company_type: str | None = None
    legal_representative_name: str | None = None
    legal_representative_dni: str | None = None
    legal_representative_position: str | None = None
    cnae_2009_code: str | None = None
    cnae_2009_name: str | None = None
    cnae_2025_code: str | None = None
    cnae_2025_name: str | None = None
    pension_plan_enabled: bool = False
    pension_manager_key: str | None = None
    pension_manager_entity_number: str | None = None
    pension_plan_name: str | None = None
    work_calendar_mode: str = "new"
    work_calendar_name: str | None = None
    work_calendar_data: str | None = None
    bank_iban: str | None = None
    model_111: str | None = None
    fiscal_regime: str | None = None
    complement_computation: str | None = None
    siltra_enabled: bool = False
    siltra_payment_mode: str | None = None
    siltra_options: str | None = None
    sector_bonuses: str | None = None
    grouped_withholding_company: str | None = None

    @property
    def main_ccc(self) -> str | None:
        return self.ccc


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    cif: str | None = None
    ccc: str | None = None
    ccc_regime: str | None = None
    ccc_code: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    status: str | None = None
    registration_date: date | None = None
    deregistration_date: date | None = None
    main_collective_agreement: str | None = None
    is_cooperative: bool | None = None
    special_work_income_withholding: bool | None = None
    company_type: str | None = None
    legal_representative_name: str | None = None
    legal_representative_dni: str | None = None
    legal_representative_position: str | None = None
    cnae_2009_code: str | None = None
    cnae_2009_name: str | None = None
    cnae_2025_code: str | None = None
    cnae_2025_name: str | None = None
    pension_plan_enabled: bool | None = None
    pension_manager_key: str | None = None
    pension_manager_entity_number: str | None = None
    pension_plan_name: str | None = None
    work_calendar_mode: str | None = None
    work_calendar_name: str | None = None
    work_calendar_data: str | None = None
    bank_iban: str | None = None
    model_111: str | None = None
    fiscal_regime: str | None = None
    complement_computation: str | None = None
    siltra_enabled: bool | None = None
    siltra_payment_mode: str | None = None
    siltra_options: str | None = None
    sector_bonuses: str | None = None
    grouped_withholding_company: str | None = None
    is_active: bool | None = None


class CompanyResponse(CompanyBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
