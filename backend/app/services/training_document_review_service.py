"""Validación pedagógica bajo demanda para gestión documental y comunicaciones."""

from __future__ import annotations

from datetime import datetime
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.employee import Employee
from app.models.mail import EmailAttachment, EmailMessage, EmailThread
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import CaseScenarioError, ensure_assignment_progress, update_assignment_step


DOCUMENT_SCENARIO_CODES = {
    "TRAIN-2026-DOC-A51": "A51",
    "TRAIN-2026-DOC-A52": "A52",
    "TRAIN-2026-DOC-A53": "A53",
    "TRAIN-2026-DOC-A54": "A54",
}


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _check(passed: bool, message: str, evidence: dict[str, Any], *, rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _activity_code(assignment) -> str | None:
    scenario = str(assignment.case_study.scenario_code or "").strip().upper()
    return DOCUMENT_SCENARIO_CODES.get(scenario)


def _employee_name(employee: Employee) -> str:
    return " ".join(part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part)


def _find_employee(db: Session, name: str | None) -> Employee | None:
    expected = _normalize(name)
    if not expected:
        return None
    return next(
        (employee for employee in db.query(Employee).all() if _normalize(_employee_name(employee)) == expected),
        None,
    )


def _documents_by_type(db: Session, employee_id: int) -> dict[str, Document]:
    rows = db.query(Document).filter(Document.employee_id == employee_id).order_by(Document.id.asc()).all()
    return {row.document_type: row for row in rows}


def _review_a51(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    expected = state.get("document_data") or {}
    employee = _find_employee(db, state.get("employee"))
    documents = _documents_by_type(db, employee.id) if employee else {}
    required = list(expected.get("required_types") or [])
    received = set(expected.get("received_types") or [])
    pending = set(expected.get("pending_types") or [])
    missing = [code for code in required if code not in documents]
    wrong_status = {
        code: documents[code].status
        for code in required
        if code in documents
        and (
            (code in received and documents[code].status != "received")
            or (code in pending and documents[code].status != "pending")
        )
    }
    passed = bool(employee and required) and not missing and not wrong_status
    return _check(
        passed,
        (
            "El checklist contiene todos los documentos mínimos y conserva como pendientes los que aún no se han recibido."
            if passed
            else "Completa el checklist sin convertir en recibidos documentos que todavía están pendientes."
        ),
        {
            "employee_id": employee.id if employee else None,
            "required_types": required,
            "document_ids": {code: documents[code].id for code in required if code in documents},
            "statuses": {code: documents[code].status for code in required if code in documents},
            "missing_types": missing,
            "wrong_status": wrong_status,
        },
        rule_type="training_a51_document_checklist",
    )


def _review_a52(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    expected = state.get("document_data") or {}
    employee = _find_employee(db, state.get("employee"))
    documents = _documents_by_type(db, employee.id) if employee else {}
    expected_statuses = dict(expected.get("expected_statuses") or {})
    status_matches = {
        code: bool(documents.get(code) and documents[code].status == status)
        for code, status in expected_statuses.items()
    }
    expired_type = expected.get("expired_type")
    expired_document = documents.get(expired_type)
    expiry_ok = bool(
        expired_document
        and expired_document.expiry_date
        and str(expired_document.expiry_date) == str(expected.get("expired_on"))
        and expired_document.status == "expired"
    )
    no_apply_type = expected.get("not_applicable_type")
    no_apply_document = documents.get(no_apply_type)
    note = _normalize(no_apply_document.notes if no_apply_document else "")
    keywords = [_normalize(item) for item in expected.get("not_applicable_note_keywords") or []]
    justification_ok = bool(no_apply_document and no_apply_document.status == "not_applicable" and any(word in note for word in keywords))
    passed = bool(employee and expected_statuses) and all(status_matches.values()) and expiry_ok and justification_ok
    return _check(
        passed,
        (
            "Los estados documentales son coherentes, la caducidad está identificada y el no aplicable queda justificado."
            if passed
            else "Revisa estados, fecha de caducidad y la justificación del documento marcado como no aplicable."
        ),
        {
            "employee_id": employee.id if employee else None,
            "status_matches": status_matches,
            "expiry_ok": expiry_ok,
            "not_applicable_justified": justification_ok,
            "not_applicable_notes": no_apply_document.notes if no_apply_document else None,
        },
        rule_type="training_a52_document_statuses",
    )


def _case_thread(db: Session, assignment) -> EmailThread | None:
    return (
        db.query(EmailThread)
        .filter(EmailThread.case_assignment_id == assignment.id)
        .order_by(EmailThread.id.asc())
        .first()
    )


def _review_a53(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    mail_data = state.get("mail_data") or {}
    thread = _case_thread(db, assignment)
    reply = None
    if thread:
        reply = (
            db.query(EmailMessage)
            .filter(
                EmailMessage.thread_id == thread.id,
                EmailMessage.direction == "outgoing",
                EmailMessage.message_type.in_(["reply", "forward"]),
            )
            .order_by(EmailMessage.id.desc())
            .first()
        )
    body = _normalize(reply.body_text if reply else "")
    required = [_normalize(item) for item in mail_data.get("required_concepts") or []]
    forbidden = [_normalize(item) for item in mail_data.get("forbidden_claims") or []]
    required_matches = {item: item in body for item in required}
    forbidden_matches = {item: item in body for item in forbidden}
    content_ok = bool(reply and required and all(required_matches.values()) and not any(forbidden_matches.values()))
    passed = bool(thread and reply and content_ok)
    return _check(
        passed,
        (
            "La respuesta está enviada en el hilo, explica la caducidad y solicita una actualización sin inventar una recepción inexistente."
            if passed
            else "Responde en el mismo hilo usando la situación real del expediente: certificado caducado y necesidad de actualización."
        ),
        {
            "thread_id": thread.id if thread else None,
            "message_id": reply.id if reply else None,
            "required_concepts": required_matches,
            "forbidden_claims": forbidden_matches,
            "content_ok": content_ok,
        },
        rule_type="training_a53_professional_reply",
    )


def _review_a54(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    expected = state.get("document_data") or {}
    evidence = state.get("evidence_data") or {}
    employee = _find_employee(db, state.get("employee"))
    thread = _case_thread(db, assignment)
    attachment = None
    if thread:
        attachment = (
            db.query(EmailAttachment)
            .join(EmailMessage, EmailAttachment.message_id == EmailMessage.id)
            .filter(
                EmailMessage.thread_id == thread.id,
                EmailAttachment.filename == evidence.get("attachment_filename"),
            )
            .first()
        )
    linked_document = (
        db.query(Document).filter(Document.id == attachment.linked_document_id).first()
        if attachment and attachment.linked_document_id
        else None
    )
    document_ok = bool(
        linked_document
        and employee
        and linked_document.employee_id == employee.id
        and linked_document.document_type == expected.get("document_type")
        and linked_document.status == expected.get("status")
        and str(linked_document.issue_date or "") == str(expected.get("issue_date") or "")
        and str(linked_document.expiry_date or "") == str(expected.get("expiry_date") or "")
    )
    process_ok = bool(
        thread
        and thread.case_reference == assignment.case_study.scenario_code
        and thread.employee_id == (employee.id if employee else None)
        and attachment
    )
    passed = document_ok and process_ok
    return _check(
        passed,
        (
            "El correo, su adjunto y el documento recibido quedan enlazados y permiten reconstruir el cierre del proceso."
            if passed
            else "Vincula el adjunto del correo al documento correcto del expediente para completar la trazabilidad."
        ),
        {
            "employee_id": employee.id if employee else None,
            "thread_id": thread.id if thread else None,
            "attachment_id": attachment.id if attachment else None,
            "linked_document_id": linked_document.id if linked_document else None,
            "document_ok": document_ok,
            "process_ok": process_ok,
        },
        rule_type="training_a54_process_evidence",
    )


def handles_training_document_review(assignment, task) -> bool:
    return _activity_code(assignment) in {"A51", "A52", "A53", "A54"}


def validate_training_document_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    code = _activity_code(assignment)
    if not code:
        raise CaseScenarioError("El paso no pertenece al bloque formativo documental", code="UNSUPPORTED_TRAINING_REVIEW", status_code=400)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    if code == "A51":
        check = _review_a51(db, assignment)
    elif code == "A52":
        check = _review_a52(db, assignment)
    elif code == "A53":
        check = _review_a53(db, assignment)
    else:
        check = _review_a54(db, assignment)

    previous = dict(progress.validation_result or {})
    validation_result = {
        **previous,
        "mode": "explicit_review",
        "validated_at": datetime.utcnow().isoformat(),
        "passed": bool(check["passed"]),
        "manual_required": False,
        "checks": [check],
    }
    scenario = update_assignment_step(
        db,
        assignment_id,
        task.id,
        CaseTaskProgressUpdate(
            status="completed" if check["passed"] else "in_progress",
            student_notes=progress.student_notes,
            validation_result=validation_result,
        ),
    )
    return {
        "passed": bool(check["passed"]),
        "manual_required": False,
        "message": (
            "Comprobación superada. La evidencia documental del ejercicio es coherente."
            if check["passed"]
            else "La comprobación no se ha superado. Revisa el expediente documental o la comunicación del caso."
        ),
        "checks": [check],
        "scenario": scenario,
    }
