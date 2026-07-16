import json
import re
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.crud.communication_file import serialize_communication_event, serialize_communication_file
from app.models.affiliation_worker_state import AffiliationWorkerState
from app.models.communication_file import CommunicationFile, CommunicationFileEvent
from app.models.communication_submission import CommunicationSubmission
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.social_security_registration import SocialSecurityRegistration
from app.models.work_center import WorkCenter
from app.services.communication_file_workflow import (
    CommunicationEventType,
    CommunicationFileStatus,
    CommunicationFileType,
    normalize_ccc,
)
from app.services.siltra_response_codes import CommunicationSubmissionStatus
from app.services.siltra_simulation_service import generate_submission_number, next_attempt_number


class AffiliationRemittanceDomainError(ValueError):
    pass


MOVEMENT_TYPES = {"ALTA", "MODIFICACION", "BAJA"}
EDITABLE_STATUSES = {
    CommunicationFileStatus.DRAFT.value,
    CommunicationFileStatus.READY.value,
    CommunicationFileStatus.GENERATED.value,
    CommunicationFileStatus.VALIDATION_ERROR.value,
    CommunicationFileStatus.REJECTED.value,
}
SENDABLE_STATUSES = {
    CommunicationFileStatus.GENERATED.value,
    CommunicationFileStatus.ACCEPTED.value,
    CommunicationFileStatus.ACCEPTED_WITH_WARNINGS.value,
    CommunicationFileStatus.REJECTED.value,
}
ACTIVE_SUBMISSION_STATUSES = {
    CommunicationSubmissionStatus.PENDING.value,
    CommunicationSubmissionStatus.SENT.value,
    CommunicationSubmissionStatus.PROCESSING.value,
}

AFFILIATION_CODES: dict[str, dict[str, str]] = {
    "A0001": {"severity": "INFO", "message": "Fichero de afiliación aceptado y movimientos registrados."},
    "R9701": {"severity": "ERROR", "message": "El documento identificativo no es válido."},
    "R9702": {"severity": "ERROR", "message": "El NAF debe contener 12 dígitos."},
    "R9703": {"severity": "ERROR", "message": "El CCC debe contener 11 dígitos y pertenecer a la empresa."},
    "R9704": {"severity": "ERROR", "message": "El trabajador ya consta de alta en este CCC."},
    "R9705": {"severity": "ERROR", "message": "No puede tramitarse la baja porque el trabajador no consta de alta."},
    "R9706": {"severity": "ERROR", "message": "No puede modificarse la afiliación de un trabajador que no consta de alta."},
    "R9707": {"severity": "ERROR", "message": "Faltan datos esenciales en el movimiento de afiliación."},
    "R9708": {"severity": "ERROR", "message": "El fichero no contiene movimientos de afiliación."},
    "R9709": {"severity": "ERROR", "message": "El movimiento ya fue procesado o está duplicado en la remesa."},
    "R9710": {"severity": "ERROR", "message": "El tipo o la fecha del movimiento no coincide con la información laboral."},
}

AFFILIATION_RECOMMENDATIONS = {
    "R9701": "Corrija el DNI o NIE en la ficha del trabajador y regenere la remesa.",
    "R9702": "Complete el NAF con sus 12 dígitos antes de repetir el envío.",
    "R9703": "Revise el CCC de la empresa o del centro de trabajo asociado al contrato.",
    "R9704": "Compruebe el estado externo simulado; utilice una modificación si la relación ya está activa.",
    "R9705": "Tramite primero un alta aceptada en el mismo CCC o revise la empresa y el centro del contrato.",
    "R9706": "La modificación exige una relación de afiliación activa en el mismo CCC.",
    "R9707": "Complete empresa, trabajador, contrato, fecha, documento, NAF y CCC.",
    "R9708": "Cargue al menos un alta, modificación o baja en el borrador.",
    "R9709": "Retire el duplicado o consulte el historial del trabajador antes de reenviar.",
    "R9710": "Actualice el contrato o el alta de Seguridad Social y vuelva a cargar el movimiento.",
}

DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _json_load(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _digits(value: Any) -> str:
    return "".join(character for character in str(value or "") if character.isdigit())


def _employee_name(employee: Employee | None) -> str:
    if not employee:
        return "Trabajador desconocido"
    return " ".join(
        part.strip()
        for part in (employee.first_name, employee.last_name, employee.second_last_name)
        if part and part.strip()
    )


def _resolve_ccc(contract: Contract) -> str | None:
    center = contract.work_center
    company = contract.company
    return (
        getattr(center, "main_ccc", None)
        or getattr(center, "general_ccc", None)
        or getattr(company, "ccc", None)
    )


def _movement_key(movement_type: str, contract_id: int, effective_date: date) -> str:
    prefix = {"ALTA": "A", "MODIFICACION": "M", "BAJA": "B"}[movement_type]
    return f"{prefix}:{contract_id}:{effective_date.isoformat()}"


def _parse_movement_key(value: str) -> tuple[str, int, date]:
    try:
        prefix, contract_id, raw_date = value.split(":", 2)
        movement_type = {"A": "ALTA", "M": "MODIFICACION", "B": "BAJA"}[prefix.upper()]
        return movement_type, int(contract_id), date.fromisoformat(raw_date)
    except (KeyError, TypeError, ValueError) as error:
        raise AffiliationRemittanceDomainError(f"Movimiento no válido: {value}") from error


def _contract_query(db: Session):
    return db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
        joinedload(Contract.work_center),
        joinedload(Contract.collective_agreement),
        joinedload(Contract.ss_registration),
    )


def _infer_external_status(contract: Contract, effective_date: date) -> str:
    started_before = bool(contract.start_date and contract.start_date < effective_date)
    not_ended_before = not contract.end_date or contract.end_date >= effective_date
    return "ACTIVE" if started_before and not_ended_before else "INACTIVE"


def _current_external_status(db: Session, contract: Contract, ccc: str | None, effective_date: date) -> str:
    normalized_ccc = normalize_ccc(ccc)
    if normalized_ccc:
        state = (
            db.query(AffiliationWorkerState)
            .filter(
                AffiliationWorkerState.employee_id == contract.employee_id,
                AffiliationWorkerState.ccc == normalized_ccc,
            )
            .first()
        )
        if state:
            return state.status
    return _infer_external_status(contract, effective_date)


def _candidate_from_contract(
    db: Session,
    contract: Contract,
    movement_type: str,
    effective_date: date,
) -> dict[str, Any]:
    employee = contract.employee
    company = contract.company
    center = contract.work_center
    agreement = contract.collective_agreement
    if not employee or not company:
        raise AffiliationRemittanceDomainError(
            f"El contrato {contract.id} no tiene trabajador o empresa asociados."
        )
    ccc = _resolve_ccc(contract)
    reason = {
        "ALTA": "Inicio del contrato",
        "BAJA": contract.termination_reason or "Fin del contrato",
        "MODIFICACION": "Actualización de datos RED / Seguridad Social",
    }[movement_type]
    return {
        "movement_key": _movement_key(movement_type, contract.id, effective_date),
        "movement_type": movement_type,
        "effective_date": effective_date.isoformat(),
        "reason": reason,
        "contract_id": contract.id,
        "employee_id": employee.id,
        "employee_name": _employee_name(employee),
        "company_id": company.id,
        "company_name": company.name,
        "center_id": center.id if center else None,
        "center_name": center.name if center else None,
        "collective_agreement_id": contract.collective_agreement_id,
        "collective_agreement_name": agreement.name if agreement else contract.collective_agreement_code,
        "dni": employee.dni,
        "naf": employee.naf,
        "ccc": ccc,
        "contribution_group": (
            getattr(contract.ss_registration, "contribution_group", None)
            or contract.contribution_group
        ),
        "contract_code": contract.contract_code or contract.contract_type,
        "current_external_status": _current_external_status(db, contract, ccc, effective_date),
    }


def _candidate_from_key(db: Session, movement_key: str) -> dict[str, Any]:
    movement_type, contract_id, effective_date = _parse_movement_key(movement_key)
    contract = _contract_query(db).filter(Contract.id == contract_id).first()
    if not contract:
        raise AffiliationRemittanceDomainError(f"Contrato no encontrado para {movement_key}.")

    valid = False
    if movement_type == "ALTA":
        valid = contract.start_date == effective_date
    elif movement_type == "BAJA":
        valid = contract.end_date == effective_date
    elif movement_type == "MODIFICACION":
        updated_at = getattr(contract.ss_registration, "updated_at", None)
        valid = bool(updated_at and updated_at.date() == effective_date)
    if not valid:
        raise AffiliationRemittanceDomainError(AFFILIATION_CODES["R9710"]["message"])
    return _candidate_from_contract(db, contract, movement_type, effective_date)


def list_candidates(
    db: Session,
    *,
    date_from: date,
    date_to: date,
    movement_type: str | None = None,
    company_id: int | None = None,
    collective_agreement_id: int | None = None,
    employee_id: int | None = None,
) -> list[dict[str, Any]]:
    if date_to < date_from:
        raise AffiliationRemittanceDomainError("La fecha final no puede ser anterior a la inicial.")
    normalized_type = (movement_type or "").strip().upper() or None
    if normalized_type and normalized_type not in MOVEMENT_TYPES:
        raise AffiliationRemittanceDomainError("Tipo de movimiento no válido.")

    query = _contract_query(db).outerjoin(
        SocialSecurityRegistration,
        SocialSecurityRegistration.contract_id == Contract.id,
    )
    if company_id is not None:
        query = query.filter(Contract.company_id == company_id)
    if collective_agreement_id is not None:
        query = query.filter(Contract.collective_agreement_id == collective_agreement_id)
    if employee_id is not None:
        query = query.filter(Contract.employee_id == employee_id)

    date_conditions = []
    if normalized_type in (None, "ALTA"):
        date_conditions.append(Contract.start_date.between(date_from, date_to))
    if normalized_type in (None, "BAJA"):
        date_conditions.append(Contract.end_date.between(date_from, date_to))
    if normalized_type in (None, "MODIFICACION"):
        date_conditions.append(func.date(SocialSecurityRegistration.updated_at).between(date_from, date_to))
    query = query.filter(or_(*date_conditions))

    candidates: list[dict[str, Any]] = []
    for contract in query.order_by(Contract.start_date, Contract.id).all():
        if normalized_type in (None, "ALTA") and contract.start_date and date_from <= contract.start_date <= date_to:
            candidates.append(_candidate_from_contract(db, contract, "ALTA", contract.start_date))
        if normalized_type in (None, "MODIFICACION"):
            updated_at = getattr(contract.ss_registration, "updated_at", None)
            if updated_at and date_from <= updated_at.date() <= date_to:
                candidates.append(_candidate_from_contract(db, contract, "MODIFICACION", updated_at.date()))
        if normalized_type in (None, "BAJA") and contract.end_date and date_from <= contract.end_date <= date_to:
            candidates.append(_candidate_from_contract(db, contract, "BAJA", contract.end_date))

    order = {"ALTA": 0, "MODIFICACION": 1, "BAJA": 2}
    candidates.sort(
        key=lambda item: (
            item["effective_date"],
            item["company_name"].lower(),
            item["employee_name"].lower(),
            order[item["movement_type"]],
        )
    )
    return candidates


def _draft_payload(source: CommunicationFile) -> dict[str, Any]:
    payload = _json_load(source.content, {})
    if not isinstance(payload, dict):
        return {}
    if not isinstance(payload.get("movements"), list):
        payload["movements"] = []
    return payload


def _reset_for_edit(source: CommunicationFile) -> None:
    source.status = CommunicationFileStatus.DRAFT.value
    source.generated_at = None
    source.submitted_at = None
    source.processed_at = None
    source.response_code = None
    source.response_message = None
    source.response_file_id = None
    source.validation_errors = "[]"


def _refresh_draft(source: CommunicationFile, payload: dict[str, Any]) -> None:
    movements = payload.get("movements") or []
    dates = sorted(date.fromisoformat(item["effective_date"]) for item in movements)
    company_ids = {item.get("company_id") for item in movements if item.get("company_id") is not None}
    cccs = {normalize_ccc(item.get("ccc")) for item in movements if normalize_ccc(item.get("ccc"))}
    metadata = _json_load(source.file_metadata, {})
    metadata.update(
        {
            "format": "AULANOMINA_AFFILIATION_V1",
            "educational_simulation": True,
            "movement_count": len(movements),
            "company_count": len(company_ids),
            "ccc_count": len(cccs),
            "date_from": dates[0].isoformat() if dates else None,
            "date_to": dates[-1].isoformat() if dates else None,
        }
    )
    payload.update(
        {
            "format": "AULANOMINA_AFFILIATION_V1",
            "educational_simulation": True,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )
    source.content = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    source.file_metadata = _json_dump(metadata)
    if dates:
        source.period = dates[0].strftime("%Y-%m")
    if movements:
        source.company_id = movements[0]["company_id"]


def _record_event(
    db: Session,
    source: CommunicationFile,
    *,
    event_type: str,
    from_status: str | None,
    to_status: str | None,
    message: str,
    details: dict[str, Any] | None = None,
    created_by: int | None = None,
) -> None:
    db.add(
        CommunicationFileEvent(
            communication_file=source,
            event_type=event_type,
            from_status=from_status,
            to_status=to_status,
            message=message,
            details=_json_dump(details or {}),
            created_by=created_by,
        )
    )


def create_draft(
    db: Session,
    movement_keys: list[str],
    *,
    created_by: int | None = None,
) -> CommunicationFile:
    movements = [_candidate_from_key(db, key) for key in dict.fromkeys(movement_keys)]
    if not movements:
        raise AffiliationRemittanceDomainError(AFFILIATION_CODES["R9708"]["message"])
    now = datetime.utcnow()
    source = CommunicationFile(
        company_id=movements[0]["company_id"],
        ccc_id=None,
        period=date.fromisoformat(movements[0]["effective_date"]).strftime("%Y-%m"),
        file_type=CommunicationFileType.AFFILIATION.value,
        status=CommunicationFileStatus.DRAFT.value,
        original_filename=f"BORRADOR_AFI_{now:%Y%m%d_%H%M%S}.json",
        content="{}",
        file_metadata="{}",
        validation_errors="[]",
        created_by=created_by,
    )
    db.add(source)
    db.flush()
    payload = {
        "format": "AULANOMINA_AFFILIATION_V1",
        "educational_simulation": True,
        "draft_id": source.id,
        "created_at": now.isoformat(),
        "movements": movements,
    }
    _refresh_draft(source, payload)
    _record_event(
        db,
        source,
        event_type=CommunicationEventType.CREATED.value,
        from_status=None,
        to_status=source.status,
        message=f"Borrador de afiliación creado con {len(movements)} movimientos.",
        details={"movement_keys": [item["movement_key"] for item in movements]},
        created_by=created_by,
    )
    db.commit()
    db.refresh(source)
    return source


def add_movements(
    db: Session,
    source: CommunicationFile,
    movement_keys: list[str],
    *,
    created_by: int | None = None,
) -> CommunicationFile:
    if source.file_type != CommunicationFileType.AFFILIATION.value:
        raise AffiliationRemittanceDomainError("El fichero no es una remesa de afiliación.")
    if source.status not in EDITABLE_STATUSES:
        raise AffiliationRemittanceDomainError("La remesa no puede editarse mientras está enviada o procesándose.")
    payload = _draft_payload(source)
    existing = {item.get("movement_key"): item for item in payload.get("movements", [])}
    added = []
    for key in dict.fromkeys(movement_keys):
        if key in existing:
            continue
        candidate = _candidate_from_key(db, key)
        existing[key] = candidate
        added.append(key)
    if not added:
        return source
    previous = source.status
    payload["movements"] = list(existing.values())
    _reset_for_edit(source)
    _refresh_draft(source, payload)
    _record_event(
        db,
        source,
        event_type=CommunicationEventType.UPDATED.value,
        from_status=previous,
        to_status=source.status,
        message=f"Se añadieron {len(added)} movimientos al borrador.",
        details={"movement_keys": added},
        created_by=created_by,
    )
    db.commit()
    db.refresh(source)
    return source


def remove_movement(
    db: Session,
    source: CommunicationFile,
    movement_key: str,
    *,
    created_by: int | None = None,
) -> CommunicationFile:
    if source.status not in EDITABLE_STATUSES:
        raise AffiliationRemittanceDomainError("La remesa no puede editarse mientras está enviada o procesándose.")
    payload = _draft_payload(source)
    previous_movements = payload.get("movements", [])
    movements = [item for item in previous_movements if item.get("movement_key") != movement_key]
    if len(movements) == len(previous_movements):
        raise AffiliationRemittanceDomainError("El movimiento no forma parte del borrador.")
    previous = source.status
    payload["movements"] = movements
    _reset_for_edit(source)
    _refresh_draft(source, payload)
    _record_event(
        db,
        source,
        event_type=CommunicationEventType.UPDATED.value,
        from_status=previous,
        to_status=source.status,
        message="Movimiento retirado del borrador.",
        details={"movement_key": movement_key},
        created_by=created_by,
    )
    db.commit()
    db.refresh(source)
    return source


def generate_draft(
    db: Session,
    source: CommunicationFile,
    *,
    created_by: int | None = None,
) -> CommunicationFile:
    if source.file_type != CommunicationFileType.AFFILIATION.value:
        raise AffiliationRemittanceDomainError("El fichero no es una remesa de afiliación.")
    if source.status not in EDITABLE_STATUSES:
        raise AffiliationRemittanceDomainError("La remesa no se encuentra en un estado generable.")
    payload = _draft_payload(source)
    movements = payload.get("movements", [])
    if not movements:
        source.validation_errors = _json_dump(
            [{"code": "R9708", "message": AFFILIATION_CODES["R9708"]["message"]}]
        )
        source.status = CommunicationFileStatus.VALIDATION_ERROR.value
        db.commit()
        raise AffiliationRemittanceDomainError(AFFILIATION_CODES["R9708"]["message"])
    keys = [item.get("movement_key") for item in movements]
    if len(keys) != len(set(keys)):
        raise AffiliationRemittanceDomainError(AFFILIATION_CODES["R9709"]["message"])

    previous = source.status
    now = datetime.utcnow()
    dates = sorted(date.fromisoformat(item["effective_date"]) for item in movements)
    source.status = CommunicationFileStatus.GENERATED.value
    source.generated_at = now
    source.original_filename = (
        f"AFI_{dates[0]:%Y%m%d}_{dates[-1]:%Y%m%d}_{source.id:06d}.json"
    )
    payload["generated_at"] = now.isoformat()
    _refresh_draft(source, payload)
    _record_event(
        db,
        source,
        event_type=CommunicationEventType.GENERATED.value,
        from_status=previous,
        to_status=source.status,
        message=f"Fichero AFI generado con {len(movements)} movimientos.",
        details={"filename": source.original_filename, "movement_count": len(movements)},
        created_by=created_by,
    )
    db.commit()
    db.refresh(source)
    return source


def send_draft(
    db: Session,
    source: CommunicationFile,
    *,
    created_by: int | None = None,
) -> CommunicationSubmission:
    if source.file_type != CommunicationFileType.AFFILIATION.value:
        raise AffiliationRemittanceDomainError("El fichero no es una remesa de afiliación.")
    if source.status not in SENDABLE_STATUSES:
        raise AffiliationRemittanceDomainError("Genere el fichero AFI antes de enviarlo.")
    if not _draft_payload(source).get("movements"):
        raise AffiliationRemittanceDomainError(AFFILIATION_CODES["R9708"]["message"])
    active = (
        db.query(CommunicationSubmission)
        .filter(
            CommunicationSubmission.communication_file_id == source.id,
            CommunicationSubmission.status.in_(ACTIVE_SUBMISSION_STATUSES),
        )
        .first()
    )
    if active:
        raise AffiliationRemittanceDomainError(
            f"Ya existe un envío activo ({active.submission_number}) para esta remesa."
        )

    now = datetime.utcnow()
    previous = source.status
    submission = CommunicationSubmission(
        communication_file_id=source.id,
        company_id=source.company_id,
        submission_number=generate_submission_number(db),
        attempt_number=next_attempt_number(db, source.id),
        status=CommunicationSubmissionStatus.SENT.value,
        submitted_at=now,
        created_by=created_by,
    )
    db.add(submission)
    db.flush()
    source.status = CommunicationFileStatus.SENT.value
    source.submitted_at = now
    _record_event(
        db,
        source,
        event_type=CommunicationEventType.STATUS_CHANGED.value,
        from_status=previous,
        to_status=source.status,
        message=f"Fichero AFI transmitido a SILTRA simulado ({submission.submission_number}).",
        details={"submission_id": submission.id, "attempt_number": submission.attempt_number},
        created_by=created_by,
    )
    db.commit()
    db.refresh(submission)
    return submission


def _valid_identity_document(value: Any) -> bool:
    normalized = re.sub(r"[\s-]", "", str(value or "").upper())
    if re.fullmatch(r"\d{8}[A-Z]", normalized):
        return DNI_LETTERS[int(normalized[:8]) % 23] == normalized[-1]
    if re.fullmatch(r"[XYZ]\d{7}[A-Z]", normalized):
        prefix = {"X": "0", "Y": "1", "Z": "2"}[normalized[0]]
        return DNI_LETTERS[int(prefix + normalized[1:8]) % 23] == normalized[-1]
    return False


def _message(code: str, movement: dict[str, Any] | None = None, **details: Any) -> dict[str, Any]:
    definition = AFFILIATION_CODES[code]
    movement = movement or {}
    return {
        "code": code,
        "severity": definition["severity"],
        "message": definition["message"],
        "employee_id": movement.get("employee_id"),
        "employee_name": movement.get("employee_name"),
        "naf": movement.get("naf"),
        "payroll_id": None,
        "field": details.pop("field", None),
        "details": {"movement_key": movement.get("movement_key"), **details},
        "recommendation": AFFILIATION_RECOMMENDATIONS.get(code),
    }


def _ccc_belongs_to_company(db: Session, company_id: int, ccc: str) -> bool:
    normalized = normalize_ccc(ccc)
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company or not normalized:
        return False
    values = {normalize_ccc(company.ccc)}
    for center in db.query(WorkCenter).filter(WorkCenter.company_id == company_id).all():
        values.update({normalize_ccc(center.main_ccc), normalize_ccc(center.general_ccc)})
    return normalized in {value for value in values if value}


def _initial_state(db: Session, movement: dict[str, Any]) -> dict[str, Any]:
    normalized_ccc = normalize_ccc(movement.get("ccc"))
    state = (
        db.query(AffiliationWorkerState)
        .filter(
            AffiliationWorkerState.employee_id == movement.get("employee_id"),
            AffiliationWorkerState.ccc == normalized_ccc,
        )
        .first()
        if normalized_ccc and movement.get("employee_id")
        else None
    )
    if state:
        return {
            "status": state.status,
            "last_movement_key": state.last_movement_key,
            "model": state,
        }
    contract = db.query(Contract).filter(Contract.id == movement.get("contract_id")).first()
    effective_date = date.fromisoformat(movement["effective_date"])
    return {
        "status": _infer_external_status(contract, effective_date) if contract else "INACTIVE",
        "last_movement_key": None,
        "model": None,
    }


def analyze_affiliation_movements(
    db: Session,
    movements: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not movements:
        return [_message("R9708")]

    messages: list[dict[str, Any]] = []
    seen: set[str] = set()
    projected: dict[tuple[int, str], dict[str, Any]] = {}

    for movement in movements:
        key = str(movement.get("movement_key") or "")
        movement_type = str(movement.get("movement_type") or "").upper()
        required = (
            key,
            movement_type in MOVEMENT_TYPES,
            movement.get("effective_date"),
            movement.get("contract_id"),
            movement.get("employee_id"),
            movement.get("company_id"),
        )
        if not all(required):
            messages.append(_message("R9707", movement, field="movement"))
            continue
        try:
            effective_date = date.fromisoformat(str(movement["effective_date"]))
        except ValueError:
            messages.append(_message("R9710", movement, field="effective_date"))
            continue
        if key in seen:
            messages.append(_message("R9709", movement, field="movement_key"))
            continue
        seen.add(key)

        try:
            key_type, key_contract_id, key_date = _parse_movement_key(key)
        except AffiliationRemittanceDomainError:
            messages.append(_message("R9710", movement, field="movement_key"))
            continue
        if (
            key_type != movement_type
            or key_contract_id != int(movement["contract_id"])
            or key_date != effective_date
        ):
            messages.append(_message("R9710", movement, field="movement_key"))
            continue

        if not _valid_identity_document(movement.get("dni")):
            messages.append(_message("R9701", movement, field="dni"))
        if len(_digits(movement.get("naf"))) != 12:
            messages.append(_message("R9702", movement, field="naf"))
        normalized_ccc = normalize_ccc(movement.get("ccc"))
        if (
            len(_digits(normalized_ccc)) != 11
            or not _ccc_belongs_to_company(db, int(movement["company_id"]), normalized_ccc or "")
        ):
            messages.append(_message("R9703", movement, field="ccc"))
            continue

        state_key = (int(movement["employee_id"]), normalized_ccc)
        current = projected.get(state_key)
        if current is None:
            current = _initial_state(db, movement)
            projected[state_key] = current
        if current.get("last_movement_key") == key:
            messages.append(_message("R9709", movement, field="movement_key"))
            continue

        if movement_type == "ALTA":
            if current["status"] == "ACTIVE":
                messages.append(_message("R9704", movement, field="movement_type"))
                continue
            current["status"] = "ACTIVE"
        elif movement_type == "BAJA":
            if current["status"] != "ACTIVE":
                messages.append(_message("R9705", movement, field="movement_type"))
                continue
            current["status"] = "INACTIVE"
        elif movement_type == "MODIFICACION":
            if current["status"] != "ACTIVE":
                messages.append(_message("R9706", movement, field="movement_type"))
                continue
        current["last_movement_key"] = key

    return messages


def _apply_movements(
    db: Session,
    movements: list[dict[str, Any]],
    submission: CommunicationSubmission,
) -> None:
    for movement in movements:
        normalized_ccc = normalize_ccc(movement.get("ccc"))
        state = (
            db.query(AffiliationWorkerState)
            .filter(
                AffiliationWorkerState.employee_id == int(movement["employee_id"]),
                AffiliationWorkerState.ccc == normalized_ccc,
            )
            .with_for_update()
            .first()
        )
        if not state:
            state = AffiliationWorkerState(
                employee_id=int(movement["employee_id"]),
                company_id=int(movement["company_id"]),
                contract_id=int(movement["contract_id"]),
                ccc=normalized_ccc,
                status="INACTIVE",
            )
            db.add(state)
        movement_type = movement["movement_type"]
        state.company_id = int(movement["company_id"])
        state.contract_id = int(movement["contract_id"])
        state.status = "INACTIVE" if movement_type == "BAJA" else "ACTIVE"
        state.last_movement_type = movement_type
        state.last_movement_date = date.fromisoformat(movement["effective_date"])
        state.last_movement_key = movement["movement_key"]
        state.source_submission_id = submission.id
        state.updated_at = datetime.utcnow()


def _build_response_file(
    db: Session,
    source: CommunicationFile,
    submission: CommunicationSubmission,
    *,
    result: str,
    response_code: str,
    response_message: str,
    messages: list[dict[str, Any]],
    processed_at: datetime,
) -> CommunicationFile:
    payload = {
        "format": "AULANOMINA_SILTRA_AFFILIATION_RESPONSE_V1",
        "educational_simulation": True,
        "submission_number": submission.submission_number,
        "attempt_number": submission.attempt_number,
        "source_file_id": source.id,
        "source_filename": source.original_filename,
        "result": result,
        "response_code": response_code,
        "response_message": response_message,
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
        original_filename=f"SILTRA-AFI-RESP-{submission.submission_number}.json",
        content=json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        file_metadata=_json_dump(
            {
                "submission_id": submission.id,
                "source_file_id": source.id,
                "source_file_type": CommunicationFileType.AFFILIATION.value,
                "result": result,
                "message_count": len(messages),
                "educational_simulation": True,
            }
        ),
        validation_errors="[]",
        created_by=submission.created_by,
    )
    db.add(response)
    db.flush()
    _record_event(
        db,
        response,
        event_type=CommunicationEventType.GENERATED.value,
        from_status=None,
        to_status=CommunicationFileStatus.GENERATED.value,
        message="Respuesta de afiliación de SILTRA simulado generada.",
        details={"submission_id": submission.id, "source_file_id": source.id},
        created_by=submission.created_by,
    )
    return response


def process_affiliation_submission(
    db: Session,
    submission: CommunicationSubmission,
    *,
    created_by: int | None = None,
) -> CommunicationSubmission:
    if submission.status != CommunicationSubmissionStatus.SENT.value:
        raise AffiliationRemittanceDomainError("Solo puede recibirse la respuesta de un envío en estado SENT.")
    source = submission.source_file
    if not source or source.file_type != CommunicationFileType.AFFILIATION.value:
        raise AffiliationRemittanceDomainError("El envío no corresponde a un fichero de afiliación.")

    previous = source.status
    submission.status = CommunicationSubmissionStatus.PROCESSING.value
    submission.processing_started_at = datetime.utcnow()
    source.status = CommunicationFileStatus.PROCESSING.value
    _record_event(
        db,
        source,
        event_type=CommunicationEventType.STATUS_CHANGED.value,
        from_status=previous,
        to_status=source.status,
        message=f"SILTRA está procesando la remesa {submission.submission_number}.",
        details={"submission_id": submission.id},
        created_by=created_by or submission.created_by,
    )
    db.flush()

    movements = _draft_payload(source).get("movements", [])
    messages = analyze_affiliation_movements(db, movements)
    first_error = next((item for item in messages if item["severity"] == "ERROR"), None)
    if first_error:
        result = CommunicationSubmissionStatus.REJECTED.value
        response_code = first_error["code"]
        response_message = first_error["message"]
    else:
        result = CommunicationSubmissionStatus.ACCEPTED.value
        response_code = "A0001"
        response_message = AFFILIATION_CODES["A0001"]["message"]
        _apply_movements(db, movements, submission)

    processed_at = datetime.utcnow()
    response = _build_response_file(
        db,
        source,
        submission,
        result=result,
        response_code=response_code,
        response_message=response_message,
        messages=messages,
        processed_at=processed_at,
    )
    submission.status = result
    submission.processed_at = processed_at
    submission.response_code = response_code
    submission.response_message = response_message
    submission.response_file_id = response.id
    submission.messages = _json_dump(messages)

    source.status = result
    source.processed_at = processed_at
    source.response_code = response_code
    source.response_message = response_message
    source.response_file_id = response.id
    metadata = _json_load(source.file_metadata, {})
    metadata.update(
        {
            "last_submission_id": submission.id,
            "last_submission_number": submission.submission_number,
            "last_submission_status": result,
            "last_submission_attempt": submission.attempt_number,
        }
    )
    source.file_metadata = _json_dump(metadata)
    _record_event(
        db,
        source,
        event_type=CommunicationEventType.RESPONSE_LINKED.value,
        from_status=CommunicationFileStatus.PROCESSING.value,
        to_status=result,
        message=f"Respuesta SILTRA {result}: {response_code} · {response_message}",
        details={
            "submission_id": submission.id,
            "response_file_id": response.id,
            "message_count": len(messages),
        },
        created_by=created_by or submission.created_by,
    )
    db.commit()
    db.refresh(submission)
    return submission


def get_draft(db: Session, draft_id: int) -> CommunicationFile | None:
    return (
        db.query(CommunicationFile)
        .filter(
            CommunicationFile.id == draft_id,
            CommunicationFile.file_type == CommunicationFileType.AFFILIATION.value,
        )
        .first()
    )


def list_drafts(
    db: Session,
    *,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[CommunicationFile], int]:
    query = db.query(CommunicationFile).filter(
        CommunicationFile.file_type == CommunicationFileType.AFFILIATION.value
    )
    if status:
        query = query.filter(CommunicationFile.status == status)
    total = query.count()
    items = (
        query.order_by(CommunicationFile.updated_at.desc(), CommunicationFile.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return items, total


def serialize_draft(db: Session, source: CommunicationFile) -> dict[str, Any]:
    payload = serialize_communication_file(source)
    movements = _draft_payload(source).get("movements", [])
    dates = sorted(
        date.fromisoformat(item["effective_date"])
        for item in movements
        if item.get("effective_date")
    )
    latest_submission = (
        db.query(CommunicationSubmission)
        .filter(CommunicationSubmission.communication_file_id == source.id)
        .order_by(CommunicationSubmission.attempt_number.desc())
        .first()
    )
    payload.update(
        {
            "movements": movements,
            "movement_count": len(movements),
            "company_count": len({item.get("company_id") for item in movements}),
            "ccc_count": len(
                {
                    normalize_ccc(item.get("ccc"))
                    for item in movements
                    if normalize_ccc(item.get("ccc"))
                }
            ),
            "date_from": dates[0] if dates else None,
            "date_to": dates[-1] if dates else None,
            "latest_submission_id": latest_submission.id if latest_submission else None,
            "latest_submission_status": latest_submission.status if latest_submission else None,
        }
    )
    return payload


def serialize_submission_detail(submission: CommunicationSubmission) -> dict[str, Any]:
    source = submission.source_file
    if not source:
        raise AffiliationRemittanceDomainError("El fichero de origen ya no existe.")
    messages = _json_load(submission.messages, [])
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
        "error_count": sum(item.get("severity") == "ERROR" for item in messages),
        "warning_count": sum(item.get("severity") == "WARNING" for item in messages),
        "message_count": len(messages),
        "source_file": serialize_communication_file(source),
        "response_file": (
            serialize_communication_file(submission.response_file)
            if submission.response_file
            else None
        ),
        "messages": messages,
        "history": [serialize_communication_event(event) for event in source.events],
        "settlement_id": None,
        "company_name": getattr(submission.company, "name", None),
    }
