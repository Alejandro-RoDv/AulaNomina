"""Validación pedagógica del bloque B01 · Fundamentos y entorno de trabajo."""

from __future__ import annotations

from datetime import datetime
import json
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.collective_agreement import CollectiveAgreement
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.work_center import WorkCenter
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.training.foundation_runtime_cases_2026 import (
    A03_EMPLOYEE_DNI,
    A05_EMPLOYEE_DNI,
    FOUNDATION_AGREEMENT_CODE,
    FOUNDATION_CENTER_CODE,
    FOUNDATION_CENTER_EXPECTED_CCC,
    FOUNDATION_CENTER_NAME,
    FOUNDATION_COMPANY_CCC,
    FOUNDATION_COMPANY_CIF,
    FOUNDATION_COMPANY_NAME,
    FOUNDATION_DECISION_RULES,
    FOUNDATION_SCENARIO_CODES,
)


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _check(passed: bool, message: str, evidence: dict[str, Any], *, rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _student_response(progress) -> dict[str, Any]:
    raw = progress.student_notes
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _review_decision(task, progress) -> dict[str, Any]:
    """Corrige únicamente la opción tipo test.

    La explicación escrita se conserva como reflexión del alumno, pero no se
    puntúa ni se analiza por palabras clave. Dos respuestas conceptualmente
    equivalentes no deben producir resultados distintos por su redacción.
    """
    schema = (task.trigger_condition or {}).get("response_schema") or {}
    validation_key = str(schema.get("validation_key") or "").strip()
    rule = FOUNDATION_DECISION_RULES.get(validation_key) or {}
    response = _student_response(progress)
    decision = str(response.get("decision") or "").strip()
    explanation = str(response.get("explanation") or "").strip()
    expected = str(rule.get("expected_decision") or "").strip()

    decision_ok = bool(validation_key and expected and decision == expected)
    return _check(
        decision_ok,
        (
            "La opción seleccionada es correcta. La justificación queda como reflexión para compararla con la solución orientativa."
            if decision_ok
            else "La opción seleccionada no es correcta. Revisa los datos del supuesto y vuelve a intentarlo."
        ),
        {
            "validation_key": validation_key or None,
            "decision": decision or None,
            "decision_matches_expected": decision_ok,
            "explanation_present": bool(explanation),
            "written_response_graded": False,
            "validation_rule_available": bool(rule),
        },
        rule_type="training_foundation_quiz_decision",
    )


def _review_a02(db: Session) -> dict[str, Any]:
    company = db.query(Company).filter(Company.cif == FOUNDATION_COMPANY_CIF).first()
    center = db.query(WorkCenter).filter(WorkCenter.center_code == FOUNDATION_CENTER_CODE).first()
    company_ok = bool(
        company
        and company.name == FOUNDATION_COMPANY_NAME
        and company.ccc == FOUNDATION_COMPANY_CCC
        and _normalize(company.city) == "cordoba"
        and company.is_active
    )
    center_ok = bool(
        center
        and company
        and center.company_id == company.id
        and center.name == FOUNDATION_CENTER_NAME
        and center.general_ccc == FOUNDATION_COMPANY_CCC
        and center.main_ccc == FOUNDATION_CENTER_EXPECTED_CCC
        and center.is_active
    )
    passed = company_ok and center_ok
    return _check(
        passed,
        (
            "La empresa está identificada y el centro queda adscrito con los CCC del supuesto."
            if passed
            else "Revisa la empresa, la adscripción del centro y especialmente su CCC principal antes de continuar."
        ),
        {
            "company_id": company.id if company else None,
            "company_name": company.name if company else None,
            "company_ccc": company.ccc if company else None,
            "company_ok": company_ok,
            "center_id": center.id if center else None,
            "center_company_id": center.company_id if center else None,
            "center_general_ccc": center.general_ccc if center else None,
            "center_main_ccc": center.main_ccc if center else None,
            "expected_center_main_ccc": FOUNDATION_CENTER_EXPECTED_CCC,
            "center_ok": center_ok,
        },
        rule_type="training_a02_company_structure",
    )


def _review_a03_assignment(db: Session) -> dict[str, Any]:
    employee = db.query(Employee).filter(Employee.dni == A03_EMPLOYEE_DNI).first()
    agreement = (
        db.query(CollectiveAgreement)
        .filter(CollectiveAgreement.agreement_code == FOUNDATION_AGREEMENT_CODE)
        .first()
    )
    contract = None
    if employee:
        contract = (
            db.query(Contract)
            .filter(Contract.employee_id == employee.id, Contract.status == "active")
            .order_by(Contract.start_date.desc(), Contract.id.desc())
            .first()
        )
    agreement_ok = bool(
        contract
        and agreement
        and (
            contract.collective_agreement_id == agreement.id
            or contract.collective_agreement_code == FOUNDATION_AGREEMENT_CODE
        )
    )
    job_ok = bool(contract and _normalize(contract.job_position) == _normalize("Auxiliar administrativa"))
    passed = agreement_ok and job_ok
    return _check(
        passed,
        (
            "El contrato de Elena conserva el puesto del supuesto y está vinculado al convenio aplicable."
            if passed
            else "Asigna el convenio indicado al contrato activo de Elena sin alterar el puesto profesional del caso."
        ),
        {
            "employee_id": employee.id if employee else None,
            "contract_id": contract.id if contract else None,
            "agreement_id": agreement.id if agreement else None,
            "agreement_code": contract.collective_agreement_code if contract else None,
            "agreement_ok": agreement_ok,
            "job_position": contract.job_position if contract else None,
            "job_position_preserved": job_ok,
        },
        rule_type="training_a03_collective_agreement_assignment",
    )


def _review_a05(db: Session) -> dict[str, Any]:
    employee = db.query(Employee).filter(Employee.dni == A05_EMPLOYEE_DNI).first()
    mobile = employee.mobile_phone if employee else None
    phone = employee.phone if employee else None
    expected = {
        "mobile_phone": "611222333",
        "postal_code": "14004",
        "dni": A05_EMPLOYEE_DNI,
        "naf": "149990000002",
        "email": "nuria.gomez@aulagestionsur.demo",
    }
    actual = {
        "mobile_phone": mobile,
        "phone": phone,
        "postal_code": employee.postal_code if employee else None,
        "dni": employee.dni if employee else None,
        "naf": employee.naf if employee else None,
        "email": employee.email if employee else None,
    }
    mobile_ok = bool(employee and (mobile == expected["mobile_phone"] or phone == expected["mobile_phone"]))
    preserved_ok = bool(
        employee
        and employee.dni == expected["dni"]
        and employee.naf == expected["naf"]
        and employee.email == expected["email"]
    )
    passed = bool(employee and mobile_ok and employee.postal_code == expected["postal_code"] and preserved_ok)
    return _check(
        passed,
        (
            "El expediente contiene las dos correcciones solicitadas y conserva los identificadores que ya eran correctos."
            if passed
            else "Corrige únicamente móvil y código postal; DNI, NAF y correo deben permanecer como en la fuente del caso."
        ),
        {
            "employee_id": employee.id if employee else None,
            "expected": expected,
            "actual": actual,
            "mobile_corrected": mobile_ok,
            "postal_code_corrected": bool(employee and employee.postal_code == expected["postal_code"]),
            "protected_fields_preserved": preserved_ok,
        },
        rule_type="training_a05_employee_data_correction",
    )


def _activity_code(assignment) -> str | None:
    scenario = str(assignment.case_study.scenario_code or "").strip().upper()
    return SCENARIO_TO_CODE.get(scenario)


def handles_training_foundation_review(assignment, task) -> bool:
    scenario = str(assignment.case_study.scenario_code or "").strip().upper()
    return scenario in FOUNDATION_SCENARIO_CODES


def validate_training_foundation_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    code = _activity_code(assignment)
    if not code:
        raise CaseScenarioError("El paso no pertenece al bloque formativo B01", code="UNSUPPORTED_FOUNDATION_REVIEW", status_code=400)
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    order = int(task.task_order or 1)
    if code == "A01":
        check = _review_decision(task, progress)
    elif code == "A02":
        check = _review_a02(db)
    elif code == "A03" and order == 1:
        check = _review_a03_assignment(db)
    elif code == "A03":
        check = _review_decision(task, progress)
    else:
        check = _review_a05(db)

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
            "Comprobación superada. El ejercicio inicial cumple los criterios del caso."
            if passed
            else "La comprobación no se ha superado. Revisa la decisión o los datos guardados en el módulo relacionado."
        ),
        "checks": [check],
        "scenario": scenario,
    }
