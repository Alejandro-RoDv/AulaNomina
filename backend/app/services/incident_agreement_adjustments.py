from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from app.models.agreement_parameterization import AgreementRuleHeader


MONEY = Decimal("0.01")


def money(value):
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def active_rules(db, agreement_id, rule_type, on_date: date):
    if not agreement_id:
        return []
    return (
        db.query(AgreementRuleHeader)
        .options(selectinload(AgreementRuleHeader.details))
        .filter(
            AgreementRuleHeader.collective_agreement_id == agreement_id,
            AgreementRuleHeader.rule_type == rule_type,
            AgreementRuleHeader.is_active.is_(True),
            or_(AgreementRuleHeader.effective_from.is_(None), AgreementRuleHeader.effective_from <= on_date),
            or_(AgreementRuleHeader.effective_to.is_(None), AgreementRuleHeader.effective_to >= on_date),
        )
        .order_by(AgreementRuleHeader.is_default.desc(), AgreementRuleHeader.id.desc())
        .all()
    )


def matches(detail, incident, segment):
    options = detail.options or {}
    allowed_incidents = set(options.get("incident_types") or [])
    allowed_segments = set(options.get("segment_types") or [])
    if allowed_incidents and incident.incident_type not in allowed_incidents:
        return False
    if allowed_segments and segment["segment_type"] not in allowed_segments:
        return False
    day_from = segment.get("process_day_from") or 1
    day_to = segment.get("process_day_to") or day_from
    if detail.minimum_value is not None and day_to < int(detail.minimum_value):
        return False
    if detail.maximum_value is not None and day_from > int(detail.maximum_value):
        return False
    return True


def it_target(db, contract, incident, segment):
    for header in active_rules(db, contract.collective_agreement_id, "it_complement", segment["start_date"]):
        for detail in header.details or []:
            if detail.is_active and matches(detail, incident, segment):
                value = detail.percentage if detail.percentage is not None else (detail.options or {}).get("target_percentage")
                if value is not None:
                    return Decimal(str(value)) / Decimal("100"), header.code or str(header.id)
        value = (header.options or {}).get("target_percentage")
        if value is not None:
            return Decimal(str(value)) / Decimal("100"), header.code or str(header.id)
    return None, None


def absence_treatment(db, contract, incident, segment):
    for header in active_rules(db, contract.collective_agreement_id, "absence_contribution", segment["start_date"]):
        for detail in header.details or []:
            if detail.is_active and matches(detail, incident, segment):
                value = (detail.options or {}).get("contribution_treatment")
                if value:
                    return value, header.code or str(header.id)
        value = (header.options or {}).get("contribution_treatment")
        if value:
            return value, header.code or str(header.id)
    explicit = (incident.details or {}).get("contribution_treatment")
    if explicit:
        return explicit, "incident"
    if (incident.details or {}).get("maintains_registration") is False:
        return "reduce", "incident"
    if segment["segment_type"] in {"unpaid_absence", "unpaid_leave", "sanction"}:
        return "minimum", "general_high_without_pay"
    return "reduce" if segment["segment_type"] == "suspension" else segment.get("contribution_treatment", "maintain"), "general"


def apply_agreement_adjustments(db, contract, incidents, result):
    by_id = {item.id: item for item in incidents}
    complement_total = Decimal("0")
    reduced_days = Decimal("0")
    for segment in result.get("segments", []):
        incident = by_id.get(segment.get("incident_id"))
        if not incident:
            continue
        trace = dict(segment.get("trace") or {})
        segment_type = str(segment.get("segment_type") or "")
        if segment_type.startswith(("it_", "work_accident", "occupational", "protected")):
            target, source = it_target(db, contract, incident, segment)
            if target is not None:
                benefit = Decimal(str(segment.get("benefit_percentage") or 0))
                complement = max(Decimal("0"), target - benefit)
                segment["complement_percentage"] = complement
                segment["complement_amount"] = money(
                    Decimal(str(segment.get("daily_salary_base") or 0))
                    * Decimal(str(segment.get("calendar_days") or 0))
                    * complement
                )
                trace["agreement_it_complement_rule"] = source
        if segment_type in {"unpaid_absence", "unpaid_leave", "sanction", "suspension"}:
            treatment, source = absence_treatment(db, contract, incident, segment)
            segment["contribution_treatment"] = treatment
            trace["absence_contribution_rule"] = source
            if treatment == "reduce":
                reduced_days += Decimal(str(segment.get("payroll_days") or 0))
        segment["trace"] = trace
        complement_total += Decimal(str(segment.get("complement_amount") or 0))
    result["company_disability_complement"] = money(complement_total)
    result["non_contribution_days"] = min(30, int(reduced_days.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
    result["contribution_days"] = max(0, 30 - result["non_contribution_days"])
    return result
