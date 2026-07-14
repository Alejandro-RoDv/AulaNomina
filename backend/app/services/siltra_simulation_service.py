import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.crud.communication_file import serialize_communication_event, serialize_communication_file
from app.models.communication_file import CommunicationFile, CommunicationFileEvent
from app.models.communication_submission import CommunicationSubmission
from app.models.company import Company
from app.models.work_center import WorkCenter
from app.services.communication_file_workflow import (
    CommunicationEventType,
    CommunicationFileStatus,
    CommunicationFileType,
    normalize_ccc,
    period_is_valid,
)
from app.services.siltra_response_codes import (
    CommunicationSubmissionStatus,
    RECOMMENDATIONS,
    RESPONSE_CODES,
)


class SiltraSimulationDomainError(ValueError):
    pass


ACTIVE_STATUSES = {
    CommunicationSubmissionStatus.PENDING.value,
    CommunicationSubmissionStatus.SENT.value,
    CommunicationSubmissionStatus.PROCESSING.value,
}
SOURCE_SENDABLE_STATUSES = {
    CommunicationFileStatus.GENERATED.value,
    CommunicationFileStatus.ACCEPTED.value,
    CommunicationFileStatus.ACCEPTED_WITH_WARNINGS.value,
    CommunicationFileStatus.REJECTED.value,
}


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _json_load(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _decimal(value: Any) -> Decimal | None:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _message(code: str, **context: Any) -> dict[str, Any]:
    definition = RESPONSE_CODES[code]
    return {
        "code": code,
        "severity": definition["severity"],
        "message": definition["message"],
        "employee_id": context.get("employee_id"),
        "employee_name": context.get("employee_name"),
        "naf": context.get("naf"),
        "payroll_id": context.get("payroll_id"),
        "field": context.get("field"),
        "details": context.get("details") or {},
        "recommendation": RECOMMENDATIONS.get(code),
    }


def _company_cccs(db: Session, company: Company) -> set[str]:
    values = {normalize_ccc(company.ccc)}
    for center in db.query(WorkCenter).filter(WorkCenter.company_id == company.id).all():
        values.update({normalize_ccc(center.general_ccc), normalize_ccc(center.main_ccc)})
    return {value for value in values if value}


def _record_source_event(
    db: Session,
    source: CommunicationFile,
    *,
    from_status: str | None,
    to_status: str | None,
    message: str,
    details: dict[str, Any],
    created_by: int | None,
    response_linked: bool = False,
) -> None:
    db.add(
        CommunicationFileEvent(
            communication_file=source,
            event_type=(
                CommunicationEventType.RESPONSE_LINKED.value
                if response_linked
                else CommunicationEventType.STATUS_CHANGED.value
            ),
            from_status=from_status,
            to_status=to_status,
            message=message,
            details=_json_dump(details),
            created_by=created_by,
        )
    )


def generate_submission_number(db: Session, now: datetime | None = None) -> str:
    now = now or datetime.utcnow()
    prefix = f"SILTRA-SIM-{now.year}-"
    latest = (
        db.query(CommunicationSubmission.submission_number)
        .filter(CommunicationSubmission.submission_number.like(f"{prefix}%"))
        .order_by(CommunicationSubmission.submission_number.desc())
        .first()
    )
    try:
        sequence = int(str(latest[0]).rsplit("-", 1)[1]) + 1 if latest else 1
    except (IndexError, TypeError, ValueError):
        sequence = 1
    return f"{prefix}{sequence:06d}"


def next_attempt_number(db: Session, communication_file_id: int) -> int:
    current = (
        db.query(func.max(CommunicationSubmission.attempt_number))
        .filter(CommunicationSubmission.communication_file_id == communication_file_id)
        .scalar()
    )
    return int(current or 0) + 1


def _worker_context(worker: dict[str, Any]) -> dict[str, Any]:
    return {
        "employee_id": worker.get("employee_id"),
        "employee_name": worker.get("employee_name"),
        "naf": str(worker.get("naf") or "").strip() or None,
        "payroll_id": worker.get("payroll_id"),
    }


def _validate_worker(worker: Any) -> list[dict[str, Any]]:
    if not isinstance(worker, dict):
        return [_message("R9508", field="workers", details={"reason": "invalid_worker"})]

    messages: list[dict[str, Any]] = []
    context = _worker_context(worker)
    if not context["naf"]:
        messages.append(_message("R9501", **context, field="naf"))
    if not str(worker.get("contribution_group") or "").strip():
        messages.append(_message("R9505", **context, field="contribution_group"))

    bases = worker.get("bases") if isinstance(worker.get("bases"), dict) else {}
    positive_base = False
    for field_name, value in bases.items():
        amount = _decimal(value)
        field = f"bases.{field_name}"
        if amount is None:
            messages.append(_message("R9508", **context, field=field, details={"value": value}))
        elif amount < 0:
            messages.append(_message("R9504", **context, field=field, details={"value": str(amount)}))
        elif amount > 0:
            positive_base = True

    try:
        days = int(worker.get("contribution_days") or 0)
    except (TypeError, ValueError):
        days = 0
        messages.append(
            _message(
                "R9508",
                **context,
                field="contribution_days",
                details={"value": worker.get("contribution_days")},
            )
        )
    if days == 0 and positive_base:
        messages.append(_message("W9603", **context, field="contribution_days"))
    if str(worker.get("payroll_status") or "").lower() in {"draft", "pending"}:
        messages.append(_message("W9601", **context, field="payroll_status"))
    return messages


def analyze_communication_content(
    source: CommunicationFile,
    *,
    company_exists: bool,
    ccc_belongs_to_company: bool,
    attempt_number: int,
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    if source.file_type != CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT.value:
        return [_message("R9509", field="file_type", details={"value": source.file_type})]
    if source.status not in SOURCE_SENDABLE_STATUSES | {
        CommunicationFileStatus.SENT.value,
        CommunicationFileStatus.PROCESSING.value,
    }:
        messages.append(_message("R9512", field="status", details={"value": source.status}))
    if not company_exists:
        messages.append(_message("R9510", field="company_id", details={"value": source.company_id}))
    if not normalize_ccc(source.ccc_id):
        messages.append(_message("R9502", field="ccc_id"))
    elif not ccc_belongs_to_company:
        messages.append(_message("R9511", field="ccc_id", details={"value": source.ccc_id}))
    if not period_is_valid(CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT, source.period):
        messages.append(_message("R9503", field="period", details={"value": source.period}))
    if not source.content or not source.content.strip():
        return messages + [_message("R9508", field="content", details={"reason": "empty"})]

    try:
        payload = json.loads(source.content)
    except (TypeError, ValueError):
        return messages + [_message("R9508", field="content", details={"reason": "invalid_json"})]
    if not isinstance(payload, dict):
        return messages + [_message("R9508", field="content", details={"reason": "root_not_object"})]

    if payload.get("company_id") != source.company_id:
        messages.append(
            _message(
                "R9510",
                field="company_id",
                details={"file_value": payload.get("company_id"), "expected": source.company_id},
            )
        )
    payload_ccc = normalize_ccc(payload.get("ccc"))
    if not payload_ccc or payload_ccc != normalize_ccc(source.ccc_id):
        messages.append(
            _message(
                "R9502",
                field="ccc",
                details={"file_value": payload.get("ccc"), "expected": source.ccc_id},
            )
        )
    if payload.get("period") != source.period:
        messages.append(
            _message(
                "R9503",
                field="period",
                details={"file_value": payload.get("period"), "expected": source.period},
            )
        )

    workers = payload.get("workers")
    if not isinstance(workers, list) or not workers:
        messages.append(_message("R9507", field="workers"))
        workers = []
    for worker in workers:
        messages.extend(_validate_worker(worker))

    totals = payload.get("totals") if isinstance(payload.get("totals"), dict) else {}
    total_due = _decimal(totals.get("total_due"))
    if total_due is None:
        messages.append(_message("R9508", field="totals.total_due", details={"value": totals.get("total_due")}))
    elif total_due < 0:
        messages.append(_message("R9506", field="totals.total_due", details={"value": str(total_due)}))

    total_bases = totals.get("bases") if isinstance(totals.get("bases"), dict) else {}
    for field_name, value in total_bases.items():
        amount = _decimal(value)
        if amount is not None and amount < 0:
            messages.append(_message("R9504", field=f"totals.bases.{field_name}", details={"value": str(amount)}))

    worker_total = sum(
        (_decimal(worker.get("total_due")) or Decimal("0"))
        for worker in workers
        if isinstance(worker, dict)
    )
    if total_due is not None and abs(worker_total - total_due) > Decimal("0.01"):
        messages.append(
            _message(
                "W9602",
                field="totals.total_due",
                details={"workers_total": str(worker_total), "declared_total": str(total_due)},
            )
        )

    metadata = _json_load(source.file_metadata, {})
    missing = [key for key in ("settlement_id", "format", "worker_count", "total_due") if metadata.get(key) in (None, "")]
    if missing:
        messages.append(_message("W9606", field="metadata", details={"missing": missing}))
    if attempt_number > 1:
        messages.append(_message("W9604", field="attempt_number", details={"attempt_number": attempt_number}))
    return messages


def determine_result(messages: list[dict[str, Any]]) -> tuple[CommunicationSubmissionStatus, str, str]:
    first_error = next((item for item in messages if item.get("severity") == "ERROR"), None)
    if first_error:
        return CommunicationSubmissionStatus.REJECTED, first_error["code"], first_error["message"]
    first_warning = next((item for item in messages if item.get("severity") == "WARNING"), None)
    if first_warning:
        return CommunicationSubmissionStatus.ACCEPTED_WITH_WARNINGS, first_warning["code"], first_warning["message"]
    return CommunicationSubmissionStatus.ACCEPTED, "A0000", RESPONSE_CODES["A0000"]["message"]


def _counts(messages: list[dict[str, Any]]) -> tuple[int, int]:
    return (
        sum(item.get("severity") == "ERROR" for item in messages),
        sum(item.get("severity") == "WARNING" for item in messages),
    )


def _ensure_source_can_create_submission(db: Session, source: CommunicationFile) -> None:
    if source.file_type != CommunicationFileType.SOCIAL_SECURITY_SETTLEMENT.value:
        raise SiltraSimulationDomainError(RESPONSE_CODES["R9509"]["message"])
    if source.status not in SOURCE_SENDABLE_STATUSES:
        raise SiltraSimulationDomainError(RESPONSE_CODES["R9512"]["message"])
    if not source.content or not source.content.strip():
        raise SiltraSimulationDomainError("El fichero no contiene datos para transmitir.")
    active = (
        db.query(CommunicationSubmission)
        .filter(
            CommunicationSubmission.communication_file_id == source.id,
            CommunicationSubmission.status.in_(ACTIVE_STATUSES),
        )
        .first()
    )
    if active:
        raise SiltraSimulationDomainError(f"Ya existe un intento activo ({active.submission_number}) para este fichero.")


def create_submission(
    db: Session,
    communication_file_id: int,
    *,
    created_by: int | None = None,
    commit: bool = True,
) -> CommunicationSubmission:
    source = (
        db.query(CommunicationFile)
        .filter(CommunicationFile.id == communication_file_id)
        .with_for_update()
        .first()
    )
    if not source:
        raise SiltraSimulationDomainError("Fichero de comunicación no encontrado.")
    _ensure_source_can_create_submission(db, source)
    submission = CommunicationSubmission(
        communication_file_id=source.id,
        company_id=source.company_id,
        submission_number=generate_submission_number(db),
        attempt_number=next_attempt_number(db, source.id),
        status=CommunicationSubmissionStatus.PENDING.value,
        created_by=created_by,
    )
    db.add(submission)
    db.flush()
    _record_source_event(
        db,
        source,
        from_status=source.status,
        to_status=source.status,
        message=f"Intento {submission.submission_number} creado y pendiente de envío.",
        details={
            "submission_id": submission.id,
            "submission_number": submission.submission_number,
            "attempt_number": submission.attempt_number,
        },
        created_by=created_by,
    )
    if commit:
        db.commit()
        db.refresh(submission)
    return submission


def send_submission(
    db: Session,
    submission: CommunicationSubmission,
    *,
    created_by: int | None = None,
    commit: bool = True,
) -> CommunicationSubmission:
    if submission.status != CommunicationSubmissionStatus.PENDING.value:
        raise SiltraSimulationDomainError("Solo puede enviarse un intento en estado PENDING.")
    source = submission.source_file
    if not source:
        raise SiltraSimulationDomainError("El fichero de origen ya no existe.")
    now = datetime.utcnow()
    previous = source.status
    submission.status = CommunicationSubmissionStatus.SENT.value
    submission.submitted_at = now
    if created_by is not None and submission.created_by is None:
        submission.created_by = created_by
    source.status = CommunicationFileStatus.SENT.value
    source.submitted_at = now
    _record_source_event(
        db,
        source,
        from_status=previous,
        to_status=source.status,
        message=f"Fichero transmitido a SILTRA simulado ({submission.submission_number}).",
        details={"submission_id": submission.id, "attempt_number": submission.attempt_number},
        created_by=created_by or submission.created_by,
    )
    if commit:
        db.commit()
        db.refresh(submission)
    return submission


def _build_response_file(
    db: Session,
    source: CommunicationFile,
    submission: CommunicationSubmission,
    result: CommunicationSubmissionStatus,
    response_code: str,
    messages: list[dict[str, Any]],
    processed_at: datetime,
) -> CommunicationFile:
    errors, warnings = _counts(messages)
    payload = {
        "format": "AULANOMINA_SILTRA_RESPONSE_V1",
        "educational_simulation": True,
        "submission_number": submission.submission_number,
        "attempt_number": submission.attempt_number,
        "source_file_id": source.id,
        "source_filename": source.original_filename,
        "company_id": source.company_id,
        "ccc_id": source.ccc_id,
        "period": source.period,
        "result": result.value,
        "response_code": response_code,
        "processed_at": processed_at.isoformat(),
        "messages": messages,
    }
    response = CommunicationFile(
        company_id=source.company_id,
        ccc_id=source.ccc_id,
        period=source.period,
        file_type=CommunicationFileType.SILTRA_RESPONSE.value,
        status=CommunicationFileStatus.GENERATED.value,
        generated_at=processed_at,
        original_filename=f"SILTRA-RESP-{submission.submission_number}.json",
        content=json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        file_metadata=_json_dump(
            {
                "submission_id": submission.id,
                "submission_number": submission.submission_number,
                "attempt_number": submission.attempt_number,
                "source_file_id": source.id,
                "result": result.value,
                "message_count": len(messages),
                "error_count": errors,
                "warning_count": warnings,
                "educational_simulation": True,
            }
        ),
        validation_errors="[]",
        created_by=submission.created_by,
    )
    db.add(response)
    db.flush()
    db.add(
        CommunicationFileEvent(
            communication_file=response,
            event_type=CommunicationEventType.GENERATED.value,
            from_status=None,
            to_status=CommunicationFileStatus.GENERATED.value,
            message="Respuesta educativa de SILTRA simulado generada.",
            details=_json_dump({"submission_id": submission.id, "source_file_id": source.id}),
            created_by=submission.created_by,
        )
    )
    return response


def process_submission(
    db: Session,
    submission: CommunicationSubmission,
    *,
    created_by: int | None = None,
    commit: bool = True,
) -> CommunicationSubmission:
    if submission.status != CommunicationSubmissionStatus.SENT.value:
        raise SiltraSimulationDomainError("Solo puede procesarse un intento en estado SENT.")
    source = submission.source_file
    if not source:
        raise SiltraSimulationDomainError("El fichero de origen ya no existe.")

    submission.status = CommunicationSubmissionStatus.PROCESSING.value
    submission.processing_started_at = datetime.utcnow()
    previous = source.status
    source.status = CommunicationFileStatus.PROCESSING.value
    _record_source_event(
        db,
        source,
        from_status=previous,
        to_status=source.status,
        message=f"Procesamiento iniciado para {submission.submission_number}.",
        details={"submission_id": submission.id},
        created_by=created_by or submission.created_by,
    )
    db.flush()

    company = db.query(Company).filter(Company.id == source.company_id).first()
    messages = analyze_communication_content(
        source,
        company_exists=company is not None,
        ccc_belongs_to_company=bool(company and normalize_ccc(source.ccc_id) in _company_cccs(db, company)),
        attempt_number=submission.attempt_number,
    )
    result, response_code, response_message = determine_result(messages)
    processed_at = datetime.utcnow()
    response = _build_response_file(db, source, submission, result, response_code, messages, processed_at)

    submission.status = result.value
    submission.processed_at = processed_at
    submission.response_code = response_code
    submission.response_message = response_message
    submission.response_file_id = response.id
    submission.messages = _json_dump(messages)

    source.status = result.value
    source.processed_at = processed_at
    source.response_code = response_code
    source.response_message = response_message
    source.response_file_id = response.id
    metadata = _json_load(source.file_metadata, {})
    metadata.update(
        {
            "last_submission_id": submission.id,
            "last_submission_number": submission.submission_number,
            "last_submission_result": result.value,
            "last_submission_attempt": submission.attempt_number,
        }
    )
    source.file_metadata = _json_dump(metadata)
    _record_source_event(
        db,
        source,
        from_status=CommunicationFileStatus.PROCESSING.value,
        to_status=source.status,
        message=f"Resultado {result.value}: {response_code} · {response_message}",
        details={
            "submission_id": submission.id,
            "submission_number": submission.submission_number,
            "attempt_number": submission.attempt_number,
            "response_code": response_code,
            "response_file_id": response.id,
            "message_count": len(messages),
        },
        created_by=created_by or submission.created_by,
        response_linked=True,
    )
    if commit:
        db.commit()
        db.refresh(submission)
    return submission


def submit_communication_file(
    db: Session,
    communication_file_id: int,
    *,
    created_by: int | None = None,
) -> CommunicationSubmission:
    try:
        submission = create_submission(db, communication_file_id, created_by=created_by, commit=False)
        send_submission(db, submission, created_by=created_by, commit=False)
        process_submission(db, submission, created_by=created_by, commit=False)
        db.commit()
        db.refresh(submission)
        return submission
    except Exception:
        db.rollback()
        raise


def cancel_submission(
    db: Session,
    submission: CommunicationSubmission,
    *,
    created_by: int | None = None,
) -> CommunicationSubmission:
    if submission.status not in {
        CommunicationSubmissionStatus.PENDING.value,
        CommunicationSubmissionStatus.SENT.value,
    }:
        raise SiltraSimulationDomainError("Solo pueden cancelarse intentos PENDING o SENT.")
    source = submission.source_file
    was_sent = submission.status == CommunicationSubmissionStatus.SENT.value
    submission.status = CommunicationSubmissionStatus.CANCELLED.value
    submission.processed_at = datetime.utcnow()
    if source and was_sent:
        previous = source.status
        source.status = CommunicationFileStatus.GENERATED.value
        source.submitted_at = None
        _record_source_event(
            db,
            source,
            from_status=previous,
            to_status=source.status,
            message=f"Intento {submission.submission_number} cancelado; fichero disponible de nuevo.",
            details={"submission_id": submission.id},
            created_by=created_by or submission.created_by,
        )
    db.commit()
    db.refresh(submission)
    return submission


def get_submission(db: Session, submission_id: int) -> CommunicationSubmission | None:
    return db.query(CommunicationSubmission).filter(CommunicationSubmission.id == submission_id).first()


def list_submissions(
    db: Session,
    *,
    company_id: int | None = None,
    communication_file_id: int | None = None,
    status: CommunicationSubmissionStatus | None = None,
    period: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[CommunicationSubmission], int]:
    query = db.query(CommunicationSubmission).join(
        CommunicationFile,
        CommunicationSubmission.communication_file_id == CommunicationFile.id,
    )
    if company_id is not None:
        query = query.filter(CommunicationSubmission.company_id == company_id)
    if communication_file_id is not None:
        query = query.filter(CommunicationSubmission.communication_file_id == communication_file_id)
    if status is not None:
        query = query.filter(CommunicationSubmission.status == status.value)
    if period:
        query = query.filter(CommunicationFile.period == period.strip().upper())
    total = query.count()
    items = (
        query.order_by(CommunicationSubmission.created_at.desc(), CommunicationSubmission.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total


def serialize_submission(submission: CommunicationSubmission) -> dict[str, Any]:
    messages = _json_load(submission.messages, [])
    errors, warnings = _counts(messages)
    return {
        "id": submission.id,
        "communication_file_id": submission.communication_file_id,
        "company_id": submission.company_id,
        "submission_number": submission.submission_number,
        "attempt_number": submission.attempt_number,
        "status": submission.status,
        "submitted_at": submission.submitted_at,
        "processing_started_at": submission.processing_started_at,
        "processed_at": submission.processed_at,
        "response_code": submission.response_code,
        "response_message": submission.response_message,
        "response_file_id": submission.response_file_id,
        "created_by": submission.created_by,
        "created_at": submission.created_at,
        "updated_at": submission.updated_at,
        "error_count": errors,
        "warning_count": warnings,
        "message_count": len(messages),
    }


def serialize_submission_detail(submission: CommunicationSubmission) -> dict[str, Any]:
    source = submission.source_file
    if not source:
        raise SiltraSimulationDomainError("El fichero de origen ya no existe.")
    payload = serialize_submission(submission)
    metadata = _json_load(source.file_metadata, {})
    payload.update(
        {
            "source_file": serialize_communication_file(source),
            "response_file": serialize_communication_file(submission.response_file) if submission.response_file else None,
            "messages": _json_load(submission.messages, []),
            "history": [
                serialize_communication_event(event)
                for event in source.events
                if _json_load(event.details, {}).get("submission_id") == submission.id
            ],
            "settlement_id": metadata.get("settlement_id"),
            "company_name": getattr(submission.company, "name", None),
        }
    )
    return payload
