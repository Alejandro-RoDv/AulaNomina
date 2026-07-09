from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.services.payroll_amounts import money
from app.services.payroll_receipt import (
    build_warnings,
    get_payroll_receipt,
    line_explanations_payload,
    line_from_item,
    split_lines,
    totals_payload,
)

REGULARIZATION_CATEGORY = "REGULARIZACION"
REGULARIZATION_CODE_PREFIX = "REGULARIZACION_"
REGULARIZATION_SOURCE_TYPE = "regularization"
REGULARIZATION_COST_CODE = "REGULARIZACION_COSTE_EMPRESA"


def as_decimal(value: Any) -> Decimal:
    return money(value or Decimal("0.00"))


def safe_trace(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def is_regularization_line(line: dict) -> bool:
    code = str(line.get("code") or "").upper()
    category = str(line.get("category") or "").upper()
    source_type = str(line.get("source_type") or "").lower()
    trace = safe_trace(line.get("trace"))
    return bool(
        code.startswith(REGULARIZATION_CODE_PREFIX)
        or category == REGULARIZATION_CATEGORY
        or source_type == REGULARIZATION_SOURCE_TYPE
        or trace.get("reason")
    )


def is_regularization_item(item: PayrollItem, payroll_id: int) -> bool:
    concept = item.concept
    code = str(getattr(concept, "code", "") or "").upper()
    category = str(getattr(concept, "category", "") or "").upper()
    source_type = str(item.source_type or "").lower()
    source_key = str(item.source_key or "")
    return bool(
        source_key.startswith(f"REGULARIZACION:{payroll_id}:")
        or source_type == REGULARIZATION_SOURCE_TYPE
        or category == REGULARIZATION_CATEGORY
        or code.startswith(REGULARIZATION_CODE_PREFIX)
    )


def regularization_items(db: Session, payroll_id: int) -> list[PayrollItem]:
    items = (
        db.query(PayrollItem)
        .options(joinedload(PayrollItem.concept))
        .filter(PayrollItem.payroll_id == payroll_id)
        .order_by(PayrollItem.display_order, PayrollItem.id)
        .all()
    )
    return [item for item in items if is_regularization_item(item, payroll_id)]


def enrich_regularization_line(line: dict) -> dict:
    trace = safe_trace(line.get("trace"))
    enriched = dict(line)
    enriched["trace"] = trace
    enriched["is_regularization"] = True
    enriched["regularization_reason"] = trace.get("reason")
    enriched["origin_payroll_id"] = trace.get("origin_payroll_id")
    enriched["actor"] = trace.get("actor")
    return enriched


def append_missing_regularization_lines(receipt: dict, regularization_lines: list[dict]) -> list[dict]:
    current_lines = []
    for section in ["earnings", "deductions", "base_lines", "company_cost_lines", "informative_lines"]:
        current_lines.extend(receipt.get(section) or [])

    existing_ids = {line.get("id") for line in current_lines if line.get("id") is not None}
    existing_codes = {line.get("code") for line in current_lines if line.get("id") is None}
    combined = [enrich_regularization_line(line) if is_regularization_line(line) else line for line in current_lines]

    for line in regularization_lines:
        if line.get("id") in existing_ids:
            continue
        if line.get("id") is None and line.get("code") in existing_codes:
            continue
        combined.append(enrich_regularization_line(line))
    return combined


def split_receipt_lines_with_regularizations(lines: list[dict]):
    earnings, deductions, base_lines, company_cost_lines, informative_lines = split_lines(lines)
    cost_ids = {line.get("id") for line in company_cost_lines if line.get("id") is not None}
    remaining_informative = []
    for line in informative_lines:
        if is_regularization_line(line) and str(line.get("code") or "").upper() == REGULARIZATION_COST_CODE:
            if line.get("id") not in cost_ids:
                company_cost_lines.append(line)
                cost_ids.add(line.get("id"))
            continue
        remaining_informative.append(line)
    sort_key = lambda item: (int(item.get("display_order") or 0), item.get("code") or "")
    return (
        sorted(earnings, key=sort_key),
        sorted(deductions, key=sort_key),
        sorted(base_lines, key=sort_key),
        sorted(company_cost_lines, key=sort_key),
        sorted(remaining_informative, key=sort_key),
    )


def regularization_explanations_payload(lines: list[dict]) -> list[dict]:
    explanations = []
    for line in [item for item in lines if is_regularization_line(item)]:
        trace = safe_trace(line.get("trace"))
        amount = as_decimal(line.get("amount"))
        reason = trace.get("reason") or line.get("regularization_reason") or "MANUAL"
        origin_payroll_id = trace.get("origin_payroll_id") or line.get("origin_payroll_id")
        concept_type = str(line.get("concept_type") or "INFORMATIVO").upper()
        if concept_type == "DEDUCCION":
            effect = "incrementa o reduce las deducciones del trabajador"
        elif concept_type == "DEVENGO":
            effect = "incrementa o reduce el bruto regularizado"
        elif str(line.get("code") or "").upper() == REGULARIZATION_COST_CODE:
            effect = "informa el ajuste de coste empresarial"
        else:
            effect = "documenta un ajuste informativo"
        origin_text = f" vinculada a la nómina origen {origin_payroll_id}" if origin_payroll_id else " sin nómina origen específica"
        explanations.append({
            "line_id": line.get("id"),
            "code": line.get("code") or "REGULARIZACION",
            "name": line.get("name") or "Regularización",
            "amount": amount,
            "concept_type": concept_type,
            "reason": reason,
            "origin_payroll_id": origin_payroll_id,
            "source_type": line.get("source_type") or REGULARIZATION_SOURCE_TYPE,
            "explanation": (
                f"{line.get('name') or line.get('code')} por {amount:.2f} € {effect}. "
                f"Motivo: {reason}.{origin_text}. No reabre la nómina histórica; se muestra como ajuste trazable en esta nómina."
            ),
            "learning_points": [
                "Una regularización corrige una diferencia de periodos anteriores sin sobrescribir la nómina original.",
                "Debe separarse de los conceptos ordinarios para poder auditar el motivo y el periodo afectado.",
                "El impacto puede afectar bruto, deducciones, bases, IRPF o coste empresa según el tipo de línea.",
            ],
        })
    return explanations


def regularization_summary_payload(lines: list[dict]) -> dict:
    regularization_lines = [line for line in lines if is_regularization_line(line)]
    gross_delta = Decimal("0.00")
    deduction_delta = Decimal("0.00")
    company_cost_delta = Decimal("0.00")
    base_delta = Decimal("0.00")
    reasons = []
    origin_ids = []

    for line in regularization_lines:
        amount = as_decimal(line.get("amount"))
        concept_type = str(line.get("concept_type") or "").upper()
        code = str(line.get("code") or "").upper()
        trace = safe_trace(line.get("trace"))
        if concept_type == "DEVENGO" and line.get("affects_gross"):
            gross_delta += amount
        elif concept_type == "DEDUCCION" and line.get("affects_net"):
            deduction_delta += amount
        elif code == REGULARIZATION_COST_CODE:
            company_cost_delta += amount
        elif line.get("contribution_base") or line.get("taxable"):
            base_delta += amount
        reason = trace.get("reason") or line.get("regularization_reason")
        if reason and reason not in reasons:
            reasons.append(reason)
        origin_id = trace.get("origin_payroll_id") or line.get("origin_payroll_id")
        if origin_id and origin_id not in origin_ids:
            origin_ids.append(origin_id)

    net_delta = money(gross_delta - deduction_delta)
    has_regularizations = bool(regularization_lines)
    if has_regularizations:
        explanation = (
            f"La nómina incluye {len(regularization_lines)} línea(s) de regularización. "
            f"Impacto neto estimado: {net_delta:.2f} €. "
            "Estas líneas corrigen diferencias sin modificar la nómina origen."
        )
    else:
        explanation = "La nómina no contiene líneas de regularización."

    return {
        "has_regularizations": has_regularizations,
        "regularization_count": len(regularization_lines),
        "gross_delta": money(gross_delta),
        "deduction_delta": money(deduction_delta),
        "net_delta": net_delta,
        "company_cost_delta": money(company_cost_delta),
        "base_delta": money(base_delta),
        "reasons": reasons,
        "origin_payroll_ids": origin_ids,
        "explanation": explanation,
    }


def enrich_line_explanations_with_regularization_flags(explanations: list[dict]) -> list[dict]:
    enriched = []
    for item in explanations:
        is_regularization = str(item.get("category") or "").upper() == REGULARIZATION_CATEGORY or str(item.get("code") or "").upper().startswith(REGULARIZATION_CODE_PREFIX)
        if is_regularization:
            updated = dict(item)
            updated["is_regularization"] = True
            updated["learning_points"] = [
                *updated.get("learning_points", []),
                "Esta línea no forma parte de la nómina ordinaria: es un ajuste retroactivo trazable.",
            ]
            updated["explanation"] = f"{updated['explanation']} Se identifica como regularización para separarla de los conceptos ordinarios."
            enriched.append(updated)
        else:
            enriched.append(item)
    return enriched


def get_payroll_receipt_with_regularization_trace(db: Session, payroll_id: int) -> dict:
    receipt = get_payroll_receipt(db, payroll_id)
    payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not payroll:
        return receipt

    regularization_lines = [line_from_item(item) for item in regularization_items(db, payroll_id)]
    combined_lines = append_missing_regularization_lines(receipt, regularization_lines)
    earnings, deductions, base_lines, company_cost_lines, informative_lines = split_receipt_lines_with_regularizations(combined_lines)

    receipt.update({
        "earnings": earnings,
        "deductions": deductions,
        "base_lines": base_lines,
        "company_cost_lines": company_cost_lines,
        "informative_lines": informative_lines,
        "line_explanations": enrich_line_explanations_with_regularization_flags(line_explanations_payload(combined_lines)),
        "regularization_summary": regularization_summary_payload(combined_lines),
        "regularization_explanations": regularization_explanations_payload(combined_lines),
        "totals": totals_payload(payroll, combined_lines),
        "warnings": build_warnings(payroll, combined_lines),
    })
    return receipt


__all__ = [
    "get_payroll_receipt_with_regularization_trace",
    "is_regularization_line",
    "regularization_summary_payload",
    "regularization_explanations_payload",
    "safe_trace",
]
