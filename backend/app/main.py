from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db import Base, engine, SessionLocal
from app.db_init import init_database
from app.models import User, Employee, Company
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
from app.schemas.company import CompanyCreate, CompanyResponse
from app.crud.company import (
    create_company,
    get_companies,
    get_companies_all,
    get_company_by_cif,
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

# MVP: create tables and ensure missing columns exist
init_database()


# dependencia DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "AulaNomina backend activo"}


# EMPLOYEES
@app.get("/employees/next-code")
def get_next_employee_code_endpoint(db: Session = Depends(get_db)):
    return {"employee_code": get_next_employee_code(db)}


@app.post("/employees", response_model=EmployeeResponse)
def create_employee_endpoint(employee: EmployeeCreate, db: Session = Depends(get_db)):
    if get_employee_by_dni(db, employee.dni):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese DNI")

    if employee.naf and get_employee_by_naf(db, employee.naf):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese NAF")

    if employee.email and get_employee_by_email(db, employee.email):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese email")

    return create_employee(db, employee)


@app.get("/employees", response_model=list[EmployeeResponse])
def list_employees(db: Session = Depends(get_db)):
    return get_employees(db)


@app.get("/employees/all", response_model=list[EmployeeResponse])
def list_all_employees(db: Session = Depends(get_db)):
    return get_employees_all(db)


@app.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee_endpoint(
    employee_id: int,
    employee: EmployeeUpdate,
    db: Session = Depends(get_db),
):
    current_employee = get_employee(db, employee_id)
    if not current_employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    if employee.dni:
        existing = get_employee_by_dni(db, employee.dni)
        if existing and existing.id != employee_id:
            raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese DNI")

    if employee.naf:
        existing = get_employee_by_naf(db, employee.naf)
        if existing and existing.id != employee_id:
            raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese NAF")

    if employee.email:
        existing = get_employee_by_email(db, employee.email)
        if existing and existing.id != employee_id:
            raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese email")

    return update_employee(db, employee_id, employee)


@app.delete("/employees/{employee_id}", response_model=EmployeeResponse)
def delete_employee_endpoint(employee_id: int, db: Session = Depends(get_db)):
    deleted_employee = soft_delete_employee(db, employee_id)
    if not deleted_employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    return deleted_employee


# CONTRACTS
@app.post("/contracts", response_model=ContractResponse)
def create_contract_endpoint(contract: ContractCreate, db: Session = Depends(get_db)):
    return create_contract(db, contract)


@app.get("/contracts", response_model=list[ContractResponse])
def get_contracts_endpoint(db: Session = Depends(get_db)):
    return get_contracts(db)


@app.put("/contracts/{contract_id}", response_model=ContractResponse)
def update_contract_endpoint(
    contract_id: int,
    contract: ContractUpdate,
    db: Session = Depends(get_db),
):
    updated_contract = update_contract(db, contract_id, contract)
    if not updated_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    return updated_contract


@app.delete("/contracts/{contract_id}", response_model=ContractResponse)
def delete_contract_endpoint(contract_id: int, db: Session = Depends(get_db)):
    deleted_contract = soft_delete_contract(db, contract_id)
    if not deleted_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    return deleted_contract


# COMPANIES
@app.get("/companies", response_model=list[CompanyResponse])
def get_companies_endpoint(db: Session = Depends(get_db)):
    return get_companies(db)


@app.get("/companies/all", response_model=list[CompanyResponse])
def get_companies_all_endpoint(db: Session = Depends(get_db)):
    return get_companies_all(db)


@app.post("/companies", response_model=CompanyResponse)
def create_company_endpoint(company: CompanyCreate, db: Session = Depends(get_db)):
    if get_company_by_cif(db, company.cif):
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CIF")

    return create_company(db, company)
