from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.contract import (
    ContractSalarySummaryResponse,
    ContractWorkdaySimulationRequest,
    ContractWorkdaySimulationResponse,
)
from app.services.contract_salary_summary import (
    build_contract_salary_summary,
    simulate_contract_workday_change,
)

router = APIRouter(tags=["contract-workday"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
