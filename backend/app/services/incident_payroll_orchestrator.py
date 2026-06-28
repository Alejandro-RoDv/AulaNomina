from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.incident import Incident
from app.models.incident_detail import IncidentDetail
from app.models.payroll import Payroll
from app.services.incident_payroll_processor import (
    ensure_incident_concepts,
    period_incidents,
    sync_payroll_items,
    upsert_segments,
)
from app.services.incident_segmenter import build_incident_segments, money
from app.services.incident_service import incident_snapshot, register_incident_audit
from app.services.payroll_amounts import calculate_social_security_amounts_from_bases


def recalculate_payroll_amounts(payroll: Payroll, result: dict[str, Any]) -> None:
    payroll.worked_base_salary = result["worked_base_salary"]
    payroll.temporary_disability_benefit = result["temporary_disability_benefit"]
    payroll.company_disability_complement = result["company_disability_complement"]
    payroll.worked_days = result["worked_days"]
    payroll.incident_days = result["incident_days"]
    payroll.it_days = result["it_days"]
    payroll.non_contribution_days = result["non_contribution_days"]
    payroll.contribution_days = result["contribution_days"]

    gross_salary = money(
        result["worked_base_salary"]
        + result["temporary_disability_benefit"]
        + result["company_disability_complement"]
        + Decimal(str(payroll.salary_supplements or 0))
        + Decimal(str(payroll.seniority_amount or 0))
        + Decimal(str(payroll.variable_incentives or 0))
        + Decimal(str(payroll.extra_pay_proration or 0))
        + result["overtime_amount"]
    )

    existing_common_base = Decimal(str(payroll.common_contingencies_base or 0))
    existing_professional_base = Decimal(str(payroll.professional_contingencies_base or 0))
    existing_unemployment_base = Decimal(str(payroll.unemployment_training_fogasa_base or 0))

    common_base = existing_common_base if existing_common_base > 0 else gross_salary
    professional_base = existing_professional_base if existing_professional_base > 0 else gross_salary
    if result["overtime_amount"] > 0:
        professional_base = money(professional_base + result["overtime_amount"])
    unemployment_base = existing_unemployment_base if existing_unemployment_base > 0 else professional_base
    if result["overtime_amount"] > 0 and unemployment_base < professional_base:
        unemployment_base = professional_base

    amounts = calculate_social_security_amounts_from_bases(
        gross_salary=gross_salary,
        common_contingencies_base=common_base,
        professional_contingencies_base=professional_base,
        unemployment_training_fogasa_base=unemployment_base,
        irpf_base=gross_salary,
        irpf_percentage=Decimal(str(payroll.irpf_percentage or 0)),
    )

    payroll.gross_salary = amounts["gross_salary"]
    payroll.common_contingencies_base = amounts["common_contingencies_base"]
    payroll.professional_contingencies_base = amounts["professional_contingencies_base"]
    payroll.unemployment_training_fogasa_base = amounts["unemployment_training_fogasa_base"]
    payroll.irpf_base = amounts["irpf_base"]
    payroll.employee_common_contingencies = amounts["employee_common_contingencies"]
    payroll.employee_unemployment = amounts["employee_unemployment"]
    payroll.employee_training = amounts["employee_training"]
    payroll.employee_mei = amounts["employee_mei"]
    payroll.employee_social_security = amounts["employee_social_security"]
    payroll.irpf = amounts["irpf"]
    payroll.total_deductions = amounts["total_deductions"]
    payroll.net_salary = amounts["net_salary"]
    payroll.company_common_contingencies = amounts["company_common_contingencies"]
    payroll.company_unemployment = amounts["company_unemployment"]
    payroll.company_fogasa = amounts["company_fogasa"]
    payroll.company_training = amounts["company_training"]
    payroll.company_at_ep = amounts["company_at_ep"]
    payroll.company_mei = amounts["company_mei"]
    payroll.company_total_social_security = amounts["company_total_social_security"]
    payroll.company_total_cost = amounts["company_total_cost"]
    payroll.daily_common_base = money(
        payroll.common_contingencies_base / Decimal(str(payroll.contribution_days or 1))
    )
    payroll.daily_professional_base = money(
        payroll.professional_contingencies_base / Decimal(str(payroll.contribution_days or 1))
    )


def incident_amounts(result: dict[str, Any]) -> dict[int, Decimal]:
    amounts: dict[int, Decimal] = {}
    for segment in result["segments"]:
        incident_id = segment["incident_id"]
        if incident_id is None:
            continue
        amounts.setdefault(incident_id, Decimal("0"))
        amounts[incident_id] += (
            Decimal(str(segment["benefit_amount"]))
            + Decimal(str(segment["complement_amount"]))
            + Decimal(
                str(
                    segment["salary_amount"]
                    if segment["segment_type"].startswith("overtime")
                    else 0
                )
            )
            - Decimal(str(segment["deduction_amount"]))
        )
    return {incident_id: money(amount) for incident_id, amount in amounts.items()}


def mark_changed_incidents_processed(
    db: Session,
    payroll: Payroll,
    incidents: list[Incident],
    result: dict[str, Any],
    actor: str | None,
) -> int:
    amounts = incident_amounts(result)
    changed = 0

    for incident in incidents:
        if incident.id not in amounts:
            continue
        if incident.detail is None:
            incident.detail = IncidentDetail(incident_id=incident.id)
            db.flush()

        target_amount = amounts[incident.id]
        unchanged = (
            incident.status == "processed"
            and incident.detail.processed_payroll_id == payroll.id
            and money(incident.detail.generated_amount) == target_amount
            and not incident.detail.requires_recalculation
            and not incident.detail.requires_regularization
        )
        if unchanged:
            continue

        previous = incident_snapshot(incident)
        incident.status = "processed"
        incident.detail.processed_payroll_id = payroll.id
        incident.detail.generated_amount = target_amount
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
        changed += 1
    return changed


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

    try:
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
        created, updated, deleted = sync_payroll_items(
            db,
            payroll,
            persisted_segments,
            concepts,
        )
        recalculate_payroll_amounts(payroll, result)
        changed_incidents = mark_changed_incidents_processed(
            db,
            payroll,
            incidents,
            result,
            actor,
        )
        payroll.status = "calculated"
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "payroll_id": payroll.id,
        "segments": len(persisted_segments),
        "created_items": created,
        "updated_items": updated,
        "deleted_items": deleted,
        "changed_incidents": changed_incidents,
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
