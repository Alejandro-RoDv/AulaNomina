"""Validación especializada de B02 · Contratación."""

from __future__ import annotations

from datetime import date, datetime
import json
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.contract_lifecycle_event import ContractLifecycleEvent
from app.models.employee import Employee
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import CaseScenarioError, ensure_assignment_progress, update_assignment_step
from app.training.hiring_runtime_cases_2026 import EMPLOYEE_DATA, HIRING_DECISION_RULES, HIRING_SCENARIO_CODES


SCENARIO_TO_CODE = {
    "TRAIN-2026-HIRE-A06": "A06",
    "TRAIN-2026-HIRE-A08": "A08",
    "TRAIN-2026-HIRE-A10": "A10",
    "TRAIN-2026-HIRE-A11": "A11",
    "TRAIN-2026-HIRE-A12": "A12",
    "TRAIN-2026-HIRE-A13": "A13",
}


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(char for char in text if not unicodedata.combining(char)).casefold().strip()


def _student_response(progress) -> dict[str, Any]:
    if not progress.student_notes:
        return {}
    if isinstance(progress.student_notes, dict):
        return progress.student_notes
    try:
        value = json.loads(progress.student_notes)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def _check(passed: bool, message: str, evidence: dict[str, Any], rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _decision(progress, code: str) -> dict[str, Any]:
    response = _student_response(progress)
    rule = HIRING_DECISION_RULES[code]
    decision = str(response.get("decision") or "").strip()
    explanation = str(response.get("explanation") or "").strip()
    normalized = _normalize(explanation)
    keywords = [_normalize(item) for item in rule["evidence_keywords"]]
    matched = sorted({item for item in keywords if item and item in normalized})
    passed = (
        decision == rule["expected_decision"]
        and bool(explanation)
        and len(matched) >= int(rule["minimum_keyword_matches"])
    )
    return _check(
        passed,
        "Decisión contractual y justificación coherentes con el supuesto." if passed else "Revisa la operación elegida y justifica la decisión con la causa, duración y efecto sobre la modalidad.",
        {"decision": decision or None, "matched_evidence": matched, "minimum_matches": rule["minimum_keyword_matches"]},
        "training_hiring_decision",
    )


def _employee(db: Session, code: str) -> Employee | None:
    dni = EMPLOYEE_DATA[code][1]
    return db.query(Employee).filter(Employee.dni == dni).first()


def _latest_contract(db: Session, code: str) -> Contract | None:
    employee = _employee(db, code)
    if not employee:
        return None
    return (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id)
        .order_by(Contract.start_date.desc(), Contract.id.desc())
        .first()
    )


def _review_a08(db: Session) -> dict[str, Any]:
    contract = _latest_contract(db, "A08")
    cause = _normalize(contract.temporary_cause if contract else "")
    passed = bool(
        contract
        and contract.contract_type == "temporal"
        and contract.contract_code == "402"
        and contract.start_date == date(2026, 9, 1)
        and contract.end_date == date(2026, 12, 31)
        and abs(float(contract.weekly_hours or 0) - 40) < 0.01
        and "incremento" in cause
        and ("pedido" in cause or "produccion" in cause)
    )
    return _check(
        passed,
        "El contrato temporal identifica modalidad, causa, duración y jornada del supuesto." if passed else "Comprueba código 402, fechas, jornada y una causa concreta conectada con el incremento temporal de pedidos.",
        {
            "contract_id": contract.id if contract else None,
            "contract_code": contract.contract_code if contract else None,
            "start_date": str(contract.start_date) if contract else None,
            "end_date": str(contract.end_date) if contract and contract.end_date else None,
            "weekly_hours": contract.weekly_hours if contract else None,
            "temporary_cause": contract.temporary_cause if contract else None,
        },
        "training_a08_temporary_contract",
    )


def _review_a10(db: Session) -> dict[str, Any]:
    contract = _latest_contract(db, "A10")
    passed = bool(
        contract
        and contract.contract_type == "formacion"
        and contract.contract_code == "421"
        and contract.training_contract_subtype == "alternance"
        and contract.start_date == date(2026, 9, 15)
        and contract.end_date == date(2027, 6, 30)
        and contract.training_program == "CFGS Administración y Finanzas"
        and contract.training_center == "IES Aula Córdoba"
        and contract.training_company_tutor == "Marta Vega Romero"
        and contract.training_plan_reference == "PF-A10-2026"
        and abs(float(contract.training_work_percentage or 0) - 65) < 0.01
    )
    return _check(
        passed,
        "La formación en alternancia conserva programa, centro, tutoría, plan y distribución de trabajo del caso." if passed else "Completa la modalidad 421 y todos los datos formativos del supuesto; el trabajo efectivo del primer año debe quedar en 65 %.",
        {
            "contract_id": contract.id if contract else None,
            "contract_code": contract.contract_code if contract else None,
            "subtype": contract.training_contract_subtype if contract else None,
            "program": contract.training_program if contract else None,
            "training_center": contract.training_center if contract else None,
            "tutor": contract.training_company_tutor if contract else None,
            "plan": contract.training_plan_reference if contract else None,
            "work_percentage": contract.training_work_percentage if contract else None,
        },
        "training_a10_alternance",
    )


def _review_a11(db: Session) -> dict[str, Any]:
    contract = _latest_contract(db, "A11")
    qualification_in_window = bool(
        contract
        and contract.qualification_date
        and contract.start_date
        and 0 <= (contract.start_date - contract.qualification_date).days <= 3 * 366
    )
    passed = bool(
        contract
        and contract.contract_type == "formacion"
        and contract.contract_code == "420"
        and contract.training_contract_subtype == "professional_practice"
        and contract.start_date == date(2026, 10, 1)
        and contract.end_date == date(2027, 3, 31)
        and contract.qualification_name == "Técnico Superior en Administración y Finanzas"
        and contract.qualification_date == date(2025, 6, 20)
        and qualification_in_window
        and contract.training_company_tutor == "Álvaro Medina Ruiz"
        and contract.training_plan_reference == "PF-A11-2026"
    )
    return _check(
        passed,
        "La práctica profesional queda vinculada a una titulación reciente y a su plan individual." if passed else "Revisa código 420, titulación y fecha, duración de seis meses, tutor y referencia del plan formativo.",
        {
            "contract_id": contract.id if contract else None,
            "contract_code": contract.contract_code if contract else None,
            "qualification": contract.qualification_name if contract else None,
            "qualification_date": str(contract.qualification_date) if contract and contract.qualification_date else None,
            "qualification_within_three_years": qualification_in_window,
            "tutor": contract.training_company_tutor if contract else None,
            "plan": contract.training_plan_reference if contract else None,
        },
        "training_a11_professional_practice",
    )


def _review_a12(db: Session) -> dict[str, Any]:
    contract = _latest_contract(db, "A12")
    event = None
    if contract:
        event = (
            db.query(ContractLifecycleEvent)
            .filter(ContractLifecycleEvent.contract_id == contract.id, ContractLifecycleEvent.event_type == "workday_change")
            .order_by(ContractLifecycleEvent.id.desc())
            .first()
        )
    previous = event.previous_state if event else {}
    new = event.new_state if event else {}
    passed = bool(
        contract
        and event
        and event.effective_date == date(2026, 9, 1)
        and abs(float(contract.weekly_hours or 0) - 30) < 0.01
        and abs(float(contract.partiality_coefficient or 0) - 75) < 0.01
        and abs(float(previous.get("weekly_hours") or 0) - 40) < 0.01
        and abs(float(new.get("weekly_hours") or 0) - 30) < 0.01
        and bool(event.reason)
    )
    return _check(
        passed,
        "La nueva jornada está vigente y la situación anterior permanece reconstruible en el evento contractual." if passed else "Usa la operación de variación de jornada: deben quedar 40 h anteriores, 30 h nuevas, 75 % y efectos 01/09/2026.",
        {
            "contract_id": contract.id if contract else None,
            "event_id": event.id if event else None,
            "effective_date": str(event.effective_date) if event else None,
            "previous_state": previous,
            "new_state": new,
            "current_weekly_hours": contract.weekly_hours if contract else None,
            "current_partiality": contract.partiality_coefficient if contract else None,
        },
        "training_a12_workday_traceability",
    )


def _review_a13(db: Session, progress) -> dict[str, Any]:
    decision_check = _decision(progress, "A13")
    contract = _latest_contract(db, "A13")
    event = None
    if contract:
        event = (
            db.query(ContractLifecycleEvent)
            .filter(ContractLifecycleEvent.contract_id == contract.id, ContractLifecycleEvent.event_type == "extension")
            .order_by(ContractLifecycleEvent.id.desc())
            .first()
        )
    previous = event.previous_state if event else {}
    new = event.new_state if event else {}
    lifecycle_ok = bool(
        contract
        and event
        and previous.get("end_date") == "2026-08-31"
        and new.get("end_date") == "2026-11-30"
        and contract.end_date == date(2026, 11, 30)
        and contract.contract_code == "402"
    )
    return _check(
        bool(decision_check["passed"] and lifecycle_ok),
        "Se distingue la prórroga de una transformación y la vigencia anterior queda preservada." if decision_check["passed"] and lifecycle_ok else "La respuesta debe identificar una prórroga y el historial debe conservar el fin 31/08/2026 antes de ampliar a 30/11/2026.",
        {
            "decision": decision_check["evidence"],
            "contract_id": contract.id if contract else None,
            "event_id": event.id if event else None,
            "previous_state": previous,
            "new_state": new,
            "current_end_date": str(contract.end_date) if contract and contract.end_date else None,
        },
        "training_a13_extension_traceability",
    )


def handles_training_hiring_review(assignment, task) -> bool:
    return str(assignment.case_study.scenario_code or "").strip().upper() in HIRING_SCENARIO_CODES


def validate_training_hiring_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    code = SCENARIO_TO_CODE.get(str(assignment.case_study.scenario_code or "").strip().upper())
    if code == "A06":
        check = _decision(progress, "A06")
    elif code == "A08":
        check = _review_a08(db)
    elif code == "A10":
        check = _review_a10(db)
    elif code == "A11":
        check = _review_a11(db)
    elif code == "A12":
        check = _review_a12(db)
    elif code == "A13":
        check = _review_a13(db, progress)
    else:
        raise CaseScenarioError("Actividad B02 no soportada", code="UNSUPPORTED_HIRING_REVIEW", status_code=400)

    passed = bool(check["passed"])
    previous = dict(progress.validation_result or {})
    validation_result = {
        **previous,
        "mode": "explicit_review",
        "validated_at": datetime.utcnow().isoformat(),
        "passed": passed,
        "manual_required": False,
        "checks": [check],
    }
    scenario = update_assignment_step(
        db,
        assignment_id,
        task.id,
        CaseTaskProgressUpdate(
            status="completed" if passed else "in_progress",
            student_notes=progress.student_notes,
            validation_result=validation_result,
        ),
    )
    return {
        "passed": passed,
        "manual_required": False,
        "message": "Comprobación superada." if passed else "La comprobación no se ha superado. Revisa los datos contractuales y la trazabilidad solicitada.",
        "checks": [check],
        "scenario": scenario,
    }
