from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class SalaryTableConceptComparisonItem(BaseModel):
    concept_key: str
    name: str
    source_type: str
    current_contract_concept_id: Optional[int] = None
    current_payroll_concept_id: Optional[int] = None
    current_amount: Optional[Decimal] = None
    target_amount: Optional[Decimal] = None
    difference: Optional[Decimal] = None
    current_active: Optional[bool] = None
    status: str
    selectable: bool = False
    selected_by_default: bool = False
    proposed_action: Literal["upsert", "deactivate", "none"] = "none"
    reason: Optional[str] = None


class SalaryTableContractPreviewItem(BaseModel):
    contract_id: int
    employee_id: int
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    contract_code: Optional[str] = None
    contract_status: str
    professional_category_id: Optional[int] = None
    professional_category_name: Optional[str] = None
    current_salary_table_id: Optional[int] = None
    current_salary_table_name: Optional[str] = None
    target_salary_table_row_id: Optional[int] = None
    target_base_salary: Optional[Decimal] = None
    eligibility: str
    reason: Optional[str] = None
    new_concepts: int = 0
    changed_concepts: int = 0
    reactivated_concepts: int = 0
    unchanged_concepts: int = 0
    obsolete_concepts: int = 0
    preserved_concepts: int = 0
    concept_changes: list[SalaryTableConceptComparisonItem] = Field(default_factory=list)


class SalaryTableActivationPreviewResponse(BaseModel):
    target_table_id: int
    target_table_name: str
    target_table_status: str
    current_active_table_ids: list[int] = Field(default_factory=list)
    current_active_table_names: list[str] = Field(default_factory=list)
    total_contracts: int = 0
    eligible_contracts: int = 0
    already_on_target: int = 0
    blocked_contracts: int = 0
    duplicate_category_rows: list[int] = Field(default_factory=list)
    contracts: list[SalaryTableContractPreviewItem] = Field(default_factory=list)


class SalaryTableActivationResponse(BaseModel):
    target_table_id: int
    target_table_name: str
    target_status: str
    previous_active_table_ids: list[int] = Field(default_factory=list)
    previous_active_table_names: list[str] = Field(default_factory=list)
    message: str


class SalaryTableContractConceptAction(BaseModel):
    contract_id: int
    concept_key: str
    action: Literal["upsert", "deactivate"]


class SalaryTableContractMigrationRequest(BaseModel):
    contract_ids: list[int] = Field(default_factory=list)
    migrate_all_eligible: bool = False
    active_contracts_only: bool = True
    update_salary_base: bool = False
    concept_actions: list[SalaryTableContractConceptAction] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_selection(self):
        if not self.migrate_all_eligible and not self.contract_ids:
            raise ValueError("Selecciona contratos o activa migrate_all_eligible")
        selected_ids = set(self.contract_ids)
        invalid_actions = [
            action.contract_id
            for action in self.concept_actions
            if not self.migrate_all_eligible and action.contract_id not in selected_ids
        ]
        if invalid_actions:
            raise ValueError("Las acciones de conceptos deben pertenecer a contratos seleccionados")
        return self


class SalaryTableContractMigrationSkipped(BaseModel):
    contract_id: int
    reason: str


class SalaryTableConceptActionSkipped(BaseModel):
    contract_id: int
    concept_key: str
    reason: str


class SalaryTableContractMigrationResponse(BaseModel):
    target_table_id: int
    target_table_name: str
    selected_contracts: int = 0
    migrated_contracts: int = 0
    salary_base_updated: int = 0
    concepts_created: int = 0
    concepts_updated: int = 0
    concepts_reactivated: int = 0
    concepts_deactivated: int = 0
    concept_actions_skipped: list[SalaryTableConceptActionSkipped] = Field(default_factory=list)
    skipped_contracts: list[SalaryTableContractMigrationSkipped] = Field(default_factory=list)
    migrated_contract_ids: list[int] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
