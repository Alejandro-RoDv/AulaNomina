from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class Mailbox(Base):
    __tablename__ = "mailboxes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    role = Column(String, default="student", nullable=False)
    display_name = Column(String, nullable=False)
    address = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    threads = relationship(
        "EmailThread",
        back_populates="mailbox",
        cascade="all, delete-orphan",
        order_by="EmailThread.updated_at.desc()",
    )


class EmailThread(Base):
    __tablename__ = "email_threads"

    id = Column(Integer, primary_key=True, index=True)
    mailbox_id = Column(Integer, ForeignKey("mailboxes.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    case_study_id = Column(Integer, ForeignKey("case_studies.id"), nullable=True, index=True)
    case_assignment_id = Column(Integer, ForeignKey("case_assignments.id"), nullable=True, index=True)
    case_task_id = Column(Integer, ForeignKey("case_tasks.id"), nullable=True, index=True)
    related_entity_type = Column(String, nullable=True, index=True)
    related_entity_id = Column(Integer, nullable=True, index=True)
    subject = Column(String, nullable=False)
    preview = Column(Text, nullable=True)
    folder = Column(String, default="inbox", nullable=False, index=True)
    status = Column(String, default="open", nullable=False, index=True)
    priority = Column(String, default="normal", nullable=False)
    category = Column(String, default="general", nullable=False, index=True)
    case_reference = Column(String, nullable=True, index=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    expected_actions = Column(JSON, default=list, nullable=False)
    context_actions = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Se actualiza explícitamente cuando entra/sale un mensaje. Cambios de estado
    # (leído, carpeta, prioridad) no deben alterar el orden cronológico del buzón.
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    mailbox = relationship("Mailbox", back_populates="threads")
    employee = relationship("Employee")
    case_study = relationship("CaseStudy")
    case_assignment = relationship("CaseAssignment", back_populates="email_threads")
    case_task = relationship("CaseTask")
    messages = relationship(
        "EmailMessage",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="EmailMessage.sent_at.asc()",
    )


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("email_threads.id"), nullable=False, index=True)
    sender_name = Column(String, nullable=False)
    sender_address = Column(String, nullable=False)
    recipient_name = Column(String, nullable=True)
    recipient_address = Column(String, nullable=False)
    cc_address = Column(Text, nullable=True)
    body_html = Column(Text, nullable=True)
    body_text = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)
    direction = Column(String, default="incoming", nullable=False)
    message_type = Column(String, default="initial", nullable=False)

    thread = relationship("EmailThread", back_populates="messages")
    attachments = relationship(
        "EmailAttachment",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="EmailAttachment.id.asc()",
    )


class EmailAttachment(Base):
    __tablename__ = "email_attachments"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("email_messages.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, default="application/octet-stream", nullable=False)
    storage_reference = Column(String, nullable=True)
    document_type = Column(String, nullable=True)
    content_text = Column(Text, nullable=True)
    linked_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True, index=True)
    size_bytes = Column(Integer, default=0, nullable=False)

    message = relationship("EmailMessage", back_populates="attachments")
    linked_document = relationship("Document")