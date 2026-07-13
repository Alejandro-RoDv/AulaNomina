import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.communication_file import CommunicationFile, CommunicationFileEvent
from app.models.company import Company
from app.models.work_center import WorkCenter
from app.schemas.communication_file import (
    CommunicationFileCreate,
    CommunicationFileGenerateRequest,
    CommunicationFileTransitionRequest,
    CommunicationFileUpdate,
)
from app.services.communication_file_workflow import (
    CommunicationEventType,
    CommunicationFileStatus,
    CommunicationFileType,
    ccc_is_required,
    normalize_ccc,
    period_is_valid,
    validate_transition,
)


class CommunicationFileDomainError(ValueError):
    pass


EDITABLE_STATUSES = {
    CommunicationFileStatus.DRAFT.value,
    CommunicationFileStatus.VALIDATION_ERROR.value,
    CommunicationFileStatus.REJECTED.value,
}


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _json_load(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return fallback
    return parsed


def serialize_communication_file(item: CommunicationFile) -> dict[str, Any]:
    return {
        "id": item.id,
        "company_id": item.company_id,
        "ccc_id": item.ccc_id,
        "period": item.period,
        "file_type": item.file_type,
        "status": item.status,
        "generated_at": item.generated_at,
        "submitted_at": item.submitted_at,
        "processed_at": item.processed_at,
        "original_filename": item.original_filename,
        "content": item.content,
        "metadata": _json_load(item.file_metadata, {}),
        "validation_errors": _json_load(item.validation_errors, []),
        "response_code": item.response_code,
        "response_message": item.response_message,
        "response_file_id": item.response_file_id,
        "created_by": item.created_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def serialize_communication_event(item: CommunicationFileEvent) -> dict[str, Any]:
    return {
        "id": item.id,
        "communication_file_id": item.communication_file_id,
        "event_type": item.event_type,
        "from_status": item.from_status,
        "to_status": item.to_status,
        "message": item.message,
        "details": _json_load(item.details, {}),
        "created_by": item.created_by,
        "created_at": item.created_at,
    }


def _record_event(
    db: Session,
    item: CommunicationFile,
    event_type: CommunicationEventType,
    *,
    from_status: str | None = None,
    to_status: str | None = None,
    message: str | None = None,
    details: dict[str, Any] | None = None,
    created_by: int | None = None,
) -> CommunicationFileEvent:
    event = CommunicationFileEvent(
        communication_file=item,
        event_type=event_type.value,
        from_status=from_status,
        to_status=to_status,
        message=message,
        details=_json_dump(details or {}),
        created_by=created_by,
    )
    db.add(event)
    return event


def _ensure_company(db: Session, company_id: int) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise CommunicationFileDomainError("Empresa no encontrada")
    return company


def _company_cccs(db: Session, company: Company) -> set[str]:
    values = {normalize_ccc(company.ccc)}
    centers = db.query(WorkCenter).filter(WorkCenter.company_id == company.id).all()
    for center in centers:
        values.add(normalize_ccc(center.general_ccc))
        values.add(normalize_ccc(center.main_ccc))
    return {value for value in values if value}


def _build_validation_errors(db: Session, item: CommunicationFile) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    company = db.query(Company).filter(Company.id == item.company_id).first()
    if not company:
        errors.append({
            "field": "company_id",
            "code": "COMPANY_NOT_FOUND",
            "message": "La empresa asociada no existe.",
        })
        return errors

    file_type = CommunicationFileType(item.file_type)
    if not period_is_valid(file_type, item.period):
        expected = "AAAA para 190; AAAA-MM o AAAA-Qn para 111; AAAA-MM para el resto"
        errors.append({
            "field": "period",
            "code": "INVALID_PERIOD",
            "message": f"Periodo no válido. Formatos admitidos: {expected}.",
        })

    normalized_ccc = normalize_ccc(item.ccc_id)
    if ccc_is_required(file_type) and not normalized_ccc:
        errors.append({
            "field": "ccc_id",
            "code": "CCC_REQUIRED",
            "message": "El tipo de comunicación requiere un CCC.",
        })
    elif normalized_ccc and normalized_ccc not in _company_cccs(db, company):
        errors.append({
            "field": "ccc_id",
            "code": "CCC_NOT_IN_COMPANY",
            "message": "El CCC no pertenece a la empresa ni a sus centros de trabajo.",
        })

    return errors


def create_communication_file(db: Session, payload: CommunicationFileCreate) -> CommunicationFile:
    _ensure_company(db, payload.company_id)
    item = CommunicationFile(
        company_id=payload.company_id,
        ccc_id=normalize_ccc(payload.ccc_id),
        period=payload.period,
        file_type=payload.file_type.value,
        status=CommunicationFileStatus.DRAFT.value,
        original_filename=payload.original_filename,
        content=payload.content,
        file_metadata=_json_dump(payload.metadata),
        validation_errors="[]",
        created_by=payload.created_by,
    )
    db.add(item)
    db.flush()
    _record_event(
        db,
        item,
        CommunicationEventType.CREATED,
        to_status=item.status,
        message="Comunicación creada como borrador.",
        created_by=payload.created_by,
    )
    db.commit()
    db.refresh(item)
    return item


def get_communication_file(db: Session, communication_file_id: int) -> CommunicationFile | None:
    return db.query(CommunicationFile).filter(CommunicationFile.id == communication_file_id).first()


def get_communication_files(
    db: Session,
    *,
    company_id: int | None = None,
    ccc_id: str | None = None,
    period: str | None = None,
    file_type: CommunicationFileType | None = None,
    status: CommunicationFileStatus | None = None,
) -> list[CommunicationFile]:
    query = db.query(CommunicationFile)
    if company_id is not None:
        query = query.filter(CommunicationFile.company_id == company_id)
    if ccc_id is not None:
        query = query.filter(CommunicationFile.ccc_id == normalize_ccc(ccc_id))
    if period is not None:
        query = query.filter(CommunicationFile.period == period.strip().upper())
    if file_type is not None:
        query = query.filter(CommunicationFile.file_type == file_type.value)
    if status is not None:
        query = query.filter(CommunicationFile.status == status.value)
    return query.order_by(CommunicationFile.created_at.desc(), CommunicationFile.id.desc()).all()


def update_communication_file(
    db: Session,
    item: CommunicationFile,
    payload: CommunicationFileUpdate,
) -> CommunicationFile:
    if item.status not in EDITABLE_STATUSES:
        raise CommunicationFileDomainError(
            f"La comunicación no puede editarse en estado {item.status}."
        )

    changes = payload.model_dump(exclude_unset=True)
    actor = changes.pop("created_by", None)
    if "ccc_id" in changes:
        changes["ccc_id"] = normalize_ccc(changes["ccc_id"])
    if "file_type" in changes and changes["file_type"] is not None:
        changes["file_type"] = changes["file_type"].value
    if "metadata" in changes:
        item.file_metadata = _json_dump(changes.pop("metadata") or {})

    for field, value in changes.items():
        setattr(item, field, value)

    previous_status = item.status
    if item.status in {
        CommunicationFileStatus.VALIDATION_ERROR.value,
        CommunicationFileStatus.REJECTED.value,
    }:
        item.status = CommunicationFileStatus.DRAFT.value
        item.validation_errors = "[]"
        item.response_code = None
        item.response_message = None
        item.processed_at = None

    _record_event(
        db,
        item,
        CommunicationEventType.UPDATED,
        from_status=previous_status,
        to_status=item.status,
        message="Datos de la comunicación actualizados.",
        details={"updated_fields": sorted(changes.keys())},
        created_by=actor,
    )
    db.commit()
    db.refresh(item)
    return item


def validate_communication_file(
    db: Session,
    item: CommunicationFile,
    *,
    created_by: int | None = None,
) -> CommunicationFile:
    if item.status not in {
        CommunicationFileStatus.DRAFT.value,
        CommunicationFileStatus.VALIDATION_ERROR.value,
    }:
        raise CommunicationFileDomainError(
            f"No se puede validar una comunicación en estado {item.status}."
        )

    previous_status = item.status
    item.status = CommunicationFileStatus.VALIDATING.value
    _record_event(
        db,
        item,
        CommunicationEventType.STATUS_CHANGED,
        from_status=previous_status,
        to_status=item.status,
        message="Validación iniciada.",
        created_by=created_by,
    )
    db.flush()

    errors = _build_validation_errors(db, item)
    item.validation_errors = _json_dump(errors)
    from_status = item.status
    if errors:
        item.status = CommunicationFileStatus.VALIDATION_ERROR.value
        event_type = CommunicationEventType.VALIDATION_FAILED
        message = "La comunicación contiene errores de validación."
    else:
        item.status = CommunicationFileStatus.READY.value
        event_type = CommunicationEventType.VALIDATED
        message = "Comunicación validada y preparada para generar."

    _record_event(
        db,
        item,
        event_type,
        from_status=from_status,
        to_status=item.status,
        message=message,
        details={"validation_errors": errors},
        created_by=created_by,
    )
    db.commit()
    db.refresh(item)
    return item


def generate_communication_file(
    db: Session,
    item: CommunicationFile,
    payload: CommunicationFileGenerateRequest,
) -> CommunicationFile:
    validate_transition(item.status, CommunicationFileStatus.GENERATED)
    previous_status = item.status
    item.content = payload.content
    item.original_filename = payload.original_filename
    current_metadata = _json_load(item.file_metadata, {})
    current_metadata.update(payload.metadata)
    item.file_metadata = _json_dump(current_metadata)
    item.generated_at = datetime.utcnow()
    item.status = CommunicationFileStatus.GENERATED.value
    item.validation_errors = "[]"

    _record_event(
        db,
        item,
        CommunicationEventType.GENERATED,
        from_status=previous_status,
        to_status=item.status,
        message="Fichero generado y pendiente de envío.",
        details={"original_filename": item.original_filename},
        created_by=payload.created_by,
    )
    db.commit()
    db.refresh(item)
    return item


def transition_communication_file(
    db: Session,
    item: CommunicationFile,
    payload: CommunicationFileTransitionRequest,
) -> CommunicationFile:
    managed_by_dedicated_endpoints = {
        CommunicationFileStatus.VALIDATING,
        CommunicationFileStatus.VALIDATION_ERROR,
        CommunicationFileStatus.READY,
        CommunicationFileStatus.GENERATED,
    }
    if payload.status in managed_by_dedicated_endpoints:
        raise CommunicationFileDomainError(
            "Los estados de validación y generación deben alcanzarse mediante sus endpoints específicos."
        )

    validate_transition(item.status, payload.status)
    previous_status = item.status

    if payload.response_file_id is not None:
        if payload.response_file_id == item.id:
            raise CommunicationFileDomainError("Un fichero no puede ser su propia respuesta.")
        response_file = get_communication_file(db, payload.response_file_id)
        if not response_file:
            raise CommunicationFileDomainError("Fichero de respuesta no encontrado.")
        item.response_file_id = response_file.id

    item.status = payload.status.value
    item.response_code = payload.response_code
    item.response_message = payload.response_message

    current_metadata = _json_load(item.file_metadata, {})
    current_metadata.update(payload.metadata)
    item.file_metadata = _json_dump(current_metadata)

    now = datetime.utcnow()
    if payload.status == CommunicationFileStatus.SENT:
        item.submitted_at = now
    if payload.status in {
        CommunicationFileStatus.ACCEPTED,
        CommunicationFileStatus.ACCEPTED_WITH_WARNINGS,
        CommunicationFileStatus.REJECTED,
    }:
        item.processed_at = now

    event_type = (
        CommunicationEventType.RESPONSE_LINKED
        if payload.response_file_id is not None
        else CommunicationEventType.STATUS_CHANGED
    )
    _record_event(
        db,
        item,
        event_type,
        from_status=previous_status,
        to_status=item.status,
        message=payload.response_message or f"Estado actualizado a {item.status}.",
        details={
            "response_code": payload.response_code,
            "response_file_id": payload.response_file_id,
            "metadata": payload.metadata,
        },
        created_by=payload.created_by,
    )
    db.commit()
    db.refresh(item)
    return item


def get_communication_file_events(
    db: Session,
    communication_file_id: int,
) -> list[CommunicationFileEvent]:
    return (
        db.query(CommunicationFileEvent)
        .filter(CommunicationFileEvent.communication_file_id == communication_file_id)
        .order_by(CommunicationFileEvent.created_at.asc(), CommunicationFileEvent.id.asc())
        .all()
    )
