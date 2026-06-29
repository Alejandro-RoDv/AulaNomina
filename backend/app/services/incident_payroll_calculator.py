from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.payroll import Payroll
from app.services.incident_calculation_policy import DEFAULT_INCIDENT_CALCULATION_POLICY, IncidentCalculationPolicy
from app.services.incident_component_sensitivity import COMPONENT_FIELDS
from app.services.incident_payroll_result import IncidentPayrollCalculationResult, PayrollComponentAdjustment
from app.services.incident_segmenter import build_incident_segments, money
from app.services.payroll_amounts import calculate_social_security_amounts_from_bases


SUPPORTED_CONTRIBUTION_TREATMENTS = {
    "maintain",
    "reduce",
    "none",
}


def calculate_component_adjustments(payroll: Payroll, segment_result: dict[str, Any]) -> list[PayrollComponentAdjustment]:
    factors = segment_result.get("component_factors") or {}
    adjustments = []
    for field in COMPONENT_FIELDS:
        original = money(getattr(payroll, field, 0))
        factor = Decimal(str(factors.get(field, 1)))
        adjusted = money(original * factor)
        adjustments.append(PayrollComponentAdjustment(
            field=field,
            original_amount=original,
            factor=factor,
            adjusted_amount=adjusted,
            reduction_amount=money(original - adjusted),
        ))
    return adjustments


def calculate_incident_amounts(segment_result: dict[str, Any]) -> dict[int, Decimal]:
    amounts: dict[int, Decimal] = {}
    for segment in segment_result["segments"]:
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
    return {incident_id: money(amount) for incident_id, amount in amounts.items()}


def calculate_contribution_salary_base(segment_result: dict[str, Any]) -> Decimal:
    total = Decimal("0")
    for segment in segment_result["segments"]:
        if segment["segment_type"].startswith("overtime"):
            continue
        treatment = str(segment.get("contribution_treatment") or "maintain")
        if treatment not in SUPPORTED_CONTRIBUTION_TREATMENTS:
            raise ValueError(
                f"Tratamiento de cotización no soportado: {treatment} "
                f"en el segmento {segment.get('segment_key')}"
            )
        if treatment == "maintain":
            total += Decimal(str(segment["daily_salary_base"])) * Decimal(str(segment["payroll_days"]))
        elif treatment == "reduce":
            total += Decimal(str(segment["salary_amount"]))
    return money(total)


def calculate_fresh_contribution_bases(
    payroll: Payroll,
    segment_result: dict[str, Any],
    adjustments: list[PayrollComponentAdjustment],
) -> dict[str, Any]:
    adjusted_components = sum(
        (adjustment.adjusted_amount for adjustment in adjustments),
        Decimal("0"),
    )
    contribution_salary = calculate_contribution_salary_base(segment_result)
    overtime = money(segment_result["overtime_amount"])

    automatic_common = money(contribution_salary + adjusted_components)
    automatic_professional = money(automatic_common + overtime)
    automatic_unemployment = automatic_professional

    overrides = {
        "common_contingencies_base": payroll.common_contingencies_base_override,
        "professional_contingencies_base": payroll.professional_contingencies_base_override,
        "unemployment_training_fogasa_base": payroll.unemployment_training_fogasa_base_override,
    }
    automatic = {
        "common_contingencies_base": automatic_common,
        "professional_contingencies_base": automatic_professional,
        "unemployment_training_fogasa_base": automatic_unemployment,
    }
    resolved = {
        field: money(overrides[field]) if overrides[field] is not None else automatic[field]
        for field in automatic
    }
    sources = {
        field: "manual_override" if overrides[field] is not None else "incident_engine"
        for field in automatic
    }
    return {
        "contribution_salary_amount": contribution_salary,
        "adjusted_contribution_components": money(adjusted_components),
        "overtime_amount": overtime,
        "automatic": automatic,
        "overrides": {
            field: money(value) if value is not None else None
            for field, value in overrides.items()
        },
        "resolved": resolved,
        "sources": sources,
    }


def calculate_payroll_amounts(
    payroll: Payroll,
    segment_result: dict[str, Any],
    adjustments: list[PayrollComponentAdjustment],
    contribution_bases: dict[str, Any],
) -> dict[str, Decimal | int]:
    components = {item.field: item.adjusted_amount for item in adjustments}
    gross_salary = money(
        segment_result["worked_base_salary"]
        + segment_result["temporary_disability_benefit"]
        + segment_result["company_disability_complement"]
        + sum(components.values(), Decimal("0"))
        + segment_result["overtime_amount"]
    )
    resolved_bases = contribution_bases["resolved"]
    amounts = calculate_social_security_amounts_from_bases(
        gross_salary=gross_salary,
        common_contingencies_base=resolved_bases["common_contingencies_base"],
        professional_contingencies_base=resolved_bases["professional_contingencies_base"],
        unemployment_training_fogasa_base=resolved_bases["unemployment_training_fogasa_base"],
        irpf_base=gross_salary,
        irpf_percentage=Decimal(str(payroll.irpf_percentage or 0)),
    )
    contribution_days = int(segment_result["contribution_days"])
    divisor = Decimal(str(contribution_days or 1))
    return {
        "worked_base_salary": segment_result["worked_base_salary"],
        "temporary_disability_benefit": segment_result["temporary_disability_benefit"],
        "company_disability_complement": segment_result["company_disability_complement"],
        "worked_days": int(segment_result["worked_days"]),
        "incident_days": int(segment_result["incident_days"]),
        "it_days": int(segment_result["it_days"]),
        "non_contribution_days": int(segment_result["non_contribution_days"]),
        "contribution_days": contribution_days,
        **amounts,
        "daily_common_base": money(amounts["common_contingencies_base"] / divisor),
        "daily_professional_base": money(amounts["professional_contingencies_base"] / divisor),
    }


def calculate_incident_payroll(
    db: Session,
    payroll: Payroll,
    incidents: list[Incident],
    *,
    calculation_policy: IncidentCalculationPolicy = DEFAULT_INCIDENT_CALCULATION_POLICY,
) -> IncidentPayrollCalculationResult:
    segment_result = build_incident_segments(
        db,
        payroll.id,
        payroll.contract,
        payroll.period_month,
        payroll.period_year,
        incidents,
        calculation_policy=calculation_policy,
    )
    adjustments = calculate_component_adjustments(payroll, segment_result)
    contribution_bases = calculate_fresh_contribution_bases(
        payroll,
        segment_result,
        adjustments,
    )
    segment_result["contribution_base_resolution"] = contribution_bases
    return IncidentPayrollCalculationResult.create(
        payroll_id=payroll.id,
        incident_ids=[incident.id for incident in incidents],
        segment_result=segment_result,
        component_adjustments=adjustments,
        payroll_amounts=calculate_payroll_amounts(
            payroll,
            segment_result,
            adjustments,
            contribution_bases,
        ),
        incident_amounts=calculate_incident_amounts(segment_result),
    )


__all__ = [
    "calculate_component_adjustments",
    "calculate_contribution_salary_base",
    "calculate_fresh_contribution_bases",
    "calculate_incident_amounts",
    "calculate_incident_payroll",
    "calculate_payroll_amounts",
]
