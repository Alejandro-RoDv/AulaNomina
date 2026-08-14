"""Validadores bajo demanda para las prácticas A23-A27.

Las operaciones de alta de incidencias siguen pasando por el motor general de
casos. Este servicio valida los pasos pedagógicos que necesitan interpretar el
estado resultante: contingencia médica, vacaciones, ausencia y cambio de jornada.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.payroll import Payroll
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.services.incident_service import ABSENCE_LIKE_TYPES


INCIDENT_SCENARIO_CODES = {
    "TRAIN-2026-INCIDENT-A23": "A23",
    "TRAIN-2026-INCIDENT-A24": "A24",
    "TRAIN-2026-INCIDENT-A25": "A25",
    "TRAIN-2026-INCIDENT-A26": "A26",
    "TRAIN-2026-INCIDENT-A27": "A27",
}
TOLERANCE = Decimal("0.05")


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _close(left: Any, right: Any, tolerance: Decimal = TOLERANCE) -> bool:
    return abs(_money(left) - _money(right)) <= tolerance


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


def _scenario_code(assignment) -> str:
    return str(assignment.case_study.scenario_code or "").strip().upper()


def _activity_code(assignment) -> str | None:
    return INCIDENT_SCENARIO_CODES.get(_scenario_code(assignment))


def _incident_state(assignment) -> dict[str, Any]:
    return dict((assignment.case_study.initial_state or {}).get("incident_data") or {})


def _parse_period(value: str | None) -> tuple[int, int] | None:
    try:
        year, month = str(value or "").split("-", 1)
        return int(year), int(month)
    except (TypeError, ValueError):
        return None


def _target_incident(db: Session, assignment) -> Incident | None:
    state = assignment.case_study.initial_state or {}
    expected = _incident_state(assignment)
    employee = _find_employee(db, state.get("employee") or state.get("substitute"))
    if not employee:
        return None

    rows = (
        db.query(Incident)
        .filter(Incident.employee_id == employee.id)
        .order_by(Incident.id.desc())
        .all()
    )
    expected_type = _normalize(expected.get("incident_type"))
    expected_start = str(expected.get("start_date") or "")
    expected_end = str(expected.get("end_date") or "")
    for incident in rows:
        if incident.is_cancelled or _normalize(incident.status) == "cancelled":
            continue
        if expected_type and _normalize(incident.incident_type) != expected_type:
            continue
        if expected_start and str(incident.start_date) != expected_start:
            continue
        if expected_end and str(incident.end_date or "") != expected_end:
            continue
        return incident
    return None


def _target_payroll(db: Session, assignment) -> Payroll | None:
    state = assignment.case_study.initial_state or {}
    employee = _find_employee(db, state.get("employee") or state.get("substitute"))
    period = _parse_period(state.get("payroll_period"))
    if not employee or not period:
        return None
    year, month = period
    return (
        db.query(Payroll)
        .filter(
            Payroll.employee_id == employee.id,
            Payroll.period_year == year,
            Payroll.period_month == month,
        )
        .order_by(Payroll.id.desc())
        .first()
    )


def _is_calculated(payroll: Payroll | None) -> bool:
    return bool(
        payroll
        and (
            (payroll.calculation_version or 0) > 0
            or payroll.last_calculated_at is not None
            or _normalize(payroll.status) in {"calculated", "generated", "confirmed", "reviewed", "closed"}
        )
    )


def _check(passed: bool, message: str, evidence: dict[str, Any]) -> dict[str, Any]:
    return {
        "rule_type": "training_incident_review",
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _review_medical_payroll(db: Session, assignment, *, process_type: str, benefit_rate: Decimal) -> dict[str, Any]:
    incident = _target_incident(db, assignment)
    payroll = _target_payroll(db, assignment)
    expected = _incident_state(assignment)
    expected_days = int(expected.get("expected_days") or 0)
    actual_process = str((incident.details or {}).get("process_type") or "") if incident else ""
    process_matches = _normalize(actual_process) == _normalize(process_type)
    incident_matches = bool(incident and process_matches)

    calculated = _is_calculated(payroll)
    it_days = int(payroll.it_days or 0) if payroll else 0
    days_match = calculated and it_days == expected_days

    benefit_matches = False
    company_complement_matches = False
    expected_benefit = Decimal("0.00")
    expected_company_complement = Decimal("0.00")
    if calculated and payroll and expected_days > 0:
        daily_salary = _money(payroll.base_salary) / Decimal("30")
        expected_benefit = _money(daily_salary * Decimal(expected_days) * benefit_rate)
        expected_company_complement = _money(
            daily_salary * Decimal(expected_days) * (Decimal("1.00") - benefit_rate)
        )
        benefit_matches = _close(payroll.temporary_disability_benefit, expected_benefit)
        company_complement_matches = _close(
            payroll.company_disability_complement,
            expected_company_complement,
        )

    passed = incident_matches and days_match and benefit_matches and company_complement_matches
    return _check(
        passed,
        (
            "La incidencia y la nómina reflejan la contingencia médica y el tratamiento económico esperado."
            if passed
            else "Revisa el tipo de proceso médico, las fechas y el cálculo de la nómina del periodo."
        ),
        {
            "incident_id": incident.id if incident else None,
            "expected_process_type": process_type,
            "actual_process_type": actual_process or None,
            "process_matches": process_matches,
            "payroll_id": payroll.id if payroll else None,
            "expected_it_days": expected_days,
            "actual_it_days": it_days,
            "expected_benefit": str(expected_benefit),
            "actual_benefit": str(_money(payroll.temporary_disability_benefit)) if payroll else None,
            "expected_company_complement": str(expected_company_complement),
            "actual_company_complement": str(_money(payroll.company_disability_complement)) if payroll else None,
            "benefit_matches": benefit_matches,
            "company_complement_matches": company_complement_matches,
        },
    )


def _review_vacation(db: Session, assignment) -> dict[str, Any]:
    incident = _target_incident(db, assignment)
    expected = _incident_state(assignment)
    employee = _find_employee(db, (assignment.case_study.initial_state or {}).get("employee"))
    conflicts: list[int] = []
    if incident and employee:
        start = incident.start_date
        end = incident.end_date or incident.start_date
        for other in db.query(Incident).filter(Incident.employee_id == employee.id, Incident.id != incident.id).all():
            if other.is_cancelled or other.incident_type not in ABSENCE_LIKE_TYPES:
                continue
            other_end = other.end_date or other.start_date
            if other.start_date <= end and other_end >= start:
                conflicts.append(other.id)

    expected_day_type = str(expected.get("vacation_day_type") or "")
    actual_day_type = str((incident.details or {}).get("vacation_day_type") or "") if incident else ""
    day_type_matches = not expected_day_type or actual_day_type == expected_day_type
    passed = bool(incident and not conflicts and day_type_matches)
    return _check(
        passed,
        (
            "El periodo de vacaciones coincide con el caso y no presenta solapamientos incompatibles."
            if passed
            else "Revisa la fecha final, el tipo de días o las incidencias que se solapan con las vacaciones."
        ),
        {
            "incident_id": incident.id if incident else None,
            "start_date": str(incident.start_date) if incident else None,
            "end_date": str(incident.end_date) if incident and incident.end_date else None,
            "expected_end_date": expected.get("end_date"),
            "vacation_day_type": actual_day_type or None,
            "conflicting_incident_ids": conflicts,
        },
    )


def _review_unpaid_absence(db: Session, assignment) -> dict[str, Any]:
    incident = _target_incident(db, assignment)
    payroll = _target_payroll(db, assignment)
    expected = _incident_state(assignment)
    expected_days = int(expected.get("expected_non_contribution_days") or expected.get("expected_days") or 0)
    paid_matches = bool(incident and incident.paid is False)
    calculated = _is_calculated(payroll)
    non_contribution_days = int(payroll.non_contribution_days or 0) if payroll else 0
    contribution_effect = calculated and non_contribution_days == expected_days
    salary_effect = bool(
        calculated
        and payroll
        and _money(payroll.worked_base_salary) < _money(payroll.base_salary)
    )
    passed = bool(incident and paid_matches and contribution_effect and salary_effect)
    return _check(
        passed,
        (
            "La ausencia está clasificada como no retribuida y reduce cotización y salario del periodo."
            if passed
            else "Revisa la clasificación retributiva de la ausencia y vuelve a calcular la nómina de agosto."
        ),
        {
            "incident_id": incident.id if incident else None,
            "paid": incident.paid if incident else None,
            "payroll_id": payroll.id if payroll else None,
            "expected_non_contribution_days": expected_days,
            "actual_non_contribution_days": non_contribution_days,
            "base_salary": str(_money(payroll.base_salary)) if payroll else None,
            "worked_base_salary": str(_money(payroll.worked_base_salary)) if payroll else None,
            "salary_effect": salary_effect,
        },
    )


def _active_contract(db: Session, assignment) -> Contract | None:
    employee = _find_employee(db, (assignment.case_study.initial_state or {}).get("employee"))
    if not employee:
        return None
    return (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id, Contract.status == "active")
        .order_by(Contract.id.desc())
        .first()
    )


def _review_workday_contract(db: Session, assignment) -> dict[str, Any]:
    contract = _active_contract(db, assignment)
    expected = (assignment.case_study.initial_state or {}).get("workday_change") or {}
    target_hours = Decimal(str(expected.get("target_weekly_hours") or 0))
    target_full = Decimal(str(expected.get("full_time_weekly_hours") or 40))
    target_partiality = Decimal(str(expected.get("target_partiality_coefficient") or 0))
    hours_match = bool(contract and _close(contract.weekly_hours, target_hours, Decimal("0.01")))
    full_match = bool(contract and _close(contract.full_time_weekly_hours, target_full, Decimal("0.01")))
    partiality_match = bool(contract and _close(contract.partiality_coefficient, target_partiality, Decimal("0.01")))
    type_match = bool(
        contract
        and _normalize(contract.working_day_type) == _normalize(expected.get("target_working_day_type"))
    )
    passed = hours_match and full_match and partiality_match and type_match
    return _check(
        passed,
        (
            "El contrato vigente refleja 30 horas semanales y una parcialidad del 75 %."
            if passed
            else "La jornada, la referencia de jornada completa o el coeficiente de parcialidad no coinciden con el cambio solicitado."
        ),
        {
            "contract_id": contract.id if contract else None,
            "weekly_hours": contract.weekly_hours if contract else None,
            "full_time_weekly_hours": contract.full_time_weekly_hours if contract else None,
            "partiality_coefficient": contract.partiality_coefficient if contract else None,
            "working_day_type": contract.working_day_type if contract else None,
            "hours_match": hours_match,
            "partiality_match": partiality_match,
            "type_match": type_match,
        },
    )


def _review_workday_payroll(db: Session, assignment) -> dict[str, Any]:
    contract = _active_contract(db, assignment)
    payroll = _target_payroll(db, assignment)
    expected = (assignment.case_study.initial_state or {}).get("workday_change") or {}
    target_partiality = Decimal(str(expected.get("target_partiality_coefficient") or 0))
    calculated = _is_calculated(payroll)
    expected_base = Decimal("0.00")
    actual_base = _money(payroll.base_salary) if payroll else Decimal("0.00")
    if contract:
        expected_base = _money(_money(contract.salary_base) * target_partiality / Decimal("100"))
    base_matches = bool(calculated and contract and _close(actual_base, expected_base))
    passed = base_matches
    return _check(
        passed,
        (
            "La nómina recalculada aplica al salario base la parcialidad del 75 %."
            if passed
            else "La nómina de noviembre no refleja todavía la nueva parcialidad contractual."
        ),
        {
            "contract_id": contract.id if contract else None,
            "payroll_id": payroll.id if payroll else None,
            "target_partiality_coefficient": str(target_partiality),
            "contract_salary_base": str(_money(contract.salary_base)) if contract else None,
            "expected_payroll_base": str(expected_base),
            "actual_payroll_base": str(actual_base),
            "base_matches": base_matches,
        },
    )


def handles_training_incident_review(assignment, task) -> bool:
    code = _activity_code(assignment)
    if not code:
        return False
    review_steps = {
        "A23": {3},
        "A24": {2},
        "A25": {2},
        "A26": {2},
        "A27": {1, 2},
    }
    return int(task.task_order or 0) in review_steps.get(code, set())


def validate_training_incident_review(
    db: Session,
    assignment_id: int,
    task_id: int,
) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    if not handles_training_incident_review(assignment, task):
        raise CaseScenarioError("El paso no es una revisión de incidencias", code="UNSUPPORTED_TRAINING_REVIEW", status_code=400)

    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    code = _activity_code(assignment)
    order = int(task.task_order or 0)
    if code == "A23":
        check = _review_medical_payroll(db, assignment, process_type="common_disease", benefit_rate=Decimal("0.60"))
    elif code == "A24":
        check = _review_medical_payroll(db, assignment, process_type="work_accident", benefit_rate=Decimal("0.75"))
    elif code == "A25":
        check = _review_vacation(db, assignment)
    elif code == "A26":
        check = _review_unpaid_absence(db, assignment)
    elif code == "A27" and order == 1:
        check = _review_workday_contract(db, assignment)
    elif code == "A27" and order == 2:
        check = _review_workday_payroll(db, assignment)
    else:
        raise CaseScenarioError("Revisión pedagógica no configurada", code="UNSUPPORTED_TRAINING_REVIEW", status_code=400)

    previous = dict(progress.validation_result or {})
    validation_result = {
        **previous,
        "mode": "explicit_review",
        "validated_at": datetime.utcnow().isoformat(),
        "passed": bool(check["passed"]),
        "manual_required": False,
        "checks": [check],
    }
    scenario = update_assignment_step(
        db,
        assignment_id,
        task.id,
        CaseTaskProgressUpdate(
            status="completed" if check["passed"] else "in_progress",
            student_notes=progress.student_notes,
            validation_result=validation_result,
        ),
    )
    return {
        "passed": bool(check["passed"]),
        "manual_required": False,
        "message": (
            "Comprobación superada. El resultado del ejercicio es coherente."
            if check["passed"]
            else "La comprobación no se ha superado. Revisa los datos del caso y el resultado del ERP."
        ),
        "checks": [check],
        "scenario": scenario,
    }
