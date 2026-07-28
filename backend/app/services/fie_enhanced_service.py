from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.employee import Employee
from app.models.fie import FieCommunication
from app.models.incident import Incident
from app.models.incident_detail import IncidentConfirmation
from app.schemas.fie import FieResolutionRequest, FieSimulationRequest
from app.services.fie_service import (
    FieDomainError,
    _active_contract,
    _add_event,
    _audit_incident,
    _ensure_incident_detail,
    _find_incident,
    _new_incident_from_fie,
    _payroll_impact,
    _previous_process,
    compare_fie_communication,
    get_fie_communication,
)


OPEN_INCIDENT_STATUSES = {"draft", "open", "pending", "validated"}


def _employee_name(employee: Employee | None) -> str | None:
    if not employee:
        return None
    return " ".join(
        part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part
    )


def _normalize(value: str | None) -> str:
    return "".join(character for character in str(value or "").upper() if character.isalnum())


def _technical_content(
    payload: FieSimulationRequest,
    company: Company,
    employee: Employee | None,
    process_reference: str,
    naf: str | None,
) -> dict:
    return {
        "format": "AULANOMINA_FIE_V1",
        "simulation": True,
        "design_reference": "FIE_5_0_EDUCATIONAL",
        "company": {
            "company_id": company.id,
            "name": company.name,
            "ccc": payload.ccc_id or company.ccc,
        },
        "worker": {
            "employee_id": employee.id if employee else None,
            "naf": naf,
            "nif": payload.external_nif or (employee.dni if employee else None),
            "name": payload.external_worker_name or _employee_name(employee),
        },
        "process": {
            "reference": process_reference,
            "previous_reference": payload.previous_process_reference,
            "communication_type": payload.communication_type,
            "contingency": payload.contingency_type,
            "event_date": payload.event_date.isoformat(),
            "sick_leave_date": payload.sick_leave_date.isoformat() if payload.sick_leave_date else None,
            "confirmation_date": payload.confirmation_date.isoformat() if payload.confirmation_date else None,
            "medical_discharge_date": payload.medical_discharge_date.isoformat() if payload.medical_discharge_date else None,
            "relapse_date": payload.relapse_date.isoformat() if payload.relapse_date else None,
            "estimated_duration": payload.estimated_duration,
        },
        "simulation_scenario": payload.result_scenario,
        "priority": payload.priority,
    }


def simulate_fie_communication_enhanced(db: Session, payload: FieSimulationRequest) -> FieCommunication:
    company = db.get(Company, payload.company_id)
    if not company:
        raise FieDomainError("Empresa no encontrada")

    employee = db.get(Employee, payload.employee_id) if payload.employee_id else None
    if payload.employee_id and not employee:
        raise FieDomainError("Trabajador no encontrado")
    if employee and employee.company_id and employee.company_id != company.id:
        raise FieDomainError("El trabajador no pertenece a la empresa seleccionada")

    contract = None
    if employee and payload.result_scenario != "NO_ACTIVE_CONTRACT":
        contract = _active_contract(db, employee.id, company.id, payload.event_date)

    process_reference = payload.process_reference
    if payload.result_scenario == "DUPLICATE" and not process_reference:
        previous = (
            db.query(FieCommunication)
            .filter(FieCommunication.company_id == company.id)
            .order_by(FieCommunication.received_at.desc(), FieCommunication.id.desc())
            .first()
        )
        process_reference = previous.process_reference if previous else None
    process_reference = process_reference or f"IT-{payload.event_date.year}-{uuid4().hex[:8].upper()}"

    naf = payload.external_naf or (employee.naf if employee else None)
    external_worker_name = payload.external_worker_name or _employee_name(employee)
    external_nif = payload.external_nif or (employee.dni if employee else None)
    external_message_id = f"FIE-{datetime.utcnow():%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}"

    communication = FieCommunication(
        company_id=company.id,
        employee_id=employee.id if employee else None,
        contract_id=contract.id if contract else None,
        ccc_id=payload.ccc_id or company.ccc,
        naf=naf,
        external_worker_name=external_worker_name,
        external_nif=external_nif,
        external_message_id=external_message_id,
        process_reference=process_reference,
        previous_process_reference=(
            None if payload.result_scenario == "RELAPSE_WITHOUT_PREVIOUS" else payload.previous_process_reference
        ),
        communication_type=payload.communication_type,
        contingency_type=payload.contingency_type,
        event_date=payload.event_date,
        sick_leave_date=payload.sick_leave_date,
        confirmation_date=payload.confirmation_date,
        medical_discharge_date=payload.medical_discharge_date,
        relapse_date=payload.relapse_date,
        estimated_duration=payload.estimated_duration,
        status="RECEIVED",
        source="SIMULATION",
        priority=payload.priority,
        notes=payload.notes,
        created_by=payload.created_by,
        raw_content=_technical_content(payload, company, employee, process_reference, naf),
    )
    db.add(communication)
    db.flush()
    _add_event(
        db,
        communication,
        "RECEIVED",
        actor=payload.created_by,
        detail=f"Comunicación FIE recibida. Escenario: {payload.result_scenario}.",
        payload={"external_message_id": external_message_id, "scenario": payload.result_scenario},
    )
    db.commit()
    db.refresh(communication)
    return communication


def _worker_candidates(db: Session, communication: FieCommunication) -> list[Employee]:
    query = db.query(Employee).filter(Employee.company_id == communication.company_id)
    normalized_naf = _normalize(communication.naf)
    normalized_nif = _normalize(communication.external_nif)
    candidates = []
    for employee in query.all():
        naf_matches = normalized_naf and _normalize(employee.naf) == normalized_naf
        nif_matches = normalized_nif and _normalize(employee.dni) == normalized_nif
        if naf_matches or nif_matches:
            candidates.append(employee)
    return candidates


def _candidate_incident_payload(db: Session, communication: FieCommunication) -> list[dict]:
    if not communication.employee_id:
        return []
    incidents = (
        db.query(Incident)
        .filter(
            Incident.employee_id == communication.employee_id,
            Incident.company_id == communication.company_id,
            Incident.incident_type.in_(["IT", "RECAIDA"]),
        )
        .order_by(Incident.start_date.desc(), Incident.id.desc())
        .limit(8)
        .all()
    )
    return [
        {
            "id": incident.id,
            "type": incident.incident_type,
            "start_date": incident.start_date.isoformat(),
            "end_date": incident.end_date.isoformat() if incident.end_date else None,
            "status": incident.status,
            "open": incident.status in OPEN_INCIDENT_STATUSES,
        }
        for incident in incidents
    ]


def _duplicate_of(db: Session, communication: FieCommunication) -> FieCommunication | None:
    return (
        db.query(FieCommunication)
        .filter(
            FieCommunication.id != communication.id,
            FieCommunication.company_id == communication.company_id,
            FieCommunication.process_reference == communication.process_reference,
            FieCommunication.communication_type == communication.communication_type,
            FieCommunication.event_date == communication.event_date,
            FieCommunication.naf == communication.naf,
            FieCommunication.received_at <= communication.received_at,
        )
        .order_by(FieCommunication.received_at.asc(), FieCommunication.id.asc())
        .first()
    )


def _payroll_explanation(impact: str, communication: FieCommunication) -> str:
    period = communication.event_date.strftime("%m/%Y")
    if impact == "REGULARIZATION_REQUIRED":
        return f"La nómina de {period} está cerrada o procesada. La corrección deberá regularizarse."
    if impact == "PENDING_RECALCULATION":
        return f"Existe una nómina de {period} todavía modificable. Quedará pendiente de recálculo."
    return f"No existe una nómina afectada en {period}; aplicar la comunicación no requiere recálculo inmediato."


def _save_terminal_comparison(
    db: Session,
    communication: FieCommunication,
    *,
    status: str,
    summary: str,
    issue_code: str,
    available_actions: list[str],
    actor: str | None,
    extra: dict | None = None,
) -> FieCommunication:
    communication.status = status
    communication.reconciliation_result = {
        "summary": summary,
        "issue_code": issue_code,
        "recommended_action": available_actions[0] if available_actions else "MARK_FOR_REVIEW",
        "available_actions": available_actions,
        "checks": [],
        "issues": [{"code": issue_code, "message": summary}],
        "candidate_incidents": _candidate_incident_payload(db, communication),
        **(extra or {}),
    }
    _add_event(db, communication, "COMPARED", actor=actor, detail=summary, payload=communication.reconciliation_result)
    db.commit()
    db.refresh(communication)
    return communication


def compare_fie_communication_enhanced(
    db: Session,
    communication_id: int,
    *,
    actor: str | None = None,
) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    if not communication.read_at:
        communication.read_at = datetime.utcnow()

    duplicate = _duplicate_of(db, communication)
    if duplicate:
        return _save_terminal_comparison(
            db,
            communication,
            status="DUPLICATE",
            summary=f"La comunicación coincide con el mensaje {duplicate.external_message_id} ya recibido.",
            issue_code="DUPLICATE_COMMUNICATION",
            available_actions=["IGNORE_DUPLICATE", "MARK_FOR_REVIEW"],
            actor=actor,
            extra={"duplicate_of_id": duplicate.id},
        )

    worker_candidates = _worker_candidates(db, communication)
    if communication.employee_id:
        employee = db.get(Employee, communication.employee_id)
        external_matches_assigned = bool(
            employee
            and (
                not communication.naf
                or _normalize(employee.naf) == _normalize(communication.naf)
                or _normalize(employee.dni) == _normalize(communication.external_nif)
            )
        )
        if not external_matches_assigned:
            communication.employee_id = None
            communication.contract_id = None

    if not communication.employee_id:
        if len(worker_candidates) == 1:
            employee = worker_candidates[0]
            communication.employee_id = employee.id
            communication.contract_id = (
                _active_contract(db, employee.id, communication.company_id, communication.event_date).id
                if _active_contract(db, employee.id, communication.company_id, communication.event_date)
                else None
            )
        elif len(worker_candidates) == 0:
            return _save_terminal_comparison(
                db,
                communication,
                status="UNMATCHED_WORKER",
                summary="El NAF o NIF recibido no corresponde a ningún trabajador de la empresa.",
                issue_code="WORKER_NOT_FOUND",
                available_actions=["MARK_FOR_REVIEW"],
                actor=actor,
            )
        else:
            return _save_terminal_comparison(
                db,
                communication,
                status="DISCREPANCY",
                summary="Los datos recibidos coinciden con varios trabajadores y requieren identificación manual.",
                issue_code="AMBIGUOUS_WORKER",
                available_actions=["MARK_FOR_REVIEW"],
                actor=actor,
                extra={"worker_candidate_ids": [employee.id for employee in worker_candidates]},
            )

    compared = compare_fie_communication(db, communication.id, actor=actor)
    result = dict(compared.reconciliation_result or {})
    incident = db.get(Incident, compared.incident_id) if compared.incident_id else None
    employee = db.get(Employee, compared.employee_id) if compared.employee_id else None

    checks = [
        {
            "field": "worker",
            "label": "Trabajador",
            "matches": employee is not None,
            "internal": _employee_name(employee),
            "external": compared.external_worker_name or _employee_name(employee),
            "message": "Trabajador identificado por NAF/NIF." if employee else "No se ha identificado al trabajador.",
        },
        {
            "field": "naf",
            "label": "NAF",
            "matches": bool(employee and _normalize(employee.naf) == _normalize(compared.naf)),
            "internal": employee.naf if employee else None,
            "external": compared.naf,
            "message": "El NAF coincide." if employee and _normalize(employee.naf) == _normalize(compared.naf) else "El NAF recibido no coincide con el expediente.",
        },
        {
            "field": "contract",
            "label": "Contrato vigente",
            "matches": compared.contract_id is not None or incident is not None,
            "internal": compared.contract_id,
            "external": "Necesario para crear una incidencia" if not incident else "Proceso ya existente",
            "message": "Existe cobertura contractual para el proceso." if compared.contract_id or incident else "No existe contrato vigente en la fecha del hecho.",
        },
        {
            "field": "sick_leave_date",
            "label": "Fecha de baja",
            "matches": not incident or not compared.sick_leave_date or incident.start_date == compared.sick_leave_date,
            "internal": incident.start_date.isoformat() if incident else None,
            "external": compared.sick_leave_date.isoformat() if compared.sick_leave_date else None,
            "message": (
                "La fecha de baja coincide."
                if incident and compared.sick_leave_date and incident.start_date == compared.sick_leave_date
                else "La fecha recibida difiere de la incidencia interna."
                if incident and compared.sick_leave_date
                else "No existe una baja interna equivalente."
            ),
        },
        {
            "field": "medical_discharge_date",
            "label": "Fecha de alta",
            "matches": not incident or not compared.medical_discharge_date or incident.end_date == compared.medical_discharge_date,
            "internal": incident.end_date.isoformat() if incident and incident.end_date else None,
            "external": compared.medical_discharge_date.isoformat() if compared.medical_discharge_date else None,
            "message": "Fecha de alta conciliada." if incident and incident.end_date == compared.medical_discharge_date else "Revisar la fecha de alta comunicada.",
        },
    ]

    recommended = result.get("recommended_action") or "MARK_FOR_REVIEW"
    available_actions = [recommended, "MARK_FOR_REVIEW"]
    if incident:
        available_actions.append("LINK_INCIDENT")
        if compared.communication_type in {"SICK_LEAVE", "MODIFICATION"}:
            available_actions.append("UPDATE_INCIDENT")
    if not incident and compared.communication_type == "SICK_LEAVE" and compared.contract_id:
        available_actions.append("CREATE_INCIDENT")

    issues = [
        {"code": check["field"].upper(), "message": check["message"]}
        for check in checks
        if not check["matches"]
    ]
    if not compared.contract_id and not incident and compared.communication_type in {"SICK_LEAVE", "RELAPSE"}:
        compared.status = "ERROR"
        result.update(
            {
                "summary": "La comunicación se ha identificado, pero no existe contrato vigente para crear la incidencia.",
                "issue_code": "NO_ACTIVE_CONTRACT",
                "recommended_action": "MARK_FOR_REVIEW",
            }
        )
        available_actions = ["MARK_FOR_REVIEW"]
        issues.append({"code": "NO_ACTIVE_CONTRACT", "message": "No existe contrato vigente en la fecha del hecho."})

    compared.reconciliation_result = {
        **result,
        "checks": checks,
        "issues": issues,
        "available_actions": list(dict.fromkeys(available_actions)),
        "candidate_incidents": _candidate_incident_payload(db, compared),
        "payroll_explanation": _payroll_explanation(compared.payroll_impact, compared),
    }
    db.commit()
    db.refresh(compared)
    return compared


def mark_fie_communication_read(
    db: Session,
    communication_id: int,
    *,
    actor: str | None = None,
) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    if not communication.read_at:
        communication.read_at = datetime.utcnow()
        _add_event(db, communication, "READ", actor=actor, detail="Comunicación abierta en la bandeja.")
        db.commit()
        db.refresh(communication)
    return communication


def resolve_fie_communication(
    db: Session,
    communication_id: int,
    payload: FieResolutionRequest,
) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    action = payload.action

    if action == "MARK_FOR_REVIEW":
        communication.status = "PENDING_REVIEW"
        communication.notes = payload.notes or communication.notes
        _add_event(db, communication, "MARKED_FOR_REVIEW", actor=payload.actor, detail=payload.notes or "Marcada para revisión manual.")
        db.commit()
        db.refresh(communication)
        return communication

    if action == "IGNORE_DUPLICATE":
        communication.status = "IGNORED"
        communication.notes = payload.notes or "Comunicación duplicada"
        _add_event(db, communication, "IGNORED_DUPLICATE", actor=payload.actor, detail=communication.notes)
        db.commit()
        db.refresh(communication)
        return communication

    if not communication.employee_id:
        raise FieDomainError("Debe identificarse al trabajador antes de resolver la comunicación")

    incident = db.get(Incident, payload.incident_id) if payload.incident_id else _find_incident(db, communication)
    if incident and (incident.employee_id != communication.employee_id or incident.company_id != communication.company_id):
        raise FieDomainError("La incidencia seleccionada no pertenece al trabajador y empresa de la comunicación")

    impact = _payroll_impact(db, communication, incident)

    if action == "CREATE_INCIDENT":
        if incident:
            raise FieDomainError("Ya existe una incidencia candidata; vincúlela o actualícela")
        incident = _new_incident_from_fie(
            db,
            communication,
            incident_type="IT",
            start_date=communication.sick_leave_date or communication.event_date,
            actor=payload.actor,
        )

    elif action == "CREATE_RELAPSE":
        previous = incident or _previous_process(db, communication)
        if not previous:
            raise FieDomainError("Debe seleccionar el proceso anterior de la recaída")
        incident = _new_incident_from_fie(
            db,
            communication,
            incident_type="RECAIDA",
            start_date=communication.relapse_date or communication.event_date,
            actor=payload.actor,
            previous_incident_id=previous.id,
        )

    else:
        if not incident:
            raise FieDomainError("Seleccione una incidencia interna para aplicar esta resolución")
        communication.incident_id = incident.id
        detail = _ensure_incident_detail(db, incident, communication)
        detail.updated_by = payload.actor

        if action == "LINK_INCIDENT":
            _audit_incident(db, incident, "linked_fie_manually", communication, payload.actor)

        elif action == "UPDATE_INCIDENT":
            if not payload.allow_date_override:
                raise FieDomainError("Confirme expresamente la modificación de fechas")
            if communication.sick_leave_date:
                incident.start_date = communication.sick_leave_date
            if communication.medical_discharge_date:
                incident.end_date = communication.medical_discharge_date
                incident.status = "closed"
            detail.requires_recalculation = impact == "PENDING_RECALCULATION"
            detail.requires_regularization = impact == "REGULARIZATION_REQUIRED"
            _audit_incident(db, incident, "updated_from_fie_resolution", communication, payload.actor)

        elif action == "ADD_CONFIRMATION":
            confirmation_date = communication.confirmation_date or communication.event_date
            existing = next(
                (item for item in incident.confirmations if item.confirmation_date == confirmation_date and not item.is_cancelled),
                None,
            )
            if not existing:
                db.add(
                    IncidentConfirmation(
                        incident=incident,
                        number=f"FIE-{communication.id}",
                        confirmation_date=confirmation_date,
                        confirmation_type="FIE",
                        observations=f"Recibida mediante {communication.external_message_id}",
                        status="active",
                    )
                )
            _audit_incident(db, incident, "confirmation_from_fie_resolution", communication, payload.actor)

        elif action == "CLOSE_INCIDENT":
            incident.end_date = communication.medical_discharge_date or communication.event_date
            incident.status = "closed"
            detail.requires_recalculation = impact == "PENDING_RECALCULATION"
            detail.requires_regularization = impact == "REGULARIZATION_REQUIRED"
            _audit_incident(db, incident, "closed_from_fie_resolution", communication, payload.actor)

        elif action == "CANCEL_INCIDENT":
            if impact == "NO_IMPACT":
                incident.status = "cancelled"
                detail.is_cancelled = True
                detail.cancelled_at = datetime.utcnow()
            else:
                detail.requires_regularization = True
            detail.cancellation_reason = payload.notes or f"Anulación FIE {communication.external_message_id}"
            _audit_incident(db, incident, "cancelled_from_fie_resolution", communication, payload.actor)

        else:
            raise FieDomainError("La acción seleccionada no puede aplicarse a esta comunicación")

    communication.status = "APPLIED"
    communication.payroll_impact = impact
    communication.notes = payload.notes or communication.notes
    result = dict(communication.reconciliation_result or {})
    result.update(
        {
            "applied_action": action,
            "incident_id": communication.incident_id,
            "payroll_impact": impact,
            "payroll_explanation": _payroll_explanation(impact, communication),
            "applied_at": datetime.utcnow().isoformat(),
        }
    )
    communication.reconciliation_result = result
    _add_event(
        db,
        communication,
        "RESOLVED",
        actor=payload.actor,
        detail=f"Resolución aplicada: {action}.",
        payload=result,
    )
    db.commit()
    db.refresh(communication)
    return communication
