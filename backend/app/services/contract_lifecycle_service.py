from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.contract_lifecycle_event import ContractLifecycleEvent
from app.schemas.contract_lifecycle import ContractExtensionRequest, ContractWorkdayChangeRequest


class ContractLifecycleError(ValueError):
    pass


def _partiality(weekly_hours: float, full_time_weekly_hours: float | None) -> float:
    reference = float(full_time_weekly_hours or 40)
    if reference <= 0:
        raise ContractLifecycleError("La jornada completa de referencia debe ser mayor que cero")
    return round((float(weekly_hours) / reference) * 100, 2)


def _monthly_hours(weekly_hours: float) -> float:
    return round(float(weekly_hours) * 52 / 12, 2)


def _annual_hours(weekly_hours: float) -> float:
    return round(float(weekly_hours) * 52, 2)


def get_contract_or_error(db: Session, contract_id: int) -> Contract:
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise ContractLifecycleError("Contrato no encontrado")
    return contract


def list_contract_lifecycle_events(db: Session, contract_id: int) -> list[ContractLifecycleEvent]:
    get_contract_or_error(db, contract_id)
    return (
        db.query(ContractLifecycleEvent)
        .filter(ContractLifecycleEvent.contract_id == contract_id)
        .order_by(ContractLifecycleEvent.effective_date.asc(), ContractLifecycleEvent.id.asc())
        .all()
    )


def register_workday_change(
    db: Session,
    contract_id: int,
    payload: ContractWorkdayChangeRequest,
) -> ContractLifecycleEvent:
    contract = get_contract_or_error(db, contract_id)
    if contract.status not in {"active", "draft"}:
        raise ContractLifecycleError("Solo puede modificarse la jornada de un contrato vigente o en borrador")
    if payload.effective_date < contract.start_date:
        raise ContractLifecycleError("La fecha de efectos no puede ser anterior al inicio del contrato")
    if contract.end_date and payload.effective_date > contract.end_date:
        raise ContractLifecycleError("La fecha de efectos no puede ser posterior al fin del contrato")

    previous_weekly = float(contract.weekly_hours or contract.full_time_weekly_hours or 40)
    previous_partiality = float(contract.partiality_coefficient or _partiality(previous_weekly, contract.full_time_weekly_hours))
    new_partiality = _partiality(payload.weekly_hours, contract.full_time_weekly_hours)
    new_type = "full_time" if abs(new_partiality - 100) < 0.01 else "part_time"

    event = ContractLifecycleEvent(
        contract_id=contract.id,
        event_type="workday_change",
        effective_date=payload.effective_date,
        reason=payload.reason.strip(),
        previous_state={
            "working_day_type": contract.working_day_type,
            "weekly_hours": previous_weekly,
            "partiality_coefficient": previous_partiality,
            "monthly_hours": contract.monthly_hours,
            "annual_hours": contract.annual_hours,
        },
        new_state={
            "working_day_type": new_type,
            "weekly_hours": float(payload.weekly_hours),
            "partiality_coefficient": new_partiality,
            "monthly_hours": _monthly_hours(payload.weekly_hours),
            "annual_hours": _annual_hours(payload.weekly_hours),
        },
    )
    db.add(event)

    contract.working_day_type = new_type
    contract.weekly_hours = float(payload.weekly_hours)
    contract.partiality_coefficient = new_partiality
    contract.monthly_hours = _monthly_hours(payload.weekly_hours)
    contract.annual_hours = _annual_hours(payload.weekly_hours)
    db.commit()
    db.refresh(event)
    return event


def register_contract_extension(
    db: Session,
    contract_id: int,
    payload: ContractExtensionRequest,
) -> ContractLifecycleEvent:
    contract = get_contract_or_error(db, contract_id)
    if not contract.end_date:
        raise ContractLifecycleError("La prórroga requiere una fecha fin previa")
    if payload.new_end_date <= contract.end_date:
        raise ContractLifecycleError("La nueva fecha fin debe ser posterior a la vigente")
    if payload.effective_date > payload.new_end_date:
        raise ContractLifecycleError("La fecha de efectos no puede ser posterior a la nueva fecha fin")

    previous_end_date = contract.end_date
    event = ContractLifecycleEvent(
        contract_id=contract.id,
        event_type="extension",
        effective_date=payload.effective_date,
        reason=payload.reason.strip(),
        previous_state={"end_date": previous_end_date.isoformat(), "status": contract.status},
        new_state={"end_date": payload.new_end_date.isoformat(), "status": "active"},
    )
    db.add(event)
    contract.end_date = payload.new_end_date
    contract.status = "active"
    contract.termination_reason = None
    db.commit()
    db.refresh(event)
    return event


def register_contract_transformation(
    db: Session,
    contract_id: int,
    *,
    transformation_date,
    reason: str,
    new_contract_type: str = "indefinido",
) -> ContractLifecycleEvent:
    """Registra trazabilidad de una transformación ya formalizada en otro contrato.

    La creación del nuevo contrato continúa usando el CRUD contractual general. Esta
    operación sirve para cerrar el contrato de origen y dejar evidencia histórica.
    """
    contract = get_contract_or_error(db, contract_id)
    if transformation_date <= contract.start_date:
        raise ContractLifecycleError("La transformación debe ser posterior al inicio del contrato de origen")
    previous = {"contract_type": contract.contract_type, "status": contract.status, "end_date": contract.end_date.isoformat() if contract.end_date else None}
    contract.status = "transformed"
    contract.end_date = transformation_date - timedelta(days=1)
    event = ContractLifecycleEvent(
        contract_id=contract.id,
        event_type="transformation",
        effective_date=transformation_date,
        reason=reason.strip(),
        previous_state=previous,
        new_state={"contract_type": new_contract_type, "status": "transformed", "end_date": contract.end_date.isoformat()},
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
