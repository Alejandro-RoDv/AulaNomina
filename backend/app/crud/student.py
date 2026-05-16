from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.student import Student
from app.models.student_group import StudentGroup
from app.schemas.student import StudentCreate, StudentUpdate


def get_next_student_code(db: Session):
    last_student = db.query(Student).order_by(Student.id.desc()).first()
    next_number = 1 if not last_student else last_student.id + 1
    return f"ALU{next_number:04d}"


def get_student_by_email(db: Session, email: str | None):
    if not email:
        return None
    return db.query(Student).filter(Student.email == email).first()


def get_student_by_code(db: Session, student_code: str | None):
    if not student_code:
        return None
    return db.query(Student).filter(Student.student_code == student_code).first()


def get_group(db: Session, group_id: int | None):
    if group_id is None:
        return None
    return db.query(StudentGroup).filter(StudentGroup.id == group_id).first()


def sync_group_fields(db: Session, student_data: dict):
    group_id = student_data.get("group_id")
    if group_id is None:
        return student_data

    group = get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    student_data["group_name"] = group.name
    if not student_data.get("education_center"):
        student_data["education_center"] = group.education_center
    return student_data


def create_student(db: Session, student: StudentCreate):
    student_data = sync_group_fields(db, student.model_dump())

    if not student_data.get("student_code"):
        student_data["student_code"] = get_next_student_code(db)

    if get_student_by_code(db, student_data.get("student_code")):
        raise HTTPException(status_code=400, detail="Ya existe un alumno con ese codigo")

    if student_data.get("email") and get_student_by_email(db, student_data.get("email")):
        raise HTTPException(status_code=400, detail="Ya existe un alumno con ese email")

    db_student = Student(**student_data)
    db.add(db_student)
    db.commit()
    return get_student(db, db_student.id)


def get_students(db: Session):
    return (
        db.query(Student)
        .options(joinedload(Student.group))
        .order_by(Student.created_at.desc())
        .all()
    )


def get_students_active(db: Session):
    return (
        db.query(Student)
        .options(joinedload(Student.group))
        .filter(Student.is_active == True)
        .order_by(Student.last_name.asc())
        .all()
    )


def get_student(db: Session, student_id: int):
    return (
        db.query(Student)
        .options(joinedload(Student.group))
        .filter(Student.id == student_id)
        .first()
    )


def update_student(db: Session, student_id: int, data: StudentUpdate):
    db_student = db.query(Student).filter(Student.id == student_id).first()
    if not db_student:
        return None

    update_data = sync_group_fields(db, data.model_dump(exclude_unset=True))

    if "student_code" in update_data:
        existing = get_student_by_code(db, update_data.get("student_code"))
        if existing and existing.id != student_id:
            raise HTTPException(status_code=400, detail="Ya existe un alumno con ese codigo")

    if "email" in update_data and update_data.get("email"):
        existing = get_student_by_email(db, update_data.get("email"))
        if existing and existing.id != student_id:
            raise HTTPException(status_code=400, detail="Ya existe un alumno con ese email")

    for key, value in update_data.items():
        setattr(db_student, key, value)

    db.commit()
    return get_student(db, student_id)


def soft_delete_student(db: Session, student_id: int):
    db_student = db.query(Student).filter(Student.id == student_id).first()
    if not db_student:
        return None

    db_student.is_active = False
    db_student.status = "inactive"
    db.commit()
    return get_student(db, student_id)


def seed_demo_students(db: Session):
    if db.query(Student).count() > 0:
        return

    groups = {group.name: group for group in db.query(StudentGroup).all()}

    demo_students = [
        StudentCreate(
            student_code="ALU0001",
            first_name="Laura",
            last_name="Molina",
            email="laura.molina@demo.aulanomina.es",
            group_id=groups.get("1º RRLL").id if groups.get("1º RRLL") else None,
            group_name="1º RRLL",
            education_center="Facultad Demo AulaNomina",
            status="active",
            notes="Alumna demo para casos de alta de trabajador.",
        ),
        StudentCreate(
            student_code="ALU0002",
            first_name="Carlos",
            last_name="Ruiz",
            email="carlos.ruiz@demo.aulanomina.es",
            group_id=groups.get("2º Administración").id if groups.get("2º Administración") else None,
            group_name="2º Administración",
            education_center="IES Demo AulaNomina",
            status="active",
            notes="Alumno demo para incidencias y nomina.",
        ),
        StudentCreate(
            student_code="ALU0003",
            first_name="Marta",
            last_name="Sánchez",
            email="marta.sanchez@demo.aulanomina.es",
            group_id=groups.get("1º RRLL").id if groups.get("1º RRLL") else None,
            group_name="1º RRLL",
            education_center="Facultad Demo AulaNomina",
            status="active",
            notes="Alumna demo para expediente documental.",
        ),
    ]

    for student in demo_students:
        create_student(db, student)
