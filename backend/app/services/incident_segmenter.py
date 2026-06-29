from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.services.incident_calculation_policy import (
    DEFAULT_INCIDENT_CALCULATION_POLICY,
    IncidentCalculationPolicy,
)
from app.services.incident_component_sensitivity import (
    COMPONENT_FIELDS,
    component_factors,
)
from app.services.incident_rule_catalog import normalized_process_type, resolve_band, resolve_calculation_rule


MONEY = Decimal("0.01")
FOUR_DECIMALS = Decimal("0.0001")
PERCENT = Decimal("100")
MONTHLY_PAYROLL_DAYS = Decimal("30")
MEDICAL_TYPES = {
    "IT",
    "RECAIDA",
    "NACIMIENTO_CUIDADO",
    "RIESGO_EMBARAZO",
    "RIESGO_LACTANCIA",
    "CUIDADO_MENOR",
}


def money(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def four(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(FOUR_DECIMALS, rounding=ROUND_HALF_UP)


def month_bounds(month: int, year: int) -> tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def contract_partiality_ratio(contract) -> Decimal:
    if contract.partiality_coefficient is not None:
        return Decimal(str(contract.partiality_coefficient)) / PERCENT
    weekly = Decimal(str(contract.weekly_hours or 0))
    full = Decimal(str(contract.full_time_weekly_hours or 40))
    return weekly / full if weekly > 0 and full > 0 else Decimal("1")


def contract_monthly_salary(contract) -> Decimal:
    return money(Decimal(str(contract.salary_base or 0)) * contract_partiality_ratio(contract))


def is_daily_contract(contract) -> bool:
    mode = str(contract.monthly_or_daily_contribution or "monthly").lower()
    return mode in {"daily", "diario", "days"}


def payroll_day_weight(contract, period_start: date, period_end: date) -> Decimal:
    natural_days = Decimal(str((period_end - period_start).days + 1))
    if is_daily_contract(contract):
        return Decimal("1")
    return MONTHLY_PAYROLL_DAYS / natural_days


def incident_process_start(incident: Incident) -> date:
    details = incident.details or {}
    raw = details.get("original_process_start_date") or details.get("process_start_date")
    if raw:
        try:
            return date.fromisoformat(str(raw)[:10])
        except ValueError:
            pass
    return incident.start_date


def resolve_regulatory_daily_base(
    db: Session,
    contract,
    incident: Incident,
    configuration: dict[str, Any],
    fallback_daily_salary: Decimal,
) -> tuple[Decimal, str, list[str]]:
    """Compatibility wrapper around the canonical calculation policy."""

    daily, source, warnings, _trace = DEFAULT_INCIDENT_CALCULATION_POLICY.regulatory_daily_base(
        db,
        contract,
        incident,
        configuration,
        fallback_daily_salary,
    )
    return daily, source, warnings


def active_incidents_for_day(incidents: list[Incident], current: date) -> list[Incident]:
    return [
        incident
        for incident in incidents
        if incident.incident_type != "HORAS_EXTRA"
        and not incident.is_cancelled
        and incident.start_date <= current <= (incident.end_date or current)
    ]


def _normal_day_record(current: date, day_weight: Decimal, daily_salary: Decimal) -> dict[str, Any]:
    factors, modes = component_factors(
        {},
        kind="normal_work",
        salary_percentage=Decimal("1"),
        segment_type="normal_work",
    )
    return {
        "date": current,
        "incident_id": None,
        "rule_id": None,
        "segment_type": "normal_work",
        "calendar_days": 1,
        "payroll_days": day_weight,
        "process_day": None,
        "salary_percentage": Decimal("1"),
        "benefit_percentage": Decimal("0"),
        "complement_percentage": Decimal("0"),
        "contribution_treatment": "maintain",
        "daily_salary_base": daily_salary,
        "daily_regulatory_base": Decimal("0"),
        "salary_amount": daily_salary * day_weight,
        "benefit_amount": Decimal("0"),
        "complement_amount": Decimal("0"),
        "deduction_amount": Decimal("0"),
        "component_factors": factors,
        "trace": {
            "kind": "normal_work",
            "component_sensitivity": modes,
            "component_factors": {key: str(value) for key, value in factors.items()},
        },
    }


def _day_record(
    db: Session,
    contract,
    current: date,
    period_start: date,
    period_end: date,
    incident: Incident | None,
    day_weight: Decimal,
    daily_salary: Decimal,
    calculation_policy: IncidentCalculationPolicy,
) -> tuple[dict[str, Any], list[str]]:
    if incident is None:
        return _normal_day_record(current, day_weight, daily_salary), []

    rule = resolve_calculation_rule(db, incident, current)
    if not rule:
        factors, modes = component_factors(
            {},
            kind="unconfigured",
            salary_percentage=Decimal("1"),
            segment_type="unconfigured_incident",
        )
        return {
            "date": current,
            "incident_id": incident.id,
            "rule_id": None,
            "segment_type": "unconfigured_incident",
            "calendar_days": 1,
            "payroll_days": day_weight,
            "process_day": None,
            "salary_percentage": Decimal("1"),
            "benefit_percentage": Decimal("0"),
            "complement_percentage": Decimal("0"),
            "contribution_treatment": "maintain",
            "daily_salary_base": daily_salary,
            "daily_regulatory_base": Decimal("0"),
            "salary_amount": daily_salary * day_weight,
            "benefit_amount": Decimal("0"),
            "complement_amount": Decimal("0"),
            "deduction_amount": Decimal("0"),
            "component_factors": factors,
            "trace": {
                "kind": "unconfigured",
                "incident_type": incident.incident_type,
                "component_sensitivity": modes,
                "component_factors": {key: str(value) for key, value in factors.items()},
            },
        }, [f"La incidencia {incident.id} no tiene una regla de cálculo vigente."]

    configuration = rule.configuration or {}
    kind = configuration.get("kind")
    process_start = incident_process_start(incident)
    process_day = (current - process_start).days + 1
    warnings: list[str] = []
    salary_percentage = Decimal(str(configuration.get("salary_percentage", 0))) / PERCENT
    benefit_percentage = Decimal("0")
    complement_percentage = Decimal("0")
    segment_type = configuration.get("segment_type") or incident.incident_type.lower()
    payer = None
    regulatory_daily = Decimal("0")
    regulatory_source = None
    advanced_regulatory_trace: dict[str, Any] = {}
    agreement_trace: dict[str, Any] = {}
    effective_target = Decimal("0")

    if kind == "medical":
        band = resolve_band(configuration, process_day)
        segment_type = band.get("segment_type") or "medical_incident"
        salary_percentage = Decimal(str(band.get("salary_percentage", 0))) / PERCENT
        benefit_percentage = Decimal(str(band.get("benefit_percentage", 0))) / PERCENT
        payer = band.get("payer")
        (
            regulatory_daily,
            regulatory_source,
            base_warnings,
            advanced_regulatory_trace,
        ) = calculation_policy.regulatory_daily_base(
            db,
            contract,
            incident,
            configuration,
            daily_salary,
        )
        warnings.extend(base_warnings)

        agreement_target, agreement_trace = calculation_policy.agreement_it_target(
            db,
            contract,
            incident,
            current,
            process_day,
            normalized_process_type(incident),
        )
        manual_target = Decimal(
            str((incident.details or {}).get("company_complement_target_percentage", 0))
        ) / PERCENT
        effective_target = agreement_target if agreement_target is not None else manual_target
        complement_percentage = max(
            Decimal("0"),
            effective_target - benefit_percentage - salary_percentage,
        )

    factors, modes = component_factors(
        configuration,
        kind=kind,
        salary_percentage=salary_percentage,
        segment_type=segment_type,
    )
    salary_amount = daily_salary * day_weight * salary_percentage
    deduction_amount = daily_salary * day_weight * (Decimal("1") - salary_percentage)
    benefit_amount = regulatory_daily * benefit_percentage
    complement_amount = daily_salary * complement_percentage

    trace = {
        "kind": kind,
        "rule_code": rule.code,
        "process_type": normalized_process_type(incident),
        "payer": payer,
        "regulatory_base_source": regulatory_source,
        "legal_reference": rule.legal_reference,
        "component_sensitivity": modes,
        "component_factors": {key: str(value) for key, value in factors.items()},
    }
    if advanced_regulatory_trace:
        trace["advanced_regulatory_base"] = advanced_regulatory_trace
    if agreement_trace:
        trace.update(agreement_trace)
    if effective_target > 0:
        trace["effective_target_percentage"] = str(money(effective_target * PERCENT))

    return {
        "date": current,
        "incident_id": incident.id,
        "rule_id": rule.id,
        "segment_type": segment_type,
        "calendar_days": 1,
        "payroll_days": day_weight,
        "process_day": process_day,
        "salary_percentage": salary_percentage,
        "benefit_percentage": benefit_percentage,
        "complement_percentage": complement_percentage,
        "contribution_treatment": configuration.get("contribution_treatment", "maintain"),
        "daily_salary_base": daily_salary,
        "daily_regulatory_base": regulatory_daily,
        "salary_amount": salary_amount,
        "benefit_amount": benefit_amount,
        "complement_amount": complement_amount,
        "deduction_amount": deduction_amount,
        "component_factors": factors,
        "trace": trace,
    }, warnings


def same_segment(previous: dict[str, Any], current: dict[str, Any]) -> bool:
    keys = (
        "incident_id",
        "rule_id",
        "segment_type",
        "salary_percentage",
        "benefit_percentage",
        "complement_percentage",
        "contribution_treatment",
        "daily_salary_base",
        "daily_regulatory_base",
        "component_factors",
    )
    return all(previous.get(key) == current.get(key) for key in keys)


def compress_day_records(payroll_id: int, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not records:
        return []
    compressed: list[dict[str, Any]] = []
    current = None
    for record in records:
        if current and same_segment(current, record) and record["date"] == current["end_date"] + timedelta(days=1):
            current["end_date"] = record["date"]
            current["calendar_days"] += 1
            current["payroll_days"] += record["payroll_days"]
            current["salary_amount"] += record["salary_amount"]
            current["benefit_amount"] += record["benefit_amount"]
            current["complement_amount"] += record["complement_amount"]
            current["deduction_amount"] += record["deduction_amount"]
            current["process_day_to"] = record["process_day"]
            continue

        current = {
            **record,
            "start_date": record["date"],
            "end_date": record["date"],
            "process_day_from": record["process_day"],
            "process_day_to": record["process_day"],
        }
        compressed.append(current)

    for segment in compressed:
        segment.pop("date", None)
        segment["payroll_days"] = four(segment["payroll_days"])
        for key in ("salary_amount", "benefit_amount", "complement_amount", "deduction_amount"):
            segment[key] = money(segment[key])
        segment["daily_salary_base"] = four(segment["daily_salary_base"])
        segment["daily_regulatory_base"] = four(segment["daily_regulatory_base"])
        segment["component_factors"] = {
            key: four(value) for key, value in segment["component_factors"].items()
        }
        segment["segment_key"] = (
            f"payroll:{payroll_id}:incident:{segment['incident_id'] or 'normal'}:"
            f"{segment['start_date'].isoformat()}:{segment['end_date'].isoformat()}:"
            f"{segment['segment_type']}"
        )
    return compressed


def overtime_segments(
    payroll_id: int,
    contract,
    incidents: list[Incident],
    period_start: date,
    period_end: date,
) -> tuple[list[dict[str, Any]], list[str]]:
    segments: list[dict[str, Any]] = []
    warnings: list[str] = []
    monthly_salary = contract_monthly_salary(contract)
    monthly_hours = Decimal(str(contract.monthly_hours or 0))
    ordinary_hour_value = four(monthly_salary / monthly_hours) if monthly_hours > 0 else Decimal("0")

    for incident in incidents:
        if incident.incident_type != "HORAS_EXTRA" or incident.is_cancelled:
            continue
        if incident.start_date > period_end or (incident.end_date or incident.start_date) < period_start:
            continue
        details = incident.details or {}
        hours = Decimal(str(incident.hours or details.get("hours") or 0))
        configured_value = Decimal(str(details.get("hour_value") or 0))
        compensated = bool(details.get("compensated_with_rest")) or details.get("inclusion_destination") not in {None, "payroll"}
        unit_price = configured_value
        if not compensated and ordinary_hour_value > 0 and unit_price < ordinary_hour_value:
            warnings.append(
                f"La incidencia {incident.id} tenía un valor de hora inferior al ordinario; se aplica {ordinary_hour_value}."
            )
            unit_price = ordinary_hour_value
        amount = Decimal("0") if compensated else money(hours * unit_price)
        start = max(incident.start_date, period_start)
        end = min(incident.end_date or incident.start_date, period_end)
        segments.append(
            {
                "segment_key": f"payroll:{payroll_id}:incident:{incident.id}:{start.isoformat()}:{end.isoformat()}:overtime",
                "incident_id": incident.id,
                "rule_id": None,
                "segment_type": "overtime_rest" if compensated else "overtime",
                "start_date": start,
                "end_date": end,
                "calendar_days": (end - start).days + 1,
                "payroll_days": Decimal("0.0000"),
                "process_day_from": None,
                "process_day_to": None,
                "salary_percentage": Decimal("0"),
                "benefit_percentage": Decimal("0"),
                "complement_percentage": Decimal("0"),
                "contribution_treatment": "additional_professional_base" if amount > 0 else "none",
                "daily_salary_base": Decimal("0"),
                "daily_regulatory_base": Decimal("0"),
                "salary_amount": amount,
                "benefit_amount": Decimal("0"),
                "complement_amount": Decimal("0"),
                "deduction_amount": Decimal("0"),
                "component_factors": {field: Decimal("1") for field in COMPONENT_FIELDS},
                "trace": {
                    "kind": "overtime",
                    "hours": str(hours),
                    "unit_price": str(four(unit_price)),
                    "ordinary_hour_value": str(ordinary_hour_value),
                    "compensated_with_rest": compensated,
                },
            }
        )
    return segments, warnings


def aggregate_component_factors(primary_segments: list[dict[str, Any]]) -> dict[str, Decimal]:
    total_weight = sum(
        (Decimal(str(segment["payroll_days"])) for segment in primary_segments),
        Decimal("0"),
    )
    if total_weight <= 0:
        return {field: Decimal("1.0000") for field in COMPONENT_FIELDS}

    return {
        field: four(
            sum(
                (
                    Decimal(str(segment["payroll_days"]))
                    * Decimal(str(segment["component_factors"].get(field, 1)))
                    for segment in primary_segments
                ),
                Decimal("0"),
            )
            / total_weight
        )
        for field in COMPONENT_FIELDS
    }


def build_incident_segments(
    db: Session,
    payroll_id: int,
    contract,
    period_month: int,
    period_year: int,
    incidents: list[Incident],
    calculation_policy: IncidentCalculationPolicy = DEFAULT_INCIDENT_CALCULATION_POLICY,
) -> dict[str, Any]:
    period_start, period_end = month_bounds(period_month, period_year)
    monthly_salary = contract_monthly_salary(contract)
    daily_salary = four(monthly_salary / MONTHLY_PAYROLL_DAYS) if monthly_salary else Decimal("0")
    day_weight = payroll_day_weight(contract, period_start, period_end)
    records: list[dict[str, Any]] = []
    warnings: list[str] = []

    for current in date_range(period_start, period_end):
        active = active_incidents_for_day(incidents, current)
        if len(active) > 1:
            warnings.append(
                f"El día {current.isoformat()} tiene varias incidencias activas ({', '.join(str(item.id) for item in active)}); se usa la de mayor prioridad temporal."
            )
        active.sort(key=lambda item: (item.start_date, item.id), reverse=True)
        record, day_warnings = _day_record(
            db,
            contract,
            current,
            period_start,
            period_end,
            active[0] if active else None,
            day_weight,
            daily_salary,
            calculation_policy,
        )
        records.append(record)
        warnings.extend(day_warnings)

    segments = compress_day_records(payroll_id, records)
    overtime, overtime_warnings = overtime_segments(
        payroll_id,
        contract,
        incidents,
        period_start,
        period_end,
    )
    segments.extend(overtime)
    warnings.extend(overtime_warnings)

    primary = [segment for segment in segments if not segment["segment_type"].startswith("overtime")]
    incident_primary = [segment for segment in primary if segment["incident_id"] is not None]
    medical = [segment for segment in primary if segment["incident_id"] is not None and segment["segment_type"].startswith(("it_", "work_accident", "occupational", "protected"))]
    reduced_contribution = [segment for segment in primary if segment["contribution_treatment"] == "reduce"]
    normal = [segment for segment in primary if segment["segment_type"] == "normal_work"]

    return {
        "period_start": period_start,
        "period_end": period_end,
        "segments": segments,
        "warnings": list(dict.fromkeys(warnings)),
        "component_factors": aggregate_component_factors(primary),
        "worked_base_salary": money(sum((segment["salary_amount"] for segment in primary), Decimal("0"))),
        "temporary_disability_benefit": money(sum((segment["benefit_amount"] for segment in primary), Decimal("0"))),
        "company_disability_complement": money(sum((segment["complement_amount"] for segment in primary), Decimal("0"))),
        "salary_deductions": money(sum((segment["deduction_amount"] for segment in primary), Decimal("0"))),
        "overtime_amount": money(sum((segment["salary_amount"] for segment in overtime), Decimal("0"))),
        "worked_days": int(sum((segment["payroll_days"] for segment in normal), Decimal("0")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
        "incident_days": min(30, int(sum((segment["payroll_days"] for segment in incident_primary), Decimal("0")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))),
        "it_days": min(30, sum(segment["calendar_days"] for segment in medical)),
        "non_contribution_days": min(30, int(sum((segment["payroll_days"] for segment in reduced_contribution), Decimal("0")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))),
        "contribution_days": max(0, 30 - int(sum((segment["payroll_days"] for segment in reduced_contribution), Decimal("0")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))),
    }
