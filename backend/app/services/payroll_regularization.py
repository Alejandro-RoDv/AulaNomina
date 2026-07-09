from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.schemas.payroll_regularization import PayrollRegularizationRequest
from app.services.payroll_amounts import money

REGULARIZATION_SOURCE = "REGULARIZATION"
REGULARIZATION_CATEGORY = "REGULARIZACION"
TARGET_BLOCKED_STATUSES = {"closed", "cancelled"}
LEGACY_EARNING_CONCEPT_CODE = "REGULARIZACION_DEVENGO"

EARNING_CONCEPT_BY_FLAGS = {
    (True, True): "REGULARIZACION_DEVENGO_COTIZA_TRIBUTA",
    (True, False): "REGULARIZACION_DEVENGO_COTIZA_NO_TRIBUTA",
    (False, True): "REGULARIZACION_DEVENGO_NO_COTIZA_TRIBUTA",
    (False, False): "REGULARIZACION_DEVENGO_NO_COTIZA_NO_TRIBUTA",
}

CONCEPT_DEFINITIONS = {
    LEGACY_EARNING_CONCEPT_CODE: {
        "name": "Regularización de devengos",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "affects_gross": True,
        "affects_net": True,
        "is_taxable": True,
        "is_contribution_base": True,
        "formula": "Importe bruto regularizado por diferencia detectada.",
        "display_order": 9100,
    },
    "REGULARIZACION_DEVENGO_COTIZA_TRIBUTA": {
        "name": "Regularización de devengos cotizable y tributable",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "affects_gross": True,
        "affects_net": True,
        "is_taxable": True,
        "is_contribution_base": True,
        "formula": "Importe bruto regularizado que cotiza y tributa.",
        "display_order": 9100,
    },
    "REGULARIZACION_DEVENGO_COTIZA_NO_TRIBUTA": {
        "name": "Regularización de devengos cotizable no tributable",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "affects_gross": True,
        "affects_net": True,
        "is_taxable": False,
        "is_contribution_base": True,
        "formula": "Importe bruto regularizado que cotiza y no tributa.",
        "display_order": 9101,
    },
    "REGULARIZACION_DEVENGO_NO_COTIZA_TRIBUTA": {
        "name": "Regularización de devengos no cotizable tributable",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "affects_gross": True,
        "affects_net": True,
        "is_taxable": True,
        "is_contribution_base": False,
        "formula": "Importe bruto regularizado que no cotiza y tributa.",
        "display_order": 9102,
    },
    "REGULARIZACION_DEVENGO_NO_COTIZA_NO_TRIBUTA": {
        "name": "Regularización de devengos no cotizable no tributable",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "affects_gross": True,
        "affects_net": True,
        "is_taxable": False,
        "is_contribution_base": False,
        "formula": "Importe bruto regularizado que no cotiza y no tributa.",
        "display_order": 9103,
    },
    "REGULARIZACION_DEDUCCION": {
        "name": "Regularización de deducciones",
        "concept_type": "DEDUCCION",
        "salary_nature": "INFORMATIVA",
        "affects_gross": False,
        "affects_net": True,
        "is_taxable": False,
        "is_contribution_base": False,
        "formula": "Ajuste de deducciones de trabajador por regularización.",
        "display_order": 9110,
    },
    "REGULARIZACION_IRPF": {
        "name": "Regularización de IRPF",
        "concept_type": "DEDUCCION",
        "salary_nature": "INFORMATIVA",
        "affects_gross": False,
        "affects_net": True,
        "is_taxable": False,
        "is_contribution_base": False,
        "formula": "Ajuste de retención IRPF por regularización.",
        "display_order": 9120,
    },
    "REGULARIZACION_COSTE_EMPRESA": {
        "name": "Regularización coste empresa",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "INFORMATIVA",
        "affects_gross": False,
        "affects_net": False,
        "is_taxable": False,
        "is_contribution_base": False,
        "formula": "Ajuste informativo del coste empresarial asociado a la regularización.",
        "display_order": 9130,
    },
}


def as_money(value) -> Decimal:
    return money(value or Decimal("0.00"))


def resolve_delta(value: Decimal | None, fallback: Decimal, enabled: bool) -> Decimal:
    if value is not None:
        return as_money(value)
    return fallback if enabled else Decimal("0.00")


def regularization_earning_concept_code(*, taxable: bool, contribution_base: bool) -> str:
    return EARNING_CONCEPT_BY_FLAGS[(bool(contribution_base), bool(taxable))]


def ensure_regularization_concept(db: Session, code: str) -> PayrollConcept:
    definition = CONCEPT_DEFINITIONS[code]
    concept = db.query(PayrollConcept).filter(PayrollConcept.code == code).first()
    expected_fields = {
        **definition,
        "category": REGULARIZATION_CATEGORY,
        "source_type": REGULARIZATION_SOURCE,
        "calculation_type": "FIXED_AMOUNT",
        "default_amount": Decimal("0.00"),
        "default_unit_price": Decimal("0.00"),
        "applies_workday_percentage": False,
        "is_system": True,
        "is_active": True,
    }
    if concept:
        changed = False
        for field, value in expected_fields.items():
            if getattr(concept, field) != value:
                setattr(concept, field, value)
                changed = True
        if changed:
            db.flush()
        return concept

    concept = PayrollConcept(code=code, **expected_fields)
    db.add(concept)
    db.flush()
    return concept


def line_payload(
    *,
    code: str,
    amount: Decimal,
    taxable: bool,
    contribution_base: bool,
    explanation: str,
) -> dict:
    definition = CONCEPT_DEFINITIONS[code]
    return {
        "code": code,
        "name": definition["name"],
        "concept_type": definition["concept_type"],
        "category": REGULARIZATION_CATEGORY,
        "amount": as_money(amount),
        "affects_gross": bool(definition["affects_gross"]),
        "affects_net": bool(definition["affects_net"]),
        "taxable": bool(taxable),
        "contribution_base": bool(contribution_base),
        "is_taxable": bool(taxable),
        "is_contribution_base": bool(contribution_base),
        "explanation": explanation,
    }


def build_regularization_lines(request: PayrollRegularizationRequest) -> list[dict]:
    gross_delta = as_money(request.gross_delta)
    employee_deduction_delta = as_money(request.employee_deduction_delta)
    irpf_delta = as_money(request.irpf_delta)
    company_cost_delta = as_money(request.company_cost_delta)
    lines: list[dict] = []

    if gross_delta:
        lines.append(
            line_payload(
                code=regularization_earning_concept_code(
                    taxable=request.taxable,
                    contribution_base=request.contribution_base,
                ),
                amount=gross_delta,
                taxable=request.taxable,
                contribution_base=request.contribution_base,
                explanation="Ajuste de bruto generado por la regularización.",
            )
        )
    if employee_deduction_delta:
        lines.append(
            line_payload(
                code="REGULARIZACION_DEDUCCION",
                amount=employee_deduction_delta,
                taxable=False,
                contribution_base=False,
                explanation="Ajuste de deducciones de Seguridad Social u otras deducciones de trabajador.",
            )
        )
    if irpf_delta:
        lines.append(
            line_payload(
                code="REGULARIZACION_IRPF",
                amount=irpf_delta,
                taxable=False,
                contribution_base=False,
                explanation="Ajuste específico de retención IRPF.",
            )
        )
    if company_cost_delta:
        lines.append(
            line_payload(
                code="REGULARIZACION_COSTE_EMPRESA",
                amount=company_cost_delta,
                taxable=False,
                contribution_base=False,
                explanation="Ajuste informativo del coste empresarial adicional o minorado.",
            )
        )
    return lines


def build_regularization_preview(payroll_id: int, request: PayrollRegularizationRequest) -> dict:
    gross_delta = as_money(request.gross_delta)
    employee_deduction_delta = as_money(request.employee_deduction_delta)
    irpf_delta = as_money(request.irpf_delta)
    total_deduction_delta = money(employee_deduction_delta + irpf_delta)
    contribution_base_delta = resolve_delta(request.contribution_base_delta, gross_delta, request.contribution_base)
    irpf_base_delta = resolve_delta(request.irpf_base_delta, gross_delta, request.taxable)
    company_social_security_delta = as_money(request.company_cost_delta)
    company_total_cost_delta = money(gross_delta + company_social_security_delta)
    net_delta = money(gross_delta - total_deduction_delta)
    warnings = []

    if not any([gross_delta, employee_deduction_delta, irpf_delta, company_social_security_delta, contribution_base_delta, irpf_base_delta]):
        warnings.append("La regularización no tiene impacto económico informado.")
    if request.origin_payroll_id == payroll_id:
        warnings.append("La nómina origen coincide con la nómina destino; revisa si realmente es una regularización retroactiva.")
    if gross_delta < 0:
        warnings.append("El bruto regularizado es negativo; se interpretará como minoración del devengo.")
    if total_deduction_delta < 0:
        warnings.append("Las deducciones regularizadas son negativas; se interpretará como devolución al trabajador.")

    explanation = (
        f"Regularización {request.reason}: bruto {gross_delta:.2f}, "
        f"deducciones {total_deduction_delta:.2f}, neto {net_delta:.2f}. "
        "La nómina origen no se reabre; el ajuste se aplica como línea trazable en la nómina destino."
    )

    return {
        "target_payroll_id": payroll_id,
        "origin_payroll_id": request.origin_payroll_id,
        "reason": request.reason,
        "description": request.description,
        "gross_delta": gross_delta,
        "employee_deduction_delta": employee_deduction_delta,
        "irpf_delta": irpf_delta,
        "total_deduction_delta": total_deduction_delta,
        "contribution_base_delta": contribution_base_delta,
        "irpf_base_delta": irpf_base_delta,
        "company_social_security_delta": company_social_security_delta,
        "company_total_cost_delta": company_total_cost_delta,
        "net_delta": net_delta,
        "lines": build_regularization_lines(request),
        "warnings": warnings,
        "explanation": explanation,
    }


def get_payroll_or_404(db: Session, payroll_id: int) -> Payroll:
    payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return payroll


def validate_target_payroll(payroll: Payroll):
    if payroll.status in TARGET_BLOCKED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="No se puede aplicar una regularización sobre una nómina cerrada o cancelada. Usa una nómina destino abierta.",
        )


def extract_regularization_sequence(source_key: str | None, payroll_id: int) -> int | None:
    parts = str(source_key or "").split(":")
    if len(parts) < 3 or parts[0] != "REGULARIZACION":
        return None
    try:
        key_payroll_id = int(parts[1])
        sequence = int(parts[2])
    except (TypeError, ValueError):
        return None
    if key_payroll_id != payroll_id:
        return None
    return sequence


def source_key_from_row(row: Any) -> str | None:
    if isinstance(row, str):
        return row
    try:
        return row[0]
    except (TypeError, KeyError, IndexError):
        return getattr(row, "source_key", None)


def next_regularization_sequence(db: Session, payroll_id: int) -> int:
    prefix = f"REGULARIZACION:{payroll_id}:"
    rows = db.query(PayrollItem.source_key).filter(PayrollItem.source_key.like(f"{prefix}%")).all()
    sequences = [
        sequence
        for row in rows
        for sequence in [extract_regularization_sequence(source_key_from_row(row), payroll_id)]
        if sequence is not None
    ]
    return max(sequences, default=0) + 1


def apply_payroll_amount_deltas(payroll: Payroll, preview: dict):
    payroll.gross_salary = money(payroll.gross_salary + preview["gross_delta"])
    payroll.common_contingencies_base = money(payroll.common_contingencies_base + preview["contribution_base_delta"])
    payroll.professional_contingencies_base = money(payroll.professional_contingencies_base + preview["contribution_base_delta"])
    payroll.unemployment_training_fogasa_base = money(payroll.unemployment_training_fogasa_base + preview["contribution_base_delta"])
    payroll.irpf_base = money(payroll.irpf_base + preview["irpf_base_delta"])
    payroll.employee_social_security = money(payroll.employee_social_security + preview["employee_deduction_delta"])
    payroll.irpf = money(payroll.irpf + preview["irpf_delta"])
    payroll.total_deductions = money(payroll.total_deductions + preview["total_deduction_delta"])
    payroll.net_salary = money(payroll.gross_salary - payroll.total_deductions)
    payroll.company_total_social_security = money(payroll.company_total_social_security + preview["company_social_security_delta"])
    payroll.company_total_cost = money(payroll.company_total_cost + preview["company_total_cost_delta"])
    payroll.calculation_version = int(payroll.calculation_version or 0) + 1
    payroll.calculation_engine_version = "split-34-regularization"


def create_regularization_items(db: Session, payroll: Payroll, preview: dict, request: PayrollRegularizationRequest) -> list[int]:
    sequence = next_regularization_sequence(db, payroll.id)
    created_ids = []
    for index, line in enumerate(preview["lines"], start=1):
        concept = ensure_regularization_concept(db, line["code"])
        item = PayrollItem(
            payroll_id=payroll.id,
            concept_id=concept.id,
            description=request.description,
            quantity=Decimal("1.00"),
            unit_price=line["amount"],
            amount=line["amount"],
            display_order=concept.display_order,
            notes=preview["explanation"],
            source_type="regularization",
            source_id=request.origin_payroll_id,
            source_key=f"REGULARIZACION:{payroll.id}:{sequence}:{index}:{line['code']}",
            is_automatic=True,
            calculation_trace={
                "reason": request.reason,
                "origin_payroll_id": request.origin_payroll_id,
                "actor": request.actor,
                "concept_code": line["code"],
                "taxable": bool(line["taxable"]),
                "contribution_base": bool(line["contribution_base"]),
                "gross_delta": str(preview["gross_delta"]),
                "total_deduction_delta": str(preview["total_deduction_delta"]),
                "net_delta": str(preview["net_delta"]),
                "explanation": line["explanation"],
            },
        )
        db.add(item)
        db.flush()
        created_ids.append(item.id)
    return created_ids


def preview_payroll_regularization(db: Session, payroll_id: int, request: PayrollRegularizationRequest) -> dict:
    payroll = get_payroll_or_404(db, payroll_id)
    if request.origin_payroll_id:
        get_payroll_or_404(db, request.origin_payroll_id)
    preview = build_regularization_preview(payroll.id, request)
    if payroll.status in TARGET_BLOCKED_STATUSES:
        preview["warnings"].append("La nómina destino está cerrada o cancelada; solo puede previsualizarse, no aplicarse.")
    return preview


def apply_payroll_regularization(db: Session, payroll_id: int, request: PayrollRegularizationRequest) -> dict:
    payroll = get_payroll_or_404(db, payroll_id)
    validate_target_payroll(payroll)
    if request.origin_payroll_id:
        get_payroll_or_404(db, request.origin_payroll_id)
    preview = build_regularization_preview(payroll.id, request)
    try:
        created_ids = create_regularization_items(db, payroll, preview, request)
        apply_payroll_amount_deltas(payroll, preview)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(payroll)
    return {
        **preview,
        "applied": True,
        "created_item_ids": created_ids,
        "regularization_key_prefix": f"REGULARIZACION:{payroll.id}",
        "resulting_gross_salary": money(payroll.gross_salary),
        "resulting_total_deductions": money(payroll.total_deductions),
        "resulting_net_salary": money(payroll.net_salary),
        "resulting_company_total_cost": money(payroll.company_total_cost),
    }


__all__ = [
    "apply_payroll_regularization",
    "build_regularization_preview",
    "extract_regularization_sequence",
    "next_regularization_sequence",
    "preview_payroll_regularization",
    "regularization_earning_concept_code",
]
