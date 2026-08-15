from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.case_assignment import CaseAssignment
from app.models.case_progress import CaseTaskProgress
from app.models.case_study import CaseStudy
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.student import Student
from app.models.student_group import StudentGroup
from app.schemas.case_assignment import CaseAssignmentCreate, CaseAssignmentUpdate
from app.services.case_scenario_service import ensure_assignment_progress, start_assignment
from app.training.fiscal_runtime_cases_2026 import (
    seed_fiscal_runtime_assignments_2026,
    seed_fiscal_runtime_cases_2026,
)
from app.training.foundation_runtime_cases_2026 import (
    prepare_foundation_training_data_2026,
    seed_foundation_runtime_assignments_2026,
    seed_foundation_runtime_cases_2026,
)
from app.training.incident_runtime_cases_2026 import (
    ensure_training_incident_fie_2026,
    seed_incident_runtime_assignments_2026,
    seed_incident_runtime_cases_2026,
)
from app.training.regularization_reset_2026 import normalize_regularization_training_tables_2026
from app.training.regularization_runtime_cases_2026 import (
    prepare_regularization_training_data_2026,
    seed_regularization_runtime_assignments_2026,
    seed_regularization_runtime_cases_2026,
)
from app.training.social_security_runtime_cases_2026 import (
    prepare_social_security_training_data_2026,
    seed_social_security_runtime_assignments_2026,
    seed_social_security_runtime_cases_2026,
)


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
    ensure_assignment_progress(db, db_assignment.id)
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

    changed_case_study = case_study_id != db_assignment.case_study_id
    requested_status = update_data.get("status")

    for key, value in update_data.items():
        setattr(db_assignment, key, value)

    if changed_case_study:
        db.query(CaseTaskProgress).filter(CaseTaskProgress.assignment_id == assignment_id).delete(
            synchronize_session=False
        )
        db_assignment.current_task_order = 1
        db_assignment.completion_percentage = 0
        db_assignment.started_at = None
        db_assignment.completed_at = None

    db.commit()
    ensure_assignment_progress(db, assignment_id)

    if requested_status == "in_progress":
        start_assignment(db, assignment_id)

    return get_case_assignment(db, assignment_id)


def delete_case_assignment(db: Session, assignment_id: int):
    db_assignment = db.query(CaseAssignment).filter(CaseAssignment.id == assignment_id).first()
    if not db_assignment:
        return None

    db.delete(db_assignment)
    db.commit()
    return db_assignment


def _ensure_demo_assignment(
    db: Session,
    case_study: CaseStudy,
    *,
    student: Student | None = None,
    group: StudentGroup | None = None,
    status: str = "assigned",
    notes: str,
):
    query = db.query(CaseAssignment).filter(CaseAssignment.case_study_id == case_study.id)
    if student:
        query = query.filter(CaseAssignment.student_id == student.id)
    elif group:
        query = query.filter(CaseAssignment.group_id == group.id)
    existing = query.first()
    if existing:
        ensure_assignment_progress(db, existing.id)
        if status == "in_progress" and existing.status == "assigned":
            start_assignment(db, existing.id)
        return existing

    created = create_case_assignment(
        db,
        CaseAssignmentCreate(
            case_study_id=case_study.id,
            student_id=student.id if student else None,
            group_id=group.id if group else None,
            assigned_by="Profesor demo",
            status="assigned" if status == "in_progress" else status,
            notes=notes,
        ),
    )
    if status == "in_progress":
        start_assignment(db, created.id)
    return created


def _ensure_demo_assignees(db: Session) -> None:
    """Hace el seeder de asignaciones determinista incluso en una base vacía."""
    if db.query(StudentGroup).count() == 0:
        from app.crud.student_group import seed_demo_student_groups

        seed_demo_student_groups(db)
    if db.query(Student).count() == 0:
        from app.crud.student import seed_demo_students

        seed_demo_students(db)


def _reset_training_workday_baseline(db: Session) -> None:
    """A27 parte siempre de una jornada completa visible en el contrato demo."""
    employee = db.query(Employee).filter(Employee.dni == "10000001A").first()
    if employee is None:
        return
    contract = (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id, Contract.status == "active")
        .order_by(Contract.id.desc())
        .first()
    )
    if contract is None:
        return
    contract.working_day_type = "full_time"
    contract.weekly_hours = 40
    contract.full_time_weekly_hours = 40
    contract.partiality_coefficient = 100
    db.commit()


def seed_demo_case_assignments(db: Session, *, reset_training_data: bool = True):
    """Asegura casos/asignaciones y, opcionalmente, restaura los datos base de prácticas.

    Las vistas auxiliares como Correo usan ``reset_training_data=False`` para
    enlazar los casos sin deshacer operaciones que el alumno ya haya realizado.
    Los endpoints explícitos de seed/reset conservan el comportamiento de
    restauración completa mediante el valor por defecto.
    """
    _ensure_demo_assignees(db)
    seed_foundation_runtime_cases_2026(db)
    seed_incident_runtime_cases_2026(db)
    seed_social_security_runtime_cases_2026(db)
    seed_fiscal_runtime_cases_2026(db)
    seed_regularization_runtime_cases_2026(db)

    if reset_training_data:
        _reset_training_workday_baseline(db)
        prepare_foundation_training_data_2026(db)
        ensure_training_incident_fie_2026(db, reset=True)
        prepare_social_security_training_data_2026(db)
        normalize_regularization_training_tables_2026(db)
        prepare_regularization_training_data_2026(db)
    else:
        ensure_training_incident_fie_2026(db, reset=False)

    case_studies = db.query(CaseStudy).order_by(CaseStudy.id.asc()).all()
    students = db.query(Student).order_by(Student.id.asc()).all()
    groups = db.query(StudentGroup).order_by(StudentGroup.id.asc()).all()

    if not case_studies or (not students and not groups):
        return

    first_student = students[0] if students else None
    first_group = groups[0] if groups else None
    second_group = groups[1] if len(groups) > 1 else first_group

    for case_study in case_studies:
        if case_study.scenario_code == "IT-2026-008" and second_group:
            _ensure_demo_assignment(
                db,
                case_study,
                group=second_group,
                status="in_progress",
                notes="Caso guiado de IT, FIE y nómina iniciado desde el correo simulado.",
            )
        elif case_study.scenario_code == "TRAIN-2026-PAYROLL-001" and first_student:
            _ensure_demo_assignment(
                db,
                case_study,
                student=first_student,
                status="assigned",
                notes="Itinerario formativo de estructura salarial, pagas, cálculo, bases, cotización e IRPF.",
            )
        elif case_study.scenario_code == "TRAIN-2026-PAYROLL-PARTIAL-001" and first_student:
            _ensure_demo_assignment(
                db,
                case_study,
                student=first_student,
                status="assigned",
                notes="Caso individual para practicar el cálculo proporcional de una alta dentro del mes.",
            )
        elif case_study.scenario_code in {"ALT-2026-021", "NOM-2026-014"} and first_student:
            _ensure_demo_assignment(
                db,
                case_study,
                student=first_student,
                status="assigned",
                notes="Caso individual vinculado al buzón simulado.",
            )
        elif case_study.title == "Alta completa de trabajador" and first_group:
            _ensure_demo_assignment(
                db,
                case_study,
                group=first_group,
                status="assigned",
                notes="Asignacion demo para trabajar el alta completa de trabajador.",
            )
        elif case_study.title == "Expediente documental incompleto" and first_student:
            _ensure_demo_assignment(
                db,
                case_study,
                student=first_student,
                status="submitted",
                notes="Asignacion individual demo con entrega pendiente de revisar.",
            )

    seed_foundation_runtime_assignments_2026(db)
    seed_incident_runtime_assignments_2026(db)
    seed_social_security_runtime_assignments_2026(db)
    seed_fiscal_runtime_assignments_2026(db)
    seed_regularization_runtime_assignments_2026(db)
