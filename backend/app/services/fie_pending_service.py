from datetime import datetime

from sqlalchemy.orm import Session

from app.models.fie import FieCommunication, FieProcessingEvent
from app.models.incident import Incident
from app.schemas.fie import FieSimulationRequest
from app.services.fie_enhanced_service import simulate_fie_communication_enhanced


def generate_pending_fie_communications(
    db: Session,
    *,
    company_id: int | None = None,
    actor: str | None = "Sistema INSS simulado",
    limit: int = 20,
) -> list[FieCommunication]:
    """Create one incoming FIE message for internal IT processes not yet represented.

    This is an educational trigger, not an external integration. Existing linked
    communications prevent duplicate messages when the inbox is checked repeatedly.
    """

    query = (
        db.query(Incident)
        .filter(
            Incident.incident_type.in_(["IT", "RECAIDA"]),
            Incident.status.in_(["open", "pending", "validated", "closed"]),
        )
        .order_by(Incident.created_at.asc(), Incident.id.asc())
    )
    if company_id is not None:
        query = query.filter(Incident.company_id == company_id)

    incidents = query.limit(max(1, min(limit, 100))).all()
    incident_ids = [incident.id for incident in incidents]
    existing_incident_ids = {
        item[0]
        for item in (
            db.query(FieCommunication.incident_id)
            .filter(FieCommunication.incident_id.in_(incident_ids))
            .all()
            if incident_ids
            else []
        )
        if item[0] is not None
    }

    created: list[FieCommunication] = []
    for incident in incidents:
        if incident.id in existing_incident_ids:
            continue

        detail_values = incident.detail.details if incident.detail and isinstance(incident.detail.details, dict) else {}
        process_reference = detail_values.get("external_process_reference") or f"IT-{incident.start_date.year}-{incident.id:06d}"
        communication_type = "RELAPSE" if incident.incident_type == "RECAIDA" else (
            "MEDICAL_DISCHARGE" if incident.status == "closed" and incident.end_date else "SICK_LEAVE"
        )
        event_date = incident.end_date if communication_type == "MEDICAL_DISCHARGE" else incident.start_date

        communication = simulate_fie_communication_enhanced(
            db,
            FieSimulationRequest(
                company_id=incident.company_id,
                employee_id=incident.employee_id,
                communication_type=communication_type,
                event_date=event_date,
                process_reference=process_reference,
                previous_process_reference=detail_values.get("previous_process_reference"),
                contingency_type=detail_values.get("contingency_type") or "COMMON_DISEASE",
                sick_leave_date=incident.start_date,
                medical_discharge_date=incident.end_date if communication_type == "MEDICAL_DISCHARGE" else None,
                relapse_date=incident.start_date if communication_type == "RELAPSE" else None,
                result_scenario="AUTO_INTERNAL_INCIDENT",
                priority="NORMAL",
                notes="Recibida al ejecutar una consulta manual al INSS simulado.",
                created_by=actor,
            ),
        )
        communication.incident_id = incident.id
        communication.contract_id = incident.contract_id
        db.commit()
        db.refresh(communication)
        created.append(communication)

    return created


def check_new_fie_communications(
    db: Session,
    *,
    company_id: int | None = None,
    actor: str | None = "Usuario demo",
    limit: int = 20,
) -> dict:
    """Run an explicit educational INSS query and return a stable summary."""

    checked_at = datetime.utcnow()
    communications = generate_pending_fie_communications(
        db,
        company_id=company_id,
        actor=actor,
        limit=limit,
    )

    for communication in communications:
        db.add(
            FieProcessingEvent(
                communication_id=communication.id,
                event_type="INSS_QUERY",
                actor=actor,
                detail="Comunicación incorporada mediante una consulta manual al INSS simulado.",
                payload={
                    "checked_at": checked_at.isoformat(),
                    "company_id": company_id,
                },
            )
        )

    if communications:
        db.commit()
        for communication in communications:
            db.refresh(communication)

    received_count = len(communications)
    unmatched_count = sum(1 for item in communications if item.employee_id is None)
    identified_count = received_count - unmatched_count
    pending_review_count = sum(
        1
        for item in communications
        if item.status in {"RECEIVED", "PENDING_REVIEW", "DISCREPANCY", "ERROR", "UNMATCHED_WORKER"}
    )

    return {
        "checked_at": checked_at,
        "company_id": company_id,
        "received_count": received_count,
        "identified_count": identified_count,
        "unmatched_count": unmatched_count,
        "pending_review_count": pending_review_count,
        "message": (
            "No hay nuevas comunicaciones disponibles."
            if received_count == 0
            else f"Se han recibido {received_count} comunicaciones nuevas."
        ),
        "communications": communications,
    }
