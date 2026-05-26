from calendar import monthrange
from datetime import date

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.incident import Incident
from app.models.employee import Employee
from app.models.contract import Contract
from app.models.company import Company
from app.models.payroll import Payroll
from app.models.work_center import WorkCenter
from app.schemas.incident import IncidentCreate, IncidentUpdate

ACTIVE_PAYROLL_STATUSES = {"draft", "pending", "calculated", "reviewed", "closed"}


def iter_months_between(start_date: date, end_date: date | None):
    current = date(start_date.year, start_date.month, 1)
    effective_end = end_date or start_date
    final = date(effective_end.year, effective_end.month, 1)

    while current <= final:
        yield current.month, current.year
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)


def get_impacted_payrolls_count(db: Session, incident: Incident) -> int:
    if not incident.affects_payroll:
        return 0

    period_filters = [
        (Payroll.period_month == month) & (Payroll.period_year == year)
        for month, year in iter_months_between(incident.start_date, incident.end_date)
    ]

    if not period_filters:
        return 0

    query = db.query(Payroll).filter(
        Payroll.contract_id == incident.contract_id,
        Payroll.status.in_(ACTIVE_PAYROLL_STATUSES),
    )

    combined_filter = period_filters[0]
    for period_filter in period_filters[1:]:
        combined_filter = combined_filter | period_filter

    return query.filter(combined_filter).count()


def annotate_incident_payroll_impact(db: Session, incident: Incident | None):
    if not incident:
        return incident

    impacted_count = get_impacted_payrolls_count(db, incident)
    incident.impacted_payrolls_count = impacted_count
    incident.has_impacted_payrolls = impacted_count > 0
    incident.payroll_message = (
        "Esta incidencia afecta a una nómina ya generada. Recalcula la nómina para aplicar los cambios."
        if impacted_count > 0
        else None
    )
    return incident


def create_incident(db: Session, incident: IncidentCreate):
    employee = db.query(Employee).filter(Employee.id == incident.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    contract = db.query(Contract).filter(Contract.id == incident.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    if contract.employee_id != employee.id:
        raise HTTPException(status_code=400, detail="El contrato seleccionado no pertenece al trabajador")

    if contract.status != "active":
        raise HTTPException(status_code=400, detail="La incidencia debe vincularse a un contrato activo")

    company_id = incident.company_id or contract.company_id or employee.company_id
    center_id = incident.center_id if incident.center_id is not None else contract.center_id or employee.center_id

    if company_id is None:
        raise HTTPException(status_code=400, detail="No se puede crear la incidencia sin empresa vinculada")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if contract.company_id and contract.company_id != company_id:
        raise HTTPException(status_code=400, detail="La empresa no coincide con la del contrato")

    if center_id is not None:
        center = db.query(WorkCenter).filter(WorkCenter.id == center_id).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa indicada")

    if incident.end_date and incident.end_date < incident.start_date:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")

    incident_data = incident.model_dump()
    incident_data["company_id"] = company_id
    incident_data["center_id"] = center_id

    db_incident = Incident(**incident_data)
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return get_incident(db, db_incident.id)


def get_incidents(db: Session):
    incidents = db.query(Incident).options(
        joinedload(Incident.employee),
        joinedload(Incident.contract),
        joinedload(Incident.company),
        joinedload(Incident.work_center),
    ).all()
    return [annotate_incident_payroll_impact(db, incident) for incident in incidents]


def get_incident(db: Session, incident_id: int):
    incident = db.query(Incident).options(
        joinedload(Incident.employee),
        joinedload(Incident.contract),
        joinedload(Incident.company),
        joinedload(Incident.work_center),
    ).filter(Incident.id == incident_id).first()
    return annotate_incident_payroll_impact(db, incident)


def update_incident(db: Session, incident_id: int, data: IncidentUpdate):
    db_incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not db_incident:
        return None

    update_data = data.model_dump(exclude_unset=True)

    new_start = update_data.get("start_date", db_incident.start_date)
    new_end = update_data.get("end_date", db_incident.end_date)

    if new_end and new_end < new_start:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")

    if "center_id" in update_data and update_data["center_id"] is not None:
        center = db.query(WorkCenter).filter(WorkCenter.id == update_data["center_id"]).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != db_incident.company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa de la incidencia")

    for key, value in update_data.items():
        setattr(db_incident, key, value)

    db.commit()
    db.refresh(db_incident)
    return get_incident(db, incident_id)


def delete_incident(db: Session, incident_id: int):
    db_incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not db_incident:
        return None

    db.delete(db_incident)
    db.commit()
    return db_incident
