from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.payroll_salary_structure import PayrollItem
from app.schemas.payroll_regularization import PayrollRegularizationRequest, PayrollRegularizationReversalRequest
from app.services.payroll_amounts import money
from app.services.payroll_regularization import (
    apply_payroll_amount_deltas,
    build_regularization_preview,
    create_regularization_items,
    get_payroll_or_404,
    validate_target_payroll,
)

REGULARIZATION_PREFIX = "REGULARIZACION"
REVERSAL_REASON = "REVERSION"
REVERSAL_ENGINE_VERSION = "split-34-regularization-reversal"


def as_money(value: Any) -> Decimal:
    return money(value or Decimal("0.00"))


def parse_regularization_source_key(source_key: str | None) -> dict | None:
    parts = str(source_key or "").split(":")
    if len(parts) < 5 or parts[0] != REGULARIZATION_PREFIX:
        return None
    try:
        payroll_id = int(parts[1])
        sequence = int(parts[2])
        line_index = int(parts[3])
    except (TypeError, ValueError):
        return None
    return {
        "payroll_id": payroll_id,
        "sequence": sequence,
        "line_index": line_index,
        "concept_code": ":".join(parts[4:]),
        "group_key": f"{REGULARIZATION_PREFIX}:{payroll_id}:{sequence}",
    }


def validate_group_key_for_payroll(payroll_id: int, group_key: str) -> str:
    group_key = str(group_key or "").strip()
    parts = group_key.split(":")
    if len(parts) != 3 or parts[0] != REGULARIZATION_PREFIX:
        raise HTTPException(status_code=400, detail="Clave de grupo de regularización no válida")
    try:
        group_payroll_id = int(parts[1])
        int(parts[2])
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Clave de grupo de regularización no válida")
    if group_payroll_id != payroll_id:
        raise HTTPException(status_code=400, detail="La regularización no pertenece a la nómina indicada")
    return group_key


def regularization_items_for_payroll(db: Session, payroll_id: int) -> list[PayrollItem]:
    prefix = f"{REGULARIZATION_PREFIX}:{payroll_id}:"
    return (
        db.query(PayrollItem)
        .options(joinedload(PayrollItem.concept))
        .filter(PayrollItem.payroll_id == payroll_id)
        .filter(PayrollItem.source_key.like(f"{prefix}%"))
        .order_by(PayrollItem.source_key, PayrollItem.id)
        .all()
    )


def regularization_group_items(db: Session, payroll_id: int, group_key: str) -> list[PayrollItem]:
    validated_key = validate_group_key_for_payroll(payroll_id, group_key)
    items = (
        db.query(PayrollItem)
        .options(joinedload(PayrollItem.concept))
        .filter(PayrollItem.payroll_id == payroll_id)
        .filter(PayrollItem.source_key.like(f"{validated_key}:%"))
        .order_by(PayrollItem.source_key, PayrollItem.id)
        .all()
    )
    if not items:
        raise HTTPException(status_code=404, detail="Grupo de regularización no encontrado")
    return items


def item_trace(item: PayrollItem) -> dict:
    return item.calculation_trace or {}


def item_reason(item: PayrollItem) -> str | None:
    return item_trace(item).get("reason")


def item_origin_payroll_id(item: PayrollItem):
    return item_trace(item).get("origin_payroll_id") or item.source_id


def is_reversal_item(item: PayrollItem) -> bool:
    trace = item_trace(item)
    return bool(trace.get("reversal_of") or trace.get("is_reversal") or item_reason(item) == REVERSAL_REASON)


def first_non_empty(values):
    for value in values:
        if value not in (None, ""):
            return value
    return None


def group_key_for_item(item: PayrollItem) -> str | None:
    parsed = parse_regularization_source_key(item.source_key)
    return parsed["group_key"] if parsed else None


def compute_item_group_deltas(items: list[PayrollItem]) -> dict:
    gross_delta = Decimal("0.00")
    deduction_delta = Decimal("0.00")
    company_cost_delta = Decimal("0.00")
    contribution_base_delta = Decimal("0.00")
    irpf_base_delta = Decimal("0.00")

    for item in items:
        concept = item.concept
        code = str(getattr(concept, "code", "") or "").upper()
        concept_type = str(getattr(concept, "concept_type", "") or "").upper()
        amount = as_money(item.amount)
        affects_gross = bool(getattr(concept, "affects_gross", True)) if concept else True
        affects_net = bool(getattr(concept, "affects_net", True)) if concept else True
        is_taxable = bool(getattr(concept, "is_taxable", False)) if concept else False
        is_contribution_base = bool(getattr(concept, "is_contribution_base", False)) if concept else False

        if concept_type == "DEVENGO" and affects_gross:
            gross_delta += amount
            if is_contribution_base:
                contribution_base_delta += amount
            if is_taxable:
                irpf_base_delta += amount
        elif concept_type == "DEDUCCION" and affects_net:
            deduction_delta += amount
        elif code == "REGULARIZACION_COSTE_EMPRESA":
            company_cost_delta += amount

    return {
        "gross_delta": money(gross_delta),
        "deduction_delta": money(deduction_delta),
        "net_delta": money(gross_delta - deduction_delta),
        "company_cost_delta": money(company_cost_delta),
        "contribution_base_delta": money(contribution_base_delta),
        "irpf_base_delta": money(irpf_base_delta),
    }


def list_payroll_regularization_groups(db: Session, payroll_id: int) -> list[dict]:
    get_payroll_or_404(db, payroll_id)
    items = regularization_items_for_payroll(db, payroll_id)
    grouped: dict[str, list[PayrollItem]] = defaultdict(list)
    for item in items:
        key = group_key_for_item(item)
        if key:
            grouped[key].append(item)

    reversed_keys = {
        item_trace(item).get("reversal_of")
        for item in items
        if item_trace(item).get("reversal_of")
    }

    payload = []
    for group_key, group_items in sorted(grouped.items(), key=lambda entry: entry[0]):
        sequence = int(group_key.split(":")[2])
        deltas = compute_item_group_deltas(group_items)
        first = group_items[0]
        traces = [item_trace(item) for item in group_items]
        is_reversal = any(is_reversal_item(item) for item in group_items)
        reversal_of = first_non_empty(trace.get("reversal_of") for trace in traces)
        payload.append({
            "regularization_group_key": group_key,
            "sequence": sequence,
            "item_ids": [item.id for item in group_items],
            "line_count": len(group_items),
            "reason": first_non_empty(item_reason(item) for item in group_items),
            "description": first_non_empty(item.description for item in group_items),
            "origin_payroll_id": first_non_empty(item_origin_payroll_id(item) for item in group_items),
            "gross_delta": deltas["gross_delta"],
            "deduction_delta": deltas["deduction_delta"],
            "net_delta": deltas["net_delta"],
            "company_cost_delta": deltas["company_cost_delta"],
            "is_reversal": is_reversal,
            "reversal_of": reversal_of,
            "has_reversal": group_key in reversed_keys,
        })
    return payload


def build_reversal_request_from_items(
    payroll_id: int,
    group_key: str,
    items: list[PayrollItem],
    request: PayrollRegularizationReversalRequest,
) -> PayrollRegularizationRequest:
    gross_delta = Decimal("0.00")
    employee_deduction_delta = Decimal("0.00")
    irpf_delta = Decimal("0.00")
    company_cost_delta = Decimal("0.00")
    contribution_base_delta = Decimal("0.00")
    irpf_base_delta = Decimal("0.00")

    for item in items:
        concept = item.concept
        code = str(getattr(concept, "code", "") or "").upper()
        concept_type = str(getattr(concept, "concept_type", "") or "").upper()
        amount = as_money(item.amount)
        affects_gross = bool(getattr(concept, "affects_gross", True)) if concept else True
        affects_net = bool(getattr(concept, "affects_net", True)) if concept else True
        is_taxable = bool(getattr(concept, "is_taxable", False)) if concept else False
        is_contribution_base = bool(getattr(concept, "is_contribution_base", False)) if concept else False

        if concept_type == "DEVENGO" and affects_gross:
            gross_delta -= amount
            if is_contribution_base:
                contribution_base_delta -= amount
            if is_taxable:
                irpf_base_delta -= amount
        elif concept_type == "DEDUCCION" and affects_net:
            if code == "REGULARIZACION_IRPF":
                irpf_delta -= amount
            else:
                employee_deduction_delta -= amount
        elif code == "REGULARIZACION_COSTE_EMPRESA":
            company_cost_delta -= amount

    description = request.description or f"Reversión controlada de regularización {group_key}"
    return PayrollRegularizationRequest(
        origin_payroll_id=payroll_id,
        reason=REVERSAL_REASON,
        description=description,
        gross_delta=money(gross_delta),
        employee_deduction_delta=money(employee_deduction_delta),
        irpf_delta=money(irpf_delta),
        company_cost_delta=money(company_cost_delta),
        contribution_base_delta=money(contribution_base_delta),
        irpf_base_delta=money(irpf_base_delta),
        taxable=irpf_base_delta != Decimal("0.00"),
        contribution_base=contribution_base_delta != Decimal("0.00"),
        actor=request.actor,
    )


def has_existing_reversal(db: Session, payroll_id: int, group_key: str) -> bool:
    prefix = f"{REGULARIZATION_PREFIX}:{payroll_id}:"
    items = (
        db.query(PayrollItem)
        .filter(PayrollItem.payroll_id == payroll_id)
        .filter(PayrollItem.source_key.like(f"{prefix}%"))
        .all()
    )
    for item in items:
        if (item.calculation_trace or {}).get("reversal_of") == group_key:
            return True
    return False


def build_reversal_preview(
    db: Session,
    payroll_id: int,
    request: PayrollRegularizationReversalRequest,
) -> dict:
    payroll = get_payroll_or_404(db, payroll_id)
    group_key = validate_group_key_for_payroll(payroll_id, request.regularization_group_key)
    items = regularization_group_items(db, payroll_id, group_key)
    if any(is_reversal_item(item) for item in items):
        raise HTTPException(status_code=400, detail="No se puede revertir directamente una reversión. Selecciona la regularización original.")

    reversal_request = build_reversal_request_from_items(payroll_id, group_key, items, request)
    preview = build_regularization_preview(payroll.id, reversal_request)
    already_reversed = has_existing_reversal(db, payroll_id, group_key)
    if already_reversed:
        preview["warnings"].append("Este grupo ya tiene una reversión registrada. Revisa antes de aplicar otra contra-regularización.")
    if payroll.status in {"closed", "cancelled"}:
        preview["warnings"].append("La nómina destino está cerrada o cancelada; solo puede previsualizarse, no aplicarse.")
    preview["explanation"] = (
        f"Reversión controlada de {group_key}. "
        f"Genera una contra-regularización con neto {preview['net_delta']:.2f}. "
        "No elimina las líneas originales; añade líneas inversas trazables."
    )
    return {
        **preview,
        "regularization_group_key": group_key,
        "source_item_ids": [item.id for item in items],
        "source_line_count": len(items),
        "reversal_of": group_key,
        "already_reversed": already_reversed,
    }


def apply_regularization_reversal(
    db: Session,
    payroll_id: int,
    request: PayrollRegularizationReversalRequest,
) -> dict:
    payroll = get_payroll_or_404(db, payroll_id)
    validate_target_payroll(payroll)
    preview = build_reversal_preview(db, payroll_id, request)
    group_key = preview["regularization_group_key"]
    items = regularization_group_items(db, payroll_id, group_key)
    reversal_request = build_reversal_request_from_items(payroll_id, group_key, items, request)

    try:
        created_ids = create_regularization_items(db, payroll, preview, reversal_request)
        for item in db.query(PayrollItem).filter(PayrollItem.id.in_(created_ids)).all():
            trace = dict(item.calculation_trace or {})
            trace.update({
                "is_reversal": True,
                "reversal_of": group_key,
                "reversal_source_item_ids": preview["source_item_ids"],
                "reversal_reason": reversal_request.reason,
            })
            item.calculation_trace = trace
        apply_payroll_amount_deltas(payroll, preview)
        payroll.calculation_engine_version = REVERSAL_ENGINE_VERSION
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(payroll)
    return {
        **preview,
        "applied": True,
        "created_item_ids": created_ids,
        "regularization_key_prefix": f"{REGULARIZATION_PREFIX}:{payroll.id}",
        "resulting_gross_salary": money(payroll.gross_salary),
        "resulting_total_deductions": money(payroll.total_deductions),
        "resulting_net_salary": money(payroll.net_salary),
        "resulting_company_total_cost": money(payroll.company_total_cost),
    }


__all__ = [
    "apply_regularization_reversal",
    "build_reversal_preview",
    "compute_item_group_deltas",
    "list_payroll_regularization_groups",
    "parse_regularization_source_key",
]
