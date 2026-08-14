from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.case_study import CaseStudy, CaseTask
from app.schemas.case_study import CaseStudyCreate, CaseStudyUpdate, CaseTaskCreate, CaseTaskUpdate
from app.services.case_feedback_service import normalized_feedback_config
from app.training.runtime_bindings_2026 import (
    build_payroll_core_task_definitions_2026,
    build_pilot_task_definitions_2026,
)


def _task_data(task: CaseTaskCreate) -> dict:
    data = task.model_dump()
    data["feedback_config"] = normalized_feedback_config(data.get("feedback_config"))
    return data


def create_case_study(db: Session, case_study: CaseStudyCreate):
    data = case_study.model_dump(exclude={"tasks"})
    db_case = CaseStudy(**data)
    db.add(db_case)
    db.flush()

    for task in case_study.tasks:
        db.add(CaseTask(case_study_id=db_case.id, **_task_data(task)))

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

    db_task = CaseTask(case_study_id=case_study_id, **_task_data(task))
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_case_task(db: Session, task_id: int, data: CaseTaskUpdate):
    db_task = db.query(CaseTask).filter(CaseTask.id == task_id).first()
    if not db_task:
        return None

    values = data.model_dump(exclude_unset=True)
    if "feedback_config" in values:
        values["feedback_config"] = normalized_feedback_config(values["feedback_config"])
    for key, value in values.items():
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


def _demo_cases() -> list[CaseStudyCreate]:
    pilot_tasks = [CaseTaskCreate(**definition) for definition in build_pilot_task_definitions_2026()]
    payroll_core_tasks = [
        CaseTaskCreate(**definition)
        for definition in build_payroll_core_task_definitions_2026()
    ]

    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-001",
            title="Alta completa de trabajador",
            description="Primer itinerario ejecutable del Temario Maestro 2026: expediente, contrato indefinido y alta de Seguridad Social.",
            difficulty="basic",
            category="contract",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A04", "A07", "A29"],
                "employee": "Fulanito Pérez",
                "employee_data": {
                    "first_name": "Fulanito",
                    "last_name": "Pérez",
                    "dni": "12345678Z",
                    "naf": "14/1234567890",
                    "birth_date": "1995-04-12",
                    "nationality": "Española",
                    "email": "fulanito.perez@demo.aulanomina.local",
                },
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "start_date": "2026-09-01",
                "contract_data": {
                    "contract_family": "indefinite",
                    "working_day": "Jornada completa",
                    "working_day_type": "full_time",
                    "weekly_hours": 40,
                    "job_position": "Administrativo/a de RRHH",
                },
            },
            completion_message="La incorporación está preparada: expediente creado, contrato indefinido activo y alta de Seguridad Social preparada.",
            tasks=pilot_tasks,
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-PAYROLL-001",
            title="Nómina ordinaria y comprobaciones básicas",
            description="Itinerario guiado del bloque de nómina: estructura salarial, cálculo mensual, base de contingencias comunes, deducciones de Seguridad Social e IRPF.",
            difficulty="intermediate",
            category="payroll",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A14", "A16", "A18", "A20", "A21"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "payroll_period": "2026-06",
                "salary_structure": {
                    "base_salary": "1.680,00 €",
                    "complement_code": "COMPLEMENTO_CONVENIO",
                    "complement_name": "Complemento convenio",
                    "complement_amount": "85,00 €",
                    "pay_schedule": "not_prorated_14",
                    "pay_schedule_label": "14 pagas · no prorrateadas",
                },
            },
            completion_message="La nómina ordinaria ha sido calculada y revisada en sus bases, aportaciones del trabajador y retención de IRPF.",
            tasks=payroll_core_tasks,
        ),
        CaseStudyCreate(
            scenario_code="IT-2026-008",
            title="Incidencia IT y nomina",
            description="El alumno recibe un parte de baja y una comunicación FIE. Debe registrar la IT, conciliar la comunicación y revisar su impacto en nómina.",
            difficulty="intermediate",
            category="absence",
            status="active",
            created_by="Profesor demo",
            initial_state={"employee": "Ana Martín", "leave_start": "2026-08-03", "fie_received": True},
            validation_rules=[
                {"type": "incident_exists", "incident_type": "IT", "employee": "Ana Martín"},
                {"type": "payroll_recalculated", "period": "2026-08"},
            ],
            completion_message="La incapacidad temporal ha quedado registrada, conciliada y reflejada en la nómina.",
            tasks=[
                CaseTaskCreate(title="Revisar el parte y el FIE", description="Comprobar trabajador, contingencia y fecha de efectos.", module="fie", expected_result="Documentación revisada", expected_action="review_fie", task_order=1, trigger_type="mail_response"),
                CaseTaskCreate(title="Registrar incidencia IT", description="Crear la incapacidad temporal con fecha de inicio 03/08/2026.", module="incidents", expected_result="Incidencia IT registrada", expected_action="create_incident", task_order=2, trigger_type="module_event", validation_rules=[{"type": "incident_exists", "incident_type": "IT"}]),
                CaseTaskCreate(title="Conciliar comunicación FIE", description="Relacionar la comunicación con la incidencia registrada.", module="fie", expected_result="FIE conciliado", expected_action="reconcile_fie", task_order=3, trigger_type="module_event"),
                CaseTaskCreate(title="Recalcular nómina", description="Revisar el efecto económico de la baja médica.", module="payrolls", expected_result="Nómina recalculada", expected_action="recalculate_payroll", task_order=4, trigger_type="module_event"),
            ],
        ),
        CaseStudyCreate(
            title="Expediente documental incompleto",
            description="El alumno debe revisar un expediente laboral con documentos pendientes, caducados y no aplicables.",
            difficulty="intermediate",
            category="document",
            status="active",
            created_by="Profesor demo",
            completion_message="El expediente documental ha quedado revisado sin documentos críticos pendientes.",
            tasks=[
                CaseTaskCreate(title="Revisar documentos pendientes", description="Entrar en el modulo documental y filtrar documentos pendientes.", module="documents", expected_result="Pendientes identificados", expected_action="filter_documents", task_order=1),
                CaseTaskCreate(title="Marcar Modelo 145 como recibido", description="Actualizar el estado del Modelo 145.", module="documents", expected_result="Modelo 145 recibido", expected_action="update_document", task_order=2),
                CaseTaskCreate(title="Marcar documento no aplicable", description="Indicar que un documento no procede para este trabajador.", module="documents", expected_result="Documento marcado como no aplica", expected_action="update_document", task_order=3),
                CaseTaskCreate(title="Comprobar expediente final", description="Revisar que no quedan documentos criticos sin tratar.", module="documents", expected_result="Expediente revisado", expected_action="review_documents", task_order=4),
            ],
        ),
        CaseStudyCreate(
            scenario_code="ALT-2026-021",
            title="Alta de sustitución por incapacidad temporal",
            description="A partir de una solicitud recibida por correo, el alumno debe crear a Laura Sánchez, registrar el contrato de sustitución y preparar su alta.",
            difficulty="intermediate",
            category="contract",
            status="active",
            created_by="Profesor demo",
            initial_state={"substitute": "Laura Sánchez", "start_date": "2026-08-06", "replaced_employee": "Ana Martín"},
            validation_rules=[
                {"type": "employee_exists", "employee": "Laura Sánchez"},
                {"type": "active_contract", "contract_family": "substitution"},
                {"type": "affiliation_prepared", "movement": "alta"},
            ],
            completion_message="La sustituta está creada, contratada y preparada para el movimiento de alta.",
            tasks=[
                CaseTaskCreate(title="Crear expediente de Laura Sánchez", description="Registrar los datos personales incluidos en el adjunto.", module="employees", expected_result="Trabajadora creada", expected_action="create_employee", task_order=1, trigger_type="module_event"),
                CaseTaskCreate(title="Registrar contrato de sustitución", description="Configurar causa, persona sustituida, jornada y fecha de inicio.", module="contracts", expected_result="Contrato de sustitución activo", expected_action="create_contract", task_order=2, trigger_type="module_event"),
                CaseTaskCreate(title="Preparar movimiento de alta", description="Generar el movimiento de afiliación para el 06/08/2026.", module="affiliations", expected_result="Alta preparada", expected_action="prepare_affiliation", task_order=3, trigger_type="module_event"),
            ],
        ),
        CaseStudyCreate(
            scenario_code="NOM-2026-014",
            title="Regularización de antigüedad en nómina",
            description="La trabajadora Ana Martín reclama el complemento de antigüedad. El alumno debe revisar el contrato, corregir el concepto y generar la regularización.",
            difficulty="intermediate",
            category="payroll",
            status="active",
            created_by="Profesor demo",
            initial_state={"employee": "Ana Martín", "effective_date": "2026-07-01", "payroll_period": "2026-07"},
            validation_rules=[
                {"type": "seniority_date_checked"},
                {"type": "payroll_concept_exists", "concept": "antigüedad"},
                {"type": "payroll_recalculated", "period": "2026-07"},
                {"type": "regularization_created"},
            ],
            completion_message="La antigüedad y la regularización han quedado correctamente reflejadas.",
            tasks=[
                CaseTaskCreate(title="Comprobar antigüedad", description="Revisar contrato y fecha reconocida de antigüedad.", module="contracts", expected_result="Fecha de antigüedad confirmada", expected_action="review_contract", task_order=1, trigger_type="module_event"),
                CaseTaskCreate(title="Corregir complemento", description="Añadir o modificar el concepto de antigüedad aplicable.", module="payrolls", expected_result="Concepto corregido", expected_action="update_payroll_concept", task_order=2, trigger_type="module_event"),
                CaseTaskCreate(title="Recalcular nómina", description="Recalcular la nómina de julio con el concepto correcto.", module="payrolls", expected_result="Nómina revisada", expected_action="recalculate_payroll", task_order=3, trigger_type="module_event"),
                CaseTaskCreate(title="Generar regularización", description="Crear la diferencia correspondiente y conservar trazabilidad.", module="regularizations", expected_result="Regularización generada", expected_action="create_regularization", task_order=4, trigger_type="module_event"),
            ],
        ),
    ]


def _reset_assignment_after_training_migration(case_study: CaseStudy) -> None:
    for assignment in case_study.assignments:
        assignment.progress_entries.clear()
        assignment.current_task_order = 1
        assignment.completion_percentage = 0
        assignment.started_at = None
        assignment.completed_at = None
        assignment.status = "assigned"


def _is_training_runtime_definition(definition: CaseStudyCreate) -> bool:
    return str(definition.scenario_code or "").upper().startswith("TRAIN-2026-")


def seed_demo_case_studies(db: Session):
    for definition in _demo_cases():
        query = db.query(CaseStudy)
        existing = None
        if definition.scenario_code:
            existing = query.filter(CaseStudy.scenario_code == definition.scenario_code).first()
        if existing is None:
            existing = query.filter(CaseStudy.title == definition.title).first()

        if existing is None:
            create_case_study(db, definition)
            continue

        metadata = definition.model_dump(exclude={"tasks"})
        for field, value in metadata.items():
            if field == "scenario_code" and value is None:
                continue
            setattr(existing, field, value)

        existing_by_order = {task.task_order: task for task in existing.tasks}
        defined_orders = {task.task_order for task in definition.tasks}
        training_definition = _is_training_runtime_definition(definition)
        training_migration_changed = False

        for task_definition in definition.tasks:
            task_values = _task_data(task_definition)
            existing_task = existing_by_order.get(task_definition.task_order)
            if existing_task is None:
                db.add(CaseTask(case_study_id=existing.id, **task_values))
                if training_definition:
                    training_migration_changed = True
                continue

            previous_training_code = (existing_task.trigger_condition or {}).get("training_code")
            next_training_code = (task_values.get("trigger_condition") or {}).get("training_code")
            if training_definition and previous_training_code != next_training_code:
                training_migration_changed = True

            for field, value in task_values.items():
                setattr(existing_task, field, value)

        stale_tasks = [task for task in list(existing.tasks) if task.task_order not in defined_orders]
        for stale_task in stale_tasks:
            db.delete(stale_task)
            if training_definition:
                training_migration_changed = True

        if training_migration_changed:
            _reset_assignment_after_training_migration(existing)

        db.commit()
