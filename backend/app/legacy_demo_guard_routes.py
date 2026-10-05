from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_dependencies import get_optional_principal
from app.crud.case_assignment import seed_demo_case_assignments
from app.crud.case_study import seed_demo_case_studies
from app.crud.correction import seed_demo_corrections
from app.crud.student import seed_demo_students
from app.crud.student_group import seed_demo_student_groups
from app.db import SessionLocal
from app.seed_demo import seed_demo_data
from app.seed_demo_agreements import seed_demo_collective_agreements
from app.seed_demo_documents import seed_demo_documents
from app.services.auth_service import AuthPrincipal


router = APIRouter(tags=["demo-guard"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _assert_global_demo_access(principal: AuthPrincipal | None) -> None:
    if principal is not None and not principal.is_staff:
        raise HTTPException(
            status_code=403,
            detail="Un alumno no puede modificar el entorno demo global",
        )


def _seed_global_demo(db: Session) -> dict:
    seed_demo_data(db)
    seed_demo_collective_agreements(db)
    seed_demo_documents(db)
    seed_demo_case_studies(db)
    seed_demo_case_assignments(db)
    seed_demo_corrections(db)
    seed_demo_students(db)
    seed_demo_student_groups(db)
    return {"ok": True, "message": "Datos demo recargados correctamente"}


@router.post("/seed-demo")
def guarded_seed_demo(
    db: Session = Depends(get_db),
    principal: AuthPrincipal | None = Depends(get_optional_principal),
):
    _assert_global_demo_access(principal)
    return _seed_global_demo(db)


@router.post("/demo/reset")
def guarded_demo_reset(
    db: Session = Depends(get_db),
    principal: AuthPrincipal | None = Depends(get_optional_principal),
):
    _assert_global_demo_access(principal)
    return _seed_global_demo(db)
