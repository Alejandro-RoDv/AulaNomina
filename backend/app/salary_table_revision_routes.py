from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.salary_regularization import (
    SalaryRegularizationGenerateRequest,
    SalaryRegularizationGenerateResponse,
    SalaryRegularizationPreviewRequest,
    SalaryRegularizationPreviewResponse,
)
from app.schemas.salary_table_activation import (
    SalaryTableActivationPreviewResponse,
    SalaryTableActivationResponse,
    SalaryTableContractMigrationRequest,
    SalaryTableContractMigrationResponse,
)
from app.schemas.salary_table_revision import SalaryTableRevisionRequest, SalaryTableRevisionResponse
from app.services.salary_regularization import (
    build_salary_regularization_preview,
    generate_salary_regularizations,
)
from app.services.salary_table_activation import (
    activate_salary_table,
    build_salary_table_activation_preview,
    migrate_contracts_to_salary_table,
)
from app.services.salary_table_revision import duplicate_salary_table_revision


router = APIRouter(
    prefix="/collective-agreements/salary-tables",
    tags=["salary-table-revisions"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/{source_table_id}/duplicate", response_model=SalaryTableRevisionResponse)
def duplicate_salary_table_revision_endpoint(
    source_table_id: int,
    payload: SalaryTableRevisionRequest,
    db: Session = Depends(get_db),
):
    return duplicate_salary_table_revision(db, source_table_id, payload)


@router.get("/{table_id}/activation-preview", response_model=SalaryTableActivationPreviewResponse)
def salary_table_activation_preview_endpoint(
    table_id: int,
    active_contracts_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    return build_salary_table_activation_preview(db, table_id, active_only=active_contracts_only)


@router.post("/{table_id}/activate", response_model=SalaryTableActivationResponse)
def activate_salary_table_endpoint(table_id: int, db: Session = Depends(get_db)):
    return activate_salary_table(db, table_id)


@router.post("/{table_id}/migrate-contracts", response_model=SalaryTableContractMigrationResponse)
def migrate_contracts_to_salary_table_endpoint(
    table_id: int,
    payload: SalaryTableContractMigrationRequest,
    db: Session = Depends(get_db),
):
    return migrate_contracts_to_salary_table(db, table_id, payload)


@router.post("/{table_id}/regularization-preview", response_model=SalaryRegularizationPreviewResponse)
def salary_table_regularization_preview_endpoint(
    table_id: int,
    payload: SalaryRegularizationPreviewRequest,
    db: Session = Depends(get_db),
):
    return build_salary_regularization_preview(db, table_id, payload)


@router.post("/{table_id}/regularizations", response_model=SalaryRegularizationGenerateResponse)
def generate_salary_table_regularizations_endpoint(
    table_id: int,
    payload: SalaryRegularizationGenerateRequest,
    db: Session = Depends(get_db),
):
    return generate_salary_regularizations(db, table_id, payload)
