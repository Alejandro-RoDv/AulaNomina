from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import joinedload

from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollItem


MONEY = Decimal("0.01")
SOURCE_TYPE = "incident_concept_engine"


def money(value):
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def payroll_period_bounds(payroll):
    if payroll.period_month not in range(1, 13):
        return date(payroll.period_year, 1, 1), date(payroll.period_year, 12, 31)
    return (
        date(payroll.period_year, payroll.period_month, 1),
        date(
            payroll.period_year,
            payroll.period_month,
            monthrange(payroll.period_year, payroll.period_month)[1],
        ),
    )


def active_contract_concepts(db, payroll):
    period_start, period_end = payroll_period_bounds(payroll)
    return (
        db.query(ContractPayrollConcept)
        .options(joinedload(ContractPayrollConcept.concept))
        .filter(
            ContractPayrollConcept.contract_id == payroll.contract_id,
            ContractPayrollConcept.is_active.is_(True),
            (
                ContractPayrollConcept.start_date.is_(None)
                | (ContractPayrollConcept.start_date <= period_end)
            ),
            (
                ContractPayrollConcept.end_date.is_(None)
                | (ContractPayrollConcept.end_date >= period_start)
            ),
        )
        .order_by(ContractPayrollConcept.display_order, ContractPayrollConcept.id)
        .all()
    )


def concept_monthly_amount(line):
    direct = Decimal(str(line.amount or 0))
    if direct:
        return money(direct)
    return money(Decimal(str(line.quantity or 0)) * Decimal(str(line.unit_price or 0)))


def segment_ratio(segment):
    return Decimal(str(segment.payroll_days or 0)) / Decimal("30")


def segment_factor(line, segment):
    ratio = segment_ratio(segment)
    if not line.concept or not line.concept.applies_workday_percentage:
        return ratio
    salary_percentage = Decimal(str(segment.salary_percentage or 0))
    if segment.segment_type.startswith(("it_", "work_accident", "occupational", "protected")):
        treatment = str((line.notes or "")).lower()
        if "mantener en it" in treatment or "maintain_it" in treatment:
            return ratio
    return ratio * salary_percentage


def sync_segmented_contract_concepts(db, payroll):
    segments = [
        segment
        for segment in payroll.segments
        if not segment.segment_type.startswith("overtime")
    ]
    lines = active_contract_concepts(db, payroll)
    existing = {
        item.source_key: item
        for item in db.query(PayrollItem)
        .filter(
            PayrollItem.payroll_id == payroll.id,
            PayrollItem.source_type == SOURCE_TYPE,
        )
        .all()
        if item.source_key
    }
    desired = set()
    total = Decimal("0")
    created = updated = 0

    for line in lines:
        monthly = concept_monthly_amount(line)
        if not line.concept or monthly == 0:
            continue
        for segment in segments:
            amount = money(monthly * segment_factor(line, segment))
            if amount == 0:
                continue
            key = f"payroll:{payroll.id}:contract-concept:{line.id}:segment:{segment.id}"
            desired.add(key)
            total += amount
            values = {
                "concept_id": line.concept_id,
                "description": (
                    f"{line.description or line.concept.name} ÷ "
                    f"{segment.start_date:%d/%m}-{segment.end_date:%d/%m}"
                ),
                "quantity": segment.payroll_days,
                "unit_price": money(monthly / Decimal("30")),
                "amount": amount,
                "display_order": line.display_order,
                "notes": "Concepto permanente segmentado automáticamente.",
                "source_id": line.id,
                "segment_id": segment.id,
                "is_automatic": True,
                "calculation_trace": {
                    "contract_concept_id": line.id,
                    "segment_key": segment.segment_key,
                    "monthly_amount": str(monthly),
                    "payroll_days": str(segment.payroll_days),
                    "salary_percentage": str(segment.salary_percentage),
                    "applies_workday_percentage": bool(
                        line.concept.applies_workday_percentage
                    ),
                },
            }
            item = existing.get(key)
            if item is None:
                db.add(
                    PayrollItem(
                        payroll_id=payroll.id,
                        source_type=SOURCE_TYPE,
                        source_key=key,
                        **values,
                    )
                )
                created += 1
            else:
                for field, value in values.items():
                    setattr(item, field, value)
                item.updated_at = datetime.utcnow()
                updated += 1

    stale = [item for key, item in existing.items() if key not in desired]
    for item in stale:
        db.delete(item)
    db.flush()
    return {
        "total": money(total),
        "created": created,
        "updated": updated,
        "deleted": len(stale),
    }
