from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.models.incident_calculation import PayrollSegment
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.incident_payroll_result import PayrollComponentAdjustment
from app.services.incident_payroll_segments import AUTOMATIC_SOURCE
from app.services.incident_segmenter import money


def _concept_spec(name: str, category: str, concept_type: str, *, taxable: bool, contribution_base: bool, display_order: int) -> dict[str, Any]:
    return {
        "name": name,
        "category": category,
        "concept_type": concept_type,
        "salary_nature": "SALARIAL",
        "is_taxable": taxable,
        "is_contribution_base": contribution_base,
        "display_order": display_order,
    }


CONCEPT_SPECS = {
    "INC_SALARY_REDUCTION_INFO": _concept_spec(
        "Reducción salarial por incidencia", "INCIDENCIA", "BASE_INFORMATIVA",
        taxable=False, contribution_base=False, display_order=700,
    ),
    "INC_IT_BENEFIT": _concept_spec(
        "Prestación por incapacidad temporal", "PRESTACION_IT", "DEVENGO",
        taxable=True, contribution_base=False, display_order=710,
    ),
    "INC_IT_COMPANY_COMPLEMENT": _concept_spec(
        "Complemento empresarial de IT", "COMPLEMENTO_IT", "DEVENGO",
        taxable=True, contribution_base=True, display_order=720,
    ),
    "INC_OVERTIME": _concept_spec(
        "Horas extraordinarias", "HORAS_EXTRA", "DEVENGO",
        taxable=True, contribution_base=False, display_order=730,
    ),
    "INC_VACATION_INFO": _concept_spec(
        "Vacaciones disfrutadas", "VACACIONES", "BASE_INFORMATIVA",
        taxable=False, contribution_base=False, display_order=740,
    ),
    "INC_PAID_LEAVE_INFO": _concept_spec(
        "Permiso retribuido", "PERMISO", "BASE_INFORMATIVA",
        taxable=False, contribution_base=False, display_order=741,
    ),
    "INC_OVERTIME_REST_INFO": _concept_spec(
        "Horas extra compensadas con descanso", "HORAS_EXTRA", "BASE_INFORMATIVA",
        taxable=False, contribution_base=False, display_order=742,
    ),
    "INC_SUPPLEMENTS_REDUCTION_INFO": _concept_spec(
        "Reducción de complementos salariales", "INCIDENCIA", "BASE_INFORMATIVA",
        taxable=False, contribution_base=False, display_order=750,
    ),
    "INC_SENIORITY_REDUCTION_INFO": _concept_spec(
        "Reducción de antigüedad", "INCIDENCIA", "BASE_INFORMATIVA",
        taxable=False, contribution_base=False, display_order=751,
    ),
    "INC_INCENTIVES_REDUCTION_INFO": _concept_spec(
        "Reducción de incentivos", "INCIDENCIA", "BASE_INFORMATIVA",
        taxable=False, contribution_base=False, display_order=752,
    ),
    "INC_EXTRA_PRORATION_REDUCTION_INFO": _concept_spec(
        "Reducción de prorrata de pagas extra", "INCIDENCIA", "BASE_INFORMATIVA",
        taxable=False, contribution_base=False, display_order=753,
    ),
}


COMPONENT_REDUCTION_CONCEPTS = {
    "salary_supplements": ("INC_SUPPLEMENTS_REDUCTION_INFO", "Complementos salariales"),
    "seniority_amount": ("INC_SENIORITY_REDUCTION_INFO", "Antigüedad"),
    "variable_incentives": ("INC_INCENTIVES_REDUCTION_INFO", "Incentivos"),
    "extra_pay_proration": ("INC_EXTRA_PRORATION_REDUCTION_INFO", "Prorrata de pagas extra"),
}


def ensure_incident_concepts(db: Session) -> dict[str, PayrollConcept]:
    existing = {
        concept.code: concept
        for concept in db.query(PayrollConcept).filter(PayrollConcept.code.in_(CONCEPT_SPECS)).all()
    }
    for code, spec in CONCEPT_SPECS.items():
        if code in existing:
            continue
        concept = PayrollConcept(
            code=code,
            source_type="SYSTEM",
            calculation_type="INCIDENT_ENGINE",
            default_amount=0,
            default_unit_price=0,
            applies_workday_percentage=False,
            is_system=True,
            is_active=True,
            notes="Concepto automático generado por el motor de incidencias.",
            **spec,
        )
        db.add(concept)
        db.flush()
        existing[code] = concept
    return existing


def segment_item_specs(segment: PayrollSegment) -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    trace = segment.calculation_trace or {}
    if Decimal(str(segment.deduction_amount or 0)) > 0:
        specs.append({
            "code": "INC_SALARY_REDUCTION_INFO",
            "quantity": segment.payroll_days,
            "unit_price": segment.daily_salary_base,
            "amount": segment.deduction_amount,
            "description": f"Reducción salarial {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
        })
    if Decimal(str(segment.benefit_amount or 0)) > 0:
        specs.append({
            "code": "INC_IT_BENEFIT",
            "quantity": segment.calendar_days,
            "unit_price": money(
                Decimal(str(segment.daily_regulatory_base or 0))
                * Decimal(str(segment.benefit_percentage or 0))
            ),
            "amount": segment.benefit_amount,
            "description": f"Prestación IT {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
        })
    if Decimal(str(segment.complement_amount or 0)) > 0:
        specs.append({
            "code": "INC_IT_COMPANY_COMPLEMENT",
            "quantity": segment.calendar_days,
            "unit_price": money(
                Decimal(str(segment.daily_salary_base or 0))
                * Decimal(str(segment.complement_percentage or 0))
            ),
            "amount": segment.complement_amount,
            "description": f"Complemento IT {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
        })
    if segment.segment_type == "vacation":
        specs.append({
            "code": "INC_VACATION_INFO", "quantity": segment.calendar_days,
            "unit_price": 0, "amount": 0,
            "description": f"Vacaciones {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
        })
    if segment.segment_type == "paid_leave":
        specs.append({
            "code": "INC_PAID_LEAVE_INFO", "quantity": segment.calendar_days,
            "unit_price": 0, "amount": 0,
            "description": f"Permiso retribuido {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
        })
    if segment.segment_type == "overtime":
        specs.append({
            "code": "INC_OVERTIME",
            "quantity": Decimal(str(trace.get("hours") or 0)),
            "unit_price": Decimal(str(trace.get("unit_price") or 0)),
            "amount": segment.salary_amount,
            "description": f"Horas extraordinarias {segment.start_date:%d/%m/%Y}",
        })
    if segment.segment_type == "overtime_rest":
        specs.append({
            "code": "INC_OVERTIME_REST_INFO",
            "quantity": Decimal(str(trace.get("hours") or 0)),
            "unit_price": 0, "amount": 0,
            "description": f"Horas extra compensadas con descanso {segment.start_date:%d/%m/%Y}",
        })
    return specs


def component_adjustment_specs(adjustments: Iterable[PayrollComponentAdjustment]) -> list[dict[str, Any]]:
    specs = []
    for adjustment in adjustments:
        if adjustment.reduction_amount <= 0:
            continue
        code, label = COMPONENT_REDUCTION_CONCEPTS[adjustment.field]
        specs.append({
            "field": adjustment.field,
            "code": code,
            "quantity": Decimal("1"),
            "unit_price": adjustment.reduction_amount,
            "amount": adjustment.reduction_amount,
            "description": f"{label}: reducción por incidencias",
            "trace": adjustment.to_dict(),
        })
    return specs


def _upsert_automatic_item(db: Session, payroll: Payroll, existing: dict[str, PayrollItem], desired_keys: set[str], concepts: dict[str, PayrollConcept], source_key: str, spec: dict[str, Any], *, source_id: int | None, segment_id: int | None, trace: dict[str, Any]) -> tuple[int, int]:
    desired_keys.add(source_key)
    item = existing.get(source_key)
    concept = concepts[spec["code"]]
    values = {
        "concept_id": concept.id,
        "description": spec["description"],
        "quantity": spec["quantity"],
        "unit_price": spec["unit_price"],
        "amount": spec["amount"],
        "display_order": concept.display_order,
        "notes": "Línea automática; no editar manualmente.",
        "source_id": source_id,
        "segment_id": segment_id,
        "is_automatic": True,
        "calculation_trace": trace,
    }
    if item is None:
        db.add(PayrollItem(
            payroll_id=payroll.id,
            source_type=AUTOMATIC_SOURCE,
            source_key=source_key,
            **values,
        ))
        return 1, 0
    for field, value in values.items():
        setattr(item, field, value)
    item.updated_at = datetime.utcnow()
    return 0, 1


def sync_payroll_items(db: Session, payroll: Payroll, segments: dict[str, PayrollSegment], concepts: dict[str, PayrollConcept], component_adjustments: Iterable[PayrollComponentAdjustment] = ()) -> tuple[int, int, int]:
    existing = {
        item.source_key: item
        for item in db.query(PayrollItem).filter(
            PayrollItem.payroll_id == payroll.id,
            PayrollItem.source_type == AUTOMATIC_SOURCE,
        ).all()
        if item.source_key
    }
    desired_keys: set[str] = set()
    created = 0
    updated = 0

    for segment in segments.values():
        for spec in segment_item_specs(segment):
            added, changed = _upsert_automatic_item(
                db, payroll, existing, desired_keys, concepts,
                f"{segment.segment_key}:{spec['code']}", spec,
                source_id=segment.incident_id,
                segment_id=segment.id,
                trace=segment.calculation_trace or {},
            )
            created += added
            updated += changed

    for spec in component_adjustment_specs(component_adjustments):
        added, changed = _upsert_automatic_item(
            db, payroll, existing, desired_keys, concepts,
            f"payroll:{payroll.id}:component:{spec['field']}:reduction", spec,
            source_id=None,
            segment_id=None,
            trace=spec["trace"],
        )
        created += added
        updated += changed

    stale = [item for key, item in existing.items() if key not in desired_keys]
    for item in stale:
        db.delete(item)
    db.flush()
    return created, updated, len(stale)


__all__ = [
    "COMPONENT_REDUCTION_CONCEPTS",
    "CONCEPT_SPECS",
    "component_adjustment_specs",
    "ensure_incident_concepts",
    "segment_item_specs",
    "sync_payroll_items",
]
