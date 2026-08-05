from __future__ import annotations

from datetime import datetime
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_progress import CaseTaskProgress
from app.models.case_study import CaseTask
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.fie import FieCommunication
from app.models.incident import Incident
from app.models.mail import EmailMessage
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept
from app.models.social_security_registration import SocialSecurityRegistration
from app.schemas.case_scenario import CaseContextEventCreate, CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _employee_name(employee: Employee) -> str:
    return " ".join(
        part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part
    )


def _target_employee_name(assignment: CaseAssignment, rule: dict[str, Any]) -> str | None:
    state = assignment.case_study.initial_state or {}
    return rule.get("employee") or state.get("employee") or state.get("substitute")


def _find_employee(db: Session, name: str | None) -> Employee | None:
    if not name:
        return None
    expected = _normalize(name)
    for employee in db.query(Employee).all():
        actual = _normalize(_employee_name(employee))
        if actual == expected or expected in actual or actual in expected:
            return employee
    return None


def _parse_period(value: str | None) -> tuple[int, int] | None:
    if not value:
        return None
    try:
        year_text, month_text = str(value).split("-", 1)
        return int(year_text), int(month_text)
    except (TypeError, ValueError):
        return None


def _check(
    rule_type: str,
    *,
    passed: bool,
    message: str,
    supported: bool = True,
    evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": supported,
        "passed": passed,
        "message": message,
        "evidence": evidence or {},
    }


def _incident_exists(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    if not employee:
        return _check("incident_exists", passed=False, message="No se ha encontrado al trabajador del caso.")

    incidents = db.query(Incident).filter(Incident.employee_id == employee.id).all()
    expected_type = _normalize(rule.get("incident_type") or "")
    expected_start = rule.get("start_date") or (assignment.case_study.initial_state or {}).get("leave_start")

    def type_matches(incident: Incident) -> bool:
        actual = _normalize(incident.incident_type)
        if not expected_type:
            return True
        if expected_type == "it":
            return "it" in actual or "incapacidad" in actual
        return expected_type in actual

    match = next(
        (
            incident
            for incident in incidents
            if type_matches(incident)
            and (not expected_start or str(incident.start_date) == str(expected_start))
        ),
        None,
    )
    return _check(
        "incident_exists",
        passed=match is not None,
        message=(
            "La incidencia requerida existe con los datos esperados."
            if match
            else "No existe todavía una incidencia que coincida con trabajador, tipo y fecha."
        ),
        evidence={"employee_id": employee.id, "incident_id": match.id if match else None},
    )


def _employee_exists(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    return _check(
        "employee_exists",
        passed=employee is not None and employee.is_active,
        message=(
            "La persona está dada de alta y activa."
            if employee and employee.is_active
            else "La persona todavía no está creada como trabajadora activa."
        ),
        evidence={"employee_id": employee.id if employee else None},
    )


def _active_contract(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    if not employee:
        return _check("active_contract", passed=False, message="No se ha encontrado a la persona del contrato.")

    contracts = db.query(Contract).filter(Contract.employee_id == employee.id).all()
    expected_family = _normalize(rule.get("contract_family") or "")

    def family_matches(contract: Contract) -> bool:
        if not expected_family:
            return True
        values = " ".join(
            _normalize(value)
            for value in [
                contract.contract_family,
                contract.contract_type,
                contract.contract_code_description,
            ]
            if value
        )
        if expected_family == "substitution":
            return "sustit" in values or "interinidad" in values
        return expected_family in values

    match = next(
        (contract for contract in contracts if _normalize(contract.status) == "active" and family_matches(contract)),
        None,
    )
    return _check(
        "active_contract",
        passed=match is not None,
        message=(
            "Existe un contrato activo con la modalidad esperada."
            if match
            else "No se ha encontrado el contrato activo requerido."
        ),
        evidence={"employee_id": employee.id, "contract_id": match.id if match else None},
    )


def _affiliation_prepared(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    if not employee:
        return _check("affiliation_prepared", passed=False, message="No se ha encontrado a la persona de la afiliación.")

    contract_ids = [item.id for item in db.query(Contract).filter(Contract.employee_id == employee.id).all()]
    registration = None
    if contract_ids:
        registration = (
            db.query(SocialSecurityRegistration)
            .filter(SocialSecurityRegistration.contract_id.in_(contract_ids))
            .order_by(SocialSecurityRegistration.id.desc())
            .first()
        )

    expected_date = rule.get("registration_date") or (assignment.case_study.initial_state or {}).get("start_date")
    date_matches = not expected_date or (registration and str(registration.registration_date) == str(expected_date))
    passed = registration is not None and bool(registration.registration_date) and date_matches
    return _check(
        "affiliation_prepared",
        passed=passed,
        message=(
            "El movimiento de alta está preparado con fecha coherente."
            if passed
            else "No existe todavía una preparación de alta válida para la persona del caso."
        ),
        evidence={"registration_id": registration.id if registration else None},
    )


def _review_fie(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    communications = db.query(FieCommunication).all()
    target_name = _normalize(_target_employee_name(assignment, rule))
    match = next(
        (
            communication
            for communication in communications
            if (
                (employee and communication.employee_id == employee.id)
                or (target_name and target_name in _normalize(communication.external_worker_name))
            )
            and (communication.read_at is not None or _normalize(communication.status) != "received")
        ),
        None,
    )
    return _check(
        "review_fie",
        passed=match is not None,
        message=(
            "La comunicación FIE ha sido abierta y revisada."
            if match
            else "La comunicación FIE aún no consta como revisada."
        ),
        evidence={"communication_id": match.id if match else None},
    )


def _reconcile_fie(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    communications = db.query(FieCommunication).all()
    match = next(
        (
            communication
            for communication in communications
            if (not employee or communication.employee_id == employee.id)
            and (
                communication.incident_id is not None
                or bool(communication.reconciliation_result)
                or _normalize(communication.status) in {"reconciled", "processed", "resolved", "matched"}
            )
        ),
        None,
    )
    return _check(
        "reconcile_fie",
        passed=match is not None,
        message=(
            "La comunicación FIE está conciliada con una incidencia."
            if match
            else "La comunicación FIE todavía no está conciliada."
        ),
        evidence={"communication_id": match.id if match else None, "incident_id": match.incident_id if match else None},
    )


def _payroll_recalculated(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    period = _parse_period(rule.get("period") or state.get("payroll_period"))
    query = db.query(Payroll)
    if employee:
        query = query.filter(Payroll.employee_id == employee.id)
    if period:
        year, month = period
        query = query.filter(Payroll.period_year == year, Payroll.period_month == month)
    payrolls = query.order_by(Payroll.id.desc()).all()
    match = next(
        (
            payroll
            for payroll in payrolls
            if (payroll.calculation_version or 0) > 0
            or payroll.last_calculated_at is not None
            or _normalize(payroll.status) in {"calculated", "generated", "confirmed", "closed"}
        ),
        None,
    )
    return _check(
        "payroll_recalculated",
        passed=match is not None,
        message=(
            "Existe una nómina recalculada para el periodo del caso."
            if match
            else "No se ha encontrado una nómina recalculada para el periodo requerido."
        ),
        evidence={"payroll_id": match.id if match else None},
    )


def _seniority_date_checked(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    contract = None
    if employee:
        contract = (
            db.query(Contract)
            .filter(Contract.employee_id == employee.id, Contract.status == "active")
            .order_by(Contract.id.desc())
            .first()
        )
    passed = bool(contract and (contract.recognized_seniority_date or contract.seniority_date))
    return _check(
        "seniority_date_checked",
        passed=passed,
        message=(
            "El contrato contiene una fecha de antigüedad revisable."
            if passed
            else "No consta una fecha de antigüedad en el contrato activo."
        ),
        evidence={"contract_id": contract.id if contract else None},
    )


def _payroll_concept_exists(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    employee = _find_employee(db, _target_employee_name(assignment, rule))
    if not employee:
        return _check("payroll_concept_exists", passed=False, message="No se ha encontrado a la persona del concepto salarial.")

    contract_ids = [item.id for item in db.query(Contract).filter(Contract.employee_id == employee.id).all()]
    expected = _normalize(rule.get("concept") or "antigüedad")
    rows = []
    if contract_ids:
        rows = (
            db.query(ContractPayrollConcept, PayrollConcept)
            .join(PayrollConcept, ContractPayrollConcept.concept_id == PayrollConcept.id)
            .filter(ContractPayrollConcept.contract_id.in_(contract_ids), ContractPayrollConcept.is_active.is_(True))
            .all()
        )
    match = next(
        (
            contract_concept
            for contract_concept, concept in rows
            if expected in _normalize(" ".join(filter(None, [concept.name, concept.code, contract_concept.description])))
        ),
        None,
    )
    return _check(
        "payroll_concept_exists",
        passed=match is not None,
        message=(
            "El complemento salarial requerido está activo en el contrato."
            if match
            else "No se ha encontrado el complemento salarial requerido."
        ),
        evidence={"contract_concept_id": match.id if match else None},
    )


def _reply_mail(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    thread_ids = [thread.id for thread in assignment.email_threads]
    message = None
    if thread_ids:
        message = (
            db.query(EmailMessage)
            .filter(
                EmailMessage.thread_id.in_(thread_ids),
                EmailMessage.direction == "outgoing",
                EmailMessage.message_type.in_(["reply", "forward"]),
            )
            .order_by(EmailMessage.id.desc())
            .first()
        )
    return _check(
        "reply_mail",
        passed=message is not None,
        message=(
            "Se ha enviado una respuesta dentro del hilo del caso."
            if message
            else "Todavía no se ha enviado una respuesta al hilo."
        ),
        evidence={"message_id": message.id if message else None},
    )


def _evaluate_rule(db: Session, assignment: CaseAssignment, rule: dict[str, Any]) -> dict[str, Any]:
    rule_type = rule.get("type") or rule.get("action") or ""
    aliases = {
        "create_employee": "employee_exists",
        "create_contract": "active_contract",
        "prepare_affiliation": "affiliation_prepared",
        "review_contract": "seniority_date_checked",
        "update_payroll_concept": "payroll_concept_exists",
        "recalculate_payroll": "payroll_recalculated",
    }
    normalized_type = aliases.get(rule_type, rule_type)
    evaluators = {
        "incident_exists": _incident_exists,
        "employee_exists": _employee_exists,
        "active_contract": _active_contract,
        "affiliation_prepared": _affiliation_prepared,
        "review_fie": _review_fie,
        "reconcile_fie": _reconcile_fie,
        "payroll_recalculated": _payroll_recalculated,
        "seniority_date_checked": _seniority_date_checked,
        "payroll_concept_exists": _payroll_concept_exists,
        "reply_mail": _reply_mail,
    }
    evaluator = evaluators.get(normalized_type)
    if not evaluator:
        return _check(
            rule_type or "manual",
            passed=False,
            supported=False,
            message="Este paso todavía requiere confirmación manual porque no existe una regla automática compatible.",
        )
    return evaluator(db, assignment, {**rule, "type": normalized_type})


def _task_for_assignment(assignment: CaseAssignment, task_id: int | None) -> CaseTask:
    ordered = sorted(assignment.case_study.tasks, key=lambda item: (item.task_order, item.id))
    if task_id is not None:
        task = next((item for item in ordered if item.id == task_id), None)
    else:
        task = next((item for item in ordered if item.task_order == assignment.current_task_order), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    return task


def _feedback_text(
    task: CaseTask,
    payload: CaseContextEventCreate,
    validation: dict[str, Any] | None,
) -> str:
    action_label = payload.response_summary or payload.action_code or task.title
    if payload.operation_status == "error":
        return (
            f"La operación «{action_label}» no se ha completado correctamente. "
            "El intento se ha registrado en el caso. Revisa el mensaje mostrado por el módulo, corrige los datos y vuelve a intentarlo."
        )
    if validation and validation["passed"]:
        return (
            f"La operación «{action_label}» se ha comprobado correctamente. "
            f"El paso «{task.title}» queda completado y el caso avanza al siguiente punto."
        )
    if validation and validation["manual_required"]:
        return (
            f"La operación «{action_label}» ha quedado registrada. "
            "Este paso todavía requiere confirmación manual porque no existe una comprobación automática suficientemente fiable."
        )
    failed_checks = [item["message"] for item in (validation or {}).get("checks", []) if not item["passed"]]
    detail = " ".join(failed_checks[:2])
    return (
        f"La operación «{action_label}» se ha ejecutado, pero el paso «{task.title}» aún no cumple todas las condiciones. "
        f"{detail or 'Revisa los datos del módulo relacionado y vuelve a validar.'}"
    )


def _create_feedback_message(
    db: Session,
    assignment_id: int,
    task: CaseTask,
    payload: CaseContextEventCreate,
    validation: dict[str, Any] | None,
) -> int | None:
    assignment = ensure_assignment_progress(db, assignment_id)
    thread = next((item for item in assignment.email_threads if item.case_task_id == task.id), None)
    if thread is None and assignment.email_threads:
        thread = assignment.email_threads[0]
    if thread is None:
        return None

    event_id = str((payload.metadata or {}).get("event_id") or "").strip()
    marker = f"case-event:{event_id}" if event_id else None
    if marker:
        existing = (
            db.query(EmailMessage)
            .filter(
                EmailMessage.thread_id == thread.id,
                EmailMessage.direction == "system",
                EmailMessage.message_type == "automatic",
                EmailMessage.body_html == marker,
            )
            .first()
        )
        if existing:
            return existing.id

    body = _feedback_text(task, payload, validation)
    now = datetime.utcnow()
    message = EmailMessage(
        thread_id=thread.id,
        sender_name="Tutor automático · AulaNomina",
        sender_address="tutor@aulanomina.local",
        recipient_name=thread.mailbox.display_name if thread.mailbox else "Alumno",
        recipient_address=thread.mailbox.address if thread.mailbox else "alumno@aulanomina.local",
        body_html=marker,
        body_text=body,
        sent_at=now,
        direction="system",
        message_type="automatic",
    )
    db.add(message)
    db.flush()
    thread.preview = body[:220]
    thread.is_read = False
    thread.updated_at = now
    db.commit()
    return message.id


def validate_assignment_step(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = _task_for_assignment(assignment, task_id)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    rules = list(task.validation_rules or [])
    if not rules and task.expected_action:
        rules = [{"type": task.expected_action}]
    if not rules:
        rules = [{"type": "manual"}]

    checks = [_evaluate_rule(db, assignment, rule) for rule in rules]
    manual_required = any(not item["supported"] for item in checks)
    passed = bool(checks) and not manual_required and all(item["passed"] for item in checks)
    now = datetime.utcnow().isoformat()
    previous_result = dict(progress.validation_result or {})
    validation_result = {
        **previous_result,
        "mode": "automatic",
        "validated_at": now,
        "passed": passed,
        "manual_required": manual_required,
        "checks": checks,
    }

    if passed:
        scenario = update_assignment_step(
            db,
            assignment_id,
            task.id,
            CaseTaskProgressUpdate(
                status="completed",
                student_notes=progress.student_notes,
                validation_result=validation_result,
            ),
        )
        message = "Validación superada. El paso se ha completado automáticamente."
    else:
        target_status = "in_progress" if progress.status in {"pending", "failed"} else progress.status
        scenario = update_assignment_step(
            db,
            assignment_id,
            task.id,
            CaseTaskProgressUpdate(
                status=target_status,
                student_notes=progress.student_notes,
                validation_result=validation_result,
            ),
        )
        if manual_required:
            message = "La regla automática no cubre todavía este paso. Puede confirmarse manualmente."
        else:
            message = "La validación no se ha superado. Revisa el módulo relacionado y vuelve a intentarlo."

    return {
        "passed": passed,
        "manual_required": manual_required,
        "message": message,
        "checks": checks,
        "scenario": scenario,
    }


def record_assignment_event(db: Session, assignment_id: int, payload: CaseContextEventCreate) -> dict:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = _task_for_assignment(assignment, payload.task_id)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    validation_result = dict(progress.validation_result or {})
    events = list(validation_result.get("events") or [])
    events.append(
        {
            "event_type": payload.event_type,
            "action_code": payload.action_code,
            "target": payload.target,
            "operation_status": payload.operation_status,
            "response_summary": payload.response_summary,
            "metadata": payload.metadata,
            "recorded_at": datetime.utcnow().isoformat(),
        }
    )
    validation_result["events"] = events[-50:]

    if payload.operation_status == "error":
        target_status = "failed"
    else:
        target_status = "in_progress" if progress.status in {"pending", "failed"} else progress.status

    scenario = update_assignment_step(
        db,
        assignment_id,
        task.id,
        CaseTaskProgressUpdate(
            status=target_status,
            student_notes=progress.student_notes,
            validation_result=validation_result,
        ),
    )

    validation = None
    if payload.operation_status == "success" and payload.auto_validate:
        validation = validate_assignment_step(db, assignment_id, task.id)
        scenario = validation["scenario"]

    feedback_message_id = None
    if payload.operation_status in {"success", "error"}:
        feedback_message_id = _create_feedback_message(
            db,
            assignment_id,
            task,
            payload,
            validation,
        )

    return {
        "event_recorded": True,
        "feedback_message_id": feedback_message_id,
        "validation": validation,
        "scenario": scenario,
    }
