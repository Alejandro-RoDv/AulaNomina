from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.crud.case_assignment import (
    create_case_assignment,
    delete_case_assignment,
    get_case_assignments,
    seed_demo_case_assignments,
    update_case_assignment,
)
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
from app.crud.correction import (
    create_correction,
    delete_correction,
    get_corrections,
    seed_demo_corrections,
    update_correction,
)
from app.crud.student import (
    create_student,
    get_next_student_code,
    get_student,
    get_student_by_code,
    get_student_by_email,
    get_students,
    seed_demo_students,
    soft_delete_student,
    update_student,
)
from app.crud.student_group import (
    create_student_group,
    get_group_by_code,
    get_next_group_code,
    get_student_group,
    get_student_groups,
    seed_demo_student_groups,
    soft_delete_student_group,
    update_student_group,
)
from app.schemas.case_assignment import CaseAssignmentCreate, CaseAssignmentResponse, CaseAssignmentUpdate
from app.schemas.case_study import (
    CaseStudyCreate,
    CaseStudyResponse,
    CaseStudyUpdate,
    CaseTaskCreate,
    CaseTaskResponse,
    CaseTaskUpdate,
)
from app.schemas.correction import CorrectionCreate, CorrectionResponse, CorrectionUpdate
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.schemas.student_group import StudentGroupCreate, StudentGroupResponse, StudentGroupUpdate

router = APIRouter(tags=["teaching"])


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


@router.post("/case-studies/seed-demo")
def seed_demo_case_studies_endpoint(db: Session = Depends(get_db)):
    seed_demo_student_groups(db)
    seed_demo_students(db)
    seed_demo_case_studies(db)
    seed_demo_case_assignments(db)
    seed_demo_corrections(db)
    return {"ok": True, "message": "Casos practicos, asignaciones, grupos, alumnos y correcciones demo cargados"}


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


@router.get("/case-assignments", response_model=list[CaseAssignmentResponse])
def list_case_assignments(db: Session = Depends(get_db)):
    return get_case_assignments(db)


@router.post("/case-assignments", response_model=CaseAssignmentResponse)
def create_case_assignment_endpoint(assignment: CaseAssignmentCreate, db: Session = Depends(get_db)):
    return create_case_assignment(db, assignment)


@router.post("/case-assignments/seed-demo")
def seed_demo_case_assignments_endpoint(db: Session = Depends(get_db)):
    seed_demo_student_groups(db)
    seed_demo_students(db)
    seed_demo_case_studies(db)
    seed_demo_case_assignments(db)
    return {"ok": True, "message": "Asignaciones demo cargadas"}


@router.put("/case-assignments/{assignment_id}", response_model=CaseAssignmentResponse)
def update_case_assignment_endpoint(assignment_id: int, assignment: CaseAssignmentUpdate, db: Session = Depends(get_db)):
    updated_assignment = update_case_assignment(db, assignment_id, assignment)
    if not updated_assignment:
        raise HTTPException(status_code=404, detail="Asignacion no encontrada")
    return updated_assignment


@router.delete("/case-assignments/{assignment_id}")
def delete_case_assignment_endpoint(assignment_id: int, db: Session = Depends(get_db)):
    deleted_assignment = delete_case_assignment(db, assignment_id)
    if not deleted_assignment:
        raise HTTPException(status_code=404, detail="Asignacion no encontrada")
    return {"ok": True, "deleted_id": assignment_id}


@router.get("/corrections", response_model=list[CorrectionResponse])
def list_corrections(db: Session = Depends(get_db)):
    return get_corrections(db)


@router.post("/corrections", response_model=CorrectionResponse)
def create_correction_endpoint(correction: CorrectionCreate, db: Session = Depends(get_db)):
    return create_correction(db, correction)


@router.post("/corrections/seed-demo")
def seed_demo_corrections_endpoint(db: Session = Depends(get_db)):
    seed_demo_student_groups(db)
    seed_demo_students(db)
    seed_demo_case_studies(db)
    seed_demo_case_assignments(db)
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


@router.get("/students/next-code")
def get_next_student_code_endpoint(db: Session = Depends(get_db)):
    return {"student_code": get_next_student_code(db)}


@router.get("/students", response_model=list[StudentResponse])
def list_students(db: Session = Depends(get_db)):
    return get_students(db)


@router.post("/students", response_model=StudentResponse)
def create_student_endpoint(student: StudentCreate, db: Session = Depends(get_db)):
    if student.student_code and get_student_by_code(db, student.student_code):
        raise HTTPException(status_code=400, detail="Ya existe un alumno con ese codigo")

    if student.email and get_student_by_email(db, student.email):
        raise HTTPException(status_code=400, detail="Ya existe un alumno con ese email")

    return create_student(db, student)


@router.post("/students/seed-demo")
def seed_demo_students_endpoint(db: Session = Depends(get_db)):
    seed_demo_student_groups(db)
    seed_demo_students(db)
    return {"ok": True, "message": "Alumnos demo cargados"}


@router.put("/students/{student_id}", response_model=StudentResponse)
def update_student_endpoint(student_id: int, student: StudentUpdate, db: Session = Depends(get_db)):
    if not get_student(db, student_id):
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    return update_student(db, student_id, student)


@router.delete("/students/{student_id}", response_model=StudentResponse)
def delete_student_endpoint(student_id: int, db: Session = Depends(get_db)):
    deleted_student = soft_delete_student(db, student_id)
    if not deleted_student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    return deleted_student


@router.get("/student-groups/next-code")
def get_next_group_code_endpoint(db: Session = Depends(get_db)):
    return {"group_code": get_next_group_code(db)}


@router.get("/student-groups", response_model=list[StudentGroupResponse])
def list_student_groups(db: Session = Depends(get_db)):
    return get_student_groups(db)


@router.post("/student-groups", response_model=StudentGroupResponse)
def create_student_group_endpoint(group: StudentGroupCreate, db: Session = Depends(get_db)):
    if group.group_code and get_group_by_code(db, group.group_code):
        raise HTTPException(status_code=400, detail="Ya existe un grupo con ese codigo")
    return create_student_group(db, group)


@router.post("/student-groups/seed-demo")
def seed_demo_student_groups_endpoint(db: Session = Depends(get_db)):
    seed_demo_student_groups(db)
    return {"ok": True, "message": "Grupos demo cargados"}


@router.put("/student-groups/{group_id}", response_model=StudentGroupResponse)
def update_student_group_endpoint(group_id: int, group: StudentGroupUpdate, db: Session = Depends(get_db)):
    if not get_student_group(db, group_id):
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return update_student_group(db, group_id, group)


@router.delete("/student-groups/{group_id}", response_model=StudentGroupResponse)
def delete_student_group_endpoint(group_id: int, db: Session = Depends(get_db)):
    deleted_group = soft_delete_student_group(db, group_id)
    if not deleted_group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return deleted_group
