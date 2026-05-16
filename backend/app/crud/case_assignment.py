from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy
from app.models.student import Student
from app.models.student_group import StudentGroup
from app.schemas.case_assignment import CaseAssignmentCreate, CaseAssignmentUpdate


def _validate_case_study(db: Session, case_study_id: int):
    case_study = db.query(CaseStudy).filter(CaseStudy.id == case_study_id).first()
    if not case_study:
        raise HTTPException(status_code=404, detail="Caso practico no encontrado")
    return case_study


def _validate_student(db: Session, student_id: int | None):
    if student_id is None:
        return None
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    return student


def _validate_group(db: Session, group_id: int | None):
    if group_id is None:
        return None
    group = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return group


def _validate_assignee(student_id: int | None, group_id: int | None):
    if not student_id and not group_id:
        raise HTTPException(status_code=400, detail="La asignacion debe tener alumno o grupo")
    if student_id and group_id:
        raise HTTPException(status_code=400, detail="La asignacion solo puede tener alumno o grupo")


def create_case_assignment(db: Session, assignment: CaseAssignmentCreate):
    data = assignment.model_dump()
    _validate_case_study(db, data["case_study_id"])
    _validate_assignee(data.get("student_id"), data.get("group_id"))
    _validate_student(db, data.get("student_id"))
    _validate_group(db, data.get("group_id"))

    db_assignment = CaseAssignment(**data)
    db.add(db_assignment)
    db.commit()
    return get_case_assignment(db, db_assignment.id)


def get_case_assignments(db: Session):
    return (
        db.query(CaseAssignment)
        .options(
            joinedload(CaseAssignment.case_study),
            joinedload(CaseAssignment.student),
            joinedload(CaseAssignment.group),
        )
        .order_by(CaseAssignment.assigned_at.desc())
        .all()
    )


def get_case_assignment(db: Session, assignment_id: int):
    return (
        db.query(CaseAssignment)
        .options(
            joinedload(CaseAssignment.case_study),
            joinedload(CaseAssignment.student),
            joinedload(CaseAssignment.group),
        )
        .filter(CaseAssignment.id == assignment_id)
        .first()
    )


def update_case_assignment(db: Session, assignment_id: int, data: CaseAssignmentUpdate):
    db_assignment = db.query(CaseAssignment).filter(CaseAssignment.id == assignment_id).first()
    if not db_assignment:
        return None

    update_data = data.model_dump(exclude_unset=True)

    case_study_id = update_data.get("case_study_id", db_assignment.case_study_id)
    student_id = update_data.get("student_id", db_assignment.student_id)
    group_id = update_data.get("group_id", db_assignment.group_id)

    _validate_case_study(db, case_study_id)
    _validate_assignee(student_id, group_id)
    _validate_student(db, student_id)
    _validate_group(db, group_id)

    for key, value in update_data.items():
        setattr(db_assignment, key, value)

    db.commit()
    return get_case_assignment(db, assignment_id)


def delete_case_assignment(db: Session, assignment_id: int):
    db_assignment = db.query(CaseAssignment).filter(CaseAssignment.id == assignment_id).first()
    if not db_assignment:
        return None

    db.delete(db_assignment)
    db.commit()
    return db_assignment


def seed_demo_case_assignments(db: Session):
    if db.query(CaseAssignment).count() > 0:
        return

    case_studies = db.query(CaseStudy).order_by(CaseStudy.id.asc()).all()
    students = db.query(Student).order_by(Student.id.asc()).all()
    groups = db.query(StudentGroup).order_by(StudentGroup.id.asc()).all()

    if not case_studies:
        return

    demo_assignments = []

    if groups:
        demo_assignments.append(
            CaseAssignmentCreate(
                case_study_id=case_studies[0].id,
                group_id=groups[0].id,
                assigned_by="Profesor demo",
                status="assigned",
                notes="Asignacion demo para trabajar el alta completa de trabajador.",
            )
        )

    if len(case_studies) > 1 and len(groups) > 1:
        demo_assignments.append(
            CaseAssignmentCreate(
                case_study_id=case_studies[1].id,
                group_id=groups[1].id,
                assigned_by="Profesor demo",
                status="in_progress",
                notes="Asignacion demo para practicar IT y nomina.",
            )
        )

    if len(case_studies) > 2 and students:
        demo_assignments.append(
            CaseAssignmentCreate(
                case_study_id=case_studies[2].id,
                student_id=students[0].id,
                assigned_by="Profesor demo",
                status="submitted",
                notes="Asignacion individual demo con entrega pendiente de revisar.",
            )
        )

    for assignment in demo_assignments:
        create_case_assignment(db, assignment)
