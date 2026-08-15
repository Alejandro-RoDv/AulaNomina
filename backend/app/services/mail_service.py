from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import zipfile

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.crud.case_assignment import seed_demo_case_assignments
from app.crud.case_study import seed_demo_case_studies
from app.crud.student import seed_demo_students
from app.crud.student_group import seed_demo_student_groups
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.mail import EmailAttachment, EmailMessage, EmailThread, Mailbox
from app.schemas.mail import EmailMessageCreate, EmailThreadCreate, EmailThreadUpdate


DEMO_MAILBOX_ADDRESS = "usuario.demo@aulanomina.local"
DEMO_MAILBOX_NAME = "Usuario demo"


DEMO_ATTACHMENT_CONTENT = {
    "employee_request": (
        "SOLICITUD DE REVISIÓN\n\nTrabajadora: Ana Martín García\n"
        "Periodo afectado: julio de 2026\nFecha de antigüedad reclamada: 01/07/2026\n"
        "Motivo: ausencia del complemento de antigüedad en la nómina."
    ),
    "fie": (
        "FIE|INSS|20260803|ANA MARTIN GARCIA\n"
        "SITUACION=INCAPACIDAD_TEMPORAL\nFECHA_EFECTOS=2026-08-03\n"
        "CONTINGENCIA=ENFERMEDAD_COMUN\nESTADO=PENDIENTE_CONCILIACION"
    ),
    "medical_leave": (
        "PARTE DE BAJA MÉDICA\n\nTrabajadora: Ana Martín García\n"
        "Fecha de baja: 03/08/2026\nContingencia: enfermedad común\n"
        "Duración estimada: 15 días."
    ),
    "employee_data": (
        "DATOS PARA ALTA DE SUSTITUCIÓN\n\nNombre: Laura Sánchez Romero\n"
        "NIF: 12345678Z\nFecha prevista de alta: 06/08/2026\n"
        "Motivo: sustitución de Ana Martín García durante IT\nJornada: misma jornada que la persona sustituida."
    ),
    "tax_detail": (
        "Factura;Profesional;Base;Retención\n"
        "F-2026-041;Consultoría Sur SL;1200.00;180.00\n"
        "F-2026-052;Laura Pérez;850.00;127.50\n"
        "TOTAL;;;307.50"
    ),
    "certificate": (
        "CERTIFICADO DE EMPRESA\n\nDocumento simulado incorporado al expediente laboral.\n"
        "Fecha de emisión: 01/08/2026\nEstado: firmado y archivado."
    ),
    "tax_receipt": (
        "AGENCIA TRIBUTARIA SIMULADA\n\nModelo: 190\nEjercicio: 2025\n"
        "Resultado: presentación aceptada\nCSV simulado: AN-190-2025-000284."
    ),
}


OPERATIONAL_RESPONSE_TEMPLATES = {
    "reconcile_fie": {
        "sender_name": "Comunicaciones INSS",
        "sender_address": "fie@inss.aulanomina.local",
        "success": "La comunicación FIE ha quedado conciliada con la incidencia laboral correspondiente.",
        "pending": "La comunicación FIE sigue presentando diferencias. Revisa las fechas y la contingencia antes de continuar.",
        "error": "No ha sido posible procesar la conciliación FIE. La comunicación permanece pendiente.",
    },
    "submit_affiliation": {
        "sender_name": "SILTRA simulado · Afiliación",
        "sender_address": "siltra@tgss.aulanomina.local",
        "success": "El fichero de afiliación ha sido recibido y el movimiento ha sido aceptado.",
        "pending": "El fichero de afiliación ha sido recibido con observaciones y requiere revisión.",
        "error": "El fichero de afiliación ha sido rechazado. Consulta la respuesta y corrige el movimiento.",
    },
    "submit_siltra": {
        "sender_name": "SILTRA simulado",
        "sender_address": "siltra@tgss.aulanomina.local",
        "success": "El envío ha sido procesado correctamente. La respuesta de SILTRA está disponible.",
        "pending": "El envío ha sido procesado con discrepancias. Revisa el fichero de respuesta.",
        "error": "El envío ha sido rechazado por errores de validación.",
    },
    "present_model_111": {
        "sender_name": "Agencia Tributaria simulada",
        "sender_address": "notificaciones@aeat.aulanomina.local",
        "success": "La presentación del Modelo 111 ha sido aceptada y se ha generado el justificante.",
        "pending": "La presentación del Modelo 111 contiene avisos que deben revisarse.",
        "error": "La presentación del Modelo 111 ha sido rechazada.",
    },
    "present_model_190": {
        "sender_name": "Agencia Tributaria simulada",
        "sender_address": "notificaciones@aeat.aulanomina.local",
        "success": "La presentación del Modelo 190 ha sido aceptada y se ha generado el justificante.",
        "pending": "La presentación del Modelo 190 contiene registros pendientes de revisión.",
        "error": "La presentación del Modelo 190 ha sido rechazada.",
    },
}


DEMO_THREADS = [
    {
        "subject": "Revisión de antigüedad en la nómina de Ana Martín",
        "preview": "La trabajadora indica que su nómina de julio no incluye el complemento de antigüedad.",
        "folder": "inbox",
        "status": "open",
        "priority": "high",
        "category": "payroll",
        "case_reference": "NOM-2026-014",
        "is_read": False,
        "sent_at": datetime(2026, 8, 5, 8, 12),
        "sender_name": "María López · Administración",
        "sender_address": "administracion@empresa-demo.es",
        "body_text": (
            "Buenos días:\n\nLa trabajadora Ana Martín nos comunica que su nómina de julio no incluye "
            "el complemento de antigüedad que le corresponde desde el 1 de julio de 2026.\n\n"
            "Revisa su expediente, comprueba la fecha de antigüedad, regulariza el concepto y recalcula "
            "la nómina. El caso no debe cerrarse hasta que la diferencia quede correctamente reflejada."
        ),
        "attachments": [("Solicitud_Ana_Martin.pdf", "application/pdf", "employee_request")],
        "expected_actions": [
            "Comprobar la antigüedad del contrato",
            "Añadir o corregir el concepto",
            "Recalcular la nómina",
            "Generar la regularización correspondiente",
        ],
        "context_actions": ["employee-record", "payroll-history", "regularizations"],
    },
    {
        "subject": "FIE disponible: proceso de incapacidad temporal",
        "preview": "Se ha recibido una comunicación FIE relativa a una baja médica con fecha de efectos 03/08/2026.",
        "folder": "inbox",
        "status": "in_progress",
        "priority": "urgent",
        "category": "social_security",
        "case_reference": "IT-2026-008",
        "is_read": False,
        "sent_at": datetime(2026, 8, 5, 7, 46),
        "sender_name": "Comunicaciones INSS",
        "sender_address": "fie@inss.aulanomina.local",
        "body_text": (
            "Se ha recibido una comunicación FIE relativa a una baja médica con fecha de efectos 03/08/2026.\n\n"
            "Comprueba que la incidencia registrada coincide con el parte adjunto y concilia la comunicación "
            "antes de continuar con el cálculo de nómina."
        ),
        "attachments": [
            ("FIE_IT_03082026.txt", "text/plain", "fie"),
            ("Parte_baja_Ana_Martin.pdf", "application/pdf", "medical_leave"),
        ],
        "expected_actions": [
            "Revisar fechas del parte",
            "Conciliar la comunicación FIE",
            "Comprobar el impacto en nómina",
        ],
        "context_actions": ["fie-inbox", "incidents", "payroll-history"],
    },
    {
        "subject": "Alta de sustitución por incapacidad temporal",
        "preview": "Necesitamos tramitar la incorporación de Laura Sánchez como sustituta durante la ausencia.",
        "folder": "inbox",
        "status": "open",
        "priority": "normal",
        "category": "contract",
        "case_reference": "ALT-2026-021",
        "is_read": False,
        "sent_at": datetime(2026, 8, 4, 16, 28),
        "sender_name": "Dirección del centro Norte",
        "sender_address": "direccion.norte@empresa-demo.es",
        "body_text": (
            "Buenas tardes:\n\nNecesitamos tramitar la incorporación de Laura Sánchez como sustituta durante "
            "la ausencia de Ana Martín.\n\nLos datos necesarios se encuentran en el documento adjunto. "
            "La fecha de alta prevista es el 06/08/2026 y la jornada debe coincidir con la persona sustituida."
        ),
        "attachments": [("Datos_sustituta_Laura_Sanchez.pdf", "application/pdf", "employee_data")],
        "expected_actions": [
            "Crear el expediente",
            "Registrar el contrato de sustitución",
            "Preparar el movimiento de alta",
        ],
        "context_actions": ["employees", "contracts", "affiliations"],
    },
    {
        "subject": "Documentación pendiente de incorporación",
        "preview": "El expediente de incorporación tiene documentación obligatoria todavía pendiente.",
        "folder": "inbox",
        "status": "open",
        "priority": "normal",
        "category": "document",
        "case_reference": "DOC-2026-001",
        "is_read": False,
        "sent_at": datetime(2026, 8, 4, 12, 4),
        "sender_name": "Administración de personal",
        "sender_address": "personal@empresa-demo.es",
        "body_text": (
            "Buenos días:\n\nAntes de cerrar la incorporación necesitamos comprobar que el expediente contiene "
            "toda la documentación obligatoria. Revisa los documentos pendientes y actualiza el expediente."
        ),
        "attachments": [],
        "expected_actions": ["Revisar expediente documental", "Actualizar estados de documentos"],
        "context_actions": ["documents"],
    },
    {
        "subject": "Solicitud de certificado de empresa",
        "preview": "La trabajadora solicita un certificado de empresa para presentarlo ante otra entidad.",
        "folder": "inbox",
        "status": "open",
        "priority": "normal",
        "category": "document",
        "case_reference": "DOC-2026-002",
        "is_read": False,
        "sent_at": datetime(2026, 8, 3, 11, 20),
        "sender_name": "Laura Sánchez Romero",
        "sender_address": "laura.sanchez@empresa-demo.es",
        "body_text": "Buenos días. Necesito un certificado de empresa actualizado. ¿Podéis prepararlo y dejarlo archivado en mi expediente?",
        "attachments": [],
        "expected_actions": ["Generar certificado", "Archivar documento"],
        "context_actions": ["documents"],
    },
    {
        "subject": "Revisión trimestral Modelo 111",
        "preview": "Necesitamos comprobar el trimestre antes de la presentación simulada del Modelo 111.",
        "folder": "inbox",
        "status": "open",
        "priority": "high",
        "category": "tax",
        "case_reference": "FIS-2026-001",
        "is_read": True,
        "sent_at": datetime(2026, 8, 2, 9, 34),
        "sender_name": "Departamento fiscal",
        "sender_address": "fiscal@empresa-demo.es",
        "body_text": "Revisa las retenciones del trimestre y prepara la presentación simulada del Modelo 111.",
        "attachments": [("Detalle_retenciones_Q2.csv", "text/csv", "tax_detail")],
        "expected_actions": ["Revisar retenciones", "Preparar Modelo 111"],
        "context_actions": ["model111"],
    },
    {
        "subject": "Caso resuelto: certificado archivado",
        "preview": "El certificado solicitado ya se encuentra archivado en el expediente.",
        "folder": "archive",
        "status": "resolved",
        "priority": "low",
        "category": "document",
        "case_reference": "DOC-2026-003",
        "is_read": True,
        "sent_at": datetime(2026, 8, 1, 15, 0),
        "sender_name": "Administración de personal",
        "sender_address": "personal@empresa-demo.es",
        "body_text": "El certificado de empresa solicitado ha sido generado y archivado correctamente.",
        "attachments": [("Certificado_empresa.pdf", "application/pdf", "certificate")],
        "expected_actions": ["Documento archivado"],
        "context_actions": ["documents"],
    },
    {
        "subject": "Regularización de diferencias de julio",
        "preview": "Se han detectado diferencias salariales que deben trasladarse a la nómina siguiente.",
        "folder": "sent",
        "status": "resolved",
        "priority": "normal",
        "category": "payroll",
        "case_reference": "NOM-2026-014",
        "is_read": True,
        "sent_at": datetime(2026, 8, 5, 11, 2),
        "sender_name": DEMO_MAILBOX_NAME,
        "sender_address": DEMO_MAILBOX_ADDRESS,
        "recipient_name": "María López · Administración",
        "recipient_address": "administracion@empresa-demo.es",
        "direction": "outgoing",
        "message_type": "reply",
        "body_text": "Se ha revisado la antigüedad y se ha generado la regularización correspondiente. La nómina queda recalculada.",
        "attachments": [],
        "expected_actions": ["Respuesta enviada"],
        "context_actions": ["regularizations"],
    },
    {
        "subject": "Respuesta pendiente: discrepancia de bases",
        "preview": "He revisado el fichero de respuesta de SILTRA y la diferencia se debe a...",
        "folder": "drafts",
        "status": "in_progress",
        "priority": "normal",
        "category": "social_security",
        "case_reference": "SS-2026-011",
        "is_read": True,
        "sent_at": datetime(2026, 8, 4, 9, 40),
        "sender_name": DEMO_MAILBOX_NAME,
        "sender_address": DEMO_MAILBOX_ADDRESS,
        "recipient_name": "Comunicaciones Seguridad Social",
        "recipient_address": "siltra@aulanomina.local",
        "direction": "outgoing",
        "message_type": "draft",
        "body_text": "He revisado el fichero de respuesta de SILTRA y la diferencia se debe a...",
        "attachments": [],
        "expected_actions": ["Completar respuesta"],
        "context_actions": ["siltra"],
    },
    {
        "subject": "Presentación del Modelo 190 aceptada",
        "preview": "La declaración anual ha sido recibida correctamente y se ha generado el justificante.",
        "folder": "archive",
        "status": "resolved",
        "priority": "low",
        "category": "tax",
        "case_reference": "FIS-2026-002",
        "is_read": True,
        "sent_at": datetime(2026, 7, 31, 10, 15),
        "sender_name": "Agencia Tributaria simulada",
        "sender_address": "notificaciones@aeat.aulanomina.local",
        "body_text": "La declaración anual ha sido recibida correctamente y se ha generado el justificante de presentación.",
        "attachments": [("Justificante_Modelo_190.pdf", "application/pdf", "tax_receipt")],
        "expected_actions": ["Presentación aceptada"],
        "context_actions": ["model190"],
    },
]


def get_mailbox(db: Session, mailbox_id: int) -> Mailbox | None:
    return db.query(Mailbox).filter(Mailbox.id == mailbox_id).first()


def _seed_demo_teaching_context(db: Session) -> None:
    seed_demo_student_groups(db)
    seed_demo_students(db)
    seed_demo_case_studies(db)
    seed_demo_case_assignments(db, reset_training_data=False)


def _resolve_case_link(db: Session, case_reference: str | None) -> tuple[int | None, int | None, int | None]:
    if not case_reference:
        return None, None, None
    case_study = db.query(CaseStudy).filter(CaseStudy.scenario_code == case_reference).first()
    if not case_study:
        return None, None, None
    assignment = (
        db.query(CaseAssignment)
        .filter(CaseAssignment.case_study_id == case_study.id)
        .order_by(CaseAssignment.id.asc())
        .first()
    )
    task = (
        db.query(CaseTask)
        .filter(CaseTask.case_study_id == case_study.id)
        .order_by(CaseTask.task_order.asc(), CaseTask.id.asc())
        .first()
    )
    return case_study.id, assignment.id if assignment else None, task.id if task else None


def _assignment_thread_status(assignment: CaseAssignment | None, fallback: str) -> str:
    if not assignment:
        return fallback
    if assignment.status in {"submitted", "reviewed", "approved"}:
        return "resolved"
    if assignment.status in {"in_progress", "needs_revision"}:
        return "in_progress"
    return "open"


def get_demo_mailbox(db: Session, seed_if_empty: bool = True) -> Mailbox:
    _seed_demo_teaching_context(db)
    mailbox = db.query(Mailbox).filter(Mailbox.address == DEMO_MAILBOX_ADDRESS).first()
    if mailbox is None:
        mailbox = Mailbox(role="student", display_name=DEMO_MAILBOX_NAME, address=DEMO_MAILBOX_ADDRESS)
        db.add(mailbox)
        db.flush()

    thread_count = db.query(func.count(EmailThread.id)).filter(EmailThread.mailbox_id == mailbox.id).scalar() or 0
    if seed_if_empty and thread_count == 0:
        _create_demo_threads(db, mailbox)
    else:
        _link_existing_demo_threads(db, mailbox)
    db.commit()
    db.refresh(mailbox)
    return mailbox


def reset_demo_mailbox(db: Session) -> Mailbox:
    mailbox = db.query(Mailbox).filter(Mailbox.address == DEMO_MAILBOX_ADDRESS).first()
    if mailbox is not None:
        db.delete(mailbox)
        db.commit()
    return get_demo_mailbox(db, seed_if_empty=True)


def _link_existing_demo_threads(db: Session, mailbox: Mailbox) -> None:
    threads = db.query(EmailThread).filter(EmailThread.mailbox_id == mailbox.id).all()
    for thread in threads:
        case_study_id, case_assignment_id, case_task_id = _resolve_case_link(db, thread.case_reference)
        if not case_study_id:
            continue
        thread.case_study_id = case_study_id
        thread.case_assignment_id = case_assignment_id
        if not thread.case_task_id:
            thread.case_task_id = case_task_id
        assignment = db.query(CaseAssignment).filter(CaseAssignment.id == case_assignment_id).first() if case_assignment_id else None
        thread.status = _assignment_thread_status(assignment, thread.status)


def _create_demo_threads(db: Session, mailbox: Mailbox) -> None:
    for row in DEMO_THREADS:
        case_study_id, case_assignment_id, case_task_id = _resolve_case_link(db, row["case_reference"])
        assignment = db.query(CaseAssignment).filter(CaseAssignment.id == case_assignment_id).first() if case_assignment_id else None
        thread = EmailThread(
            mailbox_id=mailbox.id,
            case_study_id=case_study_id,
            case_assignment_id=case_assignment_id,
            case_task_id=case_task_id,
            subject=row["subject"],
            preview=row["preview"],
            folder=row["folder"],
            status=_assignment_thread_status(assignment, row["status"]),
            priority=row["priority"],
            category=row["category"],
            case_reference=row["case_reference"],
            is_read=row["is_read"],
            expected_actions=row["expected_actions"],
            context_actions=row["context_actions"],
            created_at=row["sent_at"],
            updated_at=row["sent_at"],
        )
        db.add(thread)
        db.flush()

        message = EmailMessage(
            thread_id=thread.id,
            sender_name=row["sender_name"],
            sender_address=row["sender_address"],
            recipient_name=row.get("recipient_name", DEMO_MAILBOX_NAME),
            recipient_address=row.get("recipient_address", DEMO_MAILBOX_ADDRESS),
            body_text=row["body_text"],
            sent_at=row["sent_at"],
            read_at=row["sent_at"] if row["is_read"] else None,
            direction=row.get("direction", "incoming"),
            message_type=row.get("message_type", "initial"),
        )
        db.add(message)
        db.flush()

        for filename, content_type, document_type in row["attachments"]:
            content_text = DEMO_ATTACHMENT_CONTENT.get(document_type, f"Documento simulado: {filename}")
            db.add(
                EmailAttachment(
                    message_id=message.id,
                    filename=filename,
                    content_type=content_type,
                    storage_reference=f"demo://mail/{thread.case_reference}/{filename}",
                    document_type=document_type,
                    content_text=content_text,
                    size_bytes=len(content_text.encode("utf-8")),
                )
            )


def list_threads(
    db: Session,
    mailbox_id: int,
    folder: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> list[EmailThread]:
    query = (
        db.query(EmailThread)
        .options(selectinload(EmailThread.messages).selectinload(EmailMessage.attachments))
        .filter(EmailThread.mailbox_id == mailbox_id)
    )
    if folder:
        query = query.filter(EmailThread.folder == folder)
    if status:
        query = query.filter(EmailThread.status == status)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                EmailThread.subject.ilike(pattern),
                EmailThread.preview.ilike(pattern),
                EmailThread.case_reference.ilike(pattern),
                EmailThread.category.ilike(pattern),
            )
        )
    return query.order_by(EmailThread.updated_at.desc(), EmailThread.id.desc()).all()


def get_thread(db: Session, thread_id: int) -> EmailThread | None:
    return (
        db.query(EmailThread)
        .options(selectinload(EmailThread.messages).selectinload(EmailMessage.attachments))
        .filter(EmailThread.id == thread_id)
        .first()
    )


def create_thread(db: Session, mailbox: Mailbox, payload: EmailThreadCreate) -> EmailThread:
    now = datetime.utcnow()
    folder = "drafts" if payload.save_as_draft else "sent"
    thread = EmailThread(
        mailbox_id=mailbox.id,
        company_id=payload.company_id,
        employee_id=payload.employee_id,
        case_study_id=payload.case_study_id,
        case_assignment_id=payload.case_assignment_id,
        case_task_id=payload.case_task_id,
        related_entity_type=payload.related_entity_type,
        related_entity_id=payload.related_entity_id,
        subject=payload.subject.strip(),
        preview=payload.body_text.strip()[:220],
        folder=folder,
        status="in_progress" if payload.case_assignment_id else "open",
        priority=payload.priority,
        category=payload.category,
        case_reference=payload.case_reference,
        is_read=True,
        expected_actions=[],
        context_actions=[],
        created_at=now,
        updated_at=now,
    )
    db.add(thread)
    db.flush()

    message = EmailMessage(
        thread_id=thread.id,
        sender_name=mailbox.display_name,
        sender_address=mailbox.address,
        recipient_name=payload.recipient_name,
        recipient_address=payload.recipient_address.strip(),
        cc_address=payload.cc_address,
        body_html=payload.body_html,
        body_text=payload.body_text.strip(),
        sent_at=now,
        read_at=now,
        direction="outgoing",
        message_type="draft" if payload.save_as_draft else "initial",
    )
    db.add(message)
    db.flush()
    _create_attachments(db, message.id, payload.attachments)
    db.commit()
    return get_thread(db, thread.id)


def update_thread(db: Session, thread: EmailThread, payload: EmailThreadUpdate) -> EmailThread:
    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(thread, field, value)
    thread.updated_at = datetime.utcnow()
    db.commit()
    return get_thread(db, thread.id)


def create_message(db: Session, thread: EmailThread, payload: EmailMessageCreate) -> EmailMessage:
    now = datetime.utcnow()
    message = EmailMessage(
        thread_id=thread.id,
        sender_name=payload.sender_name,
        sender_address=payload.sender_address,
        recipient_name=payload.recipient_name,
        recipient_address=payload.recipient_address,
        cc_address=payload.cc_address,
        body_html=payload.body_html,
        body_text=payload.body_text,
        sent_at=now,
        read_at=now,
        direction=payload.direction,
        message_type=payload.message_type,
    )
    db.add(message)
    db.flush()
    _create_attachments(db, message.id, payload.attachments)
    thread.preview = (payload.body_text or "").strip()[:220]
    thread.updated_at = now
    if payload.direction == "outgoing" and thread.status == "open":
        thread.status = "in_progress"
    db.commit()
    db.refresh(message)
    return message


def create_operational_response(
    db: Session,
    thread_id: int,
    action_code: str,
    operation_status: str,
    event_id: str | None = None,
) -> EmailMessage | None:
    thread = get_thread(db, thread_id)
    template = OPERATIONAL_RESPONSE_TEMPLATES.get(action_code)
    if not thread or not template:
        return None

    normalized_status = "success" if operation_status == "success" else "error" if operation_status == "error" else "pending"
    marker = f"event:{event_id}" if event_id else None
    if marker:
        existing = (
            db.query(EmailMessage)
            .filter(
                EmailMessage.thread_id == thread.id,
                EmailMessage.direction == "system",
                EmailMessage.message_type == "automatic",
                EmailMessage.body_html == marker,
            )
            .first()
        )
        if existing:
            return existing

    now = datetime.utcnow()
    message = EmailMessage(
        thread_id=thread.id,
        sender_name=template["sender_name"],
        sender_address=template["sender_address"],
        recipient_name=thread.mailbox.display_name if thread.mailbox else DEMO_MAILBOX_NAME,
        recipient_address=thread.mailbox.address if thread.mailbox else DEMO_MAILBOX_ADDRESS,
        body_html=marker,
        body_text=template[normalized_status],
        sent_at=now,
        read_at=None,
        direction="system",
        message_type="automatic",
    )
    db.add(message)
    thread.preview = template[normalized_status]
    thread.updated_at = now
    thread.is_read = False
    if normalized_status == "success" and action_code in {"submit_affiliation", "present_model_111", "present_model_190"}:
        thread.status = "resolved"
    elif normalized_status == "error":
        thread.status = "in_progress"
    db.commit()
    db.refresh(message)
    return message


def get_attachment(db: Session, attachment_id: int) -> EmailAttachment | None:
    return db.query(EmailAttachment).filter(EmailAttachment.id == attachment_id).first()


def _create_attachments(db: Session, message_id: int, attachments) -> None:
    for attachment in attachments or []:
        content_text = attachment.content_text or ""
        db.add(
            EmailAttachment(
                message_id=message_id,
                filename=attachment.filename,
                content_type=attachment.content_type,
                storage_reference=attachment.storage_reference,
                document_type=attachment.document_type,
                content_text=content_text or None,
                size_bytes=attachment.size_bytes if attachment.size_bytes is not None else len(content_text.encode("utf-8")),
            )
        )


def _wrap_pdf_lines(lines: list[str], max_chars: int = 92) -> list[str]:
    wrapped: list[str] = []
    for raw_line in lines:
        line = str(raw_line or "")
        if not line:
            wrapped.append("")
            continue
        while len(line) > max_chars:
            split_at = line.rfind(" ", 0, max_chars + 1)
            if split_at <= 0:
                split_at = max_chars
            wrapped.append(line[:split_at].strip())
            line = line[split_at:].strip()
        wrapped.append(line)
    return wrapped


def _pdf_escape(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf_bytes(lines: list[str], title: str) -> bytes:
    wrapped = _wrap_pdf_lines([title, ""] + lines)
    commands = ["BT", "/F1 11 Tf", "48 790 Td", "14 TL"]
    for index, line in enumerate(wrapped):
        if index:
            commands.append("T*")
        commands.append(f"({_pdf_escape(line)}) Tj")
    commands.append("ET")
    stream = "\n".join(commands).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    output = BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{number} 0 obj\n".encode("ascii"))
        output.write(obj)
        output.write(b"\nendobj\n")

    xref_offset = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode("ascii")
    )
    return output.getvalue()


def _docx_bytes(lines: list[str], title: str) -> bytes:
    paragraphs = [title, ""] + lines
    document_xml = "".join(
        f"<w:p><w:r><w:t xml:space=\"preserve\">{escape(str(line))}</w:t></w:r></w:p>"
        for line in paragraphs
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{document_xml}<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/></w:sectPr></w:body>"
        "</w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def render_attachment_bytes(attachment: EmailAttachment) -> bytes:
    text = attachment.content_text or f"Documento simulado: {attachment.filename}"
    lines = text.splitlines() or [text]
    suffix = Path(attachment.filename or "").suffix.lower()
    content_type = (attachment.content_type or "").lower()
    if suffix == ".pdf" or content_type == "application/pdf":
        return _pdf_bytes(lines, attachment.filename)
    if suffix == ".docx" or "wordprocessingml" in content_type:
        return _docx_bytes(lines, attachment.filename)
    return text.encode("utf-8")
