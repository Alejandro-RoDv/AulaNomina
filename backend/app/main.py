from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine, SessionLocal
from app.models import User, Employee
from app.models import User, Employee
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

app = FastAPI(title="AulaNomina API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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


# CREATE
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


# READ ALL ACTIVE
@app.get("/employees", response_model=list[EmployeeResponse])
def list_employees(db: Session = Depends(get_db)):
    return get_employees(db)


# READ ALL
@app.get("/employees/all", response_model=list[EmployeeResponse])
def list_all_employees(db: Session = Depends(get_db)):
    return get_employees_all(db)


# READ ONE
@app.get("/employees/{employee_id}", response_model=EmployeeResponse)
def get_employee_endpoint(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


# UPDATE
@app.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee_endpoint(
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: Session = Depends(get_db)
):
    current_employee = get_employee(db, employee_id)
    if not current_employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee_with_code = get_employee_by_code(db, employee_data.employee_code)
    if employee_with_code and employee_with_code.id != employee_id:
        raise HTTPException(status_code=400, detail="Employee code already exists")

    employee_with_dni = get_employee_by_dni(db, employee_data.dni)
    if employee_with_dni and employee_with_dni.id != employee_id:
        raise HTTPException(status_code=400, detail="DNI already exists")

    if employee_data.email:
        employee_with_email = get_employee_by_email(db, employee_data.email)
        if employee_with_email and employee_with_email.id != employee_id:
            raise HTTPException(status_code=400, detail="Email already exists")

    updated_employee = update_employee(db, employee_id, employee_data)
    return updated_employee


# SOFT DELETE
@app.delete("/employees/{employee_id}")
def delete_employee_endpoint(employee_id: int, db: Session = Depends(get_db)):
    employee = soft_delete_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee marked as inactive"}


# CREATE contract
@app.post("/contracts", response_model=ContractResponse)
def create_contract_endpoint(contract: ContractCreate, db: Session = Depends(get_db)):
    return create_contract(db, contract)


# READ all contracts
@app.get("/contracts", response_model=list[ContractResponse])
def get_contracts_endpoint(db: Session = Depends(get_db)):
    return get_contracts(db)


# READ one contract
@app.get("/contracts/{contract_id}", response_model=ContractResponse)
def get_contract_endpoint(contract_id: int, db: Session = Depends(get_db)):
    db_contract = get_contract(db, contract_id)
    if not db_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return db_contract


# UPDATE contract
@app.put("/contracts/{contract_id}", response_model=ContractResponse)
def update_contract_endpoint(
    contract_id: int,
    contract_data: ContractUpdate,
    db: Session = Depends(get_db)
):
    db_contract = update_contract(db, contract_id, contract_data)
    if not db_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return db_contract


# SOFT DELETE contract
@app.delete("/contracts/{contract_id}", response_model=ContractResponse)
def delete_contract_endpoint(contract_id: int, db: Session = Depends(get_db)):
    db_contract = soft_delete_contract(db, contract_id)
    if not db_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return db_contract


# GET contracts by employee
@app.get("/employees/{employee_id}/contracts", response_model=list[ContractResponse])
def get_employee_contracts_endpoint(employee_id: int, db: Session = Depends(get_db)):
    return get_contracts_by_employee(db, employee_id)