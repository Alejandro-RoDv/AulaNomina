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
        "subject": "Diferencia detectada en el Modelo 111 del segundo trimestre",
        "preview": "La suma de las retenciones de profesionales no coincide con el importe declarado.",
        "folder": "inbox",
        "status": "waiting",
        "priority": "high",
        "category": "tax",
        "case_reference": "FIS-2026-006",
        "is_read": True,
        "sent_at": datetime(2026, 8, 3, 11, 3),
        "sender_name": "Departamento fiscal",
        "sender_address": "fiscal@empresa-demo.es",
        "body_text": (
            "La suma de las retenciones de profesionales no coincide con el importe declarado en el Modelo 111 "
            "del segundo trimestre.\n\nRevisa las facturas registradas, identifica la diferencia y prepara una "
            "declaración complementaria cuando proceda."
        ),
        "attachments": [("Detalle_retenciones_Q2.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "tax_detail")],
        "expected_actions": [
            "Conciliar facturas profesionales",
            "Recalcular el Modelo 111",
            "Documentar la corrección",
        ],
        "context_actions": ["model111"],
    },
    {
        "subject": "Certificado de empresa incorporado al expediente",
        "preview": "El certificado solicitado ha sido generado y está disponible en el gestor documental.",
        "folder": "inbox",
        "status": "resolved",
        "priority": "low",
        "category": "document",
        "case_reference": "DOC-2026-003",
        "is_read": True,
        "sent_at": datetime(2026, 8, 1, 13, 20),
        "sender_name": "Archivo laboral",
        "sender_address": "documentos@empresa-demo.es",
        "body_text": (
            "El certificado solicitado ha sido generado y está disponible en el gestor documental.\n\n"
            "No quedan acciones pendientes. El caso puede mantenerse archivado como evidencia del ejercicio."
        ),
        "attachments": [("Certificado_empresa.pdf", "application/pdf", "certificate")],
        "expected_actions": ["Documento generado", "Expediente actualizado"],
        "context_actions": ["documents"],
    },
    {
        "subject": "Regularización de antigüedad completada",
        "preview": "Se ha revisado el expediente y recalculado la nómina con el complemento correspondiente.",
        "folder": "sent",
        "status": "resolved",
        "priority": "normal",
        "category": "payroll",
        "case_reference": "NOM-2026-009",
        "is_read": True,
        "sent_at": datetime(2026, 8, 4, 12, 6),
        "sender_name": DEMO_MAILBOX_NAME,
        "sender_address": DEMO_MAILBOX_ADDRESS,
        "recipient_name": "Administración",
        "recipient_address": "administracion@empresa-demo.es",
        "direction": "outgoing",
        "message_type": "reply",
        "body_text": (
            "Se ha revisado el expediente y recalculado la nómina con el complemento correspondiente. "
            "Se conserva la trazabilidad de la regularización en el módulo de nómina."
        ),
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
    seed_demo_case_assignments(db)


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
    if "is_read" in values:
        read_at = datetime.utcnow() if values["is_read"] else None
        for message in thread.messages:
            if message.direction == "incoming":
                message.read_at = read_at
    thread.updated_at = datetime.utcnow()
    db.commit()
    return get_thread(db, thread.id)


def _create_attachments(db: Session, message_id: int, attachments) -> None:
    for attachment in attachments:
        values = attachment.model_dump()
        if not values.get("size_bytes") and values.get("content_text"):
            values["size_bytes"] = len(values["content_text"].encode("utf-8"))
        db.add(EmailAttachment(message_id=message_id, **values))


def create_thread_message(db: Session, thread: EmailThread, payload: EmailMessageCreate) -> EmailThread:
    message = EmailMessage(
        thread_id=thread.id,
        sender_name=payload.sender_name,
        sender_address=payload.sender_address,
        recipient_name=payload.recipient_name,
        recipient_address=payload.recipient_address,
        cc_address=payload.cc_address,
        body_html=payload.body_html,
        body_text=payload.body_text,
        direction=payload.direction,
        message_type=payload.message_type,
    )
    db.add(message)
    db.flush()
    _create_attachments(db, message.id, payload.attachments)

    thread.preview = payload.body_text[:220]
    thread.updated_at = datetime.utcnow()
    thread.is_read = True
    if payload.message_type == "draft":
        thread.folder = "drafts"
        thread.status = "in_progress"
    elif payload.direction == "outgoing":
        if thread.folder in {"drafts", "trash"}:
            thread.folder = "sent"
        thread.status = "in_progress" if thread.status != "resolved" else "resolved"
    db.commit()
    return get_thread(db, thread.id)


def get_attachment(db: Session, attachment_id: int) -> EmailAttachment | None:
    return db.query(EmailAttachment).filter(EmailAttachment.id == attachment_id).first()


def attachment_preview(attachment: EmailAttachment) -> dict:
    content_text = attachment.content_text or DEMO_ATTACHMENT_CONTENT.get(
        attachment.document_type,
        f"Documento simulado: {attachment.filename}",
    )
    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "document_type": attachment.document_type,
        "content_text": content_text,
        "linked_document_id": attachment.linked_document_id,
        "preview_supported": True,
    }


def _pdf_bytes(text: str) -> bytes:
    lines = [line[:110] for line in text.splitlines() if line.strip()][:45] or ["Documento simulado"]
    commands = ["BT", "/F1 10 Tf", "48 790 Td"]
    for index, line in enumerate(lines):
        if index:
            commands.append("0 -15 Td")
        safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        commands.append(f"({safe}) Tj")
    commands.append("ET")
    stream = "\n".join(commands).encode("latin-1", errors="replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode())
        output.extend(obj)
        output.extend(b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    )
    return bytes(output)


def _xlsx_bytes(text: str) -> bytes:
    rows = []
    for line in text.splitlines():
        separator = ";" if ";" in line else ","
        rows.append([cell.strip() for cell in line.split(separator)])
    if not rows:
        rows = [["Documento simulado"]]
    sheet_rows = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for column_index, value in enumerate(row, start=1):
            column = chr(64 + min(column_index, 26))
            cells.append(f'<c r="{column}{row_index}" t="inlineStr"><is><t>{escape(value)}</t></is></c>')
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData></worksheet>'
    )
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '</Types>',
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>',
        )
        archive.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '</Relationships>',
        )
        archive.writestr("xl/worksheets/sheet1.xml", sheet)
    return buffer.getvalue()


def attachment_download(attachment: EmailAttachment) -> tuple[bytes, str]:
    text = attachment_preview(attachment)["content_text"]
    extension = Path(attachment.filename).suffix.lower()
    if extension == ".pdf" or attachment.content_type == "application/pdf":
        return _pdf_bytes(text), "application/pdf"
    if extension == ".xlsx":
        return _xlsx_bytes(text), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if extension == ".xml":
        return f"<aulanomina-document><content>{escape(text)}</content></aulanomina-document>".encode(), "application/xml"
    if extension == ".csv":
        return text.encode("utf-8"), "text/csv; charset=utf-8"
    return text.encode("utf-8"), attachment.content_type or "text/plain; charset=utf-8"


def create_operational_response(
    db: Session,
    assignment_id: int,
    *,
    action_code: str | None,
    operation_status: str,
    event_id: str | None,
    validation: dict | None,
) -> int | None:
    template = OPERATIONAL_RESPONSE_TEMPLATES.get(action_code or "")
    if not template:
        return None
    assignment = db.query(CaseAssignment).filter(CaseAssignment.id == assignment_id).first()
    if not assignment or not assignment.email_threads:
        return None
    thread = assignment.email_threads[0]
    marker = f"operational-event:{event_id}" if event_id else None
    if marker:
        existing = (
            db.query(EmailMessage)
            .filter(EmailMessage.thread_id == thread.id, EmailMessage.body_html == marker)
            .first()
        )
        if existing:
            return existing.id

    if operation_status == "error":
        outcome = "error"
    elif validation and validation.get("passed"):
        outcome = "success"
    else:
        outcome = "pending"
    body = template[outcome]
    now = datetime.utcnow()
    message = EmailMessage(
        thread_id=thread.id,
        sender_name=template["sender_name"],
        sender_address=template["sender_address"],
        recipient_name=thread.mailbox.display_name if thread.mailbox else DEMO_MAILBOX_NAME,
        recipient_address=thread.mailbox.address if thread.mailbox else DEMO_MAILBOX_ADDRESS,
        body_html=marker,
        body_text=body,
        sent_at=now,
        direction="incoming",
        message_type="automatic",
    )
    db.add(message)
    db.flush()
    thread.preview = body[:220]
    thread.is_read = False
    thread.updated_at = now
    db.commit()
    return message.id


def mailbox_stats(db: Session, mailbox_id: int) -> dict[str, int]:
    threads = db.query(EmailThread).filter(EmailThread.mailbox_id == mailbox_id).all()
    result = {
        "total": len(threads),
        "unread": sum(1 for item in threads if not item.is_read),
        "inbox": 0,
        "sent": 0,
        "drafts": 0,
        "archive": 0,
        "trash": 0,
        "pending": 0,
        "in_progress": 0,
        "waiting": 0,
        "resolved": 0,
    }
    for thread in threads:
        if thread.folder in result:
            result[thread.folder] += 1
        if thread.status == "open":
            result["pending"] += 1
        elif thread.status in result:
            result[thread.status] += 1
    return result
