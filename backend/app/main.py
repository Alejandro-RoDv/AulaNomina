from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.db_init import init_database
from app.models import User, Employee, Company, Incident, Payroll, Document
from app.models.contract import Contract
from app.seed_demo import seed_demo_data
from app.seed_demo_agreements import seed_demo_collective_agreements
from app.seed_demo_documents import seed_demo_documents
from app.case_study_routes import router as case_study_router
from app.irpf_summary_routes import router as irpf_summary_router
from app.collective_agreement_routes import router as collective_agreement_router
from app.payroll_salary_structure_routes import router as payroll_salary_structure_router
from app.crud.case_assignment import seed_demo_case_assignments
from app.crud.case_study import seed_demo_case_studies
from app.crud.correction import seed_demo_corrections
from app.crud.student import seed_demo_students
from app.crud.student_group import seed_demo_student_groups
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.schemas.employee_assignment_history import EmployeeAssignmentHistoryResponse
from app.crud.employee import (
    create_employee,
    get_employees,
    get_employees_all,
    get_employee,
    get_employee_assignment_history,
    update_employee,
    soft_delete_employee,
    get_employee_by_dni,
    get_employee_by_email,
    get_employee_by_naf,
    get_next_employee_code,
)
from app.schemas.tax_profile import IrpfCalculationInput, IrpfCalculationResponse, TaxProfileResponse, TaxProfileUpdate
from app.crud.tax_profile import get_tax_profiles, get_tax_profile_by_employee, upsert_tax_profile
from app.services.irpf_calculator import calculate_irpf_2026
from app.schemas.contract import ContractCreate, ContractUpdate, ContractResponse
from app.crud.contract import (
    create_contract,
    get_contracts,
    update_contract,
    soft_delete_contract,
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
from app.schemas.work_center import WorkCenterCreate, WorkCenterUpdate, WorkCenterResponse
from app.crud.work_center import (
    create_work_center,
    get_work_centers,
    get_work_centers_by_company,
    get_work_center,
    get_work_center_by_code,
    update_work_center,
    soft_delete_work_center,
)
from app.schemas.incident import IncidentCreate, IncidentUpdate, IncidentResponse
from app.crud.incident import (
    create_incident,
    get_incidents,
    update_incident,
    delete_incident as delete_incident_crud,
)
from app.schemas.payroll import (
    PayrollCreate,
    PayrollFutureSimulationRequest,
    PayrollFutureSimulationResponse,
    PayrollPrepareRequest,
    PayrollPrepareResponse,
    PayrollUpdate,
    PayrollResponse,
)
from app.crud.payroll import (
    create_payroll,
    get_payrolls,
    update_payroll,
    delete_payroll,
    prepare_monthly_payrolls,
    simulate_future_payrolls,
)
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse
from app.crud.document import (
    create_document,
    get_documents,
    update_document,
    delete_document,
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

app.include_router(case_study_router)
app.include_router(irpf_summary_router)
app.include_router(collective_agreement_router)
app.include_router(payroll_salary_structure_router)


@app.on_event("startup")
def startup_event():
    init_database()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"message": "AulaNomina API funcionando"}


@app.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db)):
    seed_demo_data(db)
    seed_demo_collective_agreements(db)
    seed_demo_documents(db)
    seed_demo_case_studies(db)
    seed_demo_case_assignments(db)
    seed_demo_corrections(db)
    seed_demo_students(db)
    seed_demo_student_groups(db)
    return {"ok": True, "message": "Datos demo recargados correctamente"}


@app.get("/employees/next-code")
def next_employee_code(db: Session = Depends(get_db)):
    return {"next_code": get_next_employee_code(db)}


@app.post("/employees", response_model=EmployeeResponse)
def create_employee_endpoint(employee: EmployeeCreate, db: Session = Depends(get_db)):
    if employee.dni and get_employee_by_dni(db, employee.dni):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese documento")
    if employee.email and get_employee_by_email(db, employee.email):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese email")
    if employee.naf and get_employee_by_naf(db, employee.naf):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese NAF")
    return create_employee(db, employee)


@app.get("/employees", response_model=list[EmployeeResponse])
def list_employees(db: Session = Depends(get_db)):
    return get_employees(db)


@app.get("/employees/all", response_model=list[EmployeeResponse])
def list_all_employees(db: Session = Depends(get_db)):
    return get_employees_all(db)


@app.get("/employees/{employee_id}/assignment-history", response_model=list[EmployeeAssignmentHistoryResponse])
def list_employee_assignment_history(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return get_employee_assignment_history(db, employee_id)


@app.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee_endpoint(employee_id: int, employee: EmployeeUpdate, db: Session = Depends(get_db)):
    updated_employee = update_employee(db, employee_id, employee)
    if not updated_employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return updated_employee


@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    deleted_employee = soft_delete_employee(db, employee_id)
    if not deleted_employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return {"ok": True, "deleted_id": employee_id}


@app.post("/companies", response_model=CompanyResponse)
def create_company_endpoint(company: CompanyCreate, db: Session = Depends(get_db)):
    if get_company_by_cif(db, company.cif):
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CIF")
    if company.main_ccc and get_company_by_ccc(db, company.main_ccc):
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CCC principal")
    return create_company(db, company)


@app.get("/companies", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    return get_companies(db)


@app.get("/companies/all", response_model=list[CompanyResponse])
def list_all_companies(db: Session = Depends(get_db)):
    return get_companies_all(db)


@app.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company_endpoint(company_id: int, company: CompanyUpdate, db: Session = Depends(get_db)):
    updated_company = update_company(db, company_id, company)
    if not updated_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return updated_company


@app.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    deleted_company = soft_delete_company(db, company_id)
    if not deleted_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return {"ok": True, "deleted_id": company_id}


@app.post("/work-centers", response_model=WorkCenterResponse)
def create_work_center_endpoint(work_center: WorkCenterCreate, db: Session = Depends(get_db)):
    if not get_company(db, work_center.company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if work_center.center_code and get_work_center_by_code(db, work_center.center_code):
        raise HTTPException(status_code=400, detail="Ya existe un centro con ese código")
    return create_work_center(db, work_center)


@app.get("/work-centers", response_model=list[WorkCenterResponse])
def list_work_centers(db: Session = Depends(get_db)):
    return get_work_centers(db)


@app.get("/work-centers/company/{company_id}", response_model=list[WorkCenterResponse])
def list_work_centers_by_company(company_id: int, db: Session = Depends(get_db)):
    if not get_company(db, company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return get_work_centers_by_company(db, company_id)


@app.put("/work-centers/{work_center_id}", response_model=WorkCenterResponse)
def update_work_center_endpoint(work_center_id: int, work_center: WorkCenterUpdate, db: Session = Depends(get_db)):
    updated_work_center = update_work_center(db, work_center_id, work_center)
    if not updated_work_center:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    return updated_work_center


@app.delete("/work-centers/{work_center_id}")
def delete_work_center(work_center_id: int, db: Session = Depends(get_db)):
    deleted_work_center = soft_delete_work_center(db, work_center_id)
    if not deleted_work_center:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    return {"ok": True, "deleted_id": work_center_id}


@app.post("/contracts", response_model=ContractResponse)
def create_contract_endpoint(contract: ContractCreate, db: Session = Depends(get_db)):
    return create_contract(db, contract)


@app.get("/contracts", response_model=list[ContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    return get_contracts(db)
