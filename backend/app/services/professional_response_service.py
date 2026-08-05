from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.mail import EmailMessage


RESPONSE_TEMPLATES = {
    "reconcile_fie": {
        "sender_name": "Comunicaciones INSS",
        "sender_address": "fie@inss.aulanomina.local",
        "subject_prefix": "FIE",
        "success": "La comunicación FIE ha quedado conciliada con la incidencia laboral correspondiente.",
        "pending": "La comunicación FIE sigue presentando diferencias. Revisa las fechas, la contingencia y el proceso relacionado.",
        "error": "No ha sido posible conciliar la comunicación FIE. El proceso permanece pendiente de revisión.",
    },
    "submit_affiliation": {
        "sender_name": "SILTRA simulado · Afiliación",
        "sender_address": "siltra@tgss.aulanomina.local",
        "subject_prefix": "Afiliación",
        "success": "El fichero de afiliación ha sido recibido y el movimiento comunicado ha sido aceptado.",
        "pending": "El fichero de afiliación ha sido recibido con observaciones. Consulta el detalle antes de cerrar el alta.",
        "error": "El fichero de afiliación ha sido rechazado. Revisa la respuesta, corrige el movimiento y realiza un nuevo envío.",
    },
    "submit_siltra": {
        "sender_name": "SILTRA simulado",
        "sender_address": "siltra@tgss.aulanomina.local",
        "subject_prefix": "Liquidación",
        "success": "La liquidación ha sido procesada correctamente. El fichero de respuesta se encuentra disponible.",
        "pending": "La liquidación se ha procesado con avisos o discrepancias. Revisa el fichero de respuesta antes de confirmarla.",
        "error": "La liquidación ha sido rechazada por errores de validación. Consulta los códigos de respuesta y regenera el fichero.",
    },
    "present_model_111": {
        "sender_name": "Agencia Tributaria simulada",
        "sender_address": "notificaciones@aeat.aulanomina.local",
        "subject_prefix": "Modelo 111",
        "success": "La presentación del Modelo 111 ha sido aceptada y se ha generado el justificante.",
        "pending": "La presentación del Modelo 111 contiene avisos que deben revisarse antes de cerrar el periodo.",
        "error": "La presentación del Modelo 111 ha sido rechazada. Revisa los datos declarados y repite la presentación.",
    },
    "present_model_190": {
        "sender_name": "Agencia Tributaria simulada",
        "sender_address": "notificaciones@aeat.aulanomina.local",
        "subject_prefix": "Modelo 190",
        "success": "La presentación del Modelo 190 ha sido aceptada y se ha generado el justificante.",
        "pending": "La presentación del Modelo 190 contiene perceptores o registros pendientes de revisión.",
        "error": "La presentación del Modelo 190 ha sido rechazada. Corrige las inconsistencias y genera una nueva declaración.",
    },
    "recalculate_payroll": {
        "sender_name": "Control de nómina",
        "sender_address": "control.nomina@aulanomina.local",
        "subject_prefix": "Nómina",
        "success": "El recálculo de nómina ha finalizado y el resultado actualizado está disponible para revisión.",
        "pending": "El recálculo se ha ejecutado, pero quedan incidencias o validaciones pendientes en el periodo.",
        "error": "El recálculo de nómina no ha podido completarse. Revisa los datos laborales y las incidencias aplicadas.",
    },
    "create_regularization": {
        "sender_name": "Administración de personal",
        "sender_address": "administracion@empresa-demo.es",
        "subject_prefix": "Regularización",
        "success": "La regularización ha quedado registrada y vinculada al periodo afectado.",
        "pending": "La regularización se ha preparado, pero todavía requiere revisión antes de su cierre.",
        "error": "La regularización no ha podido generarse. Revisa los conceptos y el cálculo de origen.",
    },
}


SUCCESS_STATUSES = {
    "ACCEPTED",
    "APPLIED",
    "MATCHED",
    "PROCESSED",
    "RESOLVED",
    "COMPLETED",
    "CONFIRMED",
    "PRESENTED",
    "SUCCESS",
}
PENDING_STATUSES = {
    "PENDING",
    "SENT",
    "PROCESSING",
    "PENDING_REVIEW",
    "ACCEPTED_WITH_WARNINGS",
    "WARNING",
    "WARNINGS",
    "IN_PROGRESS",
}
ERROR_STATUSES = {
    "REJECTED",
    "ERROR",
    "FAILED",
    "CANCELLED",
    "INVALID",
    "DISCREPANCY",
}


def _normalized_status(metadata: dict[str, Any] | None) -> str:
    value = (metadata or {}).get("domain_status") or (metadata or {}).get("response_status")
    return str(value or "").strip().upper()


def _outcome(
    operation_status: str,
    validation: dict[str, Any] | None,
    metadata: dict[str, Any] | None,
) -> str:
    if operation_status == "error":
        return "error"
    domain_status = _normalized_status(metadata)
    if domain_status in ERROR_STATUSES:
        return "error"
    if domain_status in PENDING_STATUSES:
        return "pending"
    if domain_status in SUCCESS_STATUSES:
        return "success"
    if validation and validation.get("passed"):
        return "success"
    return "pending"


def _detail_suffix(metadata: dict[str, Any] | None) -> str:
    metadata = metadata or {}
    parts = []
    if metadata.get("response_code"):
        parts.append(f"Código: {metadata['response_code']}.")
    if metadata.get("response_message"):
        parts.append(str(metadata["response_message"]).strip())
    if metadata.get("submission_number"):
        parts.append(f"Referencia: {metadata['submission_number']}.")
    return f" {' '.join(parts)}" if parts else ""


def create_professional_response(
    db: Session,
    assignment_id: int,
    *,
    action_code: str | None,
    operation_status: str,
    event_id: str | None,
    validation: dict[str, Any] | None,
    metadata: dict[str, Any] | None = None,
) -> int | None:
    template = RESPONSE_TEMPLATES.get(action_code or "")
    if not template:
        return None

    assignment = db.query(CaseAssignment).filter(CaseAssignment.id == assignment_id).first()
    if not assignment or not assignment.email_threads:
        return None
    thread = assignment.email_threads[0]

    marker = f"professional-event:{event_id}" if event_id else None
    if marker:
        existing = (
            db.query(EmailMessage)
            .filter(EmailMessage.thread_id == thread.id, EmailMessage.body_html == marker)
            .first()
        )
        if existing:
            return existing.id

    outcome = _outcome(operation_status, validation, metadata)
    body = f"{template[outcome]}{_detail_suffix(metadata)}"
    now = datetime.utcnow()
    message = EmailMessage(
        thread_id=thread.id,
        sender_name=template["sender_name"],
        sender_address=template["sender_address"],
        recipient_name=thread.mailbox.display_name if thread.mailbox else "Usuario demo",
        recipient_address=thread.mailbox.address if thread.mailbox else "usuario.demo@aulanomina.local",
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
    if outcome == "error":
        thread.status = "in_progress"
    elif outcome == "pending":
        thread.status = "waiting"
    db.commit()
    return message.id
