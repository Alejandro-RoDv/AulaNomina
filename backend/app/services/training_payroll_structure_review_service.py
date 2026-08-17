"""Validaciones económicas reforzadas para A14 y A15.

A14 no debe aprobarse solo porque exista un concepto con el nombre esperado: se
comprueban salario base e importe del complemento del caso. A15 valida tanto la
modalidad de pagas como que la configuración produzca una prorrata mensual real.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.services.monthly_extra_pay_proration import resolve_monthly_extra_pay_proration


PAYROLL_STRUCTURE_REVIEW_CODES = {"A14", "A15"}
MONEY_TOLERANCE = Decimal("0.01")


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _money(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value.quantize(Decimal("0.01"))
    if isinstance(value, (int, float)):
        return Decimal(str(value)).quantize(Decimal("0.01"))
    text = str(value or "").strip().replace("€", "").replace(" ", "")
    if not text:
        return Decimal("0.00")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return Decimal(text).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def _close(left: Any, right: Any) -> bool:
    return abs(_money(left) - _money(right)) <= MONEY_TOLERANCE


def _check(passed: bool, message: str, evidence: dict[str, Any], *, rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _training_code(task) -> str | None:
    code = (task.trigger_condition or {}).get("training_code")
    return str(code).strip().upper() if code else None


def _find_employee(db: Session, name: str | None) -> Employee | None:
    expected = _normalize(name)
    if not expected:
        return None
    for employee in db.query(Employee).all():
        actual = _normalize(" ".join(
            part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part
        ))
        if actual == expected:
            return employee
    return None


def _active_contract(db: Session, assignment) -> Contract | None:
    state = assignment.case_study.initial_state or {}
    employee = _find_employee(db, state.get("employee") or state.get("substitute"))
    if not employee:
        return None
    return (
        db.query(Contract)
        .filter(Contract.employee_id == employee.id, Contract.status == "active")
        .order_by(Contract.id.desc())
        .first()
    )


def _review_a14(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    salary = state.get("salary_structure") or {}
    expected_base = _money(salary.get("base_salary"))
    expected_code = str(salary.get("complement_code") or "COMPLEMENTO_CONVENIO").strip().upper()
    expected_amount = _money(salary.get("complement_amount"))
    contract = _active_contract(db, assignment)

    actual_base = _money(contract.salary_base) if contract else Decimal("0.00")
    base_matches = bool(contract) and expected_base > 0 and _close(actual_base, expected_base)

    concept_line = None
    concept = None
    if contract:
        rows = (
            db.query(ContractPayrollConcept, PayrollConcept)
            .join(PayrollConcept, ContractPayrollConcept.concept_id == PayrollConcept.id)
            .filter(
                ContractPayrollConcept.contract_id == contract.id,
                ContractPayrollConcept.is_active.is_(True),
            )
            .all()
        )
        for candidate_line, candidate_concept in rows:
            if str(candidate_concept.code or "").strip().upper() == expected_code:
                concept_line = candidate_line
                concept = candidate_concept
                break

    actual_amount = _money(concept_line.amount) if concept_line else Decimal("0.00")
    amount_matches = bool(concept_line) and expected_amount > 0 and _close(actual_amount, expected_amount)
    passed = base_matches and amount_matches

    return _check(
        passed,
        (
            "La estructura salarial coincide con el caso: salario base y complemento tienen los importes esperados."
            if passed
            else "Revisa el salario base y el importe del complemento de convenio; no basta con que el concepto exista."
        ),
        {
            "contract_id": contract.id if contract else None,
            "expected_base_salary": str(expected_base),
            "actual_base_salary": str(actual_base),
            "base_salary_matches": base_matches,
            "expected_concept_code": expected_code,
            "concept_id": concept.id if concept else None,
            "contract_concept_id": concept_line.id if concept_line else None,
            "expected_concept_amount": str(expected_amount),
            "actual_concept_amount": str(actual_amount),
            "concept_amount_matches": amount_matches,
        },
        rule_type="training_a14_salary_structure",
    )


def _parse_period(value: Any) -> tuple[int, int]:
    try:
        year_text, month_text = str(value or "2026-06").split("-", 1)
        return int(year_text), int(month_text)
    except (TypeError, ValueError):
        return 2026, 6


def _review_a15(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    salary = state.get("salary_structure") or {}
    expected_schedule = str(salary.get("target_pay_schedule") or "prorated_12")
    contract = _active_contract(db, assignment)
    actual_schedule = str(contract.pay_schedule or "") if contract else ""
    schedule_matches = bool(contract and actual_schedule == expected_schedule)

    year, month = _parse_period(state.get("payroll_period"))
    proration = (
        resolve_monthly_extra_pay_proration(db, contract, month, year)
        if contract and schedule_matches
        else {"total_amount": Decimal("0.00"), "source": "not_applicable", "lines": [], "warnings": []}
    )
    total_amount = _money(proration.get("total_amount"))
    lines = list(proration.get("lines") or [])
    positive_lines = [line for line in lines if _money(line.get("amount")) > 0]
    proration_is_real = total_amount > 0 and bool(positive_lines) and proration.get("source") != "not_applicable"
    passed = schedule_matches and proration_is_real

    return _check(
        passed,
        (
            "La modalidad de 12 pagas prorrateadas genera una prorrata mensual positiva y trazable."
            if passed
            else "La modalidad de pagas o el cálculo de la prorrata no son coherentes; revisa la configuración del contrato."
        ),
        {
            "contract_id": contract.id if contract else None,
            "expected_pay_schedule": expected_schedule,
            "actual_pay_schedule": actual_schedule or None,
            "pay_schedule_matches": schedule_matches,
            "period": f"{year:04d}-{month:02d}",
            "proration_source": proration.get("source"),
            "proration_total_amount": str(total_amount),
            "proration_line_count": len(lines),
            "positive_proration_lines": len(positive_lines),
            "proration_is_real": proration_is_real,
            "warnings": list(proration.get("warnings") or []),
        },
        rule_type="training_a15_extra_pay_proration",
    )


def handles_training_payroll_structure_review(assignment, task) -> bool:
    return _training_code(task) in PAYROLL_STRUCTURE_REVIEW_CODES


def validate_training_payroll_structure_review(db: Session, assignment_id: int, task_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    code = _training_code(task)
    if code not in PAYROLL_STRUCTURE_REVIEW_CODES:
        raise CaseScenarioError(
            "El paso no pertenece a la revisión reforzada de estructura salarial",
            code="UNSUPPORTED_PAYROLL_STRUCTURE_REVIEW",
            status_code=400,
        )
    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    check = _review_a14(db, assignment) if code == "A14" else _review_a15(db, assignment)
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
            "Comprobación económica superada. La estructura salarial cumple el supuesto."
            if passed
            else "La comprobación económica no se ha superado. Revisa importes y configuración de pagas."
        ),
        "checks": [check],
        "scenario": scenario,
    }
