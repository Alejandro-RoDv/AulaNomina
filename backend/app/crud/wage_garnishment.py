import json
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.wage_garnishment import WageGarnishment
from app.schemas.wage_garnishment import WageGarnishmentCreate, WageGarnishmentUpdate


def _load_query(db: Session):
    return db.query(WageGarnishment).options(
        joinedload(WageGarnishment.employee),
        joinedload(WageGarnishment.contract),
        joinedload(WageGarnishment.company),
    )


def _validate_relations(
    db: Session,
    employee_id: int,
    company_id: int,
    contract_id: int | None,
):
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


def create_wage_garnishment(db: Session, payload: WageGarnishmentCreate):
    _validate_relations(db, payload.employee_id, payload.company_id, payload.contract_id)
    data = payload.model_dump(exclude={"calculation_snapshot"})
    _validate_business_data(data)
    data["calculation_detail"] = json.dumps(payload.calculation_snapshot, ensure_ascii=False)

    record = WageGarnishment(**data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return get_wage_garnishment(db, record.id)


def get_wage_garnishments(
    db: Session,
    company_id: int | None = None,
    employee_id: int | None = None,
    status: str | None = None,
):
    query = _load_query(db)
    if company_id is not None:
        query = query.filter(WageGarnishment.company_id == company_id)
    if employee_id is not None:
        query = query.filter(WageGarnishment.employee_id == employee_id)
    if status:
        query = query.filter(WageGarnishment.status == status)
    return query.order_by(WageGarnishment.start_date.desc(), WageGarnishment.id.desc()).all()


def get_wage_garnishment(db: Session, garnishment_id: int):
    return _load_query(db).filter(WageGarnishment.id == garnishment_id).first()


def update_wage_garnishment(db: Session, garnishment_id: int, payload: WageGarnishmentUpdate):
    record = db.query(WageGarnishment).filter(WageGarnishment.id == garnishment_id).first()
    if not record:
        return None

    update_data = payload.model_dump(exclude_unset=True, exclude={"calculation_snapshot"})
    employee_id = update_data.get("employee_id", record.employee_id)
    company_id = update_data.get("company_id", record.company_id)
    contract_id = update_data.get("contract_id", record.contract_id)
    _validate_relations(db, employee_id, company_id, contract_id)

    merged = {
        "start_date": update_data.get("start_date", record.start_date),
        "end_date": update_data.get("end_date", record.end_date),
        "extra_pay_prorated": update_data.get("extra_pay_prorated", record.extra_pay_prorated),
        "includes_full_extra_pay": update_data.get("includes_full_extra_pay", record.includes_full_extra_pay),
        "total_debt": update_data.get("total_debt", record.total_debt),
        "withheld_to_date": update_data.get("withheld_to_date", record.withheld_to_date),
    }
    _validate_business_data(merged)

    for key, value in update_data.items():
        setattr(record, key, value)

    if "calculation_snapshot" in payload.model_fields_set:
        record.calculation_detail = json.dumps(payload.calculation_snapshot or {}, ensure_ascii=False)

    if record.status == "active" and record.end_date and record.end_date < date.today():
        record.status = "completed"

    db.commit()
    db.refresh(record)
    return get_wage_garnishment(db, record.id)


def delete_wage_garnishment(db: Session, garnishment_id: int):
    record = db.query(WageGarnishment).filter(WageGarnishment.id == garnishment_id).first()
    if not record:
        return None
    db.delete(record)
    db.commit()
    return record
