from __future__ import annotations

from datetime import datetime
import unicodedata

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.employee import Employee
from app.models.mail import EmailAttachment, EmailMessage, EmailThread, Mailbox
from app.models.student import Student
from app.models.student_group import StudentGroup
from app.services.case_scenario_service import ensure_assignment_progress


INTEGRATED_SCENARIO_CODE = "LAB-2026-001"


TASK_DEFINITIONS = [
    {
        "title": "Revisar la comunicación FIE",
        "description": "Comprueba la persona, la contingencia y la fecha de efectos comunicada por el INSS.",
        "module": "fie",
        "expected_result": "Comunicación FIE revisada",
        "expected_action": "review_fie",
        "validation_rules": [{"type": "review_fie", "employee": "Javier Romero Sánchez"}],
    },
    {
        "title": "Comprobar la incidencia de incapacidad temporal",
        "description": "Revisa o completa la IT iniciada el 6 de mayo de 2026 para que coincida con el parte médico.",
        "module": "incidents",
        "expected_result": "Incidencia IT registrada con fecha correcta",
        "expected_action": "create_incident",
        "validation_rules": [
            {
                "type": "incident_exists",
                "employee": "Javier Romero Sánchez",
                "incident_type": "IT",
                "start_date": "2026-05-06",
            }
        ],
    },
    {
        "title": "Conciliar el FIE con la incidencia",
        "description": "Relaciona la comunicación recibida con la IT interna y resuelve las diferencias detectadas.",
        "module": "fie",
        "expected_result": "Comunicación FIE conciliada",
        "expected_action": "reconcile_fie",
        "validation_rules": [{"type": "reconcile_fie", "employee": "Javier Romero Sánchez"}],
    },
    {
        "title": "Dar de alta a la persona sustituta",
        "description": "Crea el expediente de Marta Ruiz Córdoba con los datos incluidos en el documento adjunto.",
        "module": "employees",
        "expected_result": "Marta Ruiz Córdoba creada y activa",
        "expected_action": "create_employee",
        "validation_rules": [{"type": "employee_exists", "employee": "Marta Ruiz Córdoba"}],
    },
    {
        "title": "Registrar el contrato de sustitución",
        "description": "Configura un contrato de sustitución vinculado a la ausencia de Javier y con fecha de inicio 7 de mayo.",
        "module": "contracts",
        "expected_result": "Contrato de sustitución activo",
        "expected_action": "create_contract",
        "validation_rules": [
            {
                "type": "active_contract",
                "employee": "Marta Ruiz Córdoba",
                "contract_family": "substitution",
            }
        ],
    },
    {
        "title": "Preparar el movimiento de alta",
        "description": "Genera el alta de afiliación de la sustituta con fecha 7 de mayo de 2026.",
        "module": "affiliations",
        "expected_result": "Movimiento de alta preparado",
        "expected_action": "prepare_affiliation",
        "validation_rules": [
            {
                "type": "affiliation_prepared",
                "employee": "Marta Ruiz Córdoba",
                "registration_date": "2026-05-07",
            }
        ],
    },
    {
        "title": "Enviar la afiliación mediante SILTRA",
        "description": "Genera el fichero de afiliación, envíalo al simulador y revisa la respuesta recibida.",
        "module": "affiliations",
        "expected_result": "Fichero de afiliación enviado",
        "expected_action": "submit_affiliation",
        "validation_rules": [
            {
                "type": "affiliation_prepared",
                "employee": "Marta Ruiz Córdoba",
                "registration_date": "2026-05-07",
            }
        ],
    },
    {
        "title": "Recalcular la nómina afectada",
        "description": "Comprueba el impacto de la IT en la nómina de Javier correspondiente a mayo de 2026.",
        "module": "payrolls",
        "expected_result": "Nómina de mayo recalculada",
        "expected_action": "recalculate_payroll",
        "validation_rules": [
            {
                "type": "payroll_recalculated",
                "employee": "Javier Romero Sánchez",
                "period": "2026-05",
            }
        ],
    },
    {
        "title": "Enviar la liquidación a SILTRA",
        "description": "Presenta el fichero de Seguridad Social del periodo y consulta su resultado en el simulador.",
        "module": "siltra",
        "expected_result": "Envío de liquidación procesado",
        "expected_action": "submit_siltra",
        "validation_rules": [
            {
                "type": "payroll_recalculated",
                "employee": "Javier Romero Sánchez",
                "period": "2026-05",
            }
        ],
    },
    {
        "title": "Responder a la dirección del centro",
        "description": "Confirma en el hilo que la IT, la sustitución, la nómina y los envíos han quedado tramitados.",
        "module": "general",
        "expected_result": "Respuesta profesional enviada",
        "expected_action": "reply_mail",
        "validation_rules": [{"type": "reply_mail"}],
    },
]


ATTACHMENTS = [
    {
        "filename": "01_Parte_baja_Javier_Romero.pdf",
        "content_type": "application/pdf",
        "document_type": "medical_leave_integrated",
        "content_text": (
            "PARTE MÉDICO DE BAJA\n\n"
            "Trabajador: Javier Romero Sánchez\n"
            "NIF: 10000002B\n"
            "Fecha de baja: 06/05/2026\n"
            "Contingencia: enfermedad común\n"
            "Duración estimada: 8 días\n"
            "Proceso INSS: IT-2026-JRS-0506"
        ),
    },
    {
        "filename": "02_Comunicacion_FIE_IT_Javier.txt",
        "content_type": "text/plain",
        "document_type": "fie_integrated",
        "content_text": (
            "FIE|INSS|IT-2026-JRS-0506\n"
            "TRABAJADOR=JAVIER ROMERO SANCHEZ\n"
            "NIF=10000002B\n"
            "SITUACION=INCAPACIDAD_TEMPORAL\n"
            "FECHA_EFECTOS=2026-05-06\n"
            "CONTINGENCIA=ENFERMEDAD_COMUN\n"
            "ESTADO=PENDIENTE_CONCILIACION"
        ),
    },
    {
        "filename": "03_Datos_sustituta_Marta_Ruiz.pdf",
        "content_type": "application/pdf",
        "document_type": "substitute_employee_integrated",
        "content_text": (
            "DATOS PARA INCORPORACIÓN DE SUSTITUCIÓN\n\n"
            "Nombre: Marta Ruiz Córdoba\n"
            "NIF: 20000006F\n"
            "NAF: 141000000106\n"
            "Correo: marta.ruiz@aulanomina.demo\n"
            "Fecha de nacimiento: 19/09/1994\n"
            "Fecha prevista de alta: 07/05/2026\n"
            "Persona sustituida: Javier Romero Sánchez\n"
            "Centro: Colegio San Rafael\n"
            "Jornada: 40 horas semanales"
        ),
    },
    {
        "filename": "04_Condiciones_sustitucion.csv",
        "content_type": "text/csv",
        "document_type": "substitution_conditions_integrated",
        "content_text": (
            "campo;valor\n"
            "empresa;Fundación AulaNomina\n"
            "centro;Colegio San Rafael\n"
            "persona_sustituida;Javier Romero Sánchez\n"
            "causa;Incapacidad temporal\n"
            "fecha_inicio;2026-05-07\n"
            "tipo_contrato;Sustitución\n"
            "jornada_semanal;40\n"
            "grupo_cotizacion;7"
        ),
    },
]


def _normalize(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _employee_name(employee: Employee) -> str:
    return " ".join(
        part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part
    )


def _find_employee(db: Session, expected_name: str) -> Employee | None:
    expected = _normalize(expected_name)
    return next(
        (
            employee
            for employee in db.query(Employee).all()
            if _normalize(_employee_name(employee)) == expected
        ),
        None,
    )


def _ensure_case_study(db: Session, company_id: int | None) -> CaseStudy:
    case_study = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code == INTEGRATED_SCENARIO_CODE)
        .first()
    )
    values = {
        "title": "Baja médica, sustitución y cierre de comunicaciones",
        "description": (
            "Caso integral de administración laboral que conecta FIE, incapacidad temporal, alta de una "
            "sustituta, contrato, afiliación, nómina y envíos mediante SILTRA simulado."
        ),
        "difficulty": "advanced",
        "category": "social_security",
        "company_id": company_id,
        "status": "active",
        "initial_state": {
            "employee": "Javier Romero Sánchez",
            "substitute": "Marta Ruiz Córdoba",
            "leave_start": "2026-05-06",
            "start_date": "2026-05-07",
            "payroll_period": "2026-05",
            "period": "2026-05",
            "incident_category": "medical",
            "company_id": company_id,
        },
        "validation_rules": [
            {"type": "reconcile_fie", "employee": "Javier Romero Sánchez"},
            {"type": "active_contract", "employee": "Marta Ruiz Córdoba", "contract_family": "substitution"},
            {"type": "affiliation_prepared", "employee": "Marta Ruiz Córdoba", "registration_date": "2026-05-07"},
            {"type": "payroll_recalculated", "employee": "Javier Romero Sánchez", "period": "2026-05"},
            {"type": "reply_mail"},
        ],
        "completion_message": (
            "La baja médica, la sustitución, la nómina y las comunicaciones de Seguridad Social han quedado tramitadas."
        ),
        "created_by": "Demo comercial AulaNomina",
    }
    if case_study is None:
        case_study = CaseStudy(scenario_code=INTEGRATED_SCENARIO_CODE, **values)
        db.add(case_study)
        db.flush()
    else:
        for field, value in values.items():
            setattr(case_study, field, value)

    existing_by_order = {task.task_order: task for task in case_study.tasks}
    for order, definition in enumerate(TASK_DEFINITIONS, start=1):
        task = existing_by_order.get(order)
        values = {
            **definition,
            "trigger_type": "module_event",
            "trigger_condition": {},
            "feedback_config": {},
            "task_order": order,
            "is_required": True,
            "blocking": True,
            "status": "pending",
        }
        if task is None:
            db.add(CaseTask(case_study_id=case_study.id, **values))
        else:
            for field, value in values.items():
                setattr(task, field, value)
    db.flush()
    return case_study


def _ensure_assignment(db: Session, case_study: CaseStudy) -> CaseAssignment | None:
    assignment = (
        db.query(CaseAssignment)
        .filter(CaseAssignment.case_study_id == case_study.id)
        .order_by(CaseAssignment.id.asc())
        .first()
    )
    if assignment is None:
        student = db.query(Student).order_by(Student.id.asc()).first()
        group = db.query(StudentGroup).order_by(StudentGroup.id.asc()).first()
        if student is None and group is None:
            return None
        assignment = CaseAssignment(
            case_study_id=case_study.id,
            student_id=student.id if student else None,
            group_id=None if student else group.id,
            assigned_by="Demo comercial AulaNomina",
            status="assigned",
            current_task_order=1,
            completion_percentage=0,
            notes="Recorrido integral orientado a la demostración comercial del producto.",
        )
        db.add(assignment)
        db.flush()
    ensure_assignment_progress(db, assignment.id)
    return assignment


def _ensure_thread(
    db: Session,
    mailbox: Mailbox,
    case_study: CaseStudy,
    assignment: CaseAssignment | None,
    employee: Employee | None,
) -> EmailThread:
    thread = (
        db.query(EmailThread)
        .filter(
            EmailThread.mailbox_id == mailbox.id,
            EmailThread.case_reference == INTEGRATED_SCENARIO_CODE,
        )
        .first()
    )
    first_task = (
        db.query(CaseTask)
        .filter(CaseTask.case_study_id == case_study.id)
        .order_by(CaseTask.task_order.asc(), CaseTask.id.asc())
        .first()
    )
    now = datetime(2026, 5, 6, 9, 15)
    values = {
        "company_id": employee.company_id if employee else case_study.company_id,
        "employee_id": employee.id if employee else None,
        "case_study_id": case_study.id,
        "case_assignment_id": assignment.id if assignment else None,
        "case_task_id": first_task.id if first_task else None,
        "related_entity_type": "employee",
        "related_entity_id": employee.id if employee else None,
        "subject": "Baja médica de Javier Romero: sustitución y tramitación completa",
        "preview": (
            "Se ha recibido la baja de Javier. Debemos conciliar el FIE, cubrir la ausencia y cerrar las comunicaciones."
        ),
        "folder": "inbox",
        "status": "open" if not assignment or assignment.status == "assigned" else "in_progress",
        "priority": "urgent",
        "category": "social_security",
        "is_read": False,
        "expected_actions": [definition["title"] for definition in TASK_DEFINITIONS],
        "context_actions": [
            "fie-inbox",
            "incidents",
            "employees",
            "contracts",
            "affiliations",
            "payroll-history",
            "siltra",
        ],
    }
    if thread is None:
        thread = EmailThread(
            mailbox_id=mailbox.id,
            case_reference=INTEGRATED_SCENARIO_CODE,
            created_at=now,
            updated_at=now,
            **values,
        )
        db.add(thread)
        db.flush()
    else:
        for field, value in values.items():
            setattr(thread, field, value)

    initial_message = (
        db.query(EmailMessage)
        .filter(EmailMessage.thread_id == thread.id, EmailMessage.message_type == "initial")
        .order_by(EmailMessage.id.asc())
        .first()
    )
    body_text = (
        "Buenos días:\n\n"
        "Javier Romero ha iniciado una incapacidad temporal por enfermedad común con efectos del 6 de mayo. "
        "La comunicación FIE y el parte médico se encuentran adjuntos.\n\n"
        "El centro necesita mantener la cobertura del puesto. Los datos de Marta Ruiz Córdoba, propuesta para "
        "la sustitución, también se incluyen en la documentación. Comprueba la situación de Javier, concilia "
        "la comunicación con la incidencia y tramita la incorporación de Marta con la misma jornada.\n\n"
        "Cuando la sustitución esté preparada, envía la afiliación y revisa la nómina afectada antes de presentar "
        "la liquidación en SILTRA. Confirma por este mismo hilo cuando todo el proceso esté cerrado."
    )
    if initial_message is None:
        initial_message = EmailMessage(
            thread_id=thread.id,
            sender_name="Dirección del Colegio San Rafael",
            sender_address="direccion.sanrafael@aulanomina.demo",
            recipient_name=mailbox.display_name,
            recipient_address=mailbox.address,
            body_text=body_text,
            sent_at=now,
            direction="incoming",
            message_type="initial",
        )
        db.add(initial_message)
        db.flush()
    else:
        initial_message.body_text = body_text

    existing_attachments = {attachment.filename: attachment for attachment in initial_message.attachments}
    for definition in ATTACHMENTS:
        attachment = existing_attachments.get(definition["filename"])
        values = {
            **definition,
            "storage_reference": f"demo://mail/{INTEGRATED_SCENARIO_CODE}/{definition['filename']}",
            "size_bytes": len(definition["content_text"].encode("utf-8")),
        }
        if attachment is None:
            db.add(EmailAttachment(message_id=initial_message.id, **values))
        else:
            for field, value in values.items():
                setattr(attachment, field, value)
    db.flush()
    return thread


def ensure_integrated_demo_case(db: Session, mailbox: Mailbox) -> EmailThread:
    employee = _find_employee(db, "Javier Romero Sánchez")
    case_study = _ensure_case_study(db, employee.company_id if employee else None)
    assignment = _ensure_assignment(db, case_study)
    thread = _ensure_thread(db, mailbox, case_study, assignment, employee)
    db.commit()
    db.refresh(thread)
    return thread
