from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.crud.company import (
    create_company,
    get_companies,
    get_companies_all,
    get_company,
    get_company_by_ccc,
    get_company_by_cif,
    soft_delete_company,
    update_company,
)
from app.crud.contract import create_contract, get_contracts, soft_delete_contract, update_contract
from app.crud.document import create_document, delete_document, get_documents, get_documents_by_employee, update_document
from app.crud.employee import (
    create_employee,
    get_employee,
    get_employee_assignment_history,
    get_employee_identity_conflict,
    get_employees,
    get_employees_all,
    get_employees_by_dni,
    get_next_employee_code,
    soft_delete_employee,
    update_employee,
)
from app.crud.incident import create_incident, delete_incident as delete_incident_crud, get_incidents, update_incident
from app.crud.payroll import delete_payroll, get_payrolls, simulate_future_payrolls
from app.crud.tax_profile import get_tax_profile_by_employee, get_tax_profiles, upsert_tax_profile
from app.crud.work_center import (
    create_work_center,
    get_work_center_by_code,
    get_work_centers,
    get_work_centers_by_company,
    soft_delete_work_center,
    update_work_center,
)
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.schemas.contract import ContractCreate, ContractResponse, ContractUpdate
from app.schemas.document import DocumentCreate, DocumentResponse, DocumentUpdate
from app.schemas.employee import EmployeeCreate, EmployeeResponse, EmployeeUpdate
from app.schemas.employee_assignment_history import EmployeeAssignmentHistoryResponse
from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate
from app.schemas.payroll import (
    PayrollCreate,
    PayrollFutureSimulationRequest,
    PayrollFutureSimulationResponse,
    PayrollPrepareRequest,
    PayrollPrepareResponse,
    PayrollResponse,
    PayrollUpdate,
)
from app.schemas.tax_profile import TaxProfileResponse, TaxProfileUpdate
from app.schemas.work_center import WorkCenterCreate, WorkCenterResponse, WorkCenterUpdate
from app.services.payroll_application_service import create_payroll, prepare_monthly_payrolls, update_payroll


router = APIRouter(tags=["workspace-core"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/employees/next-code")
def next_employee_code(db: Session = Depends(get_db)):
    return {"next_code": get_next_employee_code(db)}


@router.get("/employees/by-document/{document}", response_model=list[EmployeeResponse])
def list_employees_by_document(document: str, db: Session = Depends(get_db)):
    return get_employees_by_dni(db, document)


@router.post("/employees", response_model=EmployeeResponse)
def create_employee_endpoint(employee: EmployeeCreate, db: Session = Depends(get_db)):
    conflict = get_employee_identity_conflict(db, employee)
    if conflict:
        raise HTTPException(status_code=400, detail="Ya existe un trabajador con ese documento, NAF o email en la misma empresa")
    return create_employee(db, employee)


@router.get("/employees", response_model=list[EmployeeResponse])
def list_employees(db: Session = Depends(get_db)):
    return get_employees(db)


@router.get("/employees/all", response_model=list[EmployeeResponse])
def list_all_employees(db: Session = Depends(get_db)):
    return get_employees_all(db)


@router.get("/employees/{employee_id}/assignment-history", response_model=list[EmployeeAssignmentHistoryResponse])
def list_employee_assignment_history(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return get_employee_assignment_history(db, employee_id)


@router.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee_endpoint(employee_id: int, employee: EmployeeUpdate, db: Session = Depends(get_db)):
    updated_employee = update_employee(db, employee_id, employee)
    if not updated_employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return updated_employee


@router.delete("/employees/{employee_id}")
def delete_employee_endpoint(employee_id: int, db: Session = Depends(get_db)):
    deleted_employee = soft_delete_employee(db, employee_id)
    if not deleted_employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return {"ok": True, "deleted_id": employee_id}


@router.post("/companies", response_model=CompanyResponse)
def create_company_endpoint(company: CompanyCreate, db: Session = Depends(get_db)):
    if get_company_by_cif(db, company.cif):
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CIF")
    main_ccc = getattr(company, "main_ccc", None) or getattr(company, "ccc", None)
    if main_ccc and get_company_by_ccc(db, main_ccc):
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CCC principal")
    return create_company(db, company)


@router.get("/companies", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db)):
    return get_companies(db)


@router.get("/companies/all", response_model=list[CompanyResponse])
def list_all_companies(db: Session = Depends(get_db)):
    return get_companies_all(db)


@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company_endpoint(company_id: int, company: CompanyUpdate, db: Session = Depends(get_db)):
    updated_company = update_company(db, company_id, company)
    if not updated_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return updated_company


@router.delete("/companies/{company_id}")
def delete_company_endpoint(company_id: int, db: Session = Depends(get_db)):
    deleted_company = soft_delete_company(db, company_id)
    if not deleted_company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return {"ok": True, "deleted_id": company_id}


@router.post("/work-centers", response_model=WorkCenterResponse)
def create_work_center_endpoint(work_center: WorkCenterCreate, db: Session = Depends(get_db)):
    if not get_company(db, work_center.company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if work_center.center_code and get_work_center_by_code(db, work_center.center_code):
        raise HTTPException(status_code=400, detail="Ya existe un centro con ese código")
    return create_work_center(db, work_center)


@router.get("/work-centers", response_model=list[WorkCenterResponse])
def list_work_centers(db: Session = Depends(get_db)):
    return get_work_centers(db)


@router.get("/work-centers/company/{company_id}", response_model=list[WorkCenterResponse])
def list_work_centers_by_company(company_id: int, db: Session = Depends(get_db)):
    if not get_company(db, company_id):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return get_work_centers_by_company(db, company_id)


@router.put("/work-centers/{work_center_id}", response_model=WorkCenterResponse)
def update_work_center_endpoint(work_center_id: int, work_center: WorkCenterUpdate, db: Session = Depends(get_db)):
    updated_work_center = update_work_center(db, work_center_id, work_center)
    if not updated_work_center:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    return updated_work_center


@router.delete("/work-centers/{work_center_id}")
def delete_work_center_endpoint(work_center_id: int, db: Session = Depends(get_db)):
    deleted_work_center = soft_delete_work_center(db, work_center_id)
    if not deleted_work_center:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    return {"ok": True, "deleted_id": work_center_id}


@router.post("/contracts", response_model=ContractResponse)
def create_contract_endpoint(contract: ContractCreate, db: Session = Depends(get_db)):
    return create_contract(db, contract)


@router.get("/contracts", response_model=list[ContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    return get_contracts(db)


@router.put("/contracts/{contract_id}", response_model=ContractResponse)
def update_contract_endpoint(contract_id: int, contract: ContractUpdate, db: Session = Depends(get_db)):
    updated_contract = update_contract(db, contract_id, contract)
    if not updated_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return updated_contract


@router.delete("/contracts/{contract_id}")
def delete_contract_endpoint(contract_id: int, db: Session = Depends(get_db)):
    deleted_contract = soft_delete_contract(db, contract_id)
    if not deleted_contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return {"ok": True, "deleted_id": contract_id}


@router.post("/incidents", response_model=IncidentResponse)
def create_incident_endpoint(incident: IncidentCreate, db: Session = Depends(get_db)):
    return create_incident(db, incident)


@router.get("/incidents", response_model=list[IncidentResponse])
def list_incidents(db: Session = Depends(get_db)):
    return get_incidents(db)


@router.put("/incidents/{incident_id}", response_model=IncidentResponse)
def update_incident_endpoint(incident_id: int, incident: IncidentUpdate, db: Session = Depends(get_db)):
    updated_incident = update_incident(db, incident_id, incident)
    if not updated_incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return updated_incident


@router.delete("/incidents/{incident_id}")
def delete_incident_endpoint(incident_id: int, db: Session = Depends(get_db)):
    deleted_incident = delete_incident_crud(db, incident_id)
    if not deleted_incident:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return {"ok": True, "deleted_id": incident_id}


@router.post("/payrolls/prepare-monthly", response_model=PayrollPrepareResponse)
def prepare_monthly_payrolls_endpoint(request: PayrollPrepareRequest, db: Session = Depends(get_db)):
    return prepare_monthly_payrolls(db, request)


@router.post("/payrolls/simulate-future", response_model=PayrollFutureSimulationResponse)
def simulate_future_payrolls_endpoint(request: PayrollFutureSimulationRequest, db: Session = Depends(get_db)):
    return simulate_future_payrolls(db, request)


@router.post("/payrolls", response_model=PayrollResponse)
def create_payroll_endpoint(payroll: PayrollCreate, db: Session = Depends(get_db)):
    return create_payroll(db, payroll)


@router.get("/payrolls", response_model=list[PayrollResponse])
def list_payrolls(db: Session = Depends(get_db)):
    return get_payrolls(db)


@router.put("/payrolls/{payroll_id}", response_model=PayrollResponse)
def update_payroll_endpoint(payroll_id: int, payroll: PayrollUpdate, db: Session = Depends(get_db)):
    updated_payroll = update_payroll(db, payroll_id, payroll)
    if not updated_payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return updated_payroll


@router.delete("/payrolls/{payroll_id}")
def delete_payroll_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    deleted_payroll = delete_payroll(db, payroll_id)
    if not deleted_payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return deleted_payroll


@router.get("/tax-profiles", response_model=list[TaxProfileResponse])
def list_tax_profiles(db: Session = Depends(get_db)):
    return get_tax_profiles(db)


@router.get("/tax-profiles/employee/{employee_id}", response_model=TaxProfileResponse)
def get_employee_tax_profile(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    tax_profile = get_tax_profile_by_employee(db, employee_id)
    if tax_profile:
        return tax_profile
    return upsert_tax_profile(db, employee_id, TaxProfileUpdate())


@router.put("/tax-profiles/employee/{employee_id}", response_model=TaxProfileResponse)
def update_employee_tax_profile(employee_id: int, tax_profile: TaxProfileUpdate, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return upsert_tax_profile(db, employee_id, tax_profile)


@router.post("/documents", response_model=DocumentResponse)
def create_document_endpoint(document: DocumentCreate, db: Session = Depends(get_db)):
    return create_document(db, document)


@router.get("/documents", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    return get_documents(db)


@router.get("/documents/employee/{employee_id}", response_model=list[DocumentResponse])
def list_documents_by_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return get_documents_by_employee(db, employee_id)


@router.put("/documents/{document_id}", response_model=DocumentResponse)
def update_document_endpoint(document_id: int, document: DocumentUpdate, db: Session = Depends(get_db)):
    updated_document = update_document(db, document_id, document)
    if not updated_document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return updated_document


@router.delete("/documents/{document_id}")
def delete_document_endpoint(document_id: int, db: Session = Depends(get_db)):
    deleted_document = delete_document(db, document_id)
    if not deleted_document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return {"ok": True, "deleted_id": document_id}
