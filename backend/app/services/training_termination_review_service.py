"""Validación pedagógica bajo demanda para A46-A50."""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.communication_file import CommunicationFile
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.employment_termination import EmploymentTermination
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.training.termination_runtime_cases_2026 import TERMINATION_EMPLOYEES


TERMINATION_SCENARIOS = {
    "TRAIN-2026-TERM-A46": "A46",
    "TRAIN-2026-TERM-A47": "A47",
    "TRAIN-2026-TERM-A48": "A48",
    "TRAIN-2026-TERM-A49": "A49",
    "TRAIN-2026-TERM-A50": "A50",
}
MONEY_TOLERANCE = Decimal("0.05")


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _close(left: Any, right: Any) -> bool:
    return abs(_money(left) - _money(right)) <= MONEY_TOLERANCE


def _json(value: Any, fallback: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value or "")
    except (TypeError, ValueError):
        return fallback


def _check(passed: bool, message: str, evidence: dict[str, Any], rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _activity_code(assignment) -> str | None:
    return TERMINATION_SCENARIOS.get(str(assignment.case_study.scenario_code or "").strip().upper())


def _training_key(code: str) -> str:
    return "A49" if code == "A50" else code


def _employee(db: Session, code: str) -> Employee | None:
    data = TERMINATION_EMPLOYEES[_training_key(code)]
    return db.query(Employee).filter(Employee.dni == data["dni"]).first()


def _contract(db: Session, code: str) -> Contract | None:
    employee = _employee(db, code)
    if employee is None:
        return None
    data = TERMINATION_EMPLOYEES[_training_key(code)]
    return (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id, Contract.start_date == data["start_date"])
        .first()
    )


def _termination(db: Session, code: str) -> EmploymentTermination | None:
    contract = _contract(db, code)
    if contract is None:
        return None
    return db.query(EmploymentTermination).filter(EmploymentTermination.contract_id == contract.id).first()


def _baja_draft(db: Session, contract: Contract | None, effective_date: str) -> tuple[CommunicationFile | None, dict[str, Any] | None]:
    if contract is None:
        return None, None
    files = (
        db.query(CommunicationFile)
        .filter(CommunicationFile.file_type == "AFFILIATION", CommunicationFile.company_id == contract.company_id)
        .order_by(CommunicationFile.id.desc())
        .all()
    )
    expected_key = f"B:{contract.id}:{effective_date}"
    for source in files:
        payload = _json(source.content, {})
        movement = next(
            (item for item in (payload.get("movements") or []) if item.get("movement_key") == expected_key),
            None,
        )
        if movement:
            return source, movement
    return None, None


def _review_afi(db: Session, code: str) -> dict[str, Any]:
    contract = _contract(db, code)
    data = TERMINATION_EMPLOYEES[_training_key(code)]
    effective_date = data["effective_date"].isoformat()
    source, movement = _baja_draft(db, contract, effective_date)
    passed = bool(
        source
        and movement
        and movement.get("movement_type") == "BAJA"
        and movement.get("effective_date") == effective_date
        and int(movement.get("contract_id") or 0) == int(contract.id if contract else 0)
    )
    return _check(
        passed,
        (
            "La baja AFI está preparada con el mismo contrato y fecha de efectos que la extinción."
            if passed
            else "Prepara un borrador AFI con el movimiento BAJA del contrato y la fecha de efectos del cese."
        ),
        {
            "communication_file_id": source.id if source else None,
            "file_status": source.status if source else None,
            "movement": movement,
            "expected_movement_key": f"B:{contract.id if contract else 'x'}:{effective_date}",
        },
        "training_termination_afi_baja",
    )


def _review_a46(db: Session, order: int) -> dict[str, Any]:
    if order == 2:
        return _review_afi(db, "A46")
    data = TERMINATION_EMPLOYEES["A46"]
    contract = _contract(db, "A46")
    record = _termination(db, "A46")
    passed = bool(
        record
        and contract
        and record.reason_code == "voluntary_resignation"
        and record.ss_situation_code == "51"
        and record.effective_date == data["effective_date"]
        and str(record.communication_date) == "2026-10-01"
        and _close(record.indemnity_amount, 0)
        and contract.status == "ended"
        and contract.end_date == data["effective_date"]
        and contract.termination_reason == "51"
    )
    return _check(
        passed,
        (
            "La dimisión está registrada con código 51, fecha coherente y sin indemnización."
            if passed
            else "Registra la baja voluntaria con comunicación 01/10/2026, efectos 15/10/2026, código RED 51 y sin indemnización."
        ),
        {
            "termination_id": record.id if record else None,
            "reason_code": record.reason_code if record else None,
            "ss_situation_code": record.ss_situation_code if record else None,
            "communication_date": str(record.communication_date) if record and record.communication_date else None,
            "effective_date": str(record.effective_date) if record else None,
            "indemnity_amount": float(record.indemnity_amount) if record else None,
            "contract_status": contract.status if contract else None,
            "contract_end_date": str(contract.end_date) if contract and contract.end_date else None,
        },
        "training_a46_voluntary_termination",
    )


def _review_a47(db: Session, order: int) -> dict[str, Any]:
    if order == 2:
        return _review_afi(db, "A47")
    data = TERMINATION_EMPLOYEES["A47"]
    contract = _contract(db, "A47")
    record = _termination(db, "A47")
    expected_indemnity = Decimal("22400") / Decimal("365") * Decimal("12")
    passed = bool(
        record
        and contract
        and record.reason_code == "temporary_expiry"
        and record.ss_situation_code == "93"
        and record.effective_date == data["effective_date"]
        and int(record.service_months or 0) == 12
        and _close(record.indemnity_days_per_year, 12)
        and _close(record.indemnity_days, 12)
        and _close(record.indemnity_amount, expected_indemnity)
        and contract.status == "ended"
        and contract.termination_reason == "93"
    )
    return _check(
        passed,
        (
            "La expiración temporal usa código 93 y la indemnización de 12 días/año correspondiente al supuesto."
            if passed
            else "Registra el fin temporal el 31/10/2026 y revisa que se aplique la regla de 12 días/año y código RED 93."
        ),
        {
            "termination_id": record.id if record else None,
            "service_months": record.service_months if record else None,
            "days_per_year": float(record.indemnity_days_per_year) if record else None,
            "indemnity_days": float(record.indemnity_days) if record else None,
            "indemnity_amount": float(record.indemnity_amount) if record else None,
            "expected_indemnity_amount": float(_money(expected_indemnity)),
            "ss_situation_code": record.ss_situation_code if record else None,
        },
        "training_a47_temporary_expiry",
    )


def _review_a48(db: Session, order: int) -> dict[str, Any]:
    if order == 2:
        return _review_afi(db, "A48")
    data = TERMINATION_EMPLOYEES["A48"]
    contract = _contract(db, "A48")
    record = _termination(db, "A48")
    passed = bool(
        record
        and contract
        and record.reason_code == "disciplinary_dismissal"
        and record.ss_situation_code == "53"
        and record.effective_date == data["effective_date"]
        and record.document_reference == "CARTA-DISC-A48-2026"
        and _close(record.indemnity_amount, 0)
        and contract.status == "ended"
    )
    return _check(
        passed,
        (
            "El despido disciplinario está documentado, usa código 53 y no genera indemnización en el supuesto procedente."
            if passed
            else "Registra el despido disciplinario con efectos 20/11/2026 y referencia CARTA-DISC-A48-2026."
        ),
        {
            "termination_id": record.id if record else None,
            "reason_code": record.reason_code if record else None,
            "ss_situation_code": record.ss_situation_code if record else None,
            "document_reference": record.document_reference if record else None,
            "indemnity_amount": float(record.indemnity_amount) if record else None,
        },
        "training_a48_disciplinary_dismissal",
    )


def _review_a49(db: Session) -> dict[str, Any]:
    data = TERMINATION_EMPLOYEES["A49"]
    record = _termination(db, "A49")
    trace = dict(record.calculation_trace or {}) if record else {}
    indemnity_trace = trace.get("indemnity") or {}
    passed = bool(
        record
        and record.reason_code == "objective_dismissal"
        and record.ss_situation_code == "91"
        and record.effective_date == data["effective_date"]
        and record.document_reference == "CARTA-OBJ-A49-2026"
        and _close(record.annual_salary_reference, 43800)
        and int(record.service_months or 0) == 36
        and _close(record.indemnity_days_per_year, 20)
        and _close(record.indemnity_days, 60)
        and _close(record.indemnity_amount, 7200)
        and str(indemnity_trace.get("amount")) == "7200.00"
    )
    return _check(
        passed,
        (
            "La indemnización objetiva queda trazada: 36 meses, 20 días/año, 60 días y 7.200,00 €."
            if passed
            else "Revisa causa, salario anual 43.800 €, tiempo de servicio y regla de 20 días/año hasta obtener 7.200,00 €."
        ),
        {
            "termination_id": record.id if record else None,
            "annual_salary_reference": float(record.annual_salary_reference) if record else None,
            "service_months": record.service_months if record else None,
            "days_per_year": float(record.indemnity_days_per_year) if record else None,
            "indemnity_days": float(record.indemnity_days) if record else None,
            "indemnity_amount": float(record.indemnity_amount) if record else None,
            "trace": indemnity_trace,
        },
        "training_a49_objective_indemnity",
    )


def _review_a50(db: Session, order: int) -> dict[str, Any]:
    record = _termination(db, "A50")
    breakdown_ok = bool(
        record
        and _close(record.pending_salary_days, 10)
        and _close(record.pending_salary_amount, 1000)
        and _close(record.unused_vacation_days, 5)
        and _close(record.vacation_amount, 500)
        and _close(record.extra_pay_amount, 1500)
        and _close(record.indemnity_amount, 7200)
        and _close(record.other_amount, 0)
        and _close(record.total_settlement, 10200)
    )
    if order == 1:
        return _check(
            breakdown_ok,
            (
                "El finiquito separa salario, vacaciones, pagas e indemnización y suma 10.200,00 €."
                if breakdown_ok
                else "Completa 10 días de salario, 5 de vacaciones y 1.500 € de pagas manteniendo separada la indemnización de 7.200 €."
            ),
            {
                "termination_id": record.id if record else None,
                "pending_salary_days": float(record.pending_salary_days) if record else None,
                "pending_salary_amount": float(record.pending_salary_amount) if record else None,
                "unused_vacation_days": float(record.unused_vacation_days) if record else None,
                "vacation_amount": float(record.vacation_amount) if record else None,
                "extra_pay_amount": float(record.extra_pay_amount) if record else None,
                "indemnity_amount": float(record.indemnity_amount) if record else None,
                "total_settlement": float(record.total_settlement) if record else None,
            },
            "training_a50_settlement_breakdown",
        )

    trace = dict(record.calculation_trace or {}) if record else {}
    passed = bool(breakdown_ok and record.status == "settled" and trace.get("finalized") is True and trace.get("finalized_total") == "10200.00")
    return _check(
        passed,
        (
            "El finiquito está cerrado por 10.200,00 € y conserva el desglose final en su traza."
            if passed
            else "Cierra el finiquito cuando el desglose sume 10.200,00 € y comprueba que el expediente quede en estado settled."
        ),
        {
            "termination_id": record.id if record else None,
            "status": record.status if record else None,
            "total_settlement": float(record.total_settlement) if record else None,
            "finalized": trace.get("finalized"),
            "finalized_total": trace.get("finalized_total"),
        },
        "training_a50_settlement_closed",
    )


def handles_training_termination_review(assignment, task) -> bool:
    return _activity_code(assignment) in {"A46", "A47", "A48", "A49", "A50"}


def validate_training_termination_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    code = _activity_code(assignment)
    if not code:
        raise CaseScenarioError("El paso no pertenece al bloque de extinciones", code="UNSUPPORTED_TRAINING_REVIEW", status_code=400)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    order = int(task.task_order or 1)
    if code == "A46":
        check = _review_a46(db, order)
    elif code == "A47":
        check = _review_a47(db, order)
    elif code == "A48":
        check = _review_a48(db, order)
    elif code == "A49":
        check = _review_a49(db)
    else:
        check = _review_a50(db, order)

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
            "Comprobación superada. La extinción y sus efectos están correctamente registrados."
            if check["passed"]
            else "La comprobación no se ha superado. Revisa causa, fechas, cálculo o cierre administrativo antes de continuar."
        ),
        "checks": [check],
        "scenario": scenario,
    }
