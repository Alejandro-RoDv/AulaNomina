from calendar import isleap
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import or_

from app.models.collective_agreement import VacationRule
from app.models.contract import Contract
from app.models.incident import Incident
from app.models.incident_advanced import VacationLedgerEntry


FOUR = Decimal("0.0001")
VACATION_TYPES = {"VACACIONES", "VACATION"}


def four(value):
    return Decimal(str(value or 0)).quantize(FOUR, rounding=ROUND_HALF_UP)


def annual_entitlement(db, contract: Contract):
    rule = None
    if contract.collective_agreement_id:
        rule = (
            db.query(VacationRule)
            .filter(
                VacationRule.collective_agreement_id == contract.collective_agreement_id,
                or_(VacationRule.professional_category_id.is_(None), VacationRule.professional_category_id == contract.professional_category_id),
                or_(VacationRule.professional_group_id.is_(None), VacationRule.professional_group_id == getattr(contract.agreement_professional_category, "professional_group_id", None)),
            )
            .order_by(VacationRule.professional_category_id.desc().nullslast(), VacationRule.id.desc())
            .first()
        )
    if rule and rule.working_days:
        return Decimal(str(rule.working_days)), "working_days", rule.id
    if rule and rule.natural_days:
        return Decimal(str(rule.natural_days)), "natural_days", rule.id
    return Decimal("30"), "natural_days", None


def active_days_in_year(contract: Contract, year: int):
    start = max(contract.start_date, date(year, 1, 1))
    end = min(contract.end_date or date(year, 12, 31), date(year, 12, 31))
    if end < start:
        return 0
    return (end - start).days + 1


def sync_vacation_ledger(db, contract: Contract, year: int):
    entitlement, unit, rule_id = annual_entitlement(db, contract)
    days_year = Decimal("366" if isleap(year) else "365")
    accrued = four(entitlement * Decimal(active_days_in_year(contract, year)) / days_year)
    accrual_key = f"vacation:contract:{contract.id}:year:{year}:accrual"
    accrual = db.query(VacationLedgerEntry).filter(VacationLedgerEntry.source_key == accrual_key).first()
    values = {
        "employee_id": contract.employee_id,
        "contract_id": contract.id,
        "year": year,
        "entry_type": "accrual",
        "unit": unit,
        "amount": accrued,
        "description": f"Devengo anual proporcional. Regla de convenio: {rule_id or 'general 30 días'}",
        "is_automatic": True,
    }
    if accrual is None:
        db.add(VacationLedgerEntry(source_key=accrual_key, **values))
    else:
        for field, value in values.items():
            setattr(accrual, field, value)

    incidents = (
        db.query(Incident)
        .filter(
            Incident.contract_id == contract.id,
            Incident.incident_type.in_(VACATION_TYPES),
            Incident.start_date <= date(year, 12, 31),
            or_(Incident.end_date.is_(None), Incident.end_date >= date(year, 1, 1)),
        )
        .all()
    )
    active_keys = {accrual_key}
    for incident in incidents:
        start = max(incident.start_date, date(year, 1, 1))
        end = min(incident.end_date or incident.start_date, date(year, 12, 31))
        amount = Decimal((end - start).days + 1)
        key = f"vacation:incident:{incident.id}:year:{year}"
        active_keys.add(key)
        entry = db.query(VacationLedgerEntry).filter(VacationLedgerEntry.source_key == key).first()
        item_values = {
            "employee_id": contract.employee_id,
            "contract_id": contract.id,
            "year": year,
            "entry_type": "taken",
            "unit": unit,
            "amount": -amount,
            "start_date": start,
            "end_date": end,
            "source_incident_id": incident.id,
            "description": "Vacaciones disfrutadas según incidencia.",
            "is_automatic": True,
        }
        if entry is None:
            db.add(VacationLedgerEntry(source_key=key, **item_values))
        else:
            for field, value in item_values.items():
                setattr(entry, field, value)

    stale = db.query(VacationLedgerEntry).filter(
        VacationLedgerEntry.contract_id == contract.id,
        VacationLedgerEntry.year == year,
        VacationLedgerEntry.is_automatic.is_(True),
        VacationLedgerEntry.source_key.notin_(active_keys),
    ).all()
    for entry in stale:
        db.delete(entry)
    db.flush()


def vacation_balance(db, employee_id: int, year: int, contract_id: int | None = None):
    query = db.query(Contract).filter(Contract.employee_id == employee_id)
    if contract_id is not None:
        query = query.filter(Contract.id == contract_id)
    contracts = query.order_by(Contract.start_date, Contract.id).all()
    if not contracts:
        return {"employee_id": employee_id, "year": year, "contracts": [], "accrued": 0, "taken": 0, "adjustments": 0, "balance": 0}

    for contract in contracts:
        sync_vacation_ledger(db, contract, year)
    db.commit()

    rows = db.query(VacationLedgerEntry).filter(
        VacationLedgerEntry.employee_id == employee_id,
        VacationLedgerEntry.year == year,
        VacationLedgerEntry.contract_id.in_([item.id for item in contracts]),
    ).order_by(VacationLedgerEntry.contract_id, VacationLedgerEntry.created_at, VacationLedgerEntry.id).all()

    accrued = sum((Decimal(str(row.amount)) for row in rows if row.entry_type in {"accrual", "carryover"}), Decimal("0"))
    taken = -sum((Decimal(str(row.amount)) for row in rows if row.entry_type == "taken"), Decimal("0"))
    adjustments = sum((Decimal(str(row.amount)) for row in rows if row.entry_type == "adjustment"), Decimal("0"))
    return {
        "employee_id": employee_id,
        "year": year,
        "contracts": [
            {
                "id": row.id,
                "contract_id": row.contract_id,
                "entry_type": row.entry_type,
                "unit": row.unit,
                "amount": row.amount,
                "start_date": row.start_date,
                "end_date": row.end_date,
                "description": row.description,
                "source_incident_id": row.source_incident_id,
                "is_automatic": row.is_automatic,
            }
            for row in rows
        ],
        "accrued": four(accrued),
        "taken": four(taken),
        "adjustments": four(adjustments),
        "balance": four(accrued - taken + adjustments),
    }


def add_vacation_adjustment(db, contract_id: int, year: int, amount, unit: str, description: str, actor: str | None):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        return None
    entry = VacationLedgerEntry(
        employee_id=contract.employee_id,
        contract_id=contract.id,
        year=year,
        entry_type="adjustment",
        unit=unit,
        amount=four(amount),
        source_key=f"vacation:adjustment:{contract.id}:{year}:{date.today().isoformat()}:{actor or 'system'}:{description}",
        description=description,
        is_automatic=False,
        created_by=actor,
    )
    db.add(entry)
    db.commit()
    return entry
