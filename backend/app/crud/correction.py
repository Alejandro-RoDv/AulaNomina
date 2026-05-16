from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.case_study import CaseStudy
from app.models.correction import Correction
from app.schemas.correction import CorrectionCreate, CorrectionUpdate


def _validate_case_study(db: Session, case_study_id: int):
    case_study = db.query(CaseStudy).filter(CaseStudy.id == case_study_id).first()
    if not case_study:
        raise HTTPException(status_code=404, detail="Caso practico no encontrado")
    return case_study


def create_correction(db: Session, correction: CorrectionCreate):
    _validate_case_study(db, correction.case_study_id)

    db_correction = Correction(**correction.model_dump())
    if correction.status in {"reviewed", "approved", "needs_revision"}:
        db_correction.reviewed_at = datetime.utcnow()

    db.add(db_correction)
    db.commit()
    return get_correction(db, db_correction.id)


def get_corrections(db: Session):
    return (
        db.query(Correction)
        .options(joinedload(Correction.case_study))
        .order_by(Correction.submitted_at.desc())
        .all()
    )


def get_correction(db: Session, correction_id: int):
    return (
        db.query(Correction)
        .options(joinedload(Correction.case_study))
        .filter(Correction.id == correction_id)
        .first()
    )


def update_correction(db: Session, correction_id: int, data: CorrectionUpdate):
    db_correction = db.query(Correction).filter(Correction.id == correction_id).first()
    if not db_correction:
        return None

    update_data = data.model_dump(exclude_unset=True)

    if "case_study_id" in update_data and update_data["case_study_id"] is not None:
        _validate_case_study(db, update_data["case_study_id"])

    if update_data.get("status") in {"reviewed", "approved", "needs_revision"}:
        update_data["reviewed_at"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(db_correction, key, value)

    db.commit()
    return get_correction(db, correction_id)


def delete_correction(db: Session, correction_id: int):
    db_correction = db.query(Correction).filter(Correction.id == correction_id).first()
    if not db_correction:
        return None

    db.delete(db_correction)
    db.commit()
    return db_correction


def seed_demo_corrections(db: Session):
    if db.query(Correction).count() > 0:
        return

    case_studies = db.query(CaseStudy).order_by(CaseStudy.id.asc()).all()
    if not case_studies:
        return

    demo_rows = [
        CorrectionCreate(
            case_study_id=case_studies[0].id,
            student_name="Laura Molina",
            student_group="1º RRLL",
            status="pending_review",
            grade=None,
            teacher_feedback=None,
            reviewed_by=None,
        ),
        CorrectionCreate(
            case_study_id=case_studies[min(1, len(case_studies) - 1)].id,
            student_name="Carlos Ruiz",
            student_group="2º Administración",
            status="needs_revision",
            grade=5.5,
            teacher_feedback="La incidencia esta creada, pero falta revisar la nomina del periodo afectado.",
            reviewed_by="Profesor demo",
        ),
        CorrectionCreate(
            case_study_id=case_studies[min(2, len(case_studies) - 1)].id,
            student_name="Marta Sánchez",
            student_group="1º RRLL",
            status="approved",
            grade=8.0,
            teacher_feedback="Expediente documental revisado correctamente. Buen uso de estados pendientes y no aplica.",
            reviewed_by="Profesor demo",
        ),
    ]

    for correction in demo_rows:
        create_correction(db, correction)
