from __future__ import annotations

from copy import deepcopy

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.mail import EmailAttachment, EmailMessage, EmailThread, Mailbox
from app.models.student import Student
from app.services.auth_service import AuthPrincipal
from app.services.case_scenario_service import ensure_assignment_progress


def learner_student(db: Session, principal: AuthPrincipal) -> Student | None:
    if principal.student_id is None:
        return None
    return db.query(Student).filter(Student.id == principal.student_id).first()


def ensure_user_mailbox(db: Session, principal: AuthPrincipal) -> Mailbox:
    mailbox = db.query(Mailbox).filter(Mailbox.user_id == principal.user_id).first()
    if mailbox:
        return mailbox

    student = learner_student(db, principal)
    if not student:
        raise HTTPException(status_code=403, detail="La cuenta no dispone de perfil de alumno")

    # Reutiliza buzones antiguos si coinciden por email y todavía no tienen dueño.
    if student.email:
        mailbox = (
            db.query(Mailbox)
            .filter(Mailbox.address == student.email, Mailbox.user_id.is_(None))
            .first()
        )
        if mailbox:
            mailbox.user_id = principal.user_id
            mailbox.display_name = student.full_name
            db.commit()
            db.refresh(mailbox)
            return mailbox

    address = f"student-{student.id}@aulanomina.local"
    mailbox = db.query(Mailbox).filter(Mailbox.address == address).first()
    if mailbox:
        mailbox.user_id = principal.user_id
        mailbox.display_name = student.full_name
        db.commit()
        db.refresh(mailbox)
        return mailbox

    mailbox = Mailbox(
        user_id=principal.user_id,
        role="student",
        display_name=student.full_name,
        address=address,
    )
    db.add(mailbox)
    db.commit()
    db.refresh(mailbox)
    return mailbox


def _thread_already_cloned(
    db: Session,
    *,
    mailbox_id: int,
    assignment_id: int,
    source: EmailThread,
) -> bool:
    return (
        db.query(EmailThread)
        .filter(
            EmailThread.mailbox_id == mailbox_id,
            EmailThread.case_assignment_id == assignment_id,
            EmailThread.subject == source.subject,
        )
        .first()
        is not None
    )


def _clone_thread(
    db: Session,
    source: EmailThread,
    mailbox: Mailbox,
    assignment_id: int,
) -> EmailThread:
    if _thread_already_cloned(
        db,
        mailbox_id=mailbox.id,
        assignment_id=assignment_id,
        source=source,
    ):
        return (
            db.query(EmailThread)
            .filter(
                EmailThread.mailbox_id == mailbox.id,
                EmailThread.case_assignment_id == assignment_id,
                EmailThread.subject == source.subject,
            )
            .first()
        )

    thread = EmailThread(
        mailbox_id=mailbox.id,
        company_id=source.company_id,
        employee_id=source.employee_id,
        case_study_id=source.case_study_id,
        case_assignment_id=assignment_id,
        case_task_id=source.case_task_id,
        related_entity_type=source.related_entity_type,
        related_entity_id=source.related_entity_id,
        subject=source.subject,
        preview=source.preview,
        folder=source.folder,
        status="open",
        priority=source.priority,
        category=source.category,
        case_reference=source.case_reference,
        is_read=False,
        expected_actions=deepcopy(source.expected_actions or []),
        context_actions=deepcopy(source.context_actions or []),
        created_at=source.created_at,
        updated_at=source.updated_at,
    )
    db.add(thread)
    db.flush()

    for source_message in source.messages or []:
        message = EmailMessage(
            thread_id=thread.id,
            sender_name=source_message.sender_name,
            sender_address=source_message.sender_address,
            recipient_name=mailbox.display_name,
            recipient_address=mailbox.address,
            cc_address=source_message.cc_address,
            body_html=source_message.body_html,
            body_text=source_message.body_text,
            sent_at=source_message.sent_at,
            direction=source_message.direction,
            message_type=source_message.message_type,
        )
        db.add(message)
        db.flush()
        for source_attachment in source_message.attachments or []:
            db.add(
                EmailAttachment(
                    message_id=message.id,
                    filename=source_attachment.filename,
                    content_type=source_attachment.content_type,
                    storage_reference=source_attachment.storage_reference,
                    document_type=source_attachment.document_type,
                    content_text=source_attachment.content_text,
                    linked_document_id=source_attachment.linked_document_id,
                    size_bytes=source_attachment.size_bytes,
                )
            )
    return thread


def _ensure_assignment_mail_scope(
    db: Session,
    principal: AuthPrincipal,
    assignment: CaseAssignment,
    source_assignment: CaseAssignment | None = None,
) -> None:
    mailbox = ensure_user_mailbox(db, principal)
    source = source_assignment or assignment
    for thread in source.email_threads or []:
        if thread.mailbox_id == mailbox.id and thread.case_assignment_id == assignment.id:
            continue
        _clone_thread(db, thread, mailbox, assignment.id)
    db.commit()


def materialize_group_assignments(db: Session, principal: AuthPrincipal) -> list[CaseAssignment]:
    """Turn group templates into private student assignments on first access."""
    if principal.is_staff:
        return []
    student = learner_student(db, principal)
    if not student:
        raise HTTPException(status_code=403, detail="La cuenta no dispone de perfil de alumno")

    if student.group_id:
        templates = (
            db.query(CaseAssignment)
            .filter(CaseAssignment.group_id == student.group_id)
            .order_by(CaseAssignment.id.asc())
            .all()
        )
        for template in templates:
            existing = (
                db.query(CaseAssignment)
                .filter(
                    CaseAssignment.case_study_id == template.case_study_id,
                    CaseAssignment.student_id == student.id,
                )
                .order_by(CaseAssignment.id.asc())
                .first()
            )
            if existing is None:
                existing = CaseAssignment(
                    case_study_id=template.case_study_id,
                    student_id=student.id,
                    group_id=None,
                    assigned_by=template.assigned_by,
                    assigned_at=template.assigned_at,
                    due_date=template.due_date,
                    status="assigned",
                    notes=template.notes,
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)
                ensure_assignment_progress(db, existing.id)
            _ensure_assignment_mail_scope(db, principal, existing, template)

    assignments = (
        db.query(CaseAssignment)
        .filter(CaseAssignment.student_id == student.id)
        .order_by(CaseAssignment.id.asc())
        .all()
    )
    for assignment in assignments:
        ensure_assignment_progress(db, assignment.id)
        _ensure_assignment_mail_scope(db, principal, assignment)
    return assignments


def accessible_assignment_ids(db: Session, principal: AuthPrincipal) -> set[int] | None:
    if principal.is_staff:
        return None
    return {assignment.id for assignment in materialize_group_assignments(db, principal)}


def assert_assignment_access(db: Session, principal: AuthPrincipal | None, assignment_id: int) -> None:
    if principal is None or principal.is_staff:
        return
    allowed = accessible_assignment_ids(db, principal) or set()
    if assignment_id not in allowed:
        raise HTTPException(status_code=403, detail="Esta actividad pertenece a otro alumno")


def get_scoped_mailbox(db: Session, principal: AuthPrincipal) -> Mailbox:
    if principal.is_staff:
        raise HTTPException(status_code=400, detail="El buzón de alumno requiere un perfil de alumno")
    materialize_group_assignments(db, principal)
    return ensure_user_mailbox(db, principal)


def assert_mailbox_access(db: Session, principal: AuthPrincipal | None, mailbox_id: int) -> None:
    if principal is None or principal.is_staff:
        return
    mailbox = db.query(Mailbox).filter(Mailbox.id == mailbox_id).first()
    if not mailbox or mailbox.user_id != principal.user_id:
        raise HTTPException(status_code=403, detail="Este buzón pertenece a otro usuario")


def assert_thread_access(db: Session, principal: AuthPrincipal | None, thread_id: int) -> None:
    if principal is None or principal.is_staff:
        return
    thread = db.query(EmailThread).filter(EmailThread.id == thread_id).first()
    if not thread or not thread.mailbox or thread.mailbox.user_id != principal.user_id:
        raise HTTPException(status_code=403, detail="Este mensaje pertenece a otro usuario")
