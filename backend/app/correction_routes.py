from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.crud.correction import (
    create_correction,
    delete_correction,
    get_corrections,
    seed_demo_corrections,
    update_correction,
)
from app.schemas.correction import CorrectionCreate, CorrectionResponse, CorrectionUpdate

router = APIRouter(tags=["corrections"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/corrections", response_model=list[CorrectionResponse])
def list_corrections(db: Session = Depends(get_db)):
    return get_corrections(db)


@router.post("/corrections", response_model=CorrectionResponse)
def create_correction_endpoint(correction: CorrectionCreate, db: Session = Depends(get_db)):
    return create_correction(db, correction)


@router.post("/corrections/seed-demo")
def seed_demo_corrections_endpoint(db: Session = Depends(get_db)):
    seed_demo_corrections(db)
    return {"ok": True, "message": "Correcciones demo cargadas"}


@router.put("/corrections/{correction_id}", response_model=CorrectionResponse)
def update_correction_endpoint(correction_id: int, correction: CorrectionUpdate, db: Session = Depends(get_db)):
    updated_correction = update_correction(db, correction_id, correction)
    if not updated_correction:
        raise HTTPException(status_code=404, detail="Correccion no encontrada")
    return updated_correction


@router.delete("/corrections/{correction_id}")
def delete_correction_endpoint(correction_id: int, db: Session = Depends(get_db)):
    deleted_correction = delete_correction(db, correction_id)
    if not deleted_correction:
        raise HTTPException(status_code=404, detail="Correccion no encontrada")
    return {"ok": True, "deleted_id": correction_id}
