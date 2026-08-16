"""Comunicaciones formativas ligadas a actividades del curso 2026."""
from __future__ import annotations

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


def _code(case):
    sequence = (case.initial_state or {}).get("training_sequence") or []
    if sequence:
        return str(sequence[0]).upper()
    for task in sorted(case.tasks or [], key=lambda x: (x.task_order, x.id)):
        value = (task.trigger_condition or {}).get("training_code")
        if value:
            return str(value).upper()
    return None


def _sender(code):
    n = int(code[1:])
    if n <= 13: return "Dirección de personas", "personas@aulanomina.demo", "contract"
    if n <= 22: return "Administración de nóminas", "nominas@aulanomina.demo", "payroll"
    if n <= 27: return "Administración de personal", "personal@aulanomina.demo", "absence"
    if n <= 35: return "Seguridad Social", "seguridadsocial@aulanomina.demo", "social_security"
    if n <= 41: return "Departamento fiscal", "fiscal@aulanomina.demo", "tax"
    if n <= 45: return "Administración de nóminas", "nominas@aulanomina.demo", "payroll"
    if n <= 50: return "Dirección laboral", "direccion.laboral@aulanomina.demo", "contract"
    return "Administración de personal", "personal@aulanomina.demo", "document"


def _body(case):
    lines = [f"- {task.description or task.title}" for task in sorted(case.tasks or [], key=lambda x: (x.task_order, x.id))]
    return (
        f"Buenos días:\n\nNecesitamos que gestiones el siguiente asunto en AulaNomina: {case.title}.\n\n"
        f"{case.description or ''}\n\nIndicaciones del encargo:\n" + "\n".join(lines)
        + "\n\nRevisa la información recibida y realiza las operaciones necesarias en el ERP antes de cerrar el caso."
    )


def ensure_activity_mail_2026(db: Session, mailbox: Mailbox):
    ids = []
    for case in db.query(CaseStudy).filter(CaseStudy.status == "active").order_by(CaseStudy.id.asc()).all():
        code = _code(case)
        if code not in MAIL_CODES:
            continue
        assignment = db.query(CaseAssignment).filter(CaseAssignment.case_study_id == case.id).order_by(CaseAssignment.id.asc()).first()
        if not assignment:
            continue
        tasks = sorted(case.tasks or [], key=lambda x: (x.task_order, x.id))
        first_task = tasks[0] if tasks else None
        thread = db.query(EmailThread).filter(EmailThread.mailbox_id == mailbox.id, EmailThread.case_assignment_id == assignment.id).order_by(EmailThread.id.asc()).first()
        if thread:
            thread.case_study_id = case.id
            thread.case_task_id = thread.case_task_id or (first_task.id if first_task else None)
            thread.expected_actions = [task.title for task in tasks]
            ids.append(thread.id)
            continue
        sender_name, sender_address, category = _sender(code)
        now = datetime(2026, 9, 1, 8, 0)
        thread = EmailThread(
            mailbox_id=mailbox.id, company_id=case.company_id, case_study_id=case.id,
            case_assignment_id=assignment.id, case_task_id=first_task.id if first_task else None,
            related_entity_type="case_study", related_entity_id=case.id,
            subject=f"{code} · {case.title}", preview=str(case.description or case.title)[:220],
            folder="training_locked", status="open", priority="normal", category=category,
            case_reference=case.scenario_code, is_read=False,
            expected_actions=[task.title for task in tasks],
            context_actions=[str(task.module or "") for task in tasks if task.module],
            created_at=now, updated_at=now,
        )
        db.add(thread); db.flush()
        message = EmailMessage(
            thread_id=thread.id, sender_name=sender_name, sender_address=sender_address,
            recipient_name=mailbox.display_name, recipient_address=mailbox.address,
            body_text=_body(case), sent_at=now, read_at=None, direction="incoming", message_type="initial",
        )
        db.add(message); db.flush()
        if code in ATTACHMENT_CODES:
            state = dict(case.initial_state or {}); state.pop("training_sequence", None)
            content = "DATOS RECIBIDOS PARA EL CASO\n\n" + json.dumps(state, ensure_ascii=False, indent=2, default=str)
            db.add(EmailAttachment(
                message_id=message.id, filename=f"Datos_caso_{code}.txt", content_type="text/plain",
                storage_reference=f"demo://training-mail/{code}", document_type="training_case_data",
                content_text=content, size_bytes=len(content.encode("utf-8")),
            ))
        ids.append(thread.id)
    db.commit()
    return ids


def attach_activity_mail_context(db: Session, course: dict):
    """Convierte los hilos ligados al caso en parte explícita de cada actividad."""
    activities = [item for topic in course.get("topics", []) for item in topic.get("activities", [])]
    assignment_ids = {item.get("assignment_id") for item in activities if item.get("assignment_id")}
    threads = (
        db.query(EmailThread)
        .filter(EmailThread.case_assignment_id.in_(assignment_ids), EmailThread.folder != "trash")
        .order_by(EmailThread.id.asc())
        .all()
        if assignment_ids else []
    )
    by_assignment = {}
    for thread in threads:
        by_assignment.setdefault(thread.case_assignment_id, []).append(thread)

    for activity in activities:
        candidates = by_assignment.get(activity.get("assignment_id"), [])
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
