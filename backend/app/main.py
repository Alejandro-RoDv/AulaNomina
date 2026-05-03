from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db import Base, engine, SessionLocal
from app.db_init import init_database
from app.models import User, Employee, Company, Incident
from app.models.contract import Contract
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.crud.employee import (
    create_employee,
    get_employees,
    get_employees_all,
    get_employee,
    update_employee,
    soft_delete_employee,
    get_employee_by_code,
    get_employee_by_dni,
    get_employee_by_email,
    get_employee_by_naf,
    get_next_employee_code,
)
from app.schemas.contract import ContractCreate, ContractUpdate, ContractResponse
from app.crud.contract import (
    create_contract,
    get_contracts,
    get_contract,
    update_contract,
    soft_delete_contract,
    get_contracts_by_employee,
)
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse
from app.crud.company import (
    create_company,
    get_companies,
    get_companies_all,
    get_company,
    get_company_by_cif,
    get_company_by_ccc,
    update_company,
    soft_delete_company,
)
from app.schemas.incident import IncidentCreate, IncidentUpdate, IncidentResponse
from app.crud.incident import (
    create_incident,
    get_incidents,
    get_incident,
    update_incident,
    delete_incident,
)

app = FastAPI(title="AulaNomina API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_database()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "AulaNomina backend activo"}

# INCIDENTS
@app.get("/incidents", response_model=list[IncidentResponse])
def list_incidents(db: Session = Depends(get_db)):
    return get_incidents(db)


@app.post("/incidents", response_model=IncidentResponse)
def create_incident_endpoint(data: IncidentCreate, db: Session = Depends(get_db)):
    return create_incident(db, data)


@app.put("/incidents/{incident_id}", response_model=IncidentResponse)
def update_incident_endpoint(incident_id: int, data: IncidentUpdate, db: Session = Depends(get_db)):
    updated = update_incident(db, incident_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return updated


@app.delete("/incidents/{incident_id}")
def delete_incident_endpoint(incident_id: int, db: Session = Depends(get_db)):
    deleted = delete_incident(db, incident_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return {"ok": True}

# RESTO IGUAL (employees, contracts, companies)
