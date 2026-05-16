from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy
from app.models.correction import Correction
from app.schemas.correction import CorrectionCreate, CorrectionUpdate


def _validate_case_study(db: Session, case_study_id: int | None):
    if case_study_id is None:
        return None
    case_study = db.query(CaseStudy).filter(CaseStudy.id == case_study_id).first()
    if not case_study:
        raise HTTPException(status_code=404, detail="Caso practico no encontrado")
    return case_study


def _get_assignment(db: Session, assignment_id: int | None):
    if assignment_id is None:
        return None
    assignment = (
        db.query(CaseAssignment)
        .options(
            joinedload(CaseAssignment.case_study),
            joinedload(CaseAssignment.student),
            joinedload(CaseAssignment.group),
        )
        .filter(CaseAssignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignacion no encontrada")
    return assignment


def _sync_from_assignment(data: dict, assignment: CaseAssignment | None):
    if not assignment:
        return data

    data["case_study_id"] = assignment.case_study_id
    data["student_name"] = assignment.assignee_name
    data["student_group"] = assignment.group_name if assignment.group_id else None
    return data


def _sync_assignment_status(assignment: CaseAssignment | None, correction_status: str | None):
    if not assignment or not correction_status:
        return

    if correction_status == "pending_review":
        assignment.status = "submitted"
    elif correction_status == "reviewed":
        assignment.status = "reviewed"
    elif correction_status == "approved":
        assignment.status = "approved"
    elif correction_status == "needs_revision":
        assignment.status = "needs_revision"


def create_correction(db: Session, correction: CorrectionCreate):
    correction_data = correction.model_dump()
    assignment = _get_assignment(db, correction_data.get("assignment_id"))

    if assignment:
        correction_data = _sync_from_assignment(correction_data, assignment)
    else:
        _validate_case_study(db, correction_data.get("case_study_id"))

    db_correction = Correction(**correction_data)
    if correction.status in {"reviewed", "approved", "needs_revision"}:
        db_correction.reviewed_at = datetime.utcnow()

    _sync_assignment_status(assignment, correction.status)

    db.add(db_correction)
    db.commit()
    return get_correction(db, db_correction.id)


def get_corrections(db: Session):
    return (
        db.query(Correction)
        .options(
            joinedload(Correction.case_study),
            joinedload(Correction.assignment).joinedload(CaseAssignment.case_study),
            joinedload(Correction.assignment).joinedload(CaseAssignment.student),
            joinedload(Correction.assignment).joinedload(CaseAssignment.group),
        )
        .order_by(Correction.submitted_at.desc())
        .all()
    )


def get_correction(db: Session, correction_id: int):
    return (
        db.query(Correction)
        .options(
            joinedload(Correction.case_study),
            joinedload(Correction.assignment).joinedload(CaseAssignment.case_study),
            joinedload(Correction.assignment).joinedload(CaseAssignment.student),
            joinedload(Correction.assignment).joinedload(CaseAssignment.group),
        )
        .filter(Correction.id == correction_id)
        .first()
    )


def update_correction(db: Session, correction_id: int, data: CorrectionUpdate):
    db_correction = db.query(Correction).filter(Correction.id == correction_id).first()
    if not db_correction:
        return None

    update_data = data.model_dump(exclude_unset=True)

    assignment_id = update_data.get("assignment_id", db_correction.assignment_id)
    assignment = _get_assignment(db, assignment_id)

    if assignment:
        update_data = _sync_from_assignment(update_data, assignment)
    elif "case_study_id" in update_data and update_data["case_study_id"] is not None:
        _validate_case_study(db, update_data["case_study_id"])

    if update_data.get("status") in {"reviewed", "approved", "needs_revision"}:
        update_data["reviewed_at"] = datetime.utcnow()

    _sync_assignment_status(assignment, update_data.get("status"))

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

    assignments = db.query(CaseAssignment).order_by(CaseAssignment.id.asc()).all()
    case_studies = db.query(CaseStudy).order_by(CaseStudy.id.asc()).all()

    demo_rows = []

    if assignments:
        demo_rows.append(
            CorrectionCreate(
                assignment_id=assignments[0].id,
                status="pending_review",
                grade=None,
                teacher_feedback=None,
                reviewed_by=None,
            )
        )

    if len(assignments) > 1:
        demo_rows.append(
            CorrectionCreate(
                assignment_id=assignments[1].id,
                status="needs_revision",
                grade=5.5,
                teacher_feedback="La incidencia esta creada, pero falta revisar la nomina del periodo afectado.",
                reviewed_by="Profesor demo",
            )
        )

    if len(assignments) > 2:
        demo_rows.append(
            CorrectionCreate(
                assignment_id=assignments[2].id,
                status="approved",
                grade=8.0,
                teacher_feedback="Expediente documental revisado correctamente. Buen uso de estados pendientes y no aplica.",
                reviewed_by="Profesor demo",
            )
        )

    if not demo_rows and case_studies:
        demo_rows.append(
            CorrectionCreate(
                case_study_id=case_studies[0].id,
                student_name="Alumno demo",
                student_group="Grupo demo",
                status="pending_review",
            )
        )

    for correction in demo_rows:
        create_correction(db, correction)
