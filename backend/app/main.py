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
    delete_incident,
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
    get_payroll,
    prepare_monthly_payrolls,
    simulate_future_payrolls,
    update_payroll,
    delete_payroll,
)
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse
from app.crud.document import (
    create_document,
    get_documents,
    get_documents_by_employee,
    update_document,
    mark_document_not_applicable,
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
app.include_router(case_study_router)
app.include_router(irpf_summary_router)
app.include_router(collective_agreement_router)
app.include_router(payroll_salary_structure_router)

_demo_db = SessionLocal()
try:
    seed_demo_student_groups(_demo_db)
    seed_demo_students(_demo_db)
    seed_demo_case_studies(_demo_db)
    seed_demo_case_assignments(_demo_db)
    seed_demo_corrections(_demo_db)
finally:
    _demo_db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "AulaNomina API funcionando"}


@app.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db)):
    seed_demo_data()
    seed_demo_documents(db)
    seed_demo_collective_agreements(db)
    seed_demo_student_groups(db)
    seed_demo_students(db)
    seed_demo_case_studies(db)
    seed_demo_case_assignments(db)
    seed_demo_corrections(db)
    return {"ok": True, "message": "Datos demo cargados"}


@app.get("/employees/next-code")
def get_next_employee_code_endpoint(db: Session = Depends(get_db)):
    return {"employee_code": get_next_employee_code(db)}


@app.post("/employees", response_model=EmployeeResponse)
def create_employee_endpoint(employee: EmployeeCreate, db: Session = Depends(get_db)):
    if get_employee_by_dni(db, employee.dni):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con este DNI")

    if employee.email and get_employee_by_email(db, employee.email):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con este email")

    if employee.naf and get_employee_by_naf(db, employee.naf):
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con este NAF")

    return create_employee(db, employee)


@app.get("/employees", response_model=list[EmployeeResponse])
def list_employees(include_inactive: bool = False, db: Session = Depends(get_db)):
    if include_inactive:
        return get_employees_all(db)
    return get_employees(db)


@app.get("/employees/{employee_id}", response_model=EmployeeResponse)
def read_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return employee


@app.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee_endpoint(employee_id: int, employee: EmployeeUpdate, db: Session = Depends(get_db)):
    existing_employee = get_employee(db, employee_id)
    if not existing_employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    if employee.dni and employee.dni != existing_employee.dni and get_employee_by_dni(db, employee.dni):
        raise HTTPException(status_code=400, detail="Ya existe otro trabajador con este DNI")

    if employee.email and employee.email != existing_employee.email and get_employee_by_email(db, employee.email):
        raise HTTPException(status_code=400, detail="Ya existe otro trabajador con este email")

    if employee.naf and employee.naf != existing_employee.naf and get_employee_by_naf(db, employee.naf):
        raise HTTPException(status_code=400, detail="Ya existe otro trabajador con este NAF")

    updated_employee = update_employee(db, employee_id, employee)
    return updated_employee


@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    deleted_employee = soft_delete_employee(db, employee_id)
    if not deleted_employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return {"ok": True, "deleted_id": employee_id}


@app.get("/employees/{employee_id}/assignment-history", response_model=list[EmployeeAssignmentHistoryResponse])
def read_employee_assignment_history(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return get_employee_assignment_history(db, employee_id)


@app.post("/companies", response_model=CompanyResponse)
def create_company_endpoint(company: CompanyCreate, db: Session = Depends(get_db)):
    if get_company_by_cif(db, company.cif):
        raise HTTPException(status_code=400, detail="Ya existe una empresa con este CIF")

    if company.ccc and get_company_by_ccc(db, company.ccc):
        raise HTTPException(status_code=400, detail="Ya existe una empresa con este CCC principal")

    return create_company(db, company)


@app.get("/companies", response_model=list[CompanyResponse])
def list_companies(include_inactive: bool = False, db: Session = Depends(get_db)):
    if include_inactive:
        return get_companies_all(db)
    return get_companies(db)


@app.get("/companies/{company_id}", response_model=CompanyResponse)
def read_company(company_id: int, db: Session = Depends(get_db)):
    company = get_company(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


@app.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company_endpoint(company_id: int, company: CompanyUpdate, db: Session = Depends(get_db)):
    existing_company = get_company(db, company_id)
    if not existing_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if company.cif and company.cif != existing_company.cif and get_company_by_cif(db, company.cif):
        raise HTTPException(status_code=400, detail="Ya existe otra empresa con este CIF")

    if company.ccc and company.ccc != existing_company.ccc and get_company_by_ccc(db, company.ccc):
        raise HTTPException(status_code=400, detail="Ya existe otra empresa con este CCC principal")

    updated_company = update_company(db, company_id, company)
    return updated_company


@app.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    deleted_company = soft_delete_company(db, company_id)
    if not deleted_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return {"ok": True, "deleted_id": company_id}


@app.post("/work-centers", response_model=WorkCenterResponse)
def create_work_center_endpoint(work_center: WorkCenterCreate, db: Session = Depends(get_db)):
    if get_work_center_by_code(db, work_center.center_code):
        raise HTTPException(status_code=400, detail="Ya existe un centro con este código")

    return create_work_center(db, work_center)


@app.get("/work-centers", response_model=list[WorkCenterResponse])
def list_work_centers(include_inactive: bool = False, db: Session = Depends(get_db)):
    return get_work_centers(db, include_inactive=include_inactive)


@app.get("/companies/{company_id}/work-centers", response_model=list[WorkCenterResponse])
def list_work_centers_by_company(company_id: int, db: Session = Depends(get_db)):
    if not get_company(db, company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return get_work_centers_by_company(db, company_id)


@app.get("/work-centers/{center_id}", response_model=WorkCenterResponse)
def read_work_center(center_id: int, db: Session = Depends(get_db)):
    work_center = get_work_center(db, center_id)
    if not work_center:
        raise HTTPException(status_code=404, detail="Centro de trabajo no encontrado")
    return work_center


@app.put("/work-centers/{center_id}", response_model=WorkCenterResponse)
def update_work_center_endpoint(center_id: int, work_center: WorkCenterUpdate, db: Session = Depends(get_db)):
    existing_center = get_work_center(db, center_id)
    if not existing_center:
        raise HTTPException(status_code=404, detail="Centro de trabajo no encontrado")

    if work_center.center_code and work_center.center_code != existing_center.center_code:
        if get_work_center_by_code(db, work_center.center_code):
            raise HTTPException(status_code=400, detail="Ya existe otro centro con este código")

    updated_center = update_work_center(db, center_id, work_center)
    return updated_center


@app.delete("/work-centers/{center_id}")
def delete_work_center(center_id: int, db: Session = Depends(get_db)):
    deleted_center = soft_delete_work_center(db, center_id)
    if not deleted_center:
        raise HTTPException(status_code=404, detail="Centro de trabajo no encontrado")
    return {"ok": True, "deleted_id": center_id}


@app.post("/contracts", response_model=ContractResponse)
def create_contract_endpoint(contract: ContractCreate, db: Session = Depends(get_db)):
    return create_contract(db, contract)


@app.get("/contracts", response_model=list[ContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    return get_contracts(db)


@app.put("/contracts/{contract_id}", response_model=ContractResponse)
def update_contract_endpoint(contract_id: int, contract: ContractUpdate, db: Session = Depends(get_db)):
    updated_contract = update_contract(db, contract_id, contract)
    if not updated_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return updated_contract


@app.delete("/contracts/{contract_id}")
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    deleted_contract = soft_delete_contract(db, contract_id)
    if not deleted_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return {"ok": True, "deleted_id": contract_id}


@app.post("/incidents", response_model=IncidentResponse)
def create_incident_endpoint(incident: IncidentCreate, db: Session = Depends(get_db)):
    return create_incident(db, incident)


@app.get("/incidents", response_model=list[IncidentResponse])
def list_incidents(db: Session = Depends(get_db)):
    return get_incidents(db)


@app.put("/incidents/{incident_id}", response_model=IncidentResponse)
def update_incident_endpoint(incident_id: int, incident: IncidentUpdate, db: Session = Depends(get_db)):
    updated_incident = update_incident(db, incident_id, incident)
    if not updated_incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return updated_incident


@app.delete("/incidents/{incident_id}")
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    deleted_incident = delete_incident(db, incident_id)
    if not deleted_incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return {"ok": True, "deleted_id": incident_id}


@app.post("/payrolls", response_model=PayrollResponse)
def create_payroll_endpoint(payroll: PayrollCreate, db: Session = Depends(get_db)):
    return create_payroll(db, payroll)


@app.get("/payrolls", response_model=list[PayrollResponse])
def list_payrolls(db: Session = Depends(get_db)):
    return get_payrolls(db)


@app.post("/payrolls/prepare", response_model=PayrollPrepareResponse)
def prepare_payrolls_endpoint(request: PayrollPrepareRequest, db: Session = Depends(get_db)):
    return prepare_monthly_payrolls(db, request)


@app.post("/payrolls/simulate-future", response_model=PayrollFutureSimulationResponse)
def simulate_future_payrolls_endpoint(request: PayrollFutureSimulationRequest, db: Session = Depends(get_db)):
    return simulate_future_payrolls(db, request)


@app.get("/payrolls/{payroll_id}", response_model=PayrollResponse)
def read_payroll(payroll_id: int, db: Session = Depends(get_db)):
    payroll = get_payroll(db, payroll_id)
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return payroll


@app.put("/payrolls/{payroll_id}", response_model=PayrollResponse)
def update_payroll_endpoint(payroll_id: int, payroll: PayrollUpdate, db: Session = Depends(get_db)):
    updated_payroll = update_payroll(db, payroll_id, payroll)
    if not updated_payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return updated_payroll


@app.delete("/payrolls/{payroll_id}")
def delete_payroll_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    deleted_payroll = delete_payroll(db, payroll_id)
    if not deleted_payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return {"ok": True, "deleted_id": payroll_id}


@app.post("/documents", response_model=DocumentResponse)
def create_document_endpoint(document: DocumentCreate, db: Session = Depends(get_db)):
    return create_document(db, document)


@app.get("/documents", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    return get_documents(db)


@app.get("/employees/{employee_id}/documents", response_model=list[DocumentResponse])
def list_employee_documents(employee_id: int, db: Session = Depends(get_db)):
    return get_documents_by_employee(db, employee_id)


@app.put("/documents/{document_id}", response_model=DocumentResponse)
def update_document_endpoint(document_id: int, document: DocumentUpdate, db: Session = Depends(get_db)):
    updated_document = update_document(db, document_id, document)
    if not updated_document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return updated_document


@app.post("/documents/{document_id}/not-applicable", response_model=DocumentResponse)
def mark_document_not_applicable_endpoint(document_id: int, db: Session = Depends(get_db)):
    updated_document = mark_document_not_applicable(db, document_id)
    if not updated_document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return updated_document


@app.get("/tax-profiles", response_model=list[TaxProfileResponse])
def list_tax_profiles(db: Session = Depends(get_db)):
    return get_tax_profiles(db)


@app.get("/employees/{employee_id}/tax-profile", response_model=TaxProfileResponse)
def read_employee_tax_profile(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    tax_profile = get_tax_profile_by_employee(db, employee_id)
    if not tax_profile:
        raise HTTPException(status_code=404, detail="Perfil fiscal no encontrado")

    return tax_profile


@app.put("/employees/{employee_id}/tax-profile", response_model=TaxProfileResponse)
def upsert_employee_tax_profile(employee_id: int, tax_profile: TaxProfileUpdate, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return upsert_tax_profile(db, employee_id, tax_profile)


@app.post("/irpf/calculate", response_model=IrpfCalculationResponse)
def calculate_irpf_endpoint(input_data: IrpfCalculationInput):
    try:
        result = calculate_irpf_2026(input_data)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
