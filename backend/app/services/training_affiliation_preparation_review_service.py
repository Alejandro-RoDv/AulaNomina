"""Validación reforzada de A29 · Preparar alta de afiliación.

La existencia de SocialSecurityRegistration forma parte de la parametrización del
contrato, pero no demuestra que el alumno haya preparado el movimiento RED. A29
se completa únicamente cuando una remesa de afiliación contiene el ALTA correcta.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.communication_file import CommunicationFile
from app.models.contract import Contract
from app.models.employee import Employee
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.services.communication_file_workflow import CommunicationFileType, normalize_ccc


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _training_code(task) -> str | None:
    code = (task.trigger_condition or {}).get("training_code")
    return str(code).strip().upper() if code else None


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


def _active_contract(db: Session, employee: Employee | None) -> Contract | None:
    if not employee:
        return None
    return (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id, Contract.status == "active")
        .order_by(Contract.start_date.desc(), Contract.id.desc())
        .first()
    )


def _expected_ccc(contract: Contract | None) -> str | None:
    if not contract:
        return None
    center = contract.work_center
    company = contract.company
    return normalize_ccc(
        getattr(center, "main_ccc", None)
        or getattr(center, "general_ccc", None)
        or getattr(company, "ccc", None)
    )


def _json_payload(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _check(passed: bool, message: str, evidence: dict[str, Any]) -> dict[str, Any]:
    return {
        "rule_type": "training_a29_affiliation_draft",
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _review_a29(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    employee = _find_employee(db, state.get("employee"))
    contract = _active_contract(db, employee)
    expected_date = str(state.get("start_date") or "")
    period = expected_date[:7]
    expected_ccc = _expected_ccc(contract)

    files = []
    if contract and period:
        files = (
            db.query(CommunicationFile)
            .filter(
                CommunicationFile.company_id == contract.company_id,
                CommunicationFile.file_type == CommunicationFileType.AFFILIATION.value,
                CommunicationFile.period == period,
            )
            .order_by(CommunicationFile.id.desc())
            .all()
        )

    source = None
    target = None
    for candidate in files:
        movements = _json_payload(candidate.content).get("movements") or []
        match = next(
            (
                movement
                for movement in movements
                if str(movement.get("movement_type") or "").upper() == "ALTA"
                and str(movement.get("effective_date") or "") == expected_date
                and int(movement.get("employee_id") or 0) == (employee.id if employee else -1)
                and int(movement.get("contract_id") or 0) == (contract.id if contract else -1)
            ),
            None,
        )
        if match:
            source = candidate
            target = match
            break

    ccc_ok = bool(target and normalize_ccc(target.get("ccc")) == expected_ccc)
    identity_ok = bool(
        target
        and employee
        and _normalize(target.get("employee_name")) == _normalize(_employee_name(employee))
        and _normalize(target.get("dni")) == _normalize(employee.dni)
        and normalize_ccc(target.get("naf")) == normalize_ccc(employee.naf)
    )
    prepared = bool(source and target)
    passed = prepared and ccc_ok and identity_ok

    return _check(
        passed,
        (
            "El movimiento ALTA está cargado en una remesa con trabajador, contrato, fecha, NAF y CCC coherentes."
            if passed
            else "Selecciona el alta del trabajador en Afiliación y cárgala en una remesa; la parametrización SS del contrato por sí sola no completa A29."
        ),
        {
            "communication_file_id": source.id if source else None,
            "file_status": source.status if source else None,
            "contract_id": contract.id if contract else None,
            "employee_id": employee.id if employee else None,
            "movement": target,
            "expected_effective_date": expected_date or None,
            "expected_ccc": expected_ccc,
            "ccc_ok": ccc_ok,
            "identity_ok": identity_ok,
            "prepared": prepared,
        },
    )


def handles_training_affiliation_preparation_review(assignment, task) -> bool:
    return _training_code(task) == "A29"


def validate_training_affiliation_preparation_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    if _training_code(task) != "A29":
        raise CaseScenarioError("Actividad de afiliación no soportada", code="UNSUPPORTED_A29_REVIEW", status_code=400)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    check = _review_a29(db, assignment)
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
        "message": "Alta de afiliación preparada correctamente." if passed else "El movimiento ALTA todavía no está preparado en una remesa válida.",
        "checks": [check],
        "scenario": scenario,
    }
