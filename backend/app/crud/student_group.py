from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.student_group import StudentGroup
from app.schemas.student_group import StudentGroupCreate, StudentGroupUpdate


def get_next_group_code(db: Session):
    last_group = db.query(StudentGroup).order_by(StudentGroup.id.desc()).first()
    next_number = 1 if not last_group else last_group.id + 1
    return f"GRP{next_number:04d}"


def get_group_by_code(db: Session, group_code: str | None):
    if not group_code:
        return None
    return db.query(StudentGroup).filter(StudentGroup.group_code == group_code).first()


def create_student_group(db: Session, group: StudentGroupCreate):
    group_data = group.model_dump()

    if not group_data.get("group_code"):
        group_data["group_code"] = get_next_group_code(db)

    if get_group_by_code(db, group_data.get("group_code")):
        raise HTTPException(status_code=400, detail="Ya existe un grupo con ese codigo")

    db_group = StudentGroup(**group_data)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_student_groups(db: Session):
    return db.query(StudentGroup).order_by(StudentGroup.created_at.desc()).all()


def get_student_group(db: Session, group_id: int):
    return db.query(StudentGroup).filter(StudentGroup.id == group_id).first()


def update_student_group(db: Session, group_id: int, data: StudentGroupUpdate):
    db_group = get_student_group(db, group_id)
    if not db_group:
        return None

    update_data = data.model_dump(exclude_unset=True)

    if "group_code" in update_data:
        existing = get_group_by_code(db, update_data.get("group_code"))
        if existing and existing.id != group_id:
            raise HTTPException(status_code=400, detail="Ya existe un grupo con ese codigo")

    for key, value in update_data.items():
        setattr(db_group, key, value)

    db.commit()
    db.refresh(db_group)
    return db_group


def soft_delete_student_group(db: Session, group_id: int):
    db_group = get_student_group(db, group_id)
    if not db_group:
        return None

    db_group.is_active = False
    db_group.status = "inactive"
    db.commit()
    db.refresh(db_group)
    return db_group


def seed_demo_student_groups(db: Session):
    if db.query(StudentGroup).count() > 0:
        return

    demo_groups = [
        StudentGroupCreate(
            group_code="GRP0001",
            name="1º RRLL",
            academic_year="2026/2027",
            education_center="Facultad Demo AulaNomina",
            teacher_name="Profesor demo",
            status="active",
            notes="Grupo universitario demo para casos básicos de gestión laboral.",
        ),
        StudentGroupCreate(
            group_code="GRP0002",
            name="2º Administración",
            academic_year="2026/2027",
            education_center="IES Demo AulaNomina",
            teacher_name="Profesor demo",
            status="active",
            notes="Grupo de FP demo para contratos, incidencias y nómina simulada.",
        ),
        StudentGroupCreate(
            group_code="GRP0003",
            name="Máster RRHH Digital",
            academic_year="2026/2027",
            education_center="Escuela Demo AulaNomina",
            teacher_name="Coordinador demo",
            status="active",
            notes="Grupo avanzado para ejercicios complejos y evaluación de procesos completos.",
        ),
    ]

    for group in demo_groups:
        create_student_group(db, group)
