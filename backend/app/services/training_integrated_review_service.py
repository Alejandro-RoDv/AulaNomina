"""Validación de los capstones C01-C06 reutilizando reglas de los bloques previos."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.document import Document
from app.models.employee import Employee
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.services.case_validation_service import _evaluate_rule
from app.services.training_fiscal_review_service import _review_a40
from app.services.training_social_security_review_service import _review_a33, _review_a34, _review_a35
from app.services.training_termination_review_service import _review_a49, _review_a50, _review_afi
from app.training.integrated_runtime_cases_2026 import C01_EMPLOYEE, C01_REQUIRED_DOCUMENTS, INTEGRATED_SCENARIO_CODES


SCENARIO_TO_CODE = {
    scenario.upper(): code
    for code, scenario in INTEGRATED_SCENARIO_CODES.items()
    if code != "C02"
}


def _check(rule_type: str, passed: bool, message: str, evidence: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence or {},
    }


def _combine(rule_type: str, checks: list[dict[str, Any]], success: str, failure: str) -> dict[str, Any]:
    passed = bool(checks) and all(item.get("passed") for item in checks)
    return _check(
        rule_type,
        passed,
        success if passed else failure,
        {"checks": checks},
    )


def _code(assignment) -> str | None:
    return SCENARIO_TO_CODE.get(str(assignment.case_study.scenario_code or "").strip().upper())


def _generic(db: Session, assignment, rule: dict[str, Any]) -> dict[str, Any]:
    return _evaluate_rule(db, assignment, rule)


def _task_operation_check(assignment, order: int, action_code: str) -> dict[str, Any]:
    """Require evidence produced while the learner is on this capstone step.

    C06 deliberately reuses the same legal scenario as A49/A50. Domain state alone
    would therefore allow a previously completed guided exercise to satisfy the
    capstone. Operation events live inside each assignment/task progress entry, so
    requiring one here proves that the learner has actually executed the operation
    from C06 itself.
    """
    task = next(
        (item for item in assignment.case_study.tasks if int(item.task_order or 0) == int(order)),
        None,
    )
    progress = next(
        (entry for entry in assignment.progress_entries if task and entry.task_id == task.id),
        None,
    )
    events = list((progress.validation_result or {}).get("events") or []) if progress else []
    matching = [
        event
        for event in events
        if event.get("operation_status") == "success" and event.get("action_code") == action_code
    ]
    latest = matching[-1] if matching else None
    return _check(
        f"integrated_task_operation_{action_code}",
        bool(latest),
        (
            "La operación consta ejecutada dentro de este hito del caso integral."
            if latest
            else "Ejecuta la operación desde este hito antes de comprobar el resultado; no se reutiliza el progreso de una práctica guiada anterior."
        ),
        {
            "task_order": order,
            "required_action_code": action_code,
            "event": latest,
        },
    )


def _review_c01(db: Session, assignment, order: int) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    employee_name = state.get("employee")
    if order == 1:
        profile = _generic(
            db,
            assignment,
            {"type": "employee_profile_matches", "employee": employee_name, "employee_data": C01_EMPLOYEE},
        )
        structure = _generic(
            db,
            assignment,
            {
                "type": "employee_assignment",
                "employee": employee_name,
                "company_name": state.get("company_name"),
                "center_name": state.get("center_name"),
            },
        )
        return _combine(
            "integrated_c01_employee",
            [profile, structure],
            "El expediente identifica a Clara y la sitúa en la empresa y centro del encargo.",
            "El expediente todavía no coincide con la identidad o la adscripción organizativa comunicada.",
        )
    if order == 2:
        return _generic(
            db,
            assignment,
            {"type": "active_contract", "employee": employee_name, "contract_family": "indefinite"},
        )
    if order == 3:
        return _generic(
            db,
            assignment,
            {"type": "affiliation_prepared", "employee": employee_name, "registration_date": state.get("start_date")},
        )
    if order == 4:
        employee = db.query(Employee).filter(Employee.dni == C01_EMPLOYEE["dni"]).first()
        documents = (
            db.query(Document).filter(Document.employee_id == employee.id).all()
            if employee
            else []
        )
        by_type = {document.document_type: document for document in documents}
        states = {
            document_type: by_type.get(document_type).status if by_type.get(document_type) else None
            for document_type in C01_REQUIRED_DOCUMENTS
        }
        missing = [document_type for document_type, status in states.items() if status != "received"]
        return _check(
            "integrated_c01_documents",
            not missing,
            (
                "La documentación crítica de la incorporación consta recibida."
                if not missing
                else "El expediente aún tiene documentación crítica ausente o sin estado recibido."
            ),
            {"employee_id": employee.id if employee else None, "states": states, "missing": missing},
        )
    return _generic(
        db,
        assignment,
        {"type": "payroll_recalculated", "employee": employee_name, "period": state.get("payroll_period")},
    )


def _review_c03(db: Session, assignment, order: int) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    employee_name = state.get("employee")
    if order == 1:
        base = _generic(db, assignment, {"type": "seniority_date_checked", "employee": employee_name})
        actual = (base.get("evidence") or {}).get("seniority_date")
        expected = state.get("expected_seniority_date")
        date_ok = bool(base.get("passed") and actual == expected)
        return _check(
            "integrated_c03_cause",
            date_ok,
            (
                "La antigüedad reconocida coincide con la fecha que origina la reclamación."
                if date_ok
                else "La causa todavía no queda demostrada: revisa la fecha reconocida de antigüedad del contrato."
            ),
            {"expected_seniority_date": expected, "actual_seniority_date": actual, "base_check": base},
        )
    if order == 2:
        return _generic(
            db,
            assignment,
            {"type": "payroll_concept_exists", "employee": employee_name, "concept": "antigüedad"},
        )
    if order == 3:
        payroll = _generic(
            db,
            assignment,
            {"type": "payroll_recalculated", "employee": employee_name, "period": state.get("payroll_period")},
        )
        regularization = _generic(
            db,
            assignment,
            {"type": "regularization_created", "employee": employee_name, "period": state.get("payroll_period")},
        )
        return _combine(
            "integrated_c03_regularization",
            [payroll, regularization],
            "La nómina afectada se ha reconstruido y existe una regularización trazable.",
            "Falta recalcular la nómina o registrar la diferencia como regularización del periodo reclamado.",
        )
    return _generic(db, assignment, {"type": "reply_mail"})


def _review_c04(db: Session, assignment, order: int) -> dict[str, Any]:
    check = _review_a40(db, assignment, order)
    return {**check, "rule_type": f"integrated_c04_{order}"}


def _review_c05(db: Session, assignment, order: int) -> dict[str, Any]:
    if order == 1:
        cra = _review_a33(db, assignment)
        settlement = _review_a34(db, assignment)
        return _combine(
            "integrated_c05_origin",
            [cra, settlement],
            "CRA y liquidación nominal están cuadrados antes del envío.",
            "El origen aún no está cerrado: revisa CRA y RNT/RLC antes de interpretar SILTRA.",
        )
    if order == 2:
        rejection = _review_a35(db, assignment, 1)
        correction = _review_a35(db, assignment, 2)
        return _combine(
            "integrated_c05_correction",
            [rejection, correction],
            "El rechazo está identificado y existe una correctora vinculada al fichero original.",
            "Falta obtener un rechazo trazable o generar la correctora desde ese fichero.",
        )
    check = _review_a35(db, assignment, 3)
    return {**check, "rule_type": "integrated_c05_acceptance"}


def _review_c06(db: Session, assignment, order: int) -> dict[str, Any]:
    if order == 1:
        domain = {**_review_a49(db), "rule_type": "integrated_c06_termination_domain"}
        operation = _task_operation_check(assignment, order, "manage_termination")
        return _combine(
            "integrated_c06_termination",
            [domain, operation],
            "La extinción objetiva está correctamente calculada y se ha ejecutado dentro del caso integral.",
            "Registra o actualiza la extinción desde este hito y comprueba que causa, fecha e indemnización sean correctas.",
        )
    if order == 2:
        breakdown = _review_a50(db, 1)
        closed = _review_a50(db, 2)
        operation = _task_operation_check(assignment, order, "manage_termination")
        return _combine(
            "integrated_c06_settlement",
            [breakdown, closed, operation],
            "La liquidación final está desglosada, cerrada y la operación se ha ejecutado dentro del caso integral.",
            "Completa y cierra el finiquito desde este hito; no basta con un resultado dejado por la práctica guiada anterior.",
        )
    if order == 3:
        domain = {**_review_afi(db, "A49"), "rule_type": "integrated_c06_affiliation_domain"}
        operation = _task_operation_check(assignment, order, "prepare_affiliation")
        return _combine(
            "integrated_c06_affiliation",
            [domain, operation],
            "La baja AFI corresponde al cese y ha sido preparada desde el propio caso integral.",
            "Prepara desde este hito la baja AFI del contrato extinguido y comprueba su fecha de efectos.",
        )
    termination = _review_a49(db)
    reply = _generic(db, assignment, {"type": "reply_mail"})
    return _combine(
        "integrated_c06_close",
        [termination, reply],
        "La extinción conserva su referencia documental y el cierre ha sido comunicado en el hilo del caso.",
        "Antes de cerrar, comprueba el soporte documental de la extinción y envía la respuesta profesional del caso.",
    )


def handles_training_integrated_review(assignment, task) -> bool:
    return _code(assignment) in {"C01", "C03", "C04", "C05", "C06"}


def validate_training_integrated_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    code = _code(assignment)
    if not code:
        raise CaseScenarioError("El paso no pertenece a B10", code="UNSUPPORTED_INTEGRATED_REVIEW", status_code=400)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    order = int(task.task_order or 1)
    if code == "C01":
        check = _review_c01(db, assignment, order)
    elif code == "C03":
        check = _review_c03(db, assignment, order)
    elif code == "C04":
        check = _review_c04(db, assignment, order)
    elif code == "C05":
        check = _review_c05(db, assignment, order)
    else:
        check = _review_c06(db, assignment, order)

    passed = bool(check.get("passed"))
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
        "message": (
            "Comprobación integral superada. El expediente puede avanzar."
            if passed
            else "La comprobación integral no se ha superado. Revisa la evidencia del proceso antes de continuar."
        ),
        "checks": [check],
        "scenario": scenario,
    }
