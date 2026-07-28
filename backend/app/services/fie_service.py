from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.fie import FieCommunication, FieProcessingEvent
from app.models.incident import Incident
from app.models.incident_detail import IncidentAudit, IncidentConfirmation, IncidentDetail
from app.models.payroll import Payroll
from app.schemas.fie import FieSimulationRequest


class FieDomainError(ValueError):
    pass


FINAL_PAYROLL_STATUSES = {"paid", "closed", "finalized", "processed", "settled"}


def payroll_impact_for_statuses(statuses: list[str]) -> str:
    normalized = {str(status or "").strip().lower() for status in statuses}
    if normalized & FINAL_PAYROLL_STATUSES:
        return "REGULARIZATION_REQUIRED"
    if normalized:
        return "PENDING_RECALCULATION"
    return "NO_IMPACT"


def reconciliation_decision(
    communication_type: str,
    *,
    incident_exists: bool,
    exact_start_match: bool = False,
    same_discharge_date: bool = False,
    previous_process_exists: bool = False,
) -> dict:
    if communication_type == "SICK_LEAVE":
        if not incident_exists:
            return {
                "status": "PENDING_REVIEW",
                "recommended_action": "CREATE_INCIDENT",
                "summary": "El INSS comunica una baja sin incidencia interna equivalente.",
            }
        if exact_start_match:
            return {
                "status": "MATCHED",
                "recommended_action": "LINK_INCIDENT",
                "summary": "La baja FIE coincide con la incidencia registrada.",
            }
        return {
            "status": "DISCREPANCY",
            "recommended_action": "REVIEW_DATES",
            "summary": "Existe una IT interna, pero la fecha de baja no coincide.",
        }

    if communication_type == "CONFIRMATION":
        if incident_exists:
            return {
                "status": "PENDING_REVIEW",
                "recommended_action": "ADD_CONFIRMATION",
                "summary": "La confirmación puede incorporarse al proceso abierto.",
            }
        return {
            "status": "ERROR",
            "recommended_action": "LOCATE_INCIDENT",
            "summary": "Se ha recibido una confirmación sin proceso de IT relacionado.",
        }

    if communication_type == "MEDICAL_DISCHARGE":
        if not incident_exists:
            return {
                "status": "ERROR",
                "recommended_action": "LOCATE_INCIDENT",
                "summary": "Se ha recibido un alta sin incidencia abierta relacionada.",
            }
        if same_discharge_date:
            return {
                "status": "MATCHED",
                "recommended_action": "LINK_INCIDENT",
                "summary": "El alta ya estaba registrada con la misma fecha.",
            }
        return {
            "status": "PENDING_REVIEW",
            "recommended_action": "CLOSE_INCIDENT",
            "summary": "El INSS comunica el alta de una IT que continúa abierta o tiene otra fecha.",
        }

    if communication_type == "CANCELLATION":
        if incident_exists:
            return {
                "status": "PENDING_REVIEW",
                "recommended_action": "CANCEL_INCIDENT",
                "summary": "La comunicación anula un proceso registrado en AulaNomina.",
            }
        return {
            "status": "ERROR",
            "recommended_action": "LOCATE_INCIDENT",
            "summary": "No se ha encontrado la incidencia que debe anularse.",
        }

    if communication_type == "RELAPSE":
        if previous_process_exists:
            return {
                "status": "PENDING_REVIEW",
                "recommended_action": "CREATE_RELAPSE",
                "summary": "La recaída puede vincularse con un proceso anterior.",
            }
        return {
            "status": "DISCREPANCY",
            "recommended_action": "SELECT_PREVIOUS_PROCESS",
            "summary": "La recaída no tiene un proceso anterior compatible.",
        }

    if communication_type == "MODIFICATION":
        if incident_exists:
            return {
                "status": "PENDING_REVIEW",
                "recommended_action": "UPDATE_INCIDENT",
                "summary": "La variación requiere revisar y actualizar la incidencia relacionada.",
            }
        return {
            "status": "ERROR",
            "recommended_action": "LOCATE_INCIDENT",
            "summary": "No se ha encontrado el proceso que debe modificarse.",
        }

    return {
        "status": "ERROR",
        "recommended_action": "REVIEW_MESSAGE",
        "summary": "Tipo de comunicación FIE no soportado.",
    }


def _add_event(
    db: Session,
    communication: FieCommunication,
    event_type: str,
    *,
    actor: str | None = None,
    detail: str | None = None,
    payload: dict | None = None,
) -> FieProcessingEvent:
    event = FieProcessingEvent(
        communication=communication,
        event_type=event_type,
        actor=actor,
        detail=detail,
        payload=payload or {},
    )
    db.add(event)
    return event


def _active_contract(db: Session, employee_id: int, company_id: int, event_date: date) -> Contract | None:
    return (
        db.query(Contract)
        .filter(
            Contract.employee_id == employee_id,
            Contract.company_id == company_id,
            Contract.start_date <= event_date,
            or_(Contract.end_date.is_(None), Contract.end_date >= event_date),
        )
        .order_by(Contract.start_date.desc())
        .first()
    )


def _incident_process_reference(incident: Incident) -> str | None:
    if not incident.detail or not isinstance(incident.detail.details, dict):
        return None
    return incident.detail.details.get("external_process_reference")


def _candidate_incidents(db: Session, communication: FieCommunication) -> list[Incident]:
    return (
        db.query(Incident)
        .filter(
            Incident.employee_id == communication.employee_id,
            Incident.company_id == communication.company_id,
            Incident.incident_type.in_(["IT", "RECAIDA"]),
            Incident.status != "cancelled",
        )
        .order_by(Incident.start_date.desc(), Incident.id.desc())
        .all()
    )


def _find_incident(db: Session, communication: FieCommunication) -> Incident | None:
    incidents = _candidate_incidents(db, communication)
    for incident in incidents:
        if _incident_process_reference(incident) == communication.process_reference:
            return incident

    target_start = communication.sick_leave_date
    if target_start:
        exact = next((incident for incident in incidents if incident.start_date == target_start), None)
        if exact:
            return exact

    open_incident = next(
        (incident for incident in incidents if incident.status in {"draft", "open", "pending", "validated"}),
        None,
    )
    return open_incident


def _previous_process(db: Session, communication: FieCommunication) -> Incident | None:
    if communication.previous_process_reference:
        for incident in _candidate_incidents(db, communication):
            if _incident_process_reference(incident) == communication.previous_process_reference:
                return incident

    relapse_date = communication.relapse_date or communication.event_date
    return (
        db.query(Incident)
        .filter(
            Incident.employee_id == communication.employee_id,
            Incident.company_id == communication.company_id,
            Incident.incident_type.in_(["IT", "RECAIDA"]),
            Incident.start_date < relapse_date,
        )
        .order_by(Incident.start_date.desc())
        .first()
    )


def _payroll_impact(db: Session, communication: FieCommunication, incident: Incident | None) -> str:
    impact_date = (
        communication.medical_discharge_date
        or communication.relapse_date
        or communication.sick_leave_date
        or communication.confirmation_date
        or communication.event_date
    )
    payrolls = (
        db.query(Payroll)
        .filter(
            Payroll.employee_id == communication.employee_id,
            Payroll.company_id == communication.company_id,
            Payroll.period_year == impact_date.year,
            Payroll.period_month == impact_date.month,
        )
        .all()
    )
    return payroll_impact_for_statuses([payroll.status for payroll in payrolls])


def _raw_content(payload: FieSimulationRequest, company: Company, employee: Employee, process_reference: str) -> dict:
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
            "employee_id": employee.id,
            "naf": employee.naf,
            "name": " ".join(part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part),
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
    }


def simulate_fie_communication(db: Session, payload: FieSimulationRequest) -> FieCommunication:
    company = db.get(Company, payload.company_id)
    if not company:
        raise FieDomainError("Empresa no encontrada")

    employee = db.get(Employee, payload.employee_id)
    if not employee:
        raise FieDomainError("Trabajador no encontrado")
    if employee.company_id and employee.company_id != company.id:
        raise FieDomainError("El trabajador no pertenece a la empresa seleccionada")

    contract = _active_contract(db, employee.id, company.id, payload.event_date)
    process_reference = payload.process_reference or f"IT-{payload.event_date.year}-{uuid4().hex[:8].upper()}"
    external_message_id = f"FIE-{datetime.utcnow():%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}"

    communication = FieCommunication(
        company_id=company.id,
        employee_id=employee.id,
        contract_id=contract.id if contract else None,
        ccc_id=payload.ccc_id or company.ccc,
        naf=employee.naf,
        external_message_id=external_message_id,
        process_reference=process_reference,
        previous_process_reference=payload.previous_process_reference,
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
        notes=payload.notes,
        created_by=payload.created_by,
        raw_content=_raw_content(payload, company, employee, process_reference),
    )
    db.add(communication)
    db.flush()
    _add_event(
        db,
        communication,
        "RECEIVED",
        actor=payload.created_by,
        detail="Comunicación FIE recibida desde el simulador INSS.",
        payload={"external_message_id": external_message_id},
    )
    db.commit()
    db.refresh(communication)
    return communication


def list_fie_communications(
    db: Session,
    *,
    company_id: int | None = None,
    employee_id: int | None = None,
    status: str | None = None,
    communication_type: str | None = None,
    received_from: date | None = None,
    received_to: date | None = None,
) -> list[FieCommunication]:
    query = db.query(FieCommunication)
    if company_id is not None:
        query = query.filter(FieCommunication.company_id == company_id)
    if employee_id is not None:
        query = query.filter(FieCommunication.employee_id == employee_id)
    if status:
        query = query.filter(FieCommunication.status == status)
    if communication_type:
        query = query.filter(FieCommunication.communication_type == communication_type)
    if received_from:
        query = query.filter(FieCommunication.received_at >= datetime.combine(received_from, datetime.min.time()))
    if received_to:
        query = query.filter(FieCommunication.received_at <= datetime.combine(received_to, datetime.max.time()))
    return query.order_by(FieCommunication.received_at.desc(), FieCommunication.id.desc()).all()


def get_fie_communication(db: Session, communication_id: int) -> FieCommunication:
    communication = db.get(FieCommunication, communication_id)
    if not communication:
        raise FieDomainError("Comunicación FIE no encontrada")
    return communication


def compare_fie_communication(db: Session, communication_id: int, *, actor: str | None = None) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    incident = _find_incident(db, communication)
    previous = _previous_process(db, communication) if communication.communication_type == "RELAPSE" else None
    target_start = communication.sick_leave_date
    exact_start_match = bool(incident and target_start and incident.start_date == target_start)
    same_discharge_date = bool(
        incident
        and communication.medical_discharge_date
        and incident.end_date == communication.medical_discharge_date
    )
    decision = reconciliation_decision(
        communication.communication_type,
        incident_exists=incident is not None,
        exact_start_match=exact_start_match,
        same_discharge_date=same_discharge_date,
        previous_process_exists=previous is not None,
    )
    impact = _payroll_impact(db, communication, incident)
    checks = [
        {"field": "employee", "matches": True, "internal": communication.employee_id, "external": communication.employee_id},
        {"field": "naf", "matches": bool(communication.naf), "internal": communication.naf, "external": communication.naf},
        {"field": "company", "matches": True, "internal": communication.company_id, "external": communication.company_id},
        {
            "field": "sick_leave_date",
            "matches": exact_start_match if incident and target_start else incident is None,
            "internal": incident.start_date.isoformat() if incident else None,
            "external": target_start.isoformat() if target_start else None,
        },
        {
            "field": "medical_discharge_date",
            "matches": same_discharge_date if incident and communication.medical_discharge_date else True,
            "internal": incident.end_date.isoformat() if incident and incident.end_date else None,
            "external": communication.medical_discharge_date.isoformat() if communication.medical_discharge_date else None,
        },
    ]
    communication.incident_id = incident.id if incident else None
    communication.status = decision["status"]
    communication.payroll_impact = impact
    communication.reconciliation_result = {
        **decision,
        "incident_id": incident.id if incident else None,
        "previous_incident_id": previous.id if previous else None,
        "checks": checks,
        "payroll_impact": impact,
    }
    _add_event(
        db,
        communication,
        "COMPARED",
        actor=actor,
        detail=decision["summary"],
        payload=communication.reconciliation_result,
    )
    db.commit()
    db.refresh(communication)
    return communication


def _ensure_incident_detail(db: Session, incident: Incident, communication: FieCommunication) -> IncidentDetail:
    detail = incident.detail
    if not detail:
        detail = IncidentDetail(incident=incident, origin="FIE", details={})
        db.add(detail)
    values = dict(detail.details or {})
    values.update(
        {
            "source": "FIE",
            "fie_communication_id": communication.id,
            "external_process_reference": communication.process_reference,
            "last_external_update_at": datetime.utcnow().isoformat(),
            "reconciliation_status": communication.status,
            "contingency_type": communication.contingency_type,
        }
    )
    detail.origin = "FIE"
    detail.details = values
    detail.updated_at = datetime.utcnow()
    detail.version = int(detail.version or 0) + 1
    return detail


def _audit_incident(db: Session, incident: Incident, action: str, communication: FieCommunication, actor: str | None) -> None:
    db.add(
        IncidentAudit(
            incident=incident,
            action=action,
            version=incident.detail.version if incident.detail else 1,
            actor=actor,
            reason=f"Actualización aplicada desde FIE {communication.external_message_id}",
            new_values={
                "status": incident.status,
                "start_date": incident.start_date.isoformat(),
                "end_date": incident.end_date.isoformat() if incident.end_date else None,
                "fie_communication_id": communication.id,
            },
        )
    )


def _new_incident_from_fie(
    db: Session,
    communication: FieCommunication,
    *,
    incident_type: str,
    start_date: date,
    actor: str | None,
    previous_incident_id: int | None = None,
) -> Incident:
    if not communication.contract_id:
        raise FieDomainError("No existe un contrato vigente para crear la incidencia")
    incident = Incident(
        employee_id=communication.employee_id,
        contract_id=communication.contract_id,
        company_id=communication.company_id,
        incident_type=incident_type,
        start_date=start_date,
        status="open",
        description=f"Proceso creado desde comunicación FIE {communication.external_message_id}",
    )
    db.add(incident)
    db.flush()
    detail = IncidentDetail(
        incident=incident,
        origin="FIE",
        created_by=actor,
        updated_by=actor,
        details={
            "source": "FIE",
            "fie_communication_id": communication.id,
            "external_process_reference": communication.process_reference,
            "previous_process_reference": communication.previous_process_reference,
            "previous_incident_id": previous_incident_id,
            "contingency_type": communication.contingency_type,
            "last_external_update_at": datetime.utcnow().isoformat(),
            "reconciliation_status": "APPLIED",
        },
    )
    db.add(detail)
    db.flush()
    communication.incident_id = incident.id
    _audit_incident(db, incident, "created_from_fie", communication, actor)
    return incident


def apply_fie_communication(db: Session, communication_id: int, *, actor: str | None = None, notes: str | None = None) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    if communication.status in {"RECEIVED", "MATCHED"} and not communication.reconciliation_result:
        communication = compare_fie_communication(db, communication_id, actor=actor)
    if communication.status in {"ERROR", "DISCREPANCY"}:
        raise FieDomainError("La comunicación contiene discrepancias y debe revisarse antes de aplicarla")
    if communication.status == "IGNORED":
        raise FieDomainError("Reabra la comunicación antes de aplicarla")
    if communication.status == "APPLIED":
        return communication

    incident = _find_incident(db, communication)
    impact = _payroll_impact(db, communication, incident)
    action = communication.reconciliation_result.get("recommended_action")

    if communication.communication_type == "SICK_LEAVE":
        if not incident:
            incident = _new_incident_from_fie(
                db,
                communication,
                incident_type="IT",
                start_date=communication.sick_leave_date or communication.event_date,
                actor=actor,
            )
        else:
            communication.incident_id = incident.id
            detail = _ensure_incident_detail(db, incident, communication)
            detail.updated_by = actor
            _audit_incident(db, incident, "linked_fie_sick_leave", communication, actor)

    elif communication.communication_type == "CONFIRMATION":
        if not incident:
            raise FieDomainError("No existe una IT abierta para incorporar la confirmación")
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
        communication.incident_id = incident.id
        detail = _ensure_incident_detail(db, incident, communication)
        detail.updated_by = actor
        _audit_incident(db, incident, "confirmation_from_fie", communication, actor)

    elif communication.communication_type == "MEDICAL_DISCHARGE":
        if not incident:
            raise FieDomainError("No existe una IT relacionada para aplicar el alta")
        incident.end_date = communication.medical_discharge_date or communication.event_date
        incident.status = "closed"
        communication.incident_id = incident.id
        detail = _ensure_incident_detail(db, incident, communication)
        detail.updated_by = actor
        detail.requires_recalculation = impact == "PENDING_RECALCULATION"
        detail.requires_regularization = impact == "REGULARIZATION_REQUIRED"
        _audit_incident(db, incident, "medical_discharge_from_fie", communication, actor)

    elif communication.communication_type == "MODIFICATION":
        if not incident:
            raise FieDomainError("No existe una incidencia relacionada para aplicar la modificación")
        if communication.sick_leave_date:
            incident.start_date = communication.sick_leave_date
        if communication.medical_discharge_date:
            incident.end_date = communication.medical_discharge_date
            incident.status = "closed"
        communication.incident_id = incident.id
        detail = _ensure_incident_detail(db, incident, communication)
        detail.updated_by = actor
        detail.requires_recalculation = impact == "PENDING_RECALCULATION"
        detail.requires_regularization = impact == "REGULARIZATION_REQUIRED"
        _audit_incident(db, incident, "modified_from_fie", communication, actor)

    elif communication.communication_type == "CANCELLATION":
        if not incident:
            raise FieDomainError("No existe una incidencia relacionada para anular")
        communication.incident_id = incident.id
        detail = _ensure_incident_detail(db, incident, communication)
        detail.updated_by = actor
        if impact == "NO_IMPACT":
            incident.status = "cancelled"
            detail.is_cancelled = True
            detail.cancelled_at = datetime.utcnow()
            detail.cancellation_reason = notes or f"Anulación FIE {communication.external_message_id}"
        else:
            detail.requires_regularization = True
            detail.cancellation_reason = notes or "Anulación FIE con nómina ya calculada"
        _audit_incident(db, incident, "cancelled_from_fie", communication, actor)

    elif communication.communication_type == "RELAPSE":
        previous = _previous_process(db, communication)
        if not previous:
            raise FieDomainError("No existe un proceso previo compatible para registrar la recaída")
        incident = _new_incident_from_fie(
            db,
            communication,
            incident_type="RECAIDA",
            start_date=communication.relapse_date or communication.event_date,
            actor=actor,
            previous_incident_id=previous.id,
        )

    else:
        raise FieDomainError("Tipo de comunicación FIE no soportado")

    communication.status = "APPLIED"
    communication.payroll_impact = impact
    communication.notes = notes or communication.notes
    result = dict(communication.reconciliation_result or {})
    result.update(
        {
            "applied_action": action,
            "incident_id": communication.incident_id,
            "payroll_impact": impact,
            "applied_at": datetime.utcnow().isoformat(),
        }
    )
    communication.reconciliation_result = result
    _add_event(
        db,
        communication,
        "APPLIED",
        actor=actor,
        detail="Comunicación aplicada a las incidencias internas.",
        payload=result,
    )
    db.commit()
    db.refresh(communication)
    return communication


def ignore_fie_communication(db: Session, communication_id: int, *, actor: str | None = None, notes: str | None = None) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    communication.status = "IGNORED"
    communication.notes = notes or communication.notes
    _add_event(db, communication, "IGNORED", actor=actor, detail=notes or "Comunicación ignorada por el usuario.")
    db.commit()
    db.refresh(communication)
    return communication


def reopen_fie_communication(db: Session, communication_id: int, *, actor: str | None = None, notes: str | None = None) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    if communication.status not in {"IGNORED", "ERROR", "DISCREPANCY"}:
        raise FieDomainError("Solo pueden reabrirse comunicaciones ignoradas, con error o discrepancia")
    communication.status = "PENDING_REVIEW"
    _add_event(db, communication, "REOPENED", actor=actor, detail=notes or "Comunicación reabierta para revisión.")
    db.commit()
    db.refresh(communication)
    return communication
