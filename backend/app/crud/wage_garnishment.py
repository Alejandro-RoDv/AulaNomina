import json
from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.wage_garnishment import WageGarnishment
from app.schemas.wage_garnishment import WageGarnishmentCreate, WageGarnishmentUpdate
from app.services.wage_garnishment_calculator import calculate_wage_garnishment


def _load_query(db: Session):
    return db.query(WageGarnishment).options(
        joinedload(WageGarnishment.employee),
        joinedload(WageGarnishment.contract),
        joinedload(WageGarnishment.company),
        joinedload(WageGarnishment.movements),
        joinedload(WageGarnishment.documents),
    )


def _validate_relations(db: Session, employee_id: int, company_id: int, contract_id: int | None):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if employee.company_id and employee.company_id != company_id:
        raise HTTPException(status_code=400, detail="El trabajador no pertenece a la empresa seleccionada")

    contract = None
    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if not contract:
            raise HTTPException(status_code=404, detail="Contrato no encontrado")
        if contract.employee_id != employee_id:
            raise HTTPException(status_code=400, detail="El contrato no pertenece al trabajador seleccionado")
        if contract.company_id and contract.company_id != company_id:
            raise HTTPException(status_code=400, detail="El contrato no pertenece a la empresa seleccionada")
    return employee, company, contract


def _validate_business_data(data: dict):
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="La fecha fin no puede ser anterior a la fecha de inicio")
    if data.get("extra_pay_prorated") and data.get("includes_full_extra_pay"):
        raise HTTPException(status_code=400, detail="No se pueden combinar pagas prorrateadas y paga extra completa")
    total_debt = data.get("total_debt")
    withheld = data.get("withheld_to_date", Decimal("0")) or Decimal("0")
    if total_debt is not None and withheld > total_debt:
        raise HTTPException(status_code=400, detail="Lo retenido no puede superar la deuda total")
    reduction = Decimal(str(data.get("reduction_percentage", 0) or 0))
    authorized = bool(data.get("reduction_authorized", False))
    if reduction > 0 and not authorized:
        raise HTTPException(status_code=400, detail="La reducción debe estar autorizada por el órgano ejecutante")
    if authorized and reduction not in {Decimal("10"), Decimal("15")}:
        raise HTTPException(status_code=400, detail="La reducción autorizada debe ser del 10 % o del 15 %")
    if authorized and not data.get("reduction_authorization_reference"):
        raise HTTPException(status_code=400, detail="Debe indicarse la referencia de la resolución de reducción")


def _validate_priority(
    db: Session,
    employee_id: int,
    company_id: int,
    status: str,
    priority: int,
    exclude_id: int | None = None,
):
    if status != "active":
        return
    query = db.query(WageGarnishment).filter(
        WageGarnishment.employee_id == employee_id,
        WageGarnishment.company_id == company_id,
        WageGarnishment.status == "active",
        WageGarnishment.archived.is_(False),
        WageGarnishment.priority == priority,
    )
    if exclude_id is not None:
        query = query.filter(WageGarnishment.id != exclude_id)
    if query.first():
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe un embargo activo con prioridad {priority} para este trabajador",
        )


def _authoritative_calculation(data: dict):
    try:
        return calculate_wage_garnishment(
            monthly_net=Decimal(str(data.get("monthly_net", 0))),
            smi_annual=Decimal(str(data.get("smi_annual", 0))),
            reduction_percentage=Decimal(str(data.get("reduction_percentage", 0) or 0)),
            extra_pay_prorated=bool(data.get("extra_pay_prorated", False)),
            includes_full_extra_pay=bool(data.get("includes_full_extra_pay", False)),
            extra_pay_amount=Decimal(str(data.get("extra_pay_amount", 0) or 0)),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def create_wage_garnishment(db: Session, payload: WageGarnishmentCreate):
    data = payload.model_dump(exclude={"calculation_snapshot", "monthly_garnishable"})
    _validate_relations(db, payload.employee_id, payload.company_id, payload.contract_id)
    _validate_business_data(data)
    _validate_priority(db, payload.employee_id, payload.company_id, payload.status, payload.priority)
    calculation = _authoritative_calculation(data)
    data["monthly_garnishable"] = Decimal(str(calculation["totalEmbargable"]))
    data["calculation_detail"] = json.dumps(calculation, ensure_ascii=False)

    record = WageGarnishment(**data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return get_wage_garnishment(db, record.id, include_archived=True)


def get_wage_garnishments(
    db: Session,
    company_id: int | None = None,
    employee_id: int | None = None,
    status: str | None = None,
    include_archived: bool = False,
):
    query = _load_query(db)
    if not include_archived:
        query = query.filter(WageGarnishment.archived.is_(False))
    if company_id is not None:
        query = query.filter(WageGarnishment.company_id == company_id)
    if employee_id is not None:
        query = query.filter(WageGarnishment.employee_id == employee_id)
    if status:
        query = query.filter(WageGarnishment.status == status)
    return query.order_by(WageGarnishment.priority.asc(), WageGarnishment.start_date.desc(), WageGarnishment.id.desc()).all()


def get_wage_garnishment(db: Session, garnishment_id: int, include_archived: bool = False):
    query = _load_query(db).filter(WageGarnishment.id == garnishment_id)
    if not include_archived:
        query = query.filter(WageGarnishment.archived.is_(False))
    return query.first()


def update_wage_garnishment(db: Session, garnishment_id: int, payload: WageGarnishmentUpdate):
    record = db.query(WageGarnishment).filter(WageGarnishment.id == garnishment_id).first()
    if not record or record.archived:
        return None

    update_data = payload.model_dump(exclude_unset=True, exclude={"calculation_snapshot", "monthly_garnishable"})
    merged = {
        field: update_data.get(field, getattr(record, field))
        for field in (
            "employee_id", "company_id", "contract_id", "status", "priority", "start_date", "end_date",
            "total_debt", "withheld_to_date", "monthly_net", "smi_annual", "reduction_percentage",
            "reduction_authorized", "reduction_authorization_date", "reduction_authorization_reference",
            "extra_pay_prorated", "includes_full_extra_pay", "extra_pay_amount", "family_burdens",
        )
    }
    _validate_relations(db, merged["employee_id"], merged["company_id"], merged["contract_id"])
    _validate_business_data(merged)
    _validate_priority(
        db,
        merged["employee_id"],
        merged["company_id"],
        merged["status"],
        merged["priority"],
        exclude_id=record.id,
    )
    calculation = _authoritative_calculation(merged)

    for key, value in update_data.items():
        setattr(record, key, value)
    record.monthly_garnishable = Decimal(str(calculation["totalEmbargable"]))
    record.calculation_detail = json.dumps(calculation, ensure_ascii=False)
    record.updated_by = update_data.get("updated_by") or "usuario-demo"
    if record.status == "active" and record.end_date and record.end_date < date.today():
        record.status = "completed"

    db.commit()
    db.refresh(record)
    return get_wage_garnishment(db, record.id, include_archived=True)


def delete_wage_garnishment(
    db: Session,
    garnishment_id: int,
    reason: str | None = None,
    deleted_by: str = "usuario-demo",
):
    record = _load_query(db).filter(WageGarnishment.id == garnishment_id).first()
    if not record:
        return None

    if record.status == "draft" and not record.movements:
        db.delete(record)
        db.commit()
        return {"mode": "deleted", "id": garnishment_id}

    if not reason or not reason.strip():
        raise HTTPException(status_code=400, detail="Debe indicarse un motivo para archivar el expediente")
    record.archived = True
    record.status = "cancelled"
    record.deleted_at = datetime.utcnow()
    record.deleted_by = deleted_by
    record.deleted_reason = reason.strip()
    db.commit()
    return {"mode": "archived", "id": garnishment_id}
