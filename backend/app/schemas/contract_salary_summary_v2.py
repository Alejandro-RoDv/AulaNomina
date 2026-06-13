from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.schemas.contract import ContractSalaryConceptLine


class ContractSalarySummaryResponse(BaseModel):
    contract_id: int
    employee_name: Optional[str] = None
    working_day_type: Optional[str] = None
    pay_schedule: Optional[str] = None
    weekly_hours: Decimal = Decimal("0.00")
    monthly_hours: Decimal = Decimal("0.00")
    annual_hours: Decimal = Decimal("0.00")
    annual_agreement_hours: Decimal = Decimal("0.00")
    full_time_weekly_hours: Decimal = Decimal("40.00")
    partiality_coefficient: Decimal = Decimal("100.00")
    salary_base_theoretical: Decimal = Decimal("0.00")
    salary_base_applied: Decimal = Decimal("0.00")
    permanent_concepts_original: Decimal = Decimal("0.00")
    permanent_concepts_applied: Decimal = Decimal("0.00")
    ordinary_monthly_remuneration: Decimal = Decimal("0.00")
    monthly_extra_pay_proration: Decimal = Decimal("0.00")
    monthly_remuneration: Decimal = Decimal("0.00")
    annual_remuneration: Decimal = Decimal("0.00")
    estimated_company_social_security: Decimal = Decimal("0.00")
    estimated_company_cost: Decimal = Decimal("0.00")
    concept_lines: list[ContractSalaryConceptLine] = []


class ContractWorkdaySimulationResponse(BaseModel):
    contract_id: int
    before: ContractSalarySummaryResponse
    after: ContractSalarySummaryResponse
    annual_difference: Decimal = Decimal("0.00")
    monthly_difference: Decimal = Decimal("0.00")
