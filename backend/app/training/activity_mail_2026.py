"""Comunicaciones formativas ligadas a actividades del curso 2026."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
import json

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy
from app.models.mail import EmailAttachment, EmailMessage, EmailThread, Mailbox


MAIL_CODES = {
    "A08", "A10", "A11", "A12", "A13", "A14", "A15", "A17", "A21", "A22",
    "A23", "A24", "A25", "A26", "A27", "A29", "A30", "A31", "A32", "A33", "A34", "A35",
    "A36", "A38", "A39", "A40", "A41", "A42", "A43", "A44", "A45",
    "A46", "A47", "A48", "A49", "A50", "A51", "A52", "A53", "A54",
}
ATTACHMENT_CODES = {"A23", "A24", "A25", "A29", "A31", "A36", "A38", "A39", "A46", "A49", "A51", "A52"}


def _code(case: CaseStudy) -> str | None:
    sequence = (case.initial_state or {}).get("training_sequence") or []
    if sequence:
        return str(sequence[0]).upper()
    for task in sorted(case.tasks or [], key=lambda item: (item.task_order, item.id)):
        value = (task.trigger_condition or {}).get("training_code")
        if value:
            return str(value).upper()
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


def _body(case: CaseStudy) -> str:
    lines = [
        f"- {task.description or task.title}"
        for task in sorted(case.tasks or [], key=lambda item: (item.task_order, item.id))
    ]
    return (
        f"Buenos días:\n\nNecesitamos que gestiones el siguiente asunto en AulaNomina: {case.title}.\n\n"
        f"{case.description or ''}\n\nIndicaciones del encargo:\n"
        + "\n".join(lines)
        + "\n\nRevisa la información recibida y realiza las operaciones necesarias en el ERP antes de cerrar el caso."
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
    """Conserva un único hilo generado por práctica y oculta copias históricas.

    Split 43 puede convivir con CaseStudy duplicados procedentes de migraciones
    intermedias. Esos duplicados no deben convertirse en varios correos A08, A23,
    etc. Si una copia contiene una respuesta del alumno, se prefiere esa copia.
    """
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
            body_text=_body(case),
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
        initial.body_text = _body(case)
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

        tasks = sorted(case.tasks or [], key=lambda item: (item.task_order, item.id))
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

        initial = _ensure_initial_message(db, thread, case, sender_name, sender_address, sent_at)
        _ensure_training_attachment(db, code, case, initial)
        thread_ids.append(thread.id)

    db.commit()
    return thread_ids


def attach_activity_mail_context(db: Session, course: dict) -> dict:
    """Convierte los hilos ligados al caso en parte explícita de cada actividad."""
    activities = [item for topic in course.get("topics", []) for item in topic.get("activities", [])]
    assignment_ids = {item.get("assignment_id") for item in activities if item.get("assignment_id")}
    scenario_codes = {str(item.get("scenario_code") or "") for item in activities if item.get("scenario_code")}

    threads = (
        db.query(EmailThread)
        .filter(EmailThread.folder != "trash", EmailThread.related_entity_type != "training_duplicate")
        .order_by(EmailThread.id.asc())
        .all()
    )
    by_assignment: dict[int, list[EmailThread]] = defaultdict(list)
    by_reference: dict[str, list[EmailThread]] = defaultdict(list)
    by_code: dict[str, list[EmailThread]] = defaultdict(list)
    for thread in threads:
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
        activity["situation"] = "Has recibido una comunicación relacionada con este ejercicio. Consulta el correo antes de continuar."
        activity["instructions"] = (
            "Consulta el correo relacionado y sus adjuntos, realiza la gestión indicada en AulaNomina y responde por el mismo hilo cuando hayas terminado."
            if role == "reply"
            else "Consulta el correo relacionado y sus adjuntos. Con la información recibida, realiza en AulaNomina la gestión solicitada."
            if role == "attachment"
            else "Consulta el correo relacionado. Con la información recibida, realiza en AulaNomina la gestión solicitada."
        )
        activity["case_data"] = []
    return course