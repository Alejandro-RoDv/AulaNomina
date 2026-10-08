"""Comunicaciones formativas ligadas a actividades del curso 2026."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
import json

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy
from app.models.mail import EmailAttachment, EmailMessage, EmailThread, Mailbox
from app.training.foundation_runtime_cases_2026 import (
    FOUNDATION_CENTER_ADDRESS,
    FOUNDATION_CENTER_EMAIL,
    FOUNDATION_CENTER_EXPECTED_CCC,
    FOUNDATION_CENTER_NAME,
    FOUNDATION_CENTER_PHONE,
    FOUNDATION_COMPANY_ADDRESS,
    FOUNDATION_COMPANY_CCC,
    FOUNDATION_COMPANY_CIF,
    FOUNDATION_COMPANY_CNAE,
    FOUNDATION_COMPANY_CONTACT,
    FOUNDATION_COMPANY_EMAIL,
    FOUNDATION_COMPANY_NAME,
    FOUNDATION_COMPANY_PHONE,
)


MAIL_CODES = {
    "A04", "A08", "A10", "A11", "A12", "A13", "A14", "A15", "A17", "A21", "A22",
    "A23", "A24", "A25", "A26", "A27", "A29", "A30", "A31", "A32", "A33", "A34", "A35",
    "A36", "A38", "A39", "A40", "A41", "A42", "A43", "A44", "A45",
    "A46", "A47", "A48", "A49", "A50", "A51", "A52", "A53", "A54",
}
ATTACHMENT_CODES = {"A23", "A24", "A25", "A29", "A31", "A36", "A38", "A39", "A46", "A49", "A51", "A52"}


def _task_code(task) -> str | None:
    value = (task.trigger_condition or {}).get("training_code")
    return str(value).strip().upper() if value else None


def _code(case: CaseStudy) -> str | None:
    sequence = (case.initial_state or {}).get("training_sequence") or []
    if sequence:
        return str(sequence[0]).upper()
    for task in sorted(case.tasks or [], key=lambda item: (item.task_order, item.id)):
        value = _task_code(task)
        if value:
            return value
    return None


def _thread_code(thread: EmailThread) -> str | None:
    prefix = str(thread.subject or "").split("·", 1)[0].strip().upper()
    return prefix if prefix in MAIL_CODES else None


def _sender(code: str) -> tuple[str, str, str]:
    number = int(code[1:])
    if number <= 13:
        return "Dirección de personas", "personas@aulanomina.demo", "contract"
    if number <= 22:
        return "Administración de nóminas", "nominas@aulanomina.demo", "payroll"
    if number <= 27:
        return "Administración de personal", "personal@aulanomina.demo", "absence"
    if number <= 35:
        return "Seguridad Social", "seguridadsocial@aulanomina.demo", "social_security"
    if number <= 41:
        return "Departamento fiscal", "fiscal@aulanomina.demo", "tax"
    if number <= 45:
        return "Administración de nóminas", "nominas@aulanomina.demo", "payroll"
    if number <= 50:
        return "Dirección laboral", "direccion.laboral@aulanomina.demo", "contract"
    return "Administración de personal", "personal@aulanomina.demo", "document"


def _tasks_for_code(case: CaseStudy, code: str):
    tasks = sorted(case.tasks or [], key=lambda item: (item.task_order, item.id))
    matching = [task for task in tasks if _task_code(task) == code]
    return matching or tasks


def _mail_facts(case: CaseStudy, code: str) -> list[str]:
    state = case.initial_state or {}
    if code != "A04":
        rows = [("Persona trabajadora", state.get("employee")), ("Persona sustituta", state.get("substitute")),
                ("Persona sustituida", state.get("replaced_employee")), ("Empresa", state.get("company_name")),
                ("Centro de trabajo", state.get("center_name")), ("Periodo", state.get("payroll_period"))]
        for task in _tasks_for_code(case, code):
            for fact in (task.trigger_condition or {}).get("case_facts") or []:
                if isinstance(fact, dict):
                    rows.append((fact.get("label"), fact.get("value")))
        facts = []
        for label, value in rows:
            if label and value is not None and value != "" and not isinstance(value, (dict, list)):
                row = f"- {label}: {value}"
                if row not in facts:
                    facts.append(row)
        return facts

    employee = state.get("employee_data") or {}
    rows = [
        ("Nombre", employee.get("first_name")),
        ("Primer apellido", employee.get("last_name")),
        ("Segundo apellido", employee.get("second_last_name")),
        ("DNI/NIE", employee.get("dni")),
        ("NAF", employee.get("naf")),
        ("Fecha de nacimiento", employee.get("birth_date")),
        ("Nacionalidad", employee.get("nationality")),
        ("Email", employee.get("email")),
        ("Teléfono móvil", employee.get("mobile_phone")),
        ("Domicilio", employee.get("domicile")),
        ("Localidad", employee.get("city")),
        ("Provincia", employee.get("province")),
        ("Código postal", employee.get("postal_code")),
    ]
    return [f"- {label}: {value}" for label, value in rows if value not in {None, ""}]


def _body(case: CaseStudy, code: str) -> str:
    tasks = _tasks_for_code(case, code)
    lines = [f"- {task.description or task.title}" for task in tasks]
    facts = _mail_facts(case, code)

    if code == "A04":
        return (
            "Buenos días:\n\n"
            "Tenemos una nueva incorporación. Antes de preparar su contrato necesitamos crear su expediente en AulaNomina.\n\n"
            "Datos de la persona trabajadora:\n"
            + "\n".join(facts)
            + "\n\nDa de alta el trabajador con estos datos y deja el expediente preparado para continuar con la contratación."
        )

    return (
        f"Buenos días:\n\nNecesitamos que gestiones el siguiente asunto en AulaNomina: {case.title}.\n\n"
        f"{case.description or ''}\n\n"
        + (("Datos de referencia:\n" + "\n".join(facts) + "\n\n") if facts else "")
        + "Qué tienes que hacer:\n"
        + "\n".join(lines)
        + "\n\nRealiza la gestión en AulaNomina y revisa el resultado antes de darla por terminada."
    )


def _canonical_cases(db: Session) -> dict[str, CaseStudy]:
    grouped: dict[str, list[CaseStudy]] = defaultdict(list)
    for case in db.query(CaseStudy).filter(CaseStudy.status == "active").order_by(CaseStudy.id.asc()).all():
        code = _code(case)
        if code in MAIL_CODES:
            grouped[code].append(case)

    result = {}
    for code, cases in grouped.items():
        cases.sort(
            key=lambda case: (
                0 if str(case.scenario_code or "").upper().startswith("TRAIN-2026-") else 1,
                case.id,
            )
        )
        result[code] = cases[0]
    return result


def _thread_rank(thread: EmailThread) -> tuple[int, int, int]:
    has_student_content = any(
        message.direction == "outgoing" and message.message_type in {"reply", "draft", "initial"}
        for message in thread.messages or []
    )
    return (
        0 if has_student_content else 1,
        0 if thread.folder == "inbox" else 1,
        thread.id,
    )


def _suppress_duplicate_threads(db: Session, mailbox: Mailbox) -> dict[str, EmailThread]:
    grouped: dict[str, list[EmailThread]] = defaultdict(list)
    threads = (
        db.query(EmailThread)
        .filter(EmailThread.mailbox_id == mailbox.id)
        .order_by(EmailThread.id.asc())
        .all()
    )
    for thread in threads:
        code = _thread_code(thread)
        if code:
            grouped[code].append(thread)

    canonical: dict[str, EmailThread] = {}
    for code, candidates in grouped.items():
        candidates.sort(key=_thread_rank)
        keep = candidates[0]
        canonical[code] = keep
        for duplicate in candidates[1:]:
            duplicate.folder = "training_locked"
            duplicate.is_read = True
            duplicate.status = "resolved"
            duplicate.related_entity_type = "training_duplicate"
            duplicate.case_study_id = None
            duplicate.case_assignment_id = None
            duplicate.case_task_id = None
    db.flush()
    return canonical


def _ensure_initial_message(
    db: Session,
    thread: EmailThread,
    case: CaseStudy,
    code: str,
    sender_name: str,
    sender_address: str,
    sent_at: datetime,
) -> EmailMessage:
    initial = next(
        (
            message
            for message in sorted(thread.messages or [], key=lambda item: (item.sent_at, item.id))
            if message.direction == "incoming" and message.message_type == "initial"
        ),
        None,
    )
    if initial is None:
        initial = EmailMessage(
            thread_id=thread.id,
            sender_name=sender_name,
            sender_address=sender_address,
            recipient_name=thread.mailbox.display_name,
            recipient_address=thread.mailbox.address,
            body_text=_body(case, code),
            sent_at=sent_at,
            read_at=None,
            direction="incoming",
            message_type="initial",
        )
        db.add(initial)
        db.flush()
    else:
        initial.sender_name = sender_name
        initial.sender_address = sender_address
        initial.body_text = _body(case, code)
    return initial


def _ensure_training_attachment(db: Session, code: str, case: CaseStudy, message: EmailMessage) -> None:
    if code not in ATTACHMENT_CODES:
        return
    filename = f"Datos_caso_{code}.txt"
    if any(attachment.filename == filename for attachment in message.attachments or []):
        return
    state = dict(case.initial_state or {})
    state.pop("training_sequence", None)
    content = "DATOS RECIBIDOS PARA EL CASO\n\n" + json.dumps(state, ensure_ascii=False, indent=2, default=str)
    db.add(
        EmailAttachment(
            message_id=message.id,
            filename=filename,
            content_type="text/plain",
            storage_reference=f"demo://training-mail/{code}",
            document_type="training_case_data",
            content_text=content,
            size_bytes=len(content.encode("utf-8")),
        )
    )


def ensure_activity_mail_2026(db: Session, mailbox: Mailbox) -> list[int]:
    canonical_threads = _suppress_duplicate_threads(db, mailbox)
    thread_ids = []

    for code, case in sorted(_canonical_cases(db).items()):
        assignment = (
            db.query(CaseAssignment)
            .filter(CaseAssignment.case_study_id == case.id)
            .order_by(CaseAssignment.id.asc())
            .first()
        )
        if not assignment:
            continue

        tasks = _tasks_for_code(case, code)
        first_task = tasks[0] if tasks else None
        sender_name, sender_address, category = _sender(code)
        sent_at = datetime(2026, 9, 1, 8, 0)
        thread = canonical_threads.get(code)

        if thread is None:
            thread = EmailThread(
                mailbox_id=mailbox.id,
                company_id=case.company_id,
                case_study_id=case.id,
                case_assignment_id=assignment.id,
                case_task_id=first_task.id if first_task else None,
                related_entity_type="case_study",
                related_entity_id=case.id,
                subject=f"{code} · {case.title}",
                preview=str(case.description or case.title)[:220],
                folder="training_locked",
                status="open",
                priority="normal",
                category=category,
                case_reference=case.scenario_code,
                is_read=False,
                expected_actions=[task.title for task in tasks],
                context_actions=[str(task.module or "") for task in tasks if task.module],
                created_at=sent_at,
                updated_at=sent_at,
            )
            db.add(thread)
            db.flush()
            canonical_threads[code] = thread
        else:
            thread.company_id = case.company_id
            thread.case_study_id = case.id
            thread.case_assignment_id = assignment.id
            thread.case_task_id = first_task.id if first_task else None
            thread.related_entity_type = "case_study"
            thread.related_entity_id = case.id
            thread.subject = f"{code} · {case.title}"
            thread.preview = str(case.description or case.title)[:220]
            thread.category = category
            thread.case_reference = case.scenario_code
            thread.expected_actions = [task.title for task in tasks]
            thread.context_actions = [str(task.module or "") for task in tasks if task.module]
            if thread.status == "resolved" and not any(message.direction == "outgoing" for message in thread.messages or []):
                thread.status = "open"

        initial = _ensure_initial_message(db, thread, case, code, sender_name, sender_address, sent_at)
        _ensure_training_attachment(db, code, case, initial)
        thread_ids.append(thread.id)

    db.commit()
    return thread_ids


def _a02_mail_documents() -> list[tuple[str, str]]:
    """Fichas ficticias legibles, en lugar de un volcado JSON técnico."""
    empresa = (
        "AULANÓMINA · DOCUMENTACIÓN SIMULADA\n"
        "FICHA DE IDENTIFICACIÓN EMPRESARIAL\n\n"
        f"Razón social: {FOUNDATION_COMPANY_NAME}\n"
        f"NIF de empresa: {FOUNDATION_COMPANY_CIF}\n"
        "Naturaleza: entidad privada, sociedad limitada\n"
        "Estado administrativo: alta\n"
        "Inicio de actividad de referencia: 01/01/2026\n"
        f"CCC de la empresa: {FOUNDATION_COMPANY_CCC}\n"
        f"Domicilio social: {FOUNDATION_COMPANY_ADDRESS}\n"
        "Localidad: Córdoba\n"
        "Provincia: Córdoba\n"
        f"Teléfono: {FOUNDATION_COMPANY_PHONE}\n"
        f"Correo electrónico: {FOUNDATION_COMPANY_EMAIL}\n"
        f"Persona de contacto: {FOUNDATION_COMPANY_CONTACT}\n"
        f"CNAE 2009: {FOUNDATION_COMPANY_CNAE} - Servicios administrativos combinados\n\n"
        "Los datos de pólizas, seguros, IBAN y régimen fiscal no forman parte "
        "de este encargo y no deben inventarse.\n"
    )
    centro = (
        "AULANÓMINA · DOCUMENTACIÓN SIMULADA\n"
        "FICHA DE CENTRO DE TRABAJO\n\n"
        f"Empresa titular: {FOUNDATION_COMPANY_NAME}\n"
        f"Centro: {FOUNDATION_CENTER_NAME}\n"
        f"CCC de la empresa titular: {FOUNDATION_COMPANY_CCC}\n"
        f"CCC propio del centro (debe quedar registrado): {FOUNDATION_CENTER_EXPECTED_CCC}\n"
        f"Domicilio del centro: {FOUNDATION_CENTER_ADDRESS}\n"
        "Localidad: Córdoba\n"
        "Provincia: Córdoba\n"
        f"Teléfono del centro: {FOUNDATION_CENTER_PHONE}\n"
        f"Correo del centro: {FOUNDATION_CENTER_EMAIL}\n\n"
        "El CCC de empresa se sincroniza desde la ficha de la empresa. "
        "El CCC propio del centro es distinto y se configura en la ficha del centro.\n"
    )
    return [
        ("Ficha_identificacion_empresa_A02.txt", empresa),
        ("Ficha_centro_trabajo_A02.txt", centro),
    ]


def _a02_mail_body() -> str:
    return (
        "Buenos días:\n\n"
        "Necesitamos dejar preparada la empresa Aula Gestión Sur, S.L. y su centro "
        "de trabajo de Córdoba antes de tramitar incorporaciones. "
        "Te adjunto la ficha de identificación empresarial y la ficha del centro "
        "(documentación ficticia para esta práctica).\n\n"
        "DATOS ESENCIALES DE LA EMPRESA\n\n"
        f"Razón social: {FOUNDATION_COMPANY_NAME}\n\n"
        f"NIF: {FOUNDATION_COMPANY_CIF}\n\n"
        f"CCC de la empresa: {FOUNDATION_COMPANY_CCC}\n\n"
        f"Domicilio social: {FOUNDATION_COMPANY_ADDRESS}, Córdoba (Córdoba)\n\n"
        f"Teléfono: {FOUNDATION_COMPANY_PHONE} · Correo: {FOUNDATION_COMPANY_EMAIL}\n\n"
        "DATOS DEL CENTRO DE TRABAJO\n\n"
        f"Nombre: {FOUNDATION_CENTER_NAME}\n\n"
        f"CCC propio del centro que debe figurar: {FOUNDATION_CENTER_EXPECTED_CCC}\n\n"
        f"Domicilio: {FOUNDATION_CENTER_ADDRESS}, Córdoba (Córdoba)\n\n"
        "INSTRUCCIONES\n\n"
        "1. En Organización > Empresas, localiza la empresa. Si no existe, "
        "créala usando la documentación adjunta; si ya existe, revisa los datos, "
        "sin crear duplicados.\n\n"
        "2. En Centros, localiza o da de alta el centro y vincúlalo a la empresa. "
        "Configura su CCC propio conforme a la ficha adjunta. "
        "No cambies el CCC de la empresa: son dos números diferentes.\n\n"
        "3. Rellena los datos identificativos, domicilio y contacto relevantes. "
        "No inventes pólizas, IBAN ni otros campos de los que no se ha facilitado información.\n\n"
        "4. Vuelve al curso y comprueba la actividad.\n\n"
        "Gracias,\nDepartamento de Administración\nAula Gestión Sur, S.L."
    )


def deliver_a02_mail_on_open(db: Session, mailbox: Mailbox, assignment_id: int) -> EmailThread:
    """Entrega idempotente del encargo al abrir A02 por primera vez.

    El bloqueo de la asignación evita dos envíos al pulsar varias veces. No se
    reabre un correo archivado ni se pierden lecturas o respuestas anteriores.
    """
    assignment = (
        db.query(CaseAssignment)
        .filter(CaseAssignment.id == assignment_id)
        .with_for_update()
        .first()
    )
    if assignment is None or assignment.case_study is None:
        raise ValueError("Asignación formativa no encontrada")
    case = assignment.case_study
    if str(case.scenario_code or "").upper() != "TRAIN-2026-FOUND-A02":
        raise ValueError("Esta asignación no corresponde a la actividad A02")

    thread = (
        db.query(EmailThread)
        .filter(
            EmailThread.mailbox_id == mailbox.id,
            EmailThread.case_assignment_id == assignment.id,
            EmailThread.case_reference == case.scenario_code,
            EmailThread.related_entity_type != "training_duplicate",
        )
        .order_by(EmailThread.id.asc())
        .first()
    )
    if thread is not None:
        if thread.folder == "training_locked":
            thread.folder = "inbox"
            thread.updated_at = datetime.utcnow()
            db.commit()
        return thread

    sent_at = datetime.utcnow()
    task = _tasks_for_code(case, "A02")[0]
    thread = EmailThread(
        mailbox_id=mailbox.id,
        company_id=case.company_id,
        case_study_id=case.id,
        case_assignment_id=assignment.id,
        case_task_id=task.id,
        related_entity_type="case_study",
        related_entity_id=case.id,
        subject="A02 · Documentación para el alta de empresa y centro",
        preview="Encargo de Administración: fichas de empresa y centro de trabajo para preparar el ERP.",
        folder="inbox",
        status="open",
        priority="normal",
        category="contract",
        case_reference=case.scenario_code,
        is_read=False,
        expected_actions=["Revisar o crear empresa", "Revisar o crear centro", "Verificar CCC propio del centro"],
        context_actions=["companies", "work-centers"],
        created_at=sent_at,
        updated_at=sent_at,
    )
    db.add(thread)
    db.flush()
    message = EmailMessage(
        thread_id=thread.id,
        sender_name="Departamento de Administración",
        sender_address="administracion@aulagestionsur.demo",
        recipient_name=mailbox.display_name,
        recipient_address=mailbox.address,
        body_text=_a02_mail_body(),
        sent_at=sent_at,
        direction="incoming",
        message_type="initial",
    )
    db.add(message)
    db.flush()
    for filename, content in _a02_mail_documents():
        db.add(EmailAttachment(
            message_id=message.id,
            filename=filename,
            content_type="text/plain",
            storage_reference=f"demo://training-mail/A02/{filename}",
            document_type="training_case_data",
            content_text=content,
            size_bytes=len(content.encode("utf-8")),
        ))
    db.commit()
    return thread


def attach_activity_mail_context(db: Session, course: dict) -> dict:
    """Liga los hilos al curso sin sustituir la explicación pedagógica."""
    activities = [item for topic in course.get("topics", []) for item in topic.get("activities", [])]
    assignment_ids = {item.get("assignment_id") for item in activities if item.get("assignment_id")}
    scenario_codes = {str(item.get("scenario_code") or "") for item in activities if item.get("scenario_code")}

    threads = (
        db.query(EmailThread)
        .filter(EmailThread.folder != "trash")
        .order_by(EmailThread.id.asc())
        .all()
    )
    by_assignment: dict[int, list[EmailThread]] = defaultdict(list)
    by_reference: dict[str, list[EmailThread]] = defaultdict(list)
    by_code: dict[str, list[EmailThread]] = defaultdict(list)
    for thread in threads:
        if thread.related_entity_type == "training_duplicate":
            continue
        if thread.case_assignment_id in assignment_ids:
            by_assignment[thread.case_assignment_id].append(thread)
        if thread.case_reference in scenario_codes:
            by_reference[str(thread.case_reference)].append(thread)
        code = _thread_code(thread)
        if code:
            by_code[code].append(thread)

    for activity in activities:
        training_code = str(activity.get("training_code") or "").upper()
        scenario_code = str(activity.get("scenario_code") or "")
        candidates = by_assignment.get(activity.get("assignment_id"), [])
        if not candidates:
            candidates = by_reference.get(scenario_code, [])
        if not candidates and training_code:
            candidates = by_code.get(training_code, [])
        if not candidates:
            continue

        task_id = activity.get("task_id")
        direct = [thread for thread in candidates if thread.case_task_id == task_id]
        thread = (direct or candidates)[0]
        messages = sorted(thread.messages or [], key=lambda item: (item.sent_at, item.id))
        incoming = next((item for item in messages if item.direction == "incoming"), messages[0] if messages else None)
        attachments = [attachment for message in messages for attachment in (message.attachments or [])]
        action = str((activity.get("context") or {}).get("actionCode") or "")
        role = "reply" if action == "reply_mail" else "attachment" if attachments else "consult"

        activity["requires_mail"] = True
        activity["related_mail_thread_ids"] = [thread.id]
        activity["mail_context"] = {
            "thread_id": thread.id,
            "role": role,
            "subject": thread.subject,
            "sender": incoming.sender_name if incoming else "Correo relacionado",
            "has_attachments": bool(attachments),
            "attachment_count": len(attachments),
            "locked": thread.folder == "training_locked",
        }
        activity["case_data"] = []
    return course
