"""Validación específica de C02 · IT, sustitución y comunicaciones.

C02 reutiliza el caso profesional LAB-2026-001. Parte de sus datos existen en la
demo para alimentar otras pantallas, de modo que comprobar solo el estado final
permitiría avanzar sin ejecutar el capstone. Cada hito exige aquí la evidencia de
dominio y, cuando corresponde, una operación realizada dentro del propio paso.
"""

from __future__ import annotations

import json
import unicodedata
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.affiliation_worker_state import AffiliationWorkerState
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
from app.services.training_integrated_review_service import _check, _combine, _generic, _task_operation_check


C02_SCENARIO_CODE = "LAB-2026-001"
MARTA_PROFILE = {
    "first_name": "Marta",
    "last_name": "Ruiz",
    "second_last_name": "Córdoba",
    "dni": "20000006F",
    "naf": "141000000106",
    "birth_date": "1994-09-19",
    "email": "marta.ruiz@aulanomina.demo",
}
TERMINAL_OK_STATUSES = {"ACCEPTED", "ACCEPTED_WITH_WARNINGS"}


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _digits(value: Any) -> str:
    return "".join(character for character in str(value or "") if character.isdigit())


def _employee_name(employee: Employee | None) -> str:
    if not employee:
        return ""
    return " ".join(part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part)


def _find_employee(db: Session, name: str) -> Employee | None:
    expected = _normalize(name)
    return next(
        (employee for employee in db.query(Employee).all() if _normalize(_employee_name(employee)) == expected),
        None,
    )


def _marta_contract(db: Session) -> tuple[Employee | None, Contract | None]:
    employee = _find_employee(db, "Marta Ruiz Córdoba")
    if not employee:
        return None, None
    contract = (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id)
        .order_by(Contract.start_date.desc(), Contract.id.desc())
        .first()
    )
    return employee, contract


def _task_progress(assignment, order: int):
    task = next(
        (item for item in assignment.case_study.tasks if int(item.task_order or 0) == int(order)),
        None,
    )
    progress = next(
        (entry for entry in assignment.progress_entries if task and entry.task_id == task.id),
        None,
    )
    return task, progress


def _terminal_operation_check(assignment, order: int, action_code: str) -> dict[str, Any]:
    _task, progress = _task_progress(assignment, order)
    events = list((progress.validation_result or {}).get("events") or []) if progress else []
    matching = [
        event
        for event in events
        if event.get("operation_status") == "success" and event.get("action_code") == action_code
    ]
    latest = matching[-1] if matching else None
    metadata = (latest or {}).get("metadata") or {}
    domain_status = str(metadata.get("domain_status") or metadata.get("response_status") or "").upper()
    terminal_ok = bool(latest and domain_status in TERMINAL_OK_STATUSES)
    return _check(
        f"integrated_c02_terminal_{action_code}",
        terminal_ok,
        (
            "El envío se ha ejecutado en este hito y el simulador ha devuelto un resultado aceptado."
            if terminal_ok
            else "Ejecuta y procesa el envío desde este hito hasta obtener una respuesta aceptada del simulador."
        ),
        {
            "task_order": order,
            "required_action_code": action_code,
            "event": latest,
            "domain_status": domain_status or None,
            "terminal_ok": terminal_ok,
        },
    )


def _review_employee(db: Session, assignment, order: int) -> dict[str, Any]:
    profile = _generic(
        db,
        assignment,
        {"type": "employee_profile_matches", "employee": "Marta Ruiz Córdoba", "employee_data": MARTA_PROFILE},
    )
    structure = _generic(
        db,
        assignment,
        {
            "type": "employee_assignment",
            "employee": "Marta Ruiz Córdoba",
            "company_name": "Fundación AulaNomina",
            "center_name": "Colegio San Rafael",
        },
    )
    operation = _task_operation_check(assignment, order, "create_employee")
    return _combine(
        "integrated_c02_employee",
        [profile, structure, operation],
        "La sustituta se ha creado desde este hito con identidad y adscripción correctas.",
        "Crea o corrige desde este hito el expediente completo de Marta y su adscripción a San Rafael.",
    )


def _review_contract(db: Session, assignment, order: int) -> dict[str, Any]:
    employee, contract = _marta_contract(db)
    values = " ".join(
        _normalize(value)
        for value in [
            contract.contract_family if contract else None,
            contract.contract_type if contract else None,
            contract.contract_code_description if contract else None,
        ]
        if value
    )
    substitution = bool(contract and ("sustit" in values or "interinidad" in values or "replacement" in values))
    start_ok = bool(contract and str(contract.start_date) == "2026-05-07")
    active = bool(contract and _normalize(contract.status) == "active")
    workday = bool(contract and abs(float(contract.weekly_hours or 0) - 40.0) < 0.01)
    company = bool(contract and contract.company and _normalize(contract.company.name) == _normalize("Fundación AulaNomina"))
    center = bool(contract and contract.work_center and _normalize(contract.work_center.name) == _normalize("Colegio San Rafael"))
    domain = _check(
        "integrated_c02_contract_domain",
        all([substitution, start_ok, active, workday, company, center]),
        (
            "El contrato de sustitución reproduce fecha, jornada y adscripción del encargo."
            if all([substitution, start_ok, active, workday, company, center])
            else "Revisa modalidad, inicio, jornada, empresa y centro del contrato de sustitución."
        ),
        {
            "employee_id": employee.id if employee else None,
            "contract_id": contract.id if contract else None,
            "substitution": substitution,
            "start_ok": start_ok,
            "active": active,
            "workday_40h": workday,
            "company_ok": company,
            "center_ok": center,
        },
    )
    operation = _task_operation_check(assignment, order, "create_contract")
    return _combine(
        "integrated_c02_contract",
        [domain, operation],
        "El contrato de sustitución es correcto y se ha formalizado dentro del capstone.",
        "Formaliza el contrato correcto desde este hito; un contrato preexistente no completa C02.",
    )


def _affiliation_draft_check(db: Session, assignment, order: int) -> dict[str, Any]:
    employee, contract = _marta_contract(db)
    expected_ccc = normalize_ccc(
        getattr(contract.work_center, "main_ccc", None) if contract and contract.work_center else None
    ) or normalize_ccc(
        getattr(contract.work_center, "general_ccc", None) if contract and contract.work_center else None
    ) or normalize_ccc(contract.company.ccc if contract and contract.company else None)
    files = (
        db.query(CommunicationFile)
        .filter(
            CommunicationFile.company_id == contract.company_id,
            CommunicationFile.file_type == CommunicationFileType.AFFILIATION.value,
            CommunicationFile.period == "2026-05",
        )
        .order_by(CommunicationFile.id.desc())
        .all()
        if contract
        else []
    )
    source = None
    movement = None
    for candidate in files:
        try:
            payload = json.loads(candidate.content or "{}")
        except (TypeError, ValueError):
            payload = {}
        for item in payload.get("movements") or []:
            if (
                str(item.get("movement_type") or "").upper() == "ALTA"
                and str(item.get("effective_date") or "") == "2026-05-07"
                and int(item.get("employee_id") or 0) == (employee.id if employee else -1)
                and int(item.get("contract_id") or 0) == (contract.id if contract else -1)
            ):
                source = candidate
                movement = item
                break
        if movement:
            break

    identity = bool(
        movement
        and employee
        and _normalize(movement.get("dni")) == _normalize(employee.dni)
        and _digits(movement.get("naf")) == _digits(employee.naf)
    )
    ccc = bool(movement and normalize_ccc(movement.get("ccc")) == expected_ccc)
    domain = _check(
        "integrated_c02_affiliation_draft_domain",
        bool(source and movement and identity and ccc),
        (
            "La remesa contiene el ALTA de Marta con fecha, identidad, contrato y CCC correctos."
            if source and movement and identity and ccc
            else "Carga en una remesa el ALTA de Marta del 07/05 con identidad y CCC coherentes."
        ),
        {
            "communication_file_id": source.id if source else None,
            "movement": movement,
            "expected_ccc": expected_ccc,
            "identity_ok": identity,
            "ccc_ok": ccc,
        },
    )
    operation = _task_operation_check(assignment, order, "prepare_affiliation")
    return _combine(
        "integrated_c02_affiliation_draft",
        [domain, operation],
        "El alta está preparada en la remesa y la operación pertenece a este hito.",
        "Prepara el alta desde este hito; la parametrización SS del contrato no es suficiente.",
    )


def _affiliation_accepted_check(db: Session, assignment, order: int) -> dict[str, Any]:
    employee, contract = _marta_contract(db)
    state = None
    if employee and contract:
        state = (
            db.query(AffiliationWorkerState)
            .filter(
                AffiliationWorkerState.employee_id == employee.id,
                AffiliationWorkerState.contract_id == contract.id,
            )
            .order_by(AffiliationWorkerState.id.desc())
            .first()
        )
    domain = _check(
        "integrated_c02_affiliation_external_state",
        bool(
            state
            and state.status == "ACTIVE"
            and state.last_movement_type == "ALTA"
            and str(state.last_movement_date) == "2026-05-07"
            and state.source_submission_id
        ),
        (
            "TGSS simulada conserva el alta aceptada de Marta."
            if state and state.status == "ACTIVE" and state.last_movement_type == "ALTA" and str(state.last_movement_date) == "2026-05-07" and state.source_submission_id
            else "El alta todavía no consta aceptada en el estado externo simulado."
        ),
        {
            "state_id": state.id if state else None,
            "status": state.status if state else None,
            "last_movement_type": state.last_movement_type if state else None,
            "last_movement_date": str(state.last_movement_date) if state and state.last_movement_date else None,
            "source_submission_id": state.source_submission_id if state else None,
        },
    )
    operation = _terminal_operation_check(assignment, order, "submit_affiliation")
    return _combine(
        "integrated_c02_affiliation_submission",
        [domain, operation],
        "El alta se ha enviado y aceptado desde este hito.",
        "Procesa la remesa de afiliación desde este hito hasta obtener aceptación de TGSS simulada.",
    )


def _review_c02(db: Session, assignment, order: int) -> dict[str, Any]:
    if order == 1:
        domain = _generic(db, assignment, {"type": "review_fie", "employee": "Javier Romero Sánchez"})
        operation = _task_operation_check(assignment, order, "review_fie")
        return _combine("integrated_c02_fie_review", [domain, operation], "El FIE ha sido revisado dentro del caso.", "Abre y revisa el FIE desde este hito.")
    if order == 2:
        domain = _generic(db, assignment, {"type": "incident_exists", "employee": "Javier Romero Sánchez", "incident_type": "IT", "start_date": "2026-05-06"})
        operation = _task_operation_check(assignment, order, "create_incident")
        return _combine("integrated_c02_incident", [domain, operation], "La IT coincide y se ha revisado desde el hito.", "Registra o actualiza la IT desde este hito antes de comprobar.")
    if order == 3:
        domain = _generic(db, assignment, {"type": "reconcile_fie", "employee": "Javier Romero Sánchez"})
        operation = _task_operation_check(assignment, order, "reconcile_fie")
        return _combine("integrated_c02_fie_reconcile", [domain, operation], "El FIE está conciliado desde este hito.", "Concilia el FIE con la IT desde este hito.")
    if order == 4:
        return _review_employee(db, assignment, order)
    if order == 5:
        return _review_contract(db, assignment, order)
    if order == 6:
        return _affiliation_draft_check(db, assignment, order)
    if order == 7:
        return _affiliation_accepted_check(db, assignment, order)
    if order == 8:
        domain = _generic(db, assignment, {"type": "payroll_recalculated", "employee": "Javier Romero Sánchez", "period": "2026-05"})
        operation = _task_operation_check(assignment, order, "recalculate_payroll")
        return _combine("integrated_c02_payroll", [domain, operation], "La nómina de mayo se ha recalculado dentro del capstone.", "Recalcula desde este hito la nómina afectada por la IT.")
    if order == 9:
        return _terminal_operation_check(assignment, order, "submit_siltra")
    return _generic(db, assignment, {"type": "reply_mail"})


def handles_training_integrated_c02_review(assignment, task) -> bool:
    return str(assignment.case_study.scenario_code or "").strip().upper() == C02_SCENARIO_CODE


def validate_training_integrated_c02_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    if not handles_training_integrated_c02_review(assignment, task):
        raise CaseScenarioError("El paso no pertenece a C02", code="UNSUPPORTED_C02_REVIEW", status_code=400)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    order = int(task.task_order or 1)
    check = _review_c02(db, assignment, order)
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
        "message": "Comprobación C02 superada." if passed else "C02 todavía tiene evidencia pendiente en este hito.",
        "checks": [check],
        "scenario": scenario,
    }
