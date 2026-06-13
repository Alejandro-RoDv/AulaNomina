from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class AgreementContractSyncRequest(BaseModel):
    overwrite_salary_base: bool = False
    reactivate_inactive: bool = True


class AgreementContractSyncResponse(BaseModel):
    contract_id: int
    agreement_id: int
    agreement_name: Optional[str] = None
    professional_category_id: Optional[int] = None
    salary_table_id: Optional[int] = None
    salary_table_row_id: Optional[int] = None
    salary_table_row_linked: bool = False
    agreement_salary_concepts_found: int = 0
    resolved_candidates: int = 0
    salary_base_updated: bool = False
    salary_base_preserved: bool = False
    salary_base_amount: Optional[Decimal] = None
    payroll_concepts_created: int = 0
    payroll_concepts_updated: int = 0
    contract_concepts_created: int = 0
    contract_concepts_reactivated: int = 0
    contract_concepts_skipped: int = 0
    imported_names: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
