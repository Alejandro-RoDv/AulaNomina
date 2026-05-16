from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.student import Student
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


def create_student(db: Session, student: StudentCreate):
    student_data = student.model_dump()

    if not student_data.get("student_code"):
        student_data["student_code"] = get_next_student_code(db)

    if get_student_by_code(db, student_data.get("student_code")):
        raise HTTPException(status_code=400, detail="Ya existe un alumno con ese codigo")

    if student_data.get("email") and get_student_by_email(db, student_data.get("email")):
        raise HTTPException(status_code=400, detail="Ya existe un alumno con ese email")

    db_student = Student(**student_data)
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


def get_students(db: Session):
    return db.query(Student).order_by(Student.created_at.desc()).all()


def get_students_active(db: Session):
    return db.query(Student).filter(Student.is_active == True).order_by(Student.last_name.asc()).all()


def get_student(db: Session, student_id: int):
    return db.query(Student).filter(Student.id == student_id).first()


def update_student(db: Session, student_id: int, data: StudentUpdate):
    db_student = get_student(db, student_id)
    if not db_student:
        return None

    update_data = data.model_dump(exclude_unset=True)

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
    db.refresh(db_student)
    return db_student


def soft_delete_student(db: Session, student_id: int):
    db_student = get_student(db, student_id)
    if not db_student:
        return None

    db_student.is_active = False
    db_student.status = "inactive"
    db.commit()
    db.refresh(db_student)
    return db_student


def seed_demo_students(db: Session):
    if db.query(Student).count() > 0:
        return

    demo_students = [
        StudentCreate(
            student_code="ALU0001",
            first_name="Laura",
            last_name="Molina",
            email="laura.molina@demo.aulanomina.es",
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
            group_name="1º RRLL",
            education_center="Facultad Demo AulaNomina",
            status="active",
            notes="Alumna demo para expediente documental.",
        ),
    ]

    for student in demo_students:
        create_student(db, student)
