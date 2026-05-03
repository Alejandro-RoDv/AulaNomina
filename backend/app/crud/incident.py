from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.incident import Incident
from app.models.employee import Employee
from app.models.contract import Contract
from app.models.company import Company
from app.schemas.incident import IncidentCreate, IncidentUpdate


def create_incident(db: Session, incident: IncidentCreate):
    employee = db.query(Employee).filter(Employee.id == incident.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    contract = db.query(Contract).filter(Contract.id == incident.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    company = db.query(Company).filter(Company.id == incident.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if incident.end_date and incident.end_date < incident.start_date:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")

    db_incident = Incident(**incident.model_dump())
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return get_incident(db, db_incident.id)


def get_incidents(db: Session):
    return db.query(Incident).options(
        joinedload(Incident.employee),
        joinedload(Incident.contract),
        joinedload(Incident.company),
    ).all()


def get_incident(db: Session, incident_id: int):
    return db.query(Incident).options(
        joinedload(Incident.employee),
        joinedload(Incident.contract),
        joinedload(Incident.company),
    ).filter(Incident.id == incident_id).first()


def update_incident(db: Session, incident_id: int, data: IncidentUpdate):
    db_incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not db_incident:
        return None

    update_data = data.model_dump(exclude_unset=True)

    new_start = update_data.get("start_date", db_incident.start_date)
    new_end = update_data.get("end_date", db_incident.end_date)

    if new_end and new_end < new_start:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")

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
