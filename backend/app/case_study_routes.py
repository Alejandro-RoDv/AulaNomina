from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.crud.case_study import (
    create_case_study,
    create_case_task,
    delete_case_study,
    delete_case_task,
    get_case_studies,
    get_case_study,
    seed_demo_case_studies,
    update_case_study,
    update_case_task,
)
from app.schemas.case_study import (
    CaseStudyCreate,
    CaseStudyResponse,
    CaseStudyUpdate,
    CaseTaskCreate,
    CaseTaskResponse,
    CaseTaskUpdate,
)

router = APIRouter(tags=["case-studies"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/case-studies", response_model=list[CaseStudyResponse])
def list_case_studies(db: Session = Depends(get_db)):
    return get_case_studies(db)


@router.post("/case-studies", response_model=CaseStudyResponse)
def create_case_study_endpoint(case_study: CaseStudyCreate, db: Session = Depends(get_db)):
    return create_case_study(db, case_study)


@router.get("/case-studies/{case_study_id}", response_model=CaseStudyResponse)
def get_case_study_endpoint(case_study_id: int, db: Session = Depends(get_db)):
    case_study = get_case_study(db, case_study_id)
    if not case_study:
        raise HTTPException(status_code=404, detail="Caso practico no encontrado")
    return case_study


@router.put("/case-studies/{case_study_id}", response_model=CaseStudyResponse)
def update_case_study_endpoint(case_study_id: int, case_study: CaseStudyUpdate, db: Session = Depends(get_db)):
    updated_case_study = update_case_study(db, case_study_id, case_study)
    if not updated_case_study:
        raise HTTPException(status_code=404, detail="Caso practico no encontrado")
    return updated_case_study


@router.delete("/case-studies/{case_study_id}")
def delete_case_study_endpoint(case_study_id: int, db: Session = Depends(get_db)):
    deleted_case_study = delete_case_study(db, case_study_id)
    if not deleted_case_study:
        raise HTTPException(status_code=404, detail="Caso practico no encontrado")
    return {"ok": True, "deleted_id": case_study_id}


@router.post("/case-studies/{case_study_id}/tasks", response_model=CaseTaskResponse)
def create_case_task_endpoint(case_study_id: int, task: CaseTaskCreate, db: Session = Depends(get_db)):
    return create_case_task(db, case_study_id, task)


@router.put("/case-tasks/{task_id}", response_model=CaseTaskResponse)
def update_case_task_endpoint(task_id: int, task: CaseTaskUpdate, db: Session = Depends(get_db)):
    updated_task = update_case_task(db, task_id, task)
    if not updated_task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return updated_task


@router.delete("/case-tasks/{task_id}")
def delete_case_task_endpoint(task_id: int, db: Session = Depends(get_db)):
    deleted_task = delete_case_task(db, task_id)
    if not deleted_task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return {"ok": True, "deleted_id": task_id}


@router.post("/case-studies/seed-demo")
def seed_demo_case_studies_endpoint(db: Session = Depends(get_db)):
    seed_demo_case_studies(db)
    return {"ok": True, "message": "Casos practicos demo cargados"}
