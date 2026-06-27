from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.payroll import Payroll
from app.models.wage_garnishment import WageGarnishment
from app.models.wage_garnishment_movement import WageGarnishmentMovement
from app.schemas.wage_garnishment_movement import (
    WageGarnishmentMovementCreate,
    WageGarnishmentMovementUpdate,
)
from app.services.wage_garnishment_calculator import calculate_wage_garnishment


def _get_parent(db: Session, garnishment_id: int):
    parent = db.query(WageGarnishment).filter(
        WageGarnishment.id == garnishment_id,
        WageGarnishment.archived.is_(False),
    ).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Embargo no encontrado")
    return parent


def _validate_payroll(db: Session, payroll_id: int | None, parent: WageGarnishment):
    if payroll_id is None:
        return None
    payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if payroll.employee_id != parent.employee_id:
        raise HTTPException(status_code=400, detail="La nómina no pertenece al trabajador del embargo")
    return payroll


def _calculate(parent: WageGarnishment, monthly_net: Decimal, smi_annual: Decimal):
    return calculate_wage_garnishment(
        monthly_net=monthly_net,
        smi_annual=smi_annual,
        reduction_percentage=parent.reduction_percentage,
        extra_pay_prorated=parent.extra_pay_prorated,
        includes_full_extra_pay=False,
        extra_pay_amount=Decimal("0"),
    )


def _refresh_balances(db: Session, parent: WageGarnishment):
    movements = (
        db.query(WageGarnishmentMovement)
        .filter(WageGarnishmentMovement.wage_garnishment_id == parent.id)
        .order_by(WageGarnishmentMovement.period_year, WageGarnishmentMovement.period_month, WageGarnishmentMovement.id)
        .all()
    )
    accumulated = Decimal("0.00")
    for movement in movements:
        if movement.payment_status != "cancelled":
            accumulated += movement.withheld_amount or Decimal("0.00")
        movement.balance_after = (
            max(Decimal("0.00"), parent.total_debt - accumulated)
            if parent.total_debt is not None
            else None
        )
    parent.withheld_to_date = accumulated
    if parent.total_debt is not None and accumulated >= parent.total_debt and parent.status == "active":
        parent.status = "completed"
    db.flush()


def list_movements(db: Session, garnishment_id: int):
    _get_parent(db, garnishment_id)
    return (
        db.query(WageGarnishmentMovement)
        .filter(WageGarnishmentMovement.wage_garnishment_id == garnishment_id)
        .order_by(WageGarnishmentMovement.period_year.desc(), WageGarnishmentMovement.period_month.desc())
        .all()
    )


def create_movement(db: Session, garnishment_id: int, payload: WageGarnishmentMovementCreate):
    parent = _get_parent(db, garnishment_id)
    if parent.status not in {"active", "suspended"}:
        raise HTTPException(status_code=400, detail="Solo pueden registrarse movimientos en embargos activos o suspendidos")
    _validate_payroll(db, payload.payroll_id, parent)
    existing = db.query(WageGarnishmentMovement).filter(
        WageGarnishmentMovement.wage_garnishment_id == garnishment_id,
        WageGarnishmentMovement.period_year == payload.period_year,
        WageGarnishmentMovement.period_month == payload.period_month,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un movimiento para ese periodo")

    calculation = _calculate(parent, payload.monthly_net, payload.smi_annual)
    calculated_amount = Decimal(str(calculation["totalEmbargable"]))
    if payload.withheld_amount > calculated_amount:
        raise HTTPException(status_code=400, detail="La cantidad retenida no puede superar el máximo calculado")
    if parent.remaining_debt is not None and payload.withheld_amount > parent.remaining_debt:
        raise HTTPException(status_code=400, detail="La cantidad retenida no puede superar la deuda pendiente")

    data = payload.model_dump(exclude={"calculated_amount"})
    data["calculated_amount"] = calculated_amount
    movement = WageGarnishmentMovement(wage_garnishment_id=garnishment_id, **data)
    db.add(movement)
    db.flush()
    _refresh_balances(db, parent)
    db.commit()
    db.refresh(movement)
    return movement


def update_movement(
    db: Session,
    garnishment_id: int,
    movement_id: int,
    payload: WageGarnishmentMovementUpdate,
):
    parent = _get_parent(db, garnishment_id)
    movement = db.query(WageGarnishmentMovement).filter(
        WageGarnishmentMovement.id == movement_id,
        WageGarnishmentMovement.wage_garnishment_id == garnishment_id,
    ).first()
    if not movement:
        return None
    update_data = payload.model_dump(exclude_unset=True, exclude={"calculated_amount"})
    payroll_id = update_data.get("payroll_id", movement.payroll_id)
    _validate_payroll(db, payroll_id, parent)
    monthly_net = update_data.get("monthly_net", movement.monthly_net)
    smi_annual = update_data.get("smi_annual", movement.smi_annual)
    calculation = _calculate(parent, monthly_net, smi_annual)
    calculated_amount = Decimal(str(calculation["totalEmbargable"]))
    withheld_amount = update_data.get("withheld_amount", movement.withheld_amount)
    if withheld_amount > calculated_amount:
        raise HTTPException(status_code=400, detail="La cantidad retenida no puede superar el máximo calculado")

    for key, value in update_data.items():
        setattr(movement, key, value)
    movement.calculated_amount = calculated_amount
    _refresh_balances(db, parent)
    db.commit()
    db.refresh(movement)
    return movement


def delete_movement(db: Session, garnishment_id: int, movement_id: int):
    parent = _get_parent(db, garnishment_id)
    movement = db.query(WageGarnishmentMovement).filter(
        WageGarnishmentMovement.id == movement_id,
        WageGarnishmentMovement.wage_garnishment_id == garnishment_id,
    ).first()
    if not movement:
        return None
    db.delete(movement)
    db.flush()
    _refresh_balances(db, parent)
    db.commit()
    return movement
