"""Validación pedagógica bajo demanda para Seguridad Social y Sistema RED."""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any
import unicodedata
from xml.etree import ElementTree as ET

from sqlalchemy.orm import Session

from app.models.communication_file import CommunicationFile
from app.models.communication_submission import CommunicationSubmission
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.fie import FieCommunication
from app.models.incident import Incident
from app.models.social_security_settlement import SocialSecuritySettlement
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.services.communication_file_workflow import CommunicationFileType, normalize_ccc
from app.training.social_security_runtime_cases_2026 import (
    DEMO_COMPANY_CIF,
    FIE_A31_MESSAGE_ID,
)


SOCIAL_SECURITY_SCENARIO_CODES = {
    "TRAIN-2026-SS-A28": "A28",
    "TRAIN-2026-SS-A30": "A30",
    "TRAIN-2026-SS-A31": "A31",
    "TRAIN-2026-SS-A32": "A32",
    "TRAIN-2026-SS-A33": "A33",
    "TRAIN-2026-SS-A34": "A34",
    "TRAIN-2026-SS-A35": "A35",
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


def _json_load(value: Any, fallback: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _activity_code(assignment) -> str | None:
    scenario = str(assignment.case_study.scenario_code or "").strip().upper()
    return SOCIAL_SECURITY_SCENARIO_CODES.get(scenario)


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


def _demo_company(db: Session) -> Company | None:
    return db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()


def _active_contract(db: Session, employee: Employee | None, reference_date: str | None = None) -> Contract | None:
    if employee is None:
        return None
    contracts = (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id)
        .order_by(Contract.start_date.desc(), Contract.id.desc())
        .all()
    )
    for contract in contracts:
        if reference_date:
            target = str(reference_date)
            if str(contract.start_date) > target:
                continue
            if contract.end_date and str(contract.end_date) < target:
                continue
        if contract.status in {"active", "ended"}:
            return contract
    return contracts[0] if contracts else None


def _contract_ccc(contract: Contract | None) -> str | None:
    if contract is None:
        return None
    center = contract.work_center
    if center:
        value = normalize_ccc(center.main_ccc) or normalize_ccc(center.general_ccc)
        if value:
            return value
    return normalize_ccc(contract.company.ccc if contract.company else None)


def _check(passed: bool, message: str, evidence: dict[str, Any], *, rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _review_a28(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    expected = state.get("affiliation_data") or {}
    employee = _find_employee(db, state.get("employee"))
    contract = _active_contract(db, employee, expected.get("reference_date"))
    actual_ccc = _contract_ccc(contract)
    expected_ccc = normalize_ccc(expected.get("expected_ccc"))
    identity_ok = bool(employee and employee.dni and employee.naf)
    company_ok = bool(employee and employee.company_id and contract and contract.company_id == employee.company_id)
    contract_ok = bool(contract and contract.start_date)
    ccc_ok = bool(actual_ccc and actual_ccc == expected_ccc)
    passed = identity_ok and company_ok and contract_ok and ccc_ok
    return _check(
        passed,
        (
            "DNI/NIE, NAF, empresa, CCC y contrato están preparados para generar el movimiento de afiliación."
            if passed
            else "Falta o no cuadra algún dato crítico de identidad, empresa, CCC o contrato antes del movimiento RED."
        ),
        {
            "employee_id": employee.id if employee else None,
            "dni": employee.dni if employee else None,
            "naf": employee.naf if employee else None,
            "contract_id": contract.id if contract else None,
            "contract_start_date": str(contract.start_date) if contract else None,
            "expected_ccc": expected_ccc,
            "actual_ccc": actual_ccc,
            "identity_ok": identity_ok,
            "company_ok": company_ok,
            "contract_ok": contract_ok,
            "ccc_ok": ccc_ok,
        },
        rule_type="training_a28_affiliation_prerequisites",
    )


def _latest_affiliation_file(db: Session, company_id: int, period: str) -> CommunicationFile | None:
    return (
        db.query(CommunicationFile)
        .filter(
            CommunicationFile.company_id == company_id,
            CommunicationFile.file_type == CommunicationFileType.AFFILIATION.value,
            CommunicationFile.period == period,
        )
        .order_by(CommunicationFile.id.desc())
        .first()
    )


def _review_a30(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    expected = state.get("affiliation_data") or {}
    employee = _find_employee(db, state.get("employee"))
    company = _demo_company(db)
    period = str(expected.get("effective_date") or "")[:7]
    source = _latest_affiliation_file(db, company.id, period) if company and period else None
    payload = _json_load(source.content if source else None, {})
    movements = payload.get("movements") or []
    target = next(
        (
            movement
            for movement in movements
            if _normalize(movement.get("employee_name")) == _normalize(state.get("employee"))
            and str(movement.get("movement_type") or "").upper() == str(expected.get("movement_type") or "").upper()
            and str(movement.get("effective_date") or "") == str(expected.get("effective_date") or "")
        ),
        None,
    )
    ccc_ok = bool(target and normalize_ccc(target.get("ccc")) == normalize_ccc(expected.get("expected_ccc")))
    generated = bool(source and source.status in {"GENERATED", "SENT", "PROCESSING", "ACCEPTED", "ACCEPTED_WITH_WARNINGS", "REJECTED"})
    employee_ok = bool(target and employee and int(target.get("employee_id") or 0) == employee.id)
    passed = bool(target and ccc_ok and generated and employee_ok)
    return _check(
        passed,
        (
            "La remesa contiene una baja de afiliación con trabajador, fecha y CCC correctos."
            if passed
            else "No se localiza una remesa generada con la baja, fecha o CCC solicitados."
        ),
        {
            "communication_file_id": source.id if source else None,
            "file_status": source.status if source else None,
            "movement": target,
            "expected_movement_type": expected.get("movement_type"),
            "expected_effective_date": expected.get("effective_date"),
            "expected_ccc": normalize_ccc(expected.get("expected_ccc")),
            "ccc_ok": ccc_ok,
            "employee_ok": employee_ok,
            "generated": generated,
        },
        rule_type="training_a30_affiliation_movement",
    )


def _training_fie(db: Session) -> FieCommunication | None:
    return db.query(FieCommunication).filter(FieCommunication.external_message_id == FIE_A31_MESSAGE_ID).first()


def _review_a31(db: Session, assignment) -> dict[str, Any]:
    expected = (assignment.case_study.initial_state or {}).get("fie_data") or {}
    communication = _training_fie(db)
    employee = _find_employee(db, (assignment.case_study.initial_state or {}).get("employee"))
    employee_ok = bool(communication and employee and communication.employee_id == employee.id)
    process_ok = bool(communication and communication.process_reference == expected.get("process_reference"))
    type_ok = bool(communication and communication.communication_type == expected.get("communication_type"))
    contingency_ok = bool(communication and communication.contingency_type == expected.get("contingency_type"))
    date_ok = bool(communication and str(communication.event_date) == str(expected.get("event_date")))
    passed = employee_ok and process_ok and type_ok and contingency_ok and date_ok
    return _check(
        passed,
        (
            "La persona, referencia de proceso, contingencia y fecha FIE coinciden con el caso."
            if passed
            else "Revisa de nuevo la persona, referencia, contingencia o fecha de la comunicación FIE."
        ),
        {
            "communication_id": communication.id if communication else None,
            "process_reference": communication.process_reference if communication else None,
            "communication_type": communication.communication_type if communication else None,
            "contingency_type": communication.contingency_type if communication else None,
            "event_date": str(communication.event_date) if communication else None,
            "employee_ok": employee_ok,
            "process_ok": process_ok,
            "type_ok": type_ok,
            "contingency_ok": contingency_ok,
            "date_ok": date_ok,
        },
        rule_type="training_a31_fie_content",
    )


def _review_a32(db: Session, assignment) -> dict[str, Any]:
    expected = (assignment.case_study.initial_state or {}).get("fie_data") or {}
    communication = _training_fie(db)
    incident = db.query(Incident).filter(Incident.id == communication.incident_id).first() if communication and communication.incident_id else None
    status_ok = bool(communication and communication.status == expected.get("expected_status"))
    linked = bool(communication and incident)
    dates_ok = bool(
        incident
        and str(incident.start_date) == str(expected.get("expected_incident_start"))
        and str(incident.end_date or "") == str(expected.get("expected_incident_end"))
    )
    reconciliation = communication.reconciliation_result or {} if communication else {}
    matched_flag = bool(reconciliation.get("matched"))
    passed = status_ok and linked and dates_ok and matched_flag
    return _check(
        passed,
        (
            "El FIE está conciliado con la IT correcta y las fechas coinciden."
            if passed
            else "La comunicación aún no está enlazada con la incidencia correcta o existen diferencias de fechas."
        ),
        {
            "communication_id": communication.id if communication else None,
            "communication_status": communication.status if communication else None,
            "incident_id": incident.id if incident else None,
            "incident_start": str(incident.start_date) if incident else None,
            "incident_end": str(incident.end_date) if incident and incident.end_date else None,
            "matched": matched_flag,
            "status_ok": status_ok,
            "dates_ok": dates_ok,
        },
        rule_type="training_a32_fie_reconciliation",
    )


def _cra_files(db: Session, *, period: str, ccc: str) -> list[CommunicationFile]:
    company = _demo_company(db)
    if company is None:
        return []
    return (
        db.query(CommunicationFile)
        .filter(
            CommunicationFile.company_id == company.id,
            CommunicationFile.file_type == CommunicationFileType.CRA.value,
            CommunicationFile.period == period,
            CommunicationFile.ccc_id == normalize_ccc(ccc),
        )
        .order_by(CommunicationFile.id.desc())
        .all()
    )


def _cra_xml_counts(source: CommunicationFile | None) -> tuple[int, int, bool]:
    if source is None or not source.content:
        return 0, 0, False
    try:
        root = ET.fromstring(source.content)
    except ET.ParseError:
        return 0, 0, False
    workers = root.findall(".//TRB")
    records = root.findall(".//CRE")
    return len(workers), len(records), root.tag == "CRA"


def _review_a33(db: Session, assignment) -> dict[str, Any]:
    expected = (assignment.case_study.initial_state or {}).get("cra_data") or {}
    files = _cra_files(db, period=expected.get("period"), ccc=expected.get("ccc"))
    source = next((item for item in files if not _json_load(item.file_metadata, {}).get("replacement_of_file_id")), None)
    workers, records, valid_root = _cra_xml_counts(source)
    generated = bool(source and source.generated_at and source.status != "DRAFT")
    passed = bool(
        source
        and valid_root
        and generated
        and workers >= int(expected.get("minimum_workers") or 1)
        and records >= int(expected.get("minimum_records") or 1)
    )
    return _check(
        passed,
        (
            "El CRA está generado para el CCC/periodo correctos y contiene trabajadores y registros CRE."
            if passed
            else "Genera el CRA indicado y revisa que contenga al menos un trabajador y un concepto comunicable."
        ),
        {
            "communication_file_id": source.id if source else None,
            "status": source.status if source else None,
            "period": source.period if source else None,
            "ccc": source.ccc_id if source else None,
            "worker_count": workers,
            "record_count": records,
            "valid_root": valid_root,
            "generated": generated,
        },
        rule_type="training_a33_cra_file",
    )


def _review_a34(db: Session, assignment) -> dict[str, Any]:
    expected = (assignment.case_study.initial_state or {}).get("settlement_data") or {}
    company = _demo_company(db)
    settlement = None
    if company:
        settlement = (
            db.query(SocialSecuritySettlement)
            .filter(
                SocialSecuritySettlement.company_id == company.id,
                SocialSecuritySettlement.ccc_id == normalize_ccc(expected.get("ccc")),
                SocialSecuritySettlement.period_year == int(expected.get("period_year") or 0),
                SocialSecuritySettlement.period_month == int(expected.get("period_month") or 0),
            )
            .first()
        )
    lines = list(settlement.lines or []) if settlement else []
    line_total_due = sum((_money(line.total_due) for line in lines), Decimal("0.00"))
    line_common_base = sum((_money(line.common_contingencies_base) for line in lines), Decimal("0.00"))
    worker_count_ok = bool(settlement and settlement.worker_count == len(lines) and len(lines) > 0)
    total_ok = bool(settlement and _close(settlement.total_due, line_total_due))
    base_ok = bool(settlement and _close(settlement.common_contingencies_base, line_common_base))
    issues = _json_load(settlement.validation_errors if settlement else None, [])
    blocking = [issue for issue in issues if str(issue.get("severity") or "ERROR").upper() == "ERROR"]
    lines_blocking = [
        issue
        for line in lines
        for issue in _json_load(line.validation_errors, [])
        if str(issue.get("severity") or "ERROR").upper() == "ERROR"
    ]
    status_ok = bool(settlement and settlement.status in {"READY", "CONFIRMED", "GENERATED"})
    passed = worker_count_ok and total_ok and base_ok and not blocking and not lines_blocking and status_ok
    return _check(
        passed,
        (
            "La liquidación cuadra entre líneas nominales, bases, cuotas y total debido."
            if passed
            else "Revisa trabajadores, bases, cuotas o errores bloqueantes de la liquidación antes de continuar."
        ),
        {
            "settlement_id": settlement.id if settlement else None,
            "status": settlement.status if settlement else None,
            "worker_count": settlement.worker_count if settlement else 0,
            "line_count": len(lines),
            "settlement_common_base": str(_money(settlement.common_contingencies_base)) if settlement else None,
            "line_common_base": str(_money(line_common_base)),
            "settlement_total_due": str(_money(settlement.total_due)) if settlement else None,
            "line_total_due": str(_money(line_total_due)),
            "blocking_errors": len(blocking) + len(lines_blocking),
            "worker_count_ok": worker_count_ok,
            "base_ok": base_ok,
            "total_ok": total_ok,
        },
        rule_type="training_a34_settlement",
    )


def _find_rejected_cra(db: Session, assignment) -> CommunicationFile | None:
    expected = (assignment.case_study.initial_state or {}).get("siltra_data") or {}
    for source in _cra_files(db, period=expected.get("period"), ccc=expected.get("ccc")):
        metadata = _json_load(source.file_metadata, {})
        if source.status == "REJECTED" and metadata.get("last_validation_scenario") == "REJECTED":
            return source
    return None


def _find_correction(db: Session, rejected: CommunicationFile | None) -> CommunicationFile | None:
    if rejected is None:
        return None
    candidates = (
        db.query(CommunicationFile)
        .filter(CommunicationFile.file_type == CommunicationFileType.CRA.value)
        .order_by(CommunicationFile.id.desc())
        .all()
    )
    return next(
        (
            source
            for source in candidates
            if int(_json_load(source.file_metadata, {}).get("replacement_of_file_id") or 0) == rejected.id
        ),
        None,
    )


def _review_a35(db: Session, assignment, task_order: int) -> dict[str, Any]:
    rejected = _find_rejected_cra(db, assignment)
    correction = _find_correction(db, rejected)
    if task_order == 1:
        submission = (
            db.query(CommunicationSubmission)
            .filter(CommunicationSubmission.communication_file_id == rejected.id)
            .order_by(CommunicationSubmission.attempt_number.desc(), CommunicationSubmission.id.desc())
            .first()
            if rejected
            else None
        )
        messages = _json_load(submission.messages if submission else None, [])
        has_error = any(str(message.get("severity") or "").upper() == "ERROR" for message in messages)
        passed = bool(rejected and submission and submission.status == "REJECTED" and has_error and rejected.response_file_id)
        return _check(
            passed,
            (
                "El primer envío está rechazado y conserva código, mensajes y respuesta RCA para analizar el error."
                if passed
                else "Fuerza el escenario Rechazo sobre el CRA generado y revisa la respuesta devuelta."
            ),
            {
                "rejected_file_id": rejected.id if rejected else None,
                "submission_id": submission.id if submission else None,
                "submission_status": submission.status if submission else None,
                "response_code": submission.response_code if submission else None,
                "response_file_id": rejected.response_file_id if rejected else None,
                "error_messages": sum(1 for message in messages if str(message.get("severity") or "").upper() == "ERROR"),
            },
            rule_type="training_a35_rejection",
        )
    if task_order == 2:
        metadata = _json_load(correction.file_metadata if correction else None, {})
        source_metadata = _json_load(rejected.file_metadata if rejected else None, {})
        linked = bool(
            rejected
            and correction
            and int(metadata.get("replacement_of_file_id") or 0) == rejected.id
            and int(source_metadata.get("superseded_by_file_id") or 0) == correction.id
        )
        corrector = bool(correction and metadata.get("communication_kind") == "CORRECTIVE")
        generated = bool(correction and correction.status in {"GENERATED", "ACCEPTED", "ACCEPTED_WITH_WARNINGS"})
        passed = linked and corrector and generated
        return _check(
            passed,
            (
                "La correctora está generada y mantiene trazabilidad completa con el fichero rechazado."
                if passed
                else "Genera la comunicación correctora desde el fichero rechazado y comprueba su vínculo."
            ),
            {
                "rejected_file_id": rejected.id if rejected else None,
                "correction_file_id": correction.id if correction else None,
                "replacement_of_file_id": metadata.get("replacement_of_file_id"),
                "action_mode": metadata.get("action_mode"),
                "correction_status": correction.status if correction else None,
                "linked": linked,
                "corrector": corrector,
            },
            rule_type="training_a35_correction",
        )
    submission = (
        db.query(CommunicationSubmission)
        .filter(CommunicationSubmission.communication_file_id == correction.id)
        .order_by(CommunicationSubmission.attempt_number.desc(), CommunicationSubmission.id.desc())
        .first()
        if correction
        else None
    )
    accepted = bool(correction and correction.status in {"ACCEPTED", "ACCEPTED_WITH_WARNINGS"})
    response_linked = bool(correction and correction.response_file_id and submission and submission.response_file_id)
    passed = accepted and response_linked and bool(submission and submission.status in {"ACCEPTED", "ACCEPTED_WITH_WARNINGS"})
    return _check(
        passed,
        (
            "La comunicación correctora ha sido reenviada y el segundo ciclo termina aceptado con respuesta asociada."
            if passed
            else "Reenvía la correctora con validación automática y comprueba que termina aceptada."
        ),
        {
            "correction_file_id": correction.id if correction else None,
            "correction_status": correction.status if correction else None,
            "submission_id": submission.id if submission else None,
            "submission_status": submission.status if submission else None,
            "response_file_id": correction.response_file_id if correction else None,
            "accepted": accepted,
            "response_linked": response_linked,
        },
        rule_type="training_a35_acceptance",
    )


def handles_training_social_security_review(assignment, task) -> bool:
    return _activity_code(assignment) in {"A28", "A30", "A31", "A32", "A33", "A34", "A35"}


def validate_training_social_security_review(
    db: Session,
    assignment_id: int,
    task_id: int,
) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    code = _activity_code(assignment)
    if not code:
        raise CaseScenarioError("El paso no pertenece al bloque formativo de Seguridad Social", code="UNSUPPORTED_TRAINING_REVIEW", status_code=400)

    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    if code == "A28":
        check = _review_a28(db, assignment)
    elif code == "A30":
        check = _review_a30(db, assignment)
    elif code == "A31":
        check = _review_a31(db, assignment)
    elif code == "A32":
        check = _review_a32(db, assignment)
    elif code == "A33":
        check = _review_a33(db, assignment)
    elif code == "A34":
        check = _review_a34(db, assignment)
    else:
        check = _review_a35(db, assignment, int(task.task_order or 1))

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
            "Comprobación superada. El resultado de Seguridad Social es coherente."
            if check["passed"]
            else "La comprobación no se ha superado. Revisa el proceso y la evidencia generada en el ERP."
        ),
        "checks": [check],
        "scenario": scenario,
    }
