from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Mapping

from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.payroll import Payroll
from app.models.payroll_calculation_snapshot import PayrollCalculationSnapshot
from app.services.incident_payroll_result import IncidentPayrollCalculationResult


INCIDENT_ENGINE_VERSION = "incident-engine/2.1.0"


def json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [json_safe(item) for item in value]
    return value


def incident_input(incident: Incident) -> dict[str, Any]:
    return {
        "id": incident.id,
        "incident_type": incident.incident_type,
        "start_date": incident.start_date,
        "end_date": incident.end_date,
        "status": incident.status,
        "hours": incident.hours,
        "details": incident.details or {},
        "version": getattr(incident.detail, "version", None) if incident.detail else None,
    }


def payroll_input(payroll: Payroll) -> dict[str, Any]:
    contract = payroll.contract
    return {
        "payroll": {
            "id": payroll.id,
            "employee_id": payroll.employee_id,
            "contract_id": payroll.contract_id,
            "company_id": payroll.company_id,
            "period_month": payroll.period_month,
            "period_year": payroll.period_year,
            "base_salary": payroll.base_salary,
            "salary_supplements": payroll.salary_supplements,
            "seniority_amount": payroll.seniority_amount,
            "variable_incentives": payroll.variable_incentives,
            "extra_pay_proration": payroll.extra_pay_proration,
            "irpf_mode": payroll.irpf_mode,
            "irpf_percentage": payroll.irpf_percentage,
            "base_overrides": {
                "common": payroll.common_contingencies_base_override,
                "professional": payroll.professional_contingencies_base_override,
                "unemployment": payroll.unemployment_training_fogasa_base_override,
            },
        },
        "contract": {
            "id": contract.id,
            "salary_base": contract.salary_base,
            "partiality_coefficient": contract.partiality_coefficient,
            "weekly_hours": contract.weekly_hours,
            "full_time_weekly_hours": contract.full_time_weekly_hours,
            "monthly_hours": contract.monthly_hours,
            "monthly_or_daily_contribution": contract.monthly_or_daily_contribution,
            "collective_agreement_id": contract.collective_agreement_id,
            "pay_schedule": contract.pay_schedule,
        },
    }


def rule_references(calculation: IncidentPayrollCalculationResult) -> list[dict[str, Any]]:
    unique: dict[tuple[Any, Any], dict[str, Any]] = {}
    for segment in calculation.segment_result["segments"]:
        trace = segment.get("trace") or {}
        key = (segment.get("rule_id"), trace.get("rule_code"))
        if key == (None, None):
            continue
        unique[key] = {
            "rule_id": segment.get("rule_id"),
            "rule_code": trace.get("rule_code"),
            "legal_reference": trace.get("legal_reference"),
        }
    return sorted(
        unique.values(),
        key=lambda item: (str(item.get("rule_code") or ""), int(item.get("rule_id") or 0)),
    )


def build_snapshot_payload(
    payroll: Payroll,
    incidents: list[Incident],
    calculation: IncidentPayrollCalculationResult,
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]], str]:
    inputs = {
        **payroll_input(payroll),
        "incidents": [incident_input(incident) for incident in incidents],
        "component_adjustments": [
            adjustment.to_dict() for adjustment in calculation.component_adjustments
        ],
        "contribution_base_resolution": calculation.segment_result.get(
            "contribution_base_resolution",
            {},
        ),
    }
    results = {
        "segment_result": calculation.segment_payload(),
        "payroll_amounts": calculation.payroll_amount_payload(),
        "incident_amounts": calculation.incident_amount_map(),
    }
    references = rule_references(calculation)
    fingerprint_source = json.dumps(
        json_safe({
            "engine_version": INCIDENT_ENGINE_VERSION,
            "inputs": inputs,
            "rule_references": references,
        }),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()
    return json_safe(inputs), json_safe(results), json_safe(references), fingerprint


def persist_calculation_snapshot(
    db: Session,
    payroll: Payroll,
    incidents: list[Incident],
    calculation: IncidentPayrollCalculationResult,
    *,
    actor: str | None,
    calculation_version: int,
) -> PayrollCalculationSnapshot:
    inputs, results, references, fingerprint = build_snapshot_payload(
        payroll,
        incidents,
        calculation,
    )
    snapshot = PayrollCalculationSnapshot(
        payroll_id=payroll.id,
        calculation_version=calculation_version,
        engine_version=INCIDENT_ENGINE_VERSION,
        fingerprint=fingerprint,
        actor=actor,
        rule_references=references,
        input_snapshot=inputs,
        result_snapshot=results,
    )
    db.add(snapshot)
    payroll.calculation_version = calculation_version
    payroll.calculation_engine_version = INCIDENT_ENGINE_VERSION
    payroll.calculation_fingerprint = fingerprint
    payroll.last_calculated_at = datetime.utcnow()
    db.flush()
    return snapshot
