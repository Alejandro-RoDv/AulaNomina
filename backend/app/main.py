from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.db_init import init_database
from app.models import User, Employee, Company, Incident, Payroll, Document
from app.models.contract import Contract
from app.seed_demo import seed_demo_data
from app.seed_demo_documents import seed_demo_documents
from app.case_study_routes import router as case_study_router
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
    return {"message": "AulaNomina backend activo"}


@app.post("/demo/reset")
def reset_demo_endpoint():
    try:
        seed_demo_data(reset=True)
        seed_demo_documents()
        db = SessionLocal()
        try:
            seed_demo_student_groups(db)
            seed_demo_students(db)
            seed_demo_case_studies(db)
            seed_demo_case_assignments(db)
            seed_demo_corrections(db)
        finally:
            db.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al reiniciar la demo: {exc}") from exc

    return {
        "ok": True,
        "message": "Demo reiniciada correctamente, incluida documentación laboral, grupos, alumnos, casos prácticos, asignaciones y correcciones",
        "mode": "controlled_demo_reset",
    }


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


@app.get("/employees/{employee_id}/assignment-history", response_model=list[EmployeeAssignmentHistoryResponse])
def get_employee_assignment_history_endpoint(employee_id: int, db: Session = Depends(get_db)):
    if not get_employee(db, employee_id):
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return get_employee_assignment_history(db, employee_id)


@app.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee_endpoint(employee_id: int, employee: EmployeeUpdate, db: Session = Depends(get_db)):
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
def update_contract_endpoint(contract_id: int, contract: ContractUpdate, db: Session = Depends(get_db)):
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

    if company.ccc and get_company_by_ccc(db, company.ccc):
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CCC")

    return create_company(db, company)


@app.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company_endpoint(company_id: int, company: CompanyUpdate, db: Session = Depends(get_db)):
    current_company = get_company(db, company_id)
    if not current_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if company.cif:
        existing = get_company_by_cif(db, company.cif)
        if existing and existing.id != company_id:
            raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CIF")

    if company.ccc:
        existing = get_company_by_ccc(db, company.ccc)
        if existing and existing.id != company_id:
            raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CCC")

    return update_company(db, company_id, company)


@app.delete("/companies/{company_id}", response_model=CompanyResponse)
def delete_company_endpoint(company_id: int, db: Session = Depends(get_db)):
    deleted_company = soft_delete_company(db, company_id)
    if not deleted_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return deleted_company


# WORK CENTERS
@app.get("/work-centers", response_model=list[WorkCenterResponse])
def get_work_centers_endpoint(db: Session = Depends(get_db)):
    return get_work_centers(db)


@app.get("/work-centers/company/{company_id}", response_model=list[WorkCenterResponse])
def get_work_centers_by_company_endpoint(company_id: int, db: Session = Depends(get_db)):
    if not get_company(db, company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return get_work_centers_by_company(db, company_id)


@app.post("/work-centers", response_model=WorkCenterResponse)
def create_work_center_endpoint(work_center: WorkCenterCreate, db: Session = Depends(get_db)):
    if not get_company(db, work_center.company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if get_work_center_by_code(db, work_center.center_code):
        raise HTTPException(status_code=400, detail="Ya existe un centro con ese código")

    return create_work_center(db, work_center)


@app.put("/work-centers/{work_center_id}", response_model=WorkCenterResponse)
def update_work_center_endpoint(work_center_id: int, work_center: WorkCenterUpdate, db: Session = Depends(get_db)):
    current_work_center = get_work_center(db, work_center_id)
    if not current_work_center:
        raise HTTPException(status_code=404, detail="Centro no encontrado")

    if work_center.company_id and not get_company(db, work_center.company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if work_center.center_code:
        existing = get_work_center_by_code(db, work_center.center_code)
        if existing and existing.id != work_center_id:
            raise HTTPException(status_code=400, detail="Ya existe un centro con ese código")

    return update_work_center(db, work_center_id, work_center)


@app.delete("/work-centers/{work_center_id}", response_model=WorkCenterResponse)
def delete_work_center_endpoint(work_center_id: int, db: Session = Depends(get_db)):
    deleted_work_center = soft_delete_work_center(db, work_center_id)
    if not deleted_work_center:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    return deleted_work_center


# INCIDENTS
@app.get("/incidents", response_model=list[IncidentResponse])
def list_incidents(db: Session = Depends(get_db)):
    return get_incidents(db)


@app.post("/incidents", response_model=IncidentResponse)
def create_incident_endpoint(incident: IncidentCreate, db: Session = Depends(get_db)):
    return create_incident(db, incident)


@app.put("/incidents/{incident_id}", response_model=IncidentResponse)
def update_incident_endpoint(incident_id: int, incident: IncidentUpdate, db: Session = Depends(get_db)):
    updated_incident = update_incident(db, incident_id, incident)
    if not updated_incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return updated_incident


@app.delete("/incidents/{incident_id}")
def delete_incident_endpoint(incident_id: int, db: Session = Depends(get_db)):
    deleted_incident = delete_incident(db, incident_id)
    if not deleted_incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return {"ok": True}


# DOCUMENTS
@app.get("/documents", response_model=list[DocumentResponse])
def get_documents_endpoint(db: Session = Depends(get_db)):
    return get_documents(db)


@app.get("/documents/employee/{employee_id}", response_model=list[DocumentResponse])
def get_documents_by_employee_endpoint(employee_id: int, db: Session = Depends(get_db)):
    if not get_employee(db, employee_id):
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return get_documents_by_employee(db, employee_id)


@app.post("/documents", response_model=DocumentResponse)
def create_document_endpoint(document: DocumentCreate, db: Session = Depends(get_db)):
    return create_document(db, document)


@app.put("/documents/{document_id}", response_model=DocumentResponse)
def update_document_endpoint(document_id: int, document: DocumentUpdate, db: Session = Depends(get_db)):
    updated_document = update_document(db, document_id, document)
    if not updated_document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return updated_document


@app.delete("/documents/{document_id}", response_model=DocumentResponse)
def delete_document_endpoint(document_id: int, db: Session = Depends(get_db)):
    document = mark_document_not_applicable(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return document


# PAYROLLS
@app.get("/payrolls", response_model=list[PayrollResponse])
def get_payrolls_endpoint(db: Session = Depends(get_db)):
    return get_payrolls(db)


@app.post("/payrolls", response_model=PayrollResponse)
def create_payroll_endpoint(payroll: PayrollCreate, db: Session = Depends(get_db)):
    return create_payroll(db, payroll)


@app.post("/payrolls/prepare-monthly", response_model=PayrollPrepareResponse)
def prepare_monthly_payrolls_endpoint(request: PayrollPrepareRequest, db: Session = Depends(get_db)):
    return prepare_monthly_payrolls(db, request)


@app.get("/payrolls/{payroll_id}", response_model=PayrollResponse)
def get_payroll_endpoint(payroll_id: int, db: Session = Depends(get_db)):
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
    return {"ok": True, "deleted_id": deleted_payroll["id"]}
