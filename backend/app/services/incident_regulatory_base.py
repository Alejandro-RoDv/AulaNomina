from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem


FOUR = Decimal("0.0001")


def four(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(FOUR, rounding=ROUND_HALF_UP)


def previous_month(value: date) -> tuple[int, int]:
    if value.month == 1:
        return value.year - 1, 12
    return value.year, value.month - 1


def contract_text(contract) -> str:
    return " ".join(
        str(value or "").lower()
        for value in (
            contract.contract_type,
            contract.contract_family,
            contract.working_day_type,
            contract.relation_type,
            contract.relation_subtype,
            contract.work_distribution,
        )
    )


def is_part_time(contract) -> bool:
    coefficient = Decimal(str(contract.partiality_coefficient or 100))
    return coefficient < 100 or any(token in contract_text(contract) for token in ("parcial", "part_time", "part-time"))


def is_fixed_discontinuous(contract) -> bool:
    text = contract_text(contract)
    return any(token in text for token in ("fijo discontinuo", "fijo_discontinuo", "fixed discontinuous", "fixed_discontinuous"))


def month_natural_days(payroll: Payroll) -> int:
    if payroll.period_month not in range(1, 13):
        return 0
    return monthrange(payroll.period_year, payroll.period_month)[1]


def payrolls_before_event(db: Session, contract_id: int, event_date: date, months: int) -> list[Payroll]:
    year, month = previous_month(event_date)
    rows = (
        db.query(Payroll)
        .filter(
            Payroll.contract_id == contract_id,
            Payroll.period_month.between(1, 12),
            Payroll.status.in_(["calculated", "reviewed", "closed"]),
            or_(
                Payroll.period_year < year,
                and_(Payroll.period_year == year, Payroll.period_month <= month),
            ),
        )
        .order_by(Payroll.period_year.desc(), Payroll.period_month.desc(), Payroll.id.desc())
        .all()
    )
    selected: list[Payroll] = []
    seen: set[tuple[int, int]] = set()
    for payroll in rows:
        key = (payroll.period_year, payroll.period_month)
        if key in seen:
            continue
        seen.add(key)
        selected.append(payroll)
        if len(selected) >= months:
            break
    return list(reversed(selected))


def fixed_discontinuous_call_start(contract, incident) -> date:
    details = incident.details or {}
    raw = details.get("last_call_start_date") or details.get("call_start_date")
    if raw:
        try:
            return date.fromisoformat(str(raw)[:10])
        except ValueError:
            pass
    return contract.inactivity_return_date or contract.start_date


def prorated_window_base(
    db: Session,
    contract,
    incident,
    professional: bool,
) -> tuple[Decimal | None, str | None, list[str]]:
    warnings: list[str] = []
    rows = payrolls_before_event(db, contract.id, incident.start_date, 3)
    if is_fixed_discontinuous(contract):
        call_start = fixed_discontinuous_call_start(contract, incident)
        rows = [
            row
            for row in rows
            if date(row.period_year, row.period_month, monthrange(row.period_year, row.period_month)[1]) >= call_start
        ]
    if not rows:
        return None, None, warnings

    base_total = Decimal("0")
    natural_days = 0
    for payroll in rows:
        base = payroll.professional_contingencies_base if professional else payroll.common_contingencies_base
        base_total += Decimal(str(base or 0))
        natural_days += month_natural_days(payroll)
    if base_total <= 0 or natural_days <= 0:
        return None, None, warnings

    mode = "fixed_discontinuous_three_month_average" if is_fixed_discontinuous(contract) else "part_time_three_month_average"
    warnings.append(
        "Base reguladora calculada con las bases de hasta tres meses anteriores y los días naturales del período."
    )
    return four(base_total / Decimal(natural_days)), mode, warnings


def overtime_amount_last_twelve_months(db: Session, contract_id: int, event_date: date) -> Decimal:
    rows = payrolls_before_event(db, contract_id, event_date, 12)
    if not rows:
        return Decimal("0")
    payroll_ids = [row.id for row in rows]
    value = (
        db.query(PayrollItem)
        .join(PayrollConcept, PayrollConcept.id == PayrollItem.concept_id)
        .filter(
            PayrollItem.payroll_id.in_(payroll_ids),
            or_(
                PayrollConcept.category == "HORAS_EXTRA",
                PayrollConcept.code.like("%OVERTIME%"),
                PayrollConcept.code.like("%HORA_EXTRA%"),
            ),
        )
        .all()
    )
    return sum((Decimal(str(item.amount or 0)) for item in value), Decimal("0"))


def full_time_professional_base(
    db: Session,
    contract,
    incident,
) -> tuple[Decimal | None, str | None, list[str]]:
    rows = payrolls_before_event(db, contract.id, incident.start_date, 1)
    if not rows:
        return None, None, []
    payroll = rows[-1]
    days = Decimal(str(payroll.contribution_days or month_natural_days(payroll) or 30))
    monthly_professional = Decimal(str(payroll.professional_contingencies_base or 0))
    previous_overtime = overtime_amount_last_twelve_months(db, contract.id, incident.start_date)
    if days <= 0 or monthly_professional <= 0:
        return None, None, []

    daily_without_overtime = monthly_professional / days
    annual_overtime_daily = previous_overtime / Decimal("365")
    return (
        four(daily_without_overtime + annual_overtime_daily),
        f"professional_previous_payroll:{payroll.id}:overtime_12m",
        [
            "La base profesional incorpora el promedio diario de las horas extraordinarias de los doce meses anteriores."
        ] if previous_overtime > 0 else [],
    )


def resolve_advanced_regulatory_daily_base(
    db: Session,
    contract,
    incident,
    configuration: dict,
    fallback_daily_salary: Decimal,
) -> tuple[Decimal, str, list[str]]:
    professional = configuration.get("regulatory_base") == "professional"

    if is_part_time(contract) or is_fixed_discontinuous(contract):
        value, source, warnings = prorated_window_base(db, contract, incident, professional)
        if value is not None:
            return value, source or "three_month_average", warnings

    if professional and not is_part_time(contract):
        value, source, warnings = full_time_professional_base(db, contract, incident)
        if value is not None:
            return value, source or "professional_previous_payroll", warnings

    rows = payrolls_before_event(db, contract.id, incident.start_date, 1)
    if rows:
        payroll = rows[-1]
        base = payroll.professional_contingencies_base if professional else payroll.common_contingencies_base
        days = Decimal(str(payroll.contribution_days or 30))
        if Decimal(str(base or 0)) > 0 and days > 0:
            return four(Decimal(str(base)) / days), f"previous_payroll:{payroll.id}", []

    return (
        four(fallback_daily_salary),
        "salary_fallback",
        ["No existe histórico suficiente; se usa el salario diario como base reguladora provisional."],
    )
