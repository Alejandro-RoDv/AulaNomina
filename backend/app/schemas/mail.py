from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


MAIL_FOLDERS = {"inbox", "sent", "drafts", "archive", "trash"}
MAIL_STATUSES = {"open", "in_progress", "waiting", "resolved"}
MAIL_PRIORITIES = {"low", "normal", "high", "urgent"}
MAIL_CATEGORIES = {
    "payroll",
    "contract",
    "social_security",
    "tax",
    "absence",
    "employee_request",
    "document",
    "general",
}
MAIL_DIRECTIONS = {"incoming", "outgoing", "system"}
MAIL_MESSAGE_TYPES = {"initial", "reply", "automatic", "draft", "forward"}


class EmailAttachmentCreate(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"
    storage_reference: Optional[str] = None
    document_type: Optional[str] = None
    content_text: Optional[str] = None
    linked_document_id: Optional[int] = None
    size_bytes: int = 0


class EmailAttachmentResponse(EmailAttachmentCreate):
    id: int
    message_id: int

    class Config:
        from_attributes = True


class EmailAttachmentPreviewResponse(BaseModel):
    id: int
    filename: str
    content_type: str
    document_type: Optional[str] = None
    content_text: str
    linked_document_id: Optional[int] = None
    preview_supported: bool = True


class EmailMessageCreate(BaseModel):
    sender_name: str
    sender_address: str
    recipient_name: Optional[str] = None
    recipient_address: str
    cc_address: Optional[str] = None
    body_html: Optional[str] = None
    body_text: str
    direction: str = "outgoing"
    message_type: str = "reply"
    attachments: list[EmailAttachmentCreate] = Field(default_factory=list)

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, value):
        if value not in MAIL_DIRECTIONS:
            raise ValueError("Direccion de mensaje no valida")
        return value

    @field_validator("message_type")
    @classmethod
    def validate_message_type(cls, value):
        if value not in MAIL_MESSAGE_TYPES:
            raise ValueError("Tipo de mensaje no valido")
        return value


class EmailThreadCreate(BaseModel):
    recipient_name: Optional[str] = None
    recipient_address: str
    cc_address: Optional[str] = None
    subject: str
    body_text: str
    body_html: Optional[str] = None
    priority: str = "normal"
    category: str = "general"
    company_id: Optional[int] = None
    employee_id: Optional[int] = None
    case_study_id: Optional[int] = None
    case_assignment_id: Optional[int] = None
    case_task_id: Optional[int] = None
    case_reference: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None
    attachments: list[EmailAttachmentCreate] = Field(default_factory=list)
    save_as_draft: bool = False

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value):
        if value not in MAIL_PRIORITIES:
            raise ValueError("Prioridad no valida")
        return value

    @field_validator("category")
    @classmethod
    def validate_category(cls, value):
        if value not in MAIL_CATEGORIES:
            raise ValueError("Categoria no valida")
        return value


class EmailMessageResponse(BaseModel):
    id: int
    thread_id: int
    sender_name: str
    sender_address: str
    recipient_name: Optional[str] = None
    recipient_address: str
    cc_address: Optional[str] = None
    body_html: Optional[str] = None
    body_text: str
    sent_at: datetime
    read_at: Optional[datetime] = None
    direction: str
    message_type: str
    attachments: list[EmailAttachmentResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class EmailThreadUpdate(BaseModel):
    folder: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    is_read: Optional[bool] = None

    @field_validator("folder")
    @classmethod
    def validate_folder(cls, value):
        if value is not None and value not in MAIL_FOLDERS:
            raise ValueError("Carpeta de correo no valida")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        if value is not None and value not in MAIL_STATUSES:
            raise ValueError("Estado de hilo no valido")
        return value

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value):
        if value is not None and value not in MAIL_PRIORITIES:
            raise ValueError("Prioridad no valida")
        return value


class EmailThreadResponse(BaseModel):
    id: int
    mailbox_id: int
    company_id: Optional[int] = None
    employee_id: Optional[int] = None
    case_study_id: Optional[int] = None
    case_assignment_id: Optional[int] = None
    case_task_id: Optional[int] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None
    subject: str
    preview: Optional[str] = None
    folder: str
    status: str
    priority: str
    category: str
    case_reference: Optional[str] = None
    is_read: bool
    expected_actions: list[str] = Field(default_factory=list)
    context_actions: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    messages: list[EmailMessageResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class MailboxResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    company_id: Optional[int] = None
    role: str
    display_name: str
    address: str
    created_at: datetime

    class Config:
        from_attributes = True


class MailboxStatsResponse(BaseModel):
    total: int
    unread: int
    inbox: int
    sent: int
    drafts: int
    archive: int
    trash: int
    pending: int
    in_progress: int
    waiting: int
    resolved: int
