from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.case_study import CaseStudy, CaseTask
from app.schemas.case_study import CaseStudyCreate, CaseStudyUpdate, CaseTaskCreate, CaseTaskUpdate


def create_case_study(db: Session, case_study: CaseStudyCreate):
    data = case_study.model_dump(exclude={"tasks"})
    db_case = CaseStudy(**data)
    db.add(db_case)
    db.flush()

    for task in case_study.tasks:
        db.add(CaseTask(case_study_id=db_case.id, **task.model_dump()))

    db.commit()
    return get_case_study(db, db_case.id)


def get_case_studies(db: Session):
    return (
        db.query(CaseStudy)
        .options(joinedload(CaseStudy.tasks))
        .order_by(CaseStudy.created_at.desc())
        .all()
    )


def get_case_study(db: Session, case_study_id: int):
    return (
        db.query(CaseStudy)
        .options(joinedload(CaseStudy.tasks))
        .filter(CaseStudy.id == case_study_id)
        .first()
    )


def update_case_study(db: Session, case_study_id: int, data: CaseStudyUpdate):
    db_case = db.query(CaseStudy).filter(CaseStudy.id == case_study_id).first()
    if not db_case:
        return None

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(db_case, key, value)

    db.commit()
    return get_case_study(db, case_study_id)


def delete_case_study(db: Session, case_study_id: int):
    db_case = db.query(CaseStudy).filter(CaseStudy.id == case_study_id).first()
    if not db_case:
        return None

    db.delete(db_case)
    db.commit()
    return db_case


def create_case_task(db: Session, case_study_id: int, task: CaseTaskCreate):
    db_case = db.query(CaseStudy).filter(CaseStudy.id == case_study_id).first()
    if not db_case:
        raise HTTPException(status_code=404, detail="Caso practico no encontrado")

    db_task = CaseTask(case_study_id=case_study_id, **task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_case_task(db: Session, task_id: int, data: CaseTaskUpdate):
    db_task = db.query(CaseTask).filter(CaseTask.id == task_id).first()
    if not db_task:
        return None

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task


def delete_case_task(db: Session, task_id: int):
    db_task = db.query(CaseTask).filter(CaseTask.id == task_id).first()
    if not db_task:
        return None

    db.delete(db_task)
    db.commit()
    return db_task


def seed_demo_case_studies(db: Session):
    if db.query(CaseStudy).count() > 0:
        return

    demo_cases = [
        CaseStudyCreate(
            title="Alta completa de trabajador",
            description="El alumno debe crear un trabajador nuevo, asignarlo a empresa y centro, crear contrato indefinido y dejar preparada la documentación inicial.",
            difficulty="basic",
            status="active",
            created_by="Profesor demo",
            tasks=[
                CaseTaskCreate(title="Crear trabajador", description="Dar de alta a Fulanito Pérez con datos personales completos.", module="employees", expected_result="Trabajador creado y activo", task_order=1),
                CaseTaskCreate(title="Asignar empresa y centro", description="Vincular el trabajador a Fundación AulaNomina y Colegio San Rafael.", module="employees", expected_result="Empresa y centro visibles en la ficha", task_order=2),
                CaseTaskCreate(title="Crear contrato indefinido", description="Registrar contrato activo con fecha de inicio indicada por el profesor.", module="contracts", expected_result="Contrato indefinido activo", task_order=3),
                CaseTaskCreate(title="Generar checklist documental", description="Preparar DNI/NIE, NAF, contrato firmado y Modelo 145.", module="documents", expected_result="Documentos iniciales creados", task_order=4),
            ],
        ),
        CaseStudyCreate(
            title="Incidencia IT y nomina",
            description="El alumno debe registrar una baja IT durante el mes y preparar la nomina simulada afectada por la incidencia.",
            difficulty="intermediate",
            status="active",
            created_by="Profesor demo",
            tasks=[
                CaseTaskCreate(title="Localizar trabajador y contrato activo", description="Comprobar que el trabajador tiene contrato vigente.", module="contracts", expected_result="Contrato activo identificado", task_order=1),
                CaseTaskCreate(title="Registrar incidencia IT", description="Crear una incidencia de incapacidad temporal con fecha de inicio y fin.", module="incidents", expected_result="Incidencia IT abierta o cerrada segun fechas", task_order=2),
                CaseTaskCreate(title="Preparar nomina mensual", description="Generar la nomina del mes afectado por la IT.", module="payrolls", expected_result="Nomina del periodo preparada", task_order=3),
                CaseTaskCreate(title="Revisar resultado", description="Comprobar que la incidencia aparece asociada al trabajador.", module="payrolls", expected_result="Nomina revisada por el alumno", task_order=4),
            ],
        ),
        CaseStudyCreate(
            title="Expediente documental incompleto",
            description="El alumno debe revisar un expediente laboral con documentos pendientes, caducados y no aplicables.",
            difficulty="intermediate",
            status="active",
            created_by="Profesor demo",
            tasks=[
                CaseTaskCreate(title="Revisar documentos pendientes", description="Entrar en el modulo documental y filtrar documentos pendientes.", module="documents", expected_result="Pendientes identificados", task_order=1),
                CaseTaskCreate(title="Marcar Modelo 145 como recibido", description="Actualizar el estado del Modelo 145.", module="documents", expected_result="Modelo 145 recibido", task_order=2),
                CaseTaskCreate(title="Marcar documento no aplicable", description="Indicar que un documento no procede para este trabajador.", module="documents", expected_result="Documento marcado como no aplica", task_order=3),
                CaseTaskCreate(title="Comprobar expediente final", description="Revisar que no quedan documentos criticos sin tratar.", module="documents", expected_result="Expediente revisado", task_order=4),
            ],
        ),
    ]

    for case_study in demo_cases:
        create_case_study(db, case_study)
