from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


REGULARIZATION_REASON_VALUES = {
    "INCIDENCIA_TARDIA",
    "BAJA_TARDIA",
    "CAMBIO_SALARIAL",
    "ANTIGUEDAD",
    "CONVENIO",
    "IRPF",
    "SEGURIDAD_SOCIAL",
    "MANUAL",
}


class PayrollRegularizationRequest(BaseModel):
    origin_payroll_id: Optional[int] = None
    reason: str = "MANUAL"
    description: str
    gross_delta: Decimal = Decimal("0.00")
    employee_deduction_delta: Decimal = Decimal("0.00")
    irpf_delta: Decimal = Decimal("0.00")
    company_cost_delta: Decimal = Decimal("0.00")
    contribution_base_delta: Optional[Decimal] = None
    irpf_base_delta: Optional[Decimal] = None
    taxable: bool = True
    contribution_base: bool = True
    actor: str = "regularization"

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value):
        value = value.strip().upper()
        if value not in REGULARIZATION_REASON_VALUES:
            raise ValueError("Motivo de regularización no válido")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("La descripción de la regularización es obligatoria")
        return value


class PayrollRegularizationLine(BaseModel):
    code: str
    name: str
    concept_type: str
    category: str = "REGULARIZACION"
    amount: Decimal = Decimal("0.00")
    affects_gross: bool = False
    affects_net: bool = True
    taxable: bool = False
    contribution_base: bool = False
    explanation: str


class PayrollRegularizationPreviewResponse(BaseModel):
    target_payroll_id: int
    origin_payroll_id: Optional[int] = None
    reason: str
    description: str
    gross_delta: Decimal = Decimal("0.00")
    employee_deduction_delta: Decimal = Decimal("0.00")
    irpf_delta: Decimal = Decimal("0.00")
    total_deduction_delta: Decimal = Decimal("0.00")
    contribution_base_delta: Decimal = Decimal("0.00")
    irpf_base_delta: Decimal = Decimal("0.00")
    company_social_security_delta: Decimal = Decimal("0.00")
    company_total_cost_delta: Decimal = Decimal("0.00")
    net_delta: Decimal = Decimal("0.00")
    lines: list[PayrollRegularizationLine]
    warnings: list[str] = []
    explanation: str


class PayrollRegularizationApplyResponse(PayrollRegularizationPreviewResponse):
    applied: bool = True
    created_item_ids: list[int] = []
    regularization_key_prefix: str
    resulting_gross_salary: Decimal = Decimal("0.00")
    resulting_total_deductions: Decimal = Decimal("0.00")
    resulting_net_salary: Decimal = Decimal("0.00")
    resulting_company_total_cost: Decimal = Decimal("0.00")
