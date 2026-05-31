from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud.payroll_salary_structure import (
    build_payroll_breakdown,
    create_contract_payroll_concept,
    create_payroll_concept,
    create_payroll_item,
    deactivate_contract_payroll_concept,
    deactivate_payroll_concept,
    delete_payroll_item,
    get_contract_payroll_concepts,
    get_payroll_concept,
    get_payroll_concepts,
    get_payroll_items,
    load_contract_concepts_into_payroll,
    update_contract_payroll_concept,
    update_payroll_concept,
    update_payroll_item,
)
from app.db import SessionLocal
from app.schemas.contract import (
    ContractSalarySummaryResponse,
    ContractWorkdaySimulationRequest,
    ContractWorkdaySimulationResponse,
)
from app.schemas.payroll_salary_structure import (
    ContractPayrollConceptCreate,
    ContractPayrollConceptResponse,
    ContractPayrollConceptUpdate,
    LoadContractConceptsResponse,
    PayrollBreakdownResponse,
    PayrollConceptCreate,
    PayrollConceptResponse,
    PayrollConceptUpdate,
    PayrollItemCreate,
    PayrollItemResponse,
    PayrollItemUpdate,
)
from app.services.contract_salary_summary import (
    build_contract_salary_summary,
    simulate_contract_workday_change,
)

router = APIRouter(tags=["payroll-salary-structure"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/payroll-concepts", response_model=list[PayrollConceptResponse])
def list_payroll_concepts(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return get_payroll_concepts(db, include_inactive=include_inactive)


@router.post("/payroll-concepts", response_model=PayrollConceptResponse)
def create_payroll_concept_endpoint(concept: PayrollConceptCreate, db: Session = Depends(get_db)):
    return create_payroll_concept(db, concept)


@router.get("/payroll-concepts/{concept_id}", response_model=PayrollConceptResponse)
def read_payroll_concept(concept_id: int, db: Session = Depends(get_db)):
    concept = get_payroll_concept(db, concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Concepto salarial no encontrado")
    return concept


@router.put("/payroll-concepts/{concept_id}", response_model=PayrollConceptResponse)
def update_payroll_concept_endpoint(
    concept_id: int,
    concept: PayrollConceptUpdate,
    db: Session = Depends(get_db),
):
    updated_concept = update_payroll_concept(db, concept_id, concept)
    if not updated_concept:
        raise HTTPException(status_code=404, detail="Concepto salarial no encontrado")
    return updated_concept


@router.post("/payroll-concepts/{concept_id}/deactivate")
def deactivate_payroll_concept_endpoint(concept_id: int, db: Session = Depends(get_db)):
    deactivated_concept = deactivate_payroll_concept(db, concept_id)
    if not deactivated_concept:
        raise HTTPException(status_code=404, detail="Concepto salarial no encontrado")
    return {"ok": True, "deactivated_id": concept_id}


@router.get("/contracts/{contract_id}/payroll-concepts", response_model=list[ContractPayrollConceptResponse])
def list_contract_payroll_concepts(
    contract_id: int,
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return get_contract_payroll_concepts(db, contract_id, include_inactive=include_inactive)


@router.post("/contracts/{contract_id}/payroll-concepts", response_model=ContractPayrollConceptResponse)
def create_contract_payroll_concept_endpoint(
    contract_id: int,
    item: ContractPayrollConceptCreate,
    db: Session = Depends(get_db),
):
    return create_contract_payroll_concept(db, contract_id, item)


@router.get("/contracts/{contract_id}/salary-summary", response_model=ContractSalarySummaryResponse)
def read_contract_salary_summary(contract_id: int, db: Session = Depends(get_db)):
    return build_contract_salary_summary(db, contract_id)


@router.post("/contracts/{contract_id}/simulate-workday", response_model=ContractWorkdaySimulationResponse)
def simulate_contract_workday_endpoint(
    contract_id: int,
    request: ContractWorkdaySimulationRequest,
    db: Session = Depends(get_db),
):
    return simulate_contract_workday_change(db, contract_id, request)


@router.put("/contract-payroll-concepts/{concept_line_id}", response_model=ContractPayrollConceptResponse)
def update_contract_payroll_concept_endpoint(
    concept_line_id: int,
    item: ContractPayrollConceptUpdate,
    db: Session = Depends(get_db),
):
    updated_item = update_contract_payroll_concept(db, concept_line_id, item)
    if not updated_item:
        raise HTTPException(status_code=404, detail="Concepto permanente no encontrado")
    return updated_item


@router.post("/contract-payroll-concepts/{concept_line_id}/deactivate")
def deactivate_contract_payroll_concept_endpoint(concept_line_id: int, db: Session = Depends(get_db)):
    deactivated_item = deactivate_contract_payroll_concept(db, concept_line_id)
    if not deactivated_item:
        raise HTTPException(status_code=404, detail="Concepto permanente no encontrado")
    return {"ok": True, "deactivated_id": concept_line_id}


@router.get("/payrolls/{payroll_id}/items", response_model=list[PayrollItemResponse])
def list_payroll_items(payroll_id: int, db: Session = Depends(get_db)):
    return get_payroll_items(db, payroll_id)


@router.post("/payrolls/{payroll_id}/items", response_model=PayrollItemResponse)
def create_payroll_item_endpoint(
    payroll_id: int,
    item: PayrollItemCreate,
    db: Session = Depends(get_db),
):
    return create_payroll_item(db, payroll_id, item)


@router.post("/payrolls/{payroll_id}/load-contract-concepts", response_model=LoadContractConceptsResponse)
def load_contract_concepts_into_payroll_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    return load_contract_concepts_into_payroll(db, payroll_id)


@router.put("/payroll-items/{item_id}", response_model=PayrollItemResponse)
def update_payroll_item_endpoint(
    item_id: int,
    item: PayrollItemUpdate,
    db: Session = Depends(get_db),
):
    updated_item = update_payroll_item(db, item_id, item)
    if not updated_item:
        raise HTTPException(status_code=404, detail="Línea de nómina no encontrada")
    return updated_item


@router.delete("/payroll-items/{item_id}")
def delete_payroll_item_endpoint(item_id: int, db: Session = Depends(get_db)):
    deleted_item = delete_payroll_item(db, item_id)
    if not deleted_item:
        raise HTTPException(status_code=404, detail="Línea de nómina no encontrada")
    return {"ok": True, "deleted_id": item_id}


@router.get("/payrolls/{payroll_id}/breakdown", response_model=PayrollBreakdownResponse)
def read_payroll_breakdown(payroll_id: int, db: Session = Depends(get_db)):
    return build_payroll_breakdown(db, payroll_id)
