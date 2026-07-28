from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.fie import FieCommunication
from app.services.fie_enhanced_service import compare_fie_communication_enhanced
from app.services.fie_service import FieDomainError, _add_event, _find_incident, get_fie_communication


ACTION_MAP = {
    "CREATE_INCIDENT": "CREATE_INCIDENT",
    "LINK_INCIDENT": "LINK_INCIDENT",
    "REVIEW_DATES": "UPDATE_INCIDENT",
    "ADD_CONFIRMATION": "ADD_CONFIRMATION",
    "LOCATE_INCIDENT": "MARK_FOR_REVIEW",
    "CLOSE_INCIDENT": "CLOSE_INCIDENT",
    "CANCEL_INCIDENT": "CANCEL_INCIDENT",
    "CREATE_RELAPSE": "CREATE_RELAPSE",
    "SELECT_PREVIOUS_PROCESS": "CREATE_RELAPSE",
    "UPDATE_INCIDENT": "UPDATE_INCIDENT",
    "REVIEW_MESSAGE": "MARK_FOR_REVIEW",
    "MARK_FOR_REVIEW": "MARK_FOR_REVIEW",
    "IGNORE_DUPLICATE": "IGNORE_DUPLICATE",
}


def _scenario(communication: FieCommunication) -> str:
    return str((communication.raw_content or {}).get("simulation_scenario") or "AUTO")


def _normalize_actions(communication: FieCommunication) -> None:
    result = dict(communication.reconciliation_result or {})
    recommended = ACTION_MAP.get(result.get("recommended_action"), "MARK_FOR_REVIEW")
    actions = [ACTION_MAP.get(action, "MARK_FOR_REVIEW") for action in result.get("available_actions", [])]
    actions = list(dict.fromkeys([recommended, *actions, "MARK_FOR_REVIEW"]))
    result["recommended_action"] = recommended
    result["available_actions"] = actions
    communication.reconciliation_result = result


def compare_fie_case_communication(
    db: Session,
    communication_id: int,
    *,
    actor: str | None = None,
) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    scenario = _scenario(communication)

    if scenario == "DATE_MISMATCH" and communication.employee_id:
        incident = _find_incident(db, communication)
        if incident and communication.sick_leave_date == incident.start_date:
            communication.sick_leave_date = incident.start_date - timedelta(days=2)
            raw_content = dict(communication.raw_content or {})
            process = dict(raw_content.get("process") or {})
            process["sick_leave_date"] = communication.sick_leave_date.isoformat()
            raw_content["process"] = process
            communication.raw_content = raw_content
            db.commit()

    compared = compare_fie_communication_enhanced(db, communication_id, actor=actor)
    result = dict(compared.reconciliation_result or {})

    forced = {
        "CONFIRMATION_WITHOUT_PROCESS": (
            "ERROR",
            "Se ha recibido una confirmación sin una baja abierta que pueda vincularse.",
            "CONFIRMATION_WITHOUT_PROCESS",
        ),
        "DISCHARGE_WITHOUT_PROCESS": (
            "ERROR",
            "Se ha recibido un alta médica sin una baja previa relacionada.",
            "DISCHARGE_WITHOUT_PROCESS",
        ),
        "RELAPSE_WITHOUT_PREVIOUS": (
            "DISCREPANCY",
            "La recaída no dispone de un proceso anterior compatible.",
            "RELAPSE_WITHOUT_PREVIOUS",
        ),
        "NO_ACTIVE_CONTRACT": (
            "ERROR",
            "El trabajador está identificado, pero no existe contrato vigente en la fecha comunicada.",
            "NO_ACTIVE_CONTRACT",
        ),
    }

    if scenario in forced and compared.status not in {"UNMATCHED_WORKER", "DUPLICATE"}:
        status, summary, issue_code = forced[scenario]
        compared.status = status
        compared.incident_id = None if scenario != "NO_ACTIVE_CONTRACT" else compared.incident_id
        result.update(
            {
                "summary": summary,
                "issue_code": issue_code,
                "recommended_action": "MARK_FOR_REVIEW",
                "available_actions": ["MARK_FOR_REVIEW"],
                "issues": [*(result.get("issues") or []), {"code": issue_code, "message": summary}],
            }
        )
        compared.reconciliation_result = result
        _add_event(db, compared, "SCENARIO_CONFLICT", actor=actor, detail=summary, payload={"scenario": scenario})

    _normalize_actions(compared)
    db.commit()
    db.refresh(compared)
    return compared


def reopen_fie_case_communication(
    db: Session,
    communication_id: int,
    *,
    actor: str | None = None,
    notes: str | None = None,
) -> FieCommunication:
    communication = get_fie_communication(db, communication_id)
    if communication.status not in {"IGNORED", "ERROR", "DISCREPANCY", "DUPLICATE", "UNMATCHED_WORKER"}:
        raise FieDomainError("La comunicación no se encuentra en un estado que admita reapertura")
    communication.status = "PENDING_REVIEW"
    communication.read_at = communication.read_at or datetime.utcnow()
    _add_event(db, communication, "REOPENED", actor=actor, detail=notes or "Comunicación reabierta para revisión.")
    db.commit()
    db.refresh(communication)
    return communication
