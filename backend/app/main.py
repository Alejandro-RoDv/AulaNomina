from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db import Base, engine, SessionLocal
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

Base.metadata.create_all(bind=engine)


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


# CREATE EMPLOYEE
@app.post("/employees", response_model=EmployeeResponse)
def create_employee_endpoint(
    employee: EmployeeCreate, db: Session = Depends(get_db)
):
    if get_employee_by_code(db, employee.employee_code):
        raise HTTPException(status_code=400, detail="Employee code already exists")

    if get_employee_by_dni(db, employee.dni):
        raise HTTPException(status_code=400, detail="DNI already exists")

    if employee.email and get_employee_by_email(db, employee.email):
        raise HTTPException(status_code=400, detail="Email already exists")

    return create_employee(db, employee)


@app.get("/employees", response_model=list[EmployeeResponse])
def list_employees(db: Session = Depends(get_db)):
    return get_employees(db)


@app.get("/employees/all", response_model=list[EmployeeResponse])
def list_all_employees(db: Session = Depends(get_db)):
    return get_employees_all(db)


# CONTRACTS
@app.post("/contracts", response_model=ContractResponse)
def create_contract_endpoint(contract: ContractCreate, db: Session = Depends(get_db)):
    return create_contract(db, contract)


@app.get("/contracts", response_model=list[ContractResponse])
def get_contracts_endpoint(db: Session = Depends(get_db)):
    return get_contracts(db)


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
