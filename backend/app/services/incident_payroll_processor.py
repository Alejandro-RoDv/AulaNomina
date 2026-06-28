from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.incident import Incident
from app.models.incident_calculation import PayrollSegment
from app.models.incident_detail import IncidentDetail
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.incident_segmenter import build_incident_segments, money
from app.services.incident_service import incident_snapshot, register_incident_audit


AUTOMATIC_SOURCE = "incident_engine"


CONCEPT_SPECS: dict[str, dict[str, Any]] = {
    "INC_SALARY_REDUCTION_INFO": {
        "name": "Reducción salarial por incidencia",
        "category": "INCIDENCIA",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "SALARIAL",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 700,
    },
    "INC_IT_BENEFIT": {
        "name": "Prestación por incapacidad temporal",
        "category": "PRESTACION_IT",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": False,
        "display_order": 710,
    },
    "INC_IT_COMPANY_COMPLEMENT": {
        "name": "Complemento empresarial de IT",
        "category": "COMPLEMENTO_IT",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 720,
    },
    "INC_OVERTIME": {
        "name": "Horas extraordinarias",
        "category": "HORAS_EXTRA",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": False,
        "display_order": 730,
    },
    "INC_VACATION_INFO": {
        "name": "Vacaciones disfrutadas",
        "category": "VACACIONES",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "SALARIAL",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 740,
    },
    "INC_PAID_LEAVE_INFO": {
        "name": "Permiso retribuido",
        "category": "PERMISO",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "SALARIAL",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 741,
    },
    "INC_OVERTIME_REST_INFO": {
        "name": "Horas extra compensadas con descanso",
        "category": "HORAS_EXTRA",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "SALARIAL",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 742,
    },
}


def ensure_incident_concepts(db: Session) -> dict[str, PayrollConcept]:
    existing = {
        concept.code: concept
        for concept in db.query(PayrollConcept).filter(PayrollConcept.code.in_(CONCEPT_SPECS)).all()
    }
    for code, spec in CONCEPT_SPECS.items():
        concept = existing.get(code)
        if concept:
            continue
        concept = PayrollConcept(
            code=code,
            name=spec["name"],
            category=spec["category"],
            concept_type=spec["concept_type"],
            salary_nature=spec["salary_nature"],
            source_type="SYSTEM",
            calculation_type="INCIDENT_ENGINE",
            default_amount=0,
            default_unit_price=0,
            applies_workday_percentage=False,
            is_system=True,
            is_taxable=spec["is_taxable"],
            is_contribution_base=spec["is_contribution_base"],
            is_active=True,
            display_order=spec["display_order"],
            notes="Concepto automático generado por el motor de incidencias.",
        )
        db.add(concept)
        db.flush()
        existing[code] = concept
    return existing


def period_incidents(db: Session, payroll: Payroll) -> list[Incident]:
    from app.services.incident_segmenter import month_bounds

    start, end = month_bounds(payroll.period_month, payroll.period_year)
    return (
        db.query(Incident)
        .options(joinedload(Incident.contract), joinedload(Incident.detail))
        .filter(
            Incident.contract_id == payroll.contract_id,
            Incident.start_date <= end,
            ((Incident.end_date.is_(None)) | (Incident.end_date >= start)),
        )
        .order_by(Incident.start_date, Incident.id)
        .all()
    )


def upsert_segments(db: Session, payroll: Payroll, segment_result: dict[str, Any]) -> dict[str, PayrollSegment]:
    existing = {
        segment.segment_key: segment
        for segment in db.query(PayrollSegment).filter(PayrollSegment.payroll_id == payroll.id).all()
    }
    active_keys: set[str] = set()
    persisted: dict[str, PayrollSegment] = {}

    for draft in segment_result["segments"]:
        key = draft["segment_key"]
        active_keys.add(key)
        segment = existing.get(key)
        values = {
            "incident_id": draft["incident_id"],
            "rule_id": draft["rule_id"],
            "segment_type": draft["segment_type"],
            "start_date": draft["start_date"],
            "end_date": draft["end_date"],
            "calendar_days": draft["calendar_days"],
            "payroll_days": draft["payroll_days"],
            "process_day_from": draft["process_day_from"],
            "process_day_to": draft["process_day_to"],
            "salary_percentage": draft["salary_percentage"],
            "benefit_percentage": draft["benefit_percentage"],
            "complement_percentage": draft["complement_percentage"],
            "contribution_treatment": draft["contribution_treatment"],
            "daily_salary_base": draft["daily_salary_base"],
            "daily_regulatory_base": draft["daily_regulatory_base"],
            "salary_amount": draft["salary_amount"],
            "benefit_amount": draft["benefit_amount"],
            "complement_amount": draft["complement_amount"],
            "deduction_amount": draft["deduction_amount"],
            "calculation_trace": draft["trace"],
        }
        if segment is None:
            segment = PayrollSegment(payroll_id=payroll.id, segment_key=key, **values)
            db.add(segment)
        else:
            for field, value in values.items():
                setattr(segment, field, value)
            segment.updated_at = datetime.utcnow()
        db.flush()
        persisted[key] = segment

    stale = [segment for key, segment in existing.items() if key not in active_keys]
    for segment in stale:
        db.query(PayrollItem).filter(
            PayrollItem.segment_id == segment.id,
            PayrollItem.source_type == AUTOMATIC_SOURCE,
        ).delete(synchronize_session=False)
        db.delete(segment)
    db.flush()
    return persisted


def segment_item_specs(segment: PayrollSegment) -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    trace = segment.calculation_trace or {}

    if Decimal(str(segment.deduction_amount or 0)) > 0:
        specs.append(
            {
                "code": "INC_SALARY_REDUCTION_INFO",
                "quantity": segment.payroll_days,
                "unit_price": segment.daily_salary_base,
                "amount": segment.deduction_amount,
                "description": f"Reducción salarial {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
            }
        )
    if Decimal(str(segment.benefit_amount or 0)) > 0:
        specs.append(
            {
                "code": "INC_IT_BENEFIT",
                "quantity": segment.calendar_days,
                "unit_price": money(Decimal(str(segment.daily_regulatory_base or 0)) * Decimal(str(segment.benefit_percentage or 0))),
                "amount": segment.benefit_amount,
                "description": f"Prestación IT {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
            }
        )
    if Decimal(str(segment.complement_amount or 0)) > 0:
        specs.append(
            {
                "code": "INC_IT_COMPANY_COMPLEMENT",
                "quantity": segment.calendar_days,
                "unit_price": money(Decimal(str(segment.daily_salary_base or 0)) * Decimal(str(segment.complement_percentage or 0))),
                "amount": segment.complement_amount,
                "description": f"Complemento IT {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
            }
        )
    if segment.segment_type == "vacation":
        specs.append(
            {
                "code": "INC_VACATION_INFO",
                "quantity": segment.calendar_days,
                "unit_price": 0,
                "amount": 0,
                "description": f"Vacaciones {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
            }
        )
    if segment.segment_type == "paid_leave":
        specs.append(
            {
                "code": "INC_PAID_LEAVE_INFO",
                "quantity": segment.calendar_days,
                "unit_price": 0,
                "amount": 0,
                "description": f"Permiso retribuido {segment.start_date:%d/%m/%Y}-{segment.end_date:%d/%m/%Y}",
            }
        )
    if segment.segment_type == "overtime":
        specs.append(
            {
                "code": "INC_OVERTIME",
                "quantity": Decimal(str(trace.get("hours") or 0)),
                "unit_price": Decimal(str(trace.get("unit_price") or 0)),
                "amount": segment.salary_amount,
                "description": f"Horas extraordinarias {segment.start_date:%d/%m/%Y}",
            }
        )
    if segment.segment_type == "overtime_rest":
        specs.append(
            {
                "code": "INC_OVERTIME_REST_INFO",
                "quantity": Decimal(str(trace.get("hours") or 0)),
                "unit_price": 0,
                "amount": 0,
                "description": f"Horas extra compensadas con descanso {segment.start_date:%d/%m/%Y}",
            }
        )
    return specs


def sync_payroll_items(
    db: Session,
    payroll: Payroll,
    segments: dict[str, PayrollSegment],
    concepts: dict[str, PayrollConcept],
) -> tuple[int, int, int]:
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
            source_key = f"{segment.segment_key}:{spec['code']}"
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
                "source_id": segment.incident_id,
                "segment_id": segment.id,
                "is_automatic": True,
                "calculation_trace": segment.calculation_trace or {},
            }
            if item is None:
                item = PayrollItem(
                    payroll_id=payroll.id,
                    source_type=AUTOMATIC_SOURCE,
                    source_key=source_key,
                    **values,
                )
                db.add(item)
                created += 1
            else:
                for field, value in values.items():
                    setattr(item, field, value)
                item.updated_at = datetime.utcnow()
                updated += 1

    stale = [item for key, item in existing.items() if key not in desired_keys]
    for item in stale:
        db.delete(item)
    db.flush()
    return created, updated, len(stale)


def update_payroll_totals(payroll: Payroll, result: dict[str, Any]) -> None:
    payroll.worked_base_salary = result["worked_base_salary"]
    payroll.temporary_disability_benefit = result["temporary_disability_benefit"]
    payroll.company_disability_complement = result["company_disability_complement"]
    payroll.worked_days = result["worked_days"]
    payroll.incident_days = result["incident_days"]
    payroll.it_days = result["it_days"]
    payroll.non_contribution_days = result["non_contribution_days"]
    payroll.contribution_days = result["contribution_days"]
    payroll.gross_salary = money(
        result["worked_base_salary"]
        + result["temporary_disability_benefit"]
        + result["company_disability_complement"]
        + Decimal(str(payroll.salary_supplements or 0))
        + Decimal(str(payroll.seniority_amount or 0))
        + Decimal(str(payroll.variable_incentives or 0))
        + Decimal(str(payroll.extra_pay_proration or 0))
        + result["overtime_amount"]
    )


def mark_incidents_processed(
    db: Session,
    payroll: Payroll,
    incidents: list[Incident],
    result: dict[str, Any],
    actor: str | None,
) -> None:
    amounts: dict[int, Decimal] = {}
    for segment in result["segments"]:
        incident_id = segment["incident_id"]
        if incident_id is None:
            continue
        amounts.setdefault(incident_id, Decimal("0"))
        amounts[incident_id] += (
            Decimal(str(segment["benefit_amount"]))
            + Decimal(str(segment["complement_amount"]))
            + Decimal(str(segment["salary_amount"] if segment["segment_type"].startswith("overtime") else 0))
            - Decimal(str(segment["deduction_amount"]))
        )

    for incident in incidents:
        if incident.id not in amounts:
            continue
        if incident.detail is None:
            incident.detail = IncidentDetail(incident_id=incident.id)
            db.flush()
        previous = incident_snapshot(incident)
        incident.status = "processed"
        incident.detail.processed_payroll_id = payroll.id
        incident.detail.generated_amount = money(amounts[incident.id])
        incident.detail.processed_at = datetime.utcnow()
        incident.detail.requires_recalculation = False
        incident.detail.requires_regularization = False
        incident.detail.updated_by = actor
        incident.detail.version += 1
        incident.detail.updated_at = datetime.utcnow()
        db.flush()
        register_incident_audit(
            db,
            incident,
            action="payroll_engine_processed",
            actor=actor,
            reason=f"Procesada automáticamente en nómina {payroll.id}",
            previous_values=previous,
            new_values=incident_snapshot(incident),
        )


def process_payroll_incidents(db: Session, payroll_id: int, actor: str | None = None) -> dict[str, Any]:
    payroll = (
        db.query(Payroll)
        .options(joinedload(Payroll.contract), joinedload(Payroll.segments))
        .filter(Payroll.id == payroll_id)
        .first()
    )
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if payroll.period_month not in range(1, 13):
        raise HTTPException(status_code=400, detail="La segmentación solo se aplica a nóminas mensuales")
    if payroll.status == "closed":
        raise HTTPException(
            status_code=409,
            detail="La nómina está cerrada. Debe generarse una regularización, no reescribir el resultado.",
        )
    if not payroll.contract:
        raise HTTPException(status_code=400, detail="La nómina no tiene una vida laboral válida")

    incidents = period_incidents(db, payroll)
    result = build_incident_segments(
        db,
        payroll.id,
        payroll.contract,
        payroll.period_month,
        payroll.period_year,
        incidents,
    )
    concepts = ensure_incident_concepts(db)
    persisted_segments = upsert_segments(db, payroll, result)
    created, updated, deleted = sync_payroll_items(db, payroll, persisted_segments, concepts)
    update_payroll_totals(payroll, result)
    mark_incidents_processed(db, payroll, incidents, result, actor)
    payroll.status = "calculated"
    db.commit()

    return {
        "payroll_id": payroll.id,
        "segments": len(persisted_segments),
        "created_items": created,
        "updated_items": updated,
        "deleted_items": deleted,
        "worked_base_salary": result["worked_base_salary"],
        "temporary_disability_benefit": result["temporary_disability_benefit"],
        "company_disability_complement": result["company_disability_complement"],
        "salary_deductions": result["salary_deductions"],
        "overtime_amount": result["overtime_amount"],
        "worked_days": result["worked_days"],
        "incident_days": result["incident_days"],
        "it_days": result["it_days"],
        "contribution_days": result["contribution_days"],
        "warnings": result["warnings"],
    }
