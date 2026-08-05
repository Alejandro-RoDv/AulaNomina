from datetime import datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.mail import EmailAttachment, EmailMessage, EmailThread, Mailbox
from app.schemas.mail import EmailMessageCreate, EmailThreadUpdate


DEMO_MAILBOX_ADDRESS = "usuario.demo@aulanomina.local"
DEMO_MAILBOX_NAME = "Usuario demo"


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
        "attachments": [
            ("Solicitud_Ana_Martin.pdf", "application/pdf", "employee_request"),
        ],
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
        "attachments": [
            ("Datos_sustituta_Laura_Sanchez.pdf", "application/pdf", "employee_data"),
        ],
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
        "attachments": [
            ("Detalle_retenciones_Q2.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "tax_detail"),
        ],
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
        "attachments": [
            ("Certificado_empresa.pdf", "application/pdf", "certificate"),
        ],
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
        "body_text": (
            "La declaración anual ha sido recibida correctamente y se ha generado el justificante de presentación."
        ),
        "attachments": [
            ("Justificante_Modelo_190.pdf", "application/pdf", "tax_receipt"),
        ],
        "expected_actions": ["Presentación aceptada"],
        "context_actions": ["model190"],
    },
]


def get_mailbox(db: Session, mailbox_id: int) -> Mailbox | None:
    return db.query(Mailbox).filter(Mailbox.id == mailbox_id).first()


def get_demo_mailbox(db: Session, seed_if_empty: bool = True) -> Mailbox:
    mailbox = db.query(Mailbox).filter(Mailbox.address == DEMO_MAILBOX_ADDRESS).first()
    if mailbox is None:
        mailbox = Mailbox(
            role="teacher",
            display_name=DEMO_MAILBOX_NAME,
            address=DEMO_MAILBOX_ADDRESS,
        )
        db.add(mailbox)
        db.flush()

    thread_count = db.query(func.count(EmailThread.id)).filter(EmailThread.mailbox_id == mailbox.id).scalar() or 0
    if seed_if_empty and thread_count == 0:
        _create_demo_threads(db, mailbox)

    db.commit()
    db.refresh(mailbox)
    return mailbox


def reset_demo_mailbox(db: Session) -> Mailbox:
    mailbox = db.query(Mailbox).filter(Mailbox.address == DEMO_MAILBOX_ADDRESS).first()
    if mailbox is not None:
        db.delete(mailbox)
        db.commit()
    return get_demo_mailbox(db, seed_if_empty=True)


def _create_demo_threads(db: Session, mailbox: Mailbox) -> None:
    for row in DEMO_THREADS:
        thread = EmailThread(
            mailbox_id=mailbox.id,
            subject=row["subject"],
            preview=row["preview"],
            folder=row["folder"],
            status=row["status"],
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
            db.add(
                EmailAttachment(
                    message_id=message.id,
                    filename=filename,
                    content_type=content_type,
                    storage_reference=f"demo://mail/{thread.case_reference}/{filename}",
                    document_type=document_type,
                    size_bytes=0,
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


def create_thread_message(db: Session, thread: EmailThread, payload: EmailMessageCreate) -> EmailThread:
    message = EmailMessage(
        thread_id=thread.id,
        sender_name=payload.sender_name,
        sender_address=payload.sender_address,
        recipient_name=payload.recipient_name,
        recipient_address=payload.recipient_address,
        body_html=payload.body_html,
        body_text=payload.body_text,
        direction=payload.direction,
        message_type=payload.message_type,
    )
    db.add(message)
    db.flush()

    for attachment in payload.attachments:
        db.add(EmailAttachment(message_id=message.id, **attachment.model_dump()))

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
