from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.schemas.salary_table_revision import SalaryTableRevisionRequest, SalaryTableRevisionResponse
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
