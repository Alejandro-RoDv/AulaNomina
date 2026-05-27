from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


class SocialSecurityRegistrationBase(BaseModel):
    situation_code: Optional[str] = None
    situation_description: Optional[str] = None
    registration_date: Optional[date] = None

    contribution_group: Optional[str] = None
    monthly_or_daily_contribution: Optional[str] = None
    disability_degree: Optional[float] = None
    occupation_code: Optional[str] = None
    cno: Optional[str] = None

    worker_collective_code: Optional[str] = None
    unemployed_condition_code: Optional[str] = None
    social_exclusion_or_victim_status: Optional[str] = None

    is_replacement: bool = False
    replacement_cause_code: Optional[str] = None
    replaced_worker_naf: Optional[str] = None

    inactivity_type_code: Optional[str] = None

    working_time_reduction: Optional[float] = None
    initial_ctp: Optional[float] = None

    red_contract_key: Optional[str] = None
    red_occupation_code: Optional[str] = None
    red_contribution_group: Optional[str] = None
    red_reduction_code: Optional[str] = None
    red_special_relation: Optional[str] = None

    @field_validator("monthly_or_daily_contribution")
    @classmethod
    def validate_monthly_or_daily_contribution(cls, value):
        if value is None or value == "":
            return None
        allowed_values = {"monthly", "daily"}
        if value not in allowed_values:
            raise ValueError("monthly_or_daily_contribution debe ser 'monthly' o 'daily'")
        return value

    @field_validator("social_exclusion_or_victim_status")
    @classmethod
    def validate_social_exclusion_or_victim_status(cls, value):
        if value is None or value == "":
            return None
        allowed_values = {
            "none",
            "social_exclusion",
            "human_trafficking_victim",
            "sexual_violence_victim",
        }
        if value not in allowed_values:
            raise ValueError("Valor no permitido para exclusión social/víctimas")
        return value

    @model_validator(mode="after")
    def validate_ss_registration(self):
        if self.situation_code == "1" and self.registration_date is None:
            raise ValueError("registration_date es obligatoria para una situación de alta")

        if self.is_replacement and not self.replacement_cause_code:
            raise ValueError("replacement_cause_code es obligatorio si is_replacement es true")

        if self.working_time_reduction is not None and self.initial_ctp is not None:
            if self.initial_ctp <= self.working_time_reduction:
                raise ValueError("initial_ctp debe ser mayor que working_time_reduction")

        return self


class SocialSecurityRegistrationCreate(SocialSecurityRegistrationBase):
    pass


class SocialSecurityRegistrationUpdate(SocialSecurityRegistrationBase):
    pass


class SocialSecurityRegistrationResponse(SocialSecurityRegistrationBase):
    id: int
    contract_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
