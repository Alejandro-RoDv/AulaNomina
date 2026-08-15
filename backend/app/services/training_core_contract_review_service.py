"""Validaciones reforzadas para contratos nucleares A07 y A09.

Estas prácticas reutilizan casos anteriores al runtime específico de B02. La
validación genérica por familia contractual era insuficiente: ahora se contrasta
el supuesto completo y, en sustitución, la parametrización SS asociada.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.employee import Employee
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)


CORE_CONTRACT_REVIEW_CODES = {"A07", "A09"}


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _task_training_code(assignment, task) -> str | None:
    explicit = (task.trigger_condition or {}).get("training_code")
    if explicit:
        code = str(explicit).strip().upper()
        return code if code in CORE_CONTRACT_REVIEW_CODES else None
    scenario = str(assignment.case_study.scenario_code or "").strip().upper()
    if scenario == "ALT-2026-021" and task.expected_action == "create_contract":
        return "A09"
    return None


def _employee_name(employee: Employee) -> str:
    return " ".join(
        part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part
    )


def _find_employee(db: Session, name: str | None) -> Employee | None:
    expected = _normalize(name)
    if not expected:
        return None
    return next(
        (employee for employee in db.query(Employee).all() if _normalize(_employee_name(employee)) == expected),
        None,
    )


def _latest_contract(db: Session, employee: Employee | None) -> Contract | None:
    if employee is None:
        return None
    return (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id)
        .order_by(Contract.start_date.desc(), Contract.id.desc())
        .first()
    )


def _check(passed: bool, message: str, evidence: dict[str, Any], *, rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _review_a07(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    expected = state.get("contract_data") or {}
    employee = _find_employee(db, state.get("employee"))
    contract = _latest_contract(db, employee)

    family_text = _normalize(" ".join(
        str(value or "")
        for value in [
            contract.contract_family if contract else None,
            contract.contract_type if contract else None,
            contract.contract_code_description if contract else None,
        ]
    ))
    indefinite_ok = bool(contract and ("indefinite" in family_text or "indefinid" in family_text))
    date_ok = bool(contract and str(contract.start_date) == str(state.get("start_date")))
    status_ok = bool(contract and _normalize(contract.status) == "active")
    workday_ok = bool(
        contract
        and contract.working_day_type == expected.get("working_day_type")
        and abs(float(contract.weekly_hours or 0) - float(expected.get("weekly_hours") or 0)) < 0.01
    )
    job_ok = bool(
        contract
        and _normalize(contract.job_position) == _normalize(expected.get("job_position"))
    )
    company_ok = bool(
        contract
        and contract.company
        and _normalize(contract.company.name) == _normalize(state.get("company_name"))
    )
    center_ok = bool(
        contract
        and contract.work_center
        and _normalize(contract.work_center.name) == _normalize(state.get("center_name"))
    )
    passed = all([indefinite_ok, date_ok, status_ok, workday_ok, job_ok, company_ok, center_ok])

    return _check(
        passed,
        (
            "El contrato indefinido reproduce fecha, jornada, puesto, empresa y centro del supuesto."
            if passed
            else "Revisa modalidad, fecha de inicio, jornada, puesto y adscripción; no basta con que exista un contrato indefinido."
        ),
        {
            "employee_id": employee.id if employee else None,
            "contract_id": contract.id if contract else None,
            "contract_code": contract.contract_code if contract else None,
            "contract_family": contract.contract_family if contract else None,
            "contract_type": contract.contract_type if contract else None,
            "start_date": str(contract.start_date) if contract else None,
            "working_day_type": contract.working_day_type if contract else None,
            "weekly_hours": contract.weekly_hours if contract else None,
            "job_position": contract.job_position if contract else None,
            "company": contract.company.name if contract and contract.company else None,
            "center": contract.work_center.name if contract and contract.work_center else None,
            "checks": {
                "indefinite": indefinite_ok,
                "start_date": date_ok,
                "active": status_ok,
                "workday": workday_ok,
                "job_position": job_ok,
                "company": company_ok,
                "center": center_ok,
            },
        },
        rule_type="training_a07_indefinite_contract",
    )


def _review_a09(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    employee = _find_employee(db, state.get("substitute") or state.get("employee"))
    contract = _latest_contract(db, employee)
    ss = contract.ss_registration if contract else None

    family_text = _normalize(" ".join(
        str(value or "")
        for value in [
            contract.contract_family if contract else None,
            contract.contract_type if contract else None,
            contract.contract_code_description if contract else None,
        ]
    ))
    substitution_ok = bool(contract and ("replacement" in family_text or "sustit" in family_text or "interinidad" in family_text))
    date_ok = bool(contract and str(contract.start_date) == str(state.get("start_date")))
    status_ok = bool(contract and _normalize(contract.status) == "active")
    ss_replacement_ok = bool(
        ss
        and ss.is_replacement
        and str(ss.replacement_cause_code or "").strip()
        and str(ss.replaced_worker_naf or "").strip()
    )

    replaced_employee = _find_employee(db, state.get("replaced_employee"))
    replaced_naf_matches = True
    if replaced_employee and replaced_employee.naf:
        replaced_naf_matches = _normalize(ss.replaced_worker_naf if ss else None) == _normalize(replaced_employee.naf)

    workday_ok = bool(
        contract
        and contract.weekly_hours
        and float(contract.weekly_hours) > 0
    )
    passed = all([substitution_ok, date_ok, status_ok, ss_replacement_ok, replaced_naf_matches, workday_ok])

    return _check(
        passed,
        (
            "El contrato de sustitución identifica fecha, jornada, causa y persona sustituida."
            if passed
            else "Revisa la modalidad de sustitución y completa en Seguridad Social causa y NAF de la persona sustituida."
        ),
        {
            "employee_id": employee.id if employee else None,
            "contract_id": contract.id if contract else None,
            "contract_code": contract.contract_code if contract else None,
            "contract_family": contract.contract_family if contract else None,
            "contract_type": contract.contract_type if contract else None,
            "start_date": str(contract.start_date) if contract else None,
            "weekly_hours": contract.weekly_hours if contract else None,
            "is_replacement": bool(ss and ss.is_replacement),
            "replacement_cause_code": ss.replacement_cause_code if ss else None,
            "replaced_worker_naf": ss.replaced_worker_naf if ss else None,
            "expected_replaced_employee": state.get("replaced_employee"),
            "expected_replaced_naf": replaced_employee.naf if replaced_employee else None,
            "replaced_naf_matches": replaced_naf_matches,
        },
        rule_type="training_a09_substitution_contract",
    )


def handles_training_core_contract_review(assignment, task) -> bool:
    return _task_training_code(assignment, task) in CORE_CONTRACT_REVIEW_CODES


def validate_training_core_contract_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    code = _task_training_code(assignment, task)
    if code not in CORE_CONTRACT_REVIEW_CODES:
        raise CaseScenarioError("Actividad contractual no soportada", code="UNSUPPORTED_CORE_CONTRACT_REVIEW", status_code=400)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    check = _review_a07(db, assignment) if code == "A07" else _review_a09(db, assignment)
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
        "message": "Comprobación contractual superada." if passed else "La comprobación contractual no se ha superado.",
        "checks": [check],
        "scenario": scenario,
    }
