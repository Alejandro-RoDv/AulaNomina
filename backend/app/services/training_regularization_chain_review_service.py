"""Ajustes de validación secuencial para el bloque B07.

A43 depende de A42 en el Temario Maestro. Por ello la nómina corriente usada
para liquidar la antigüedad debe incorporar primero la corrección salarial ya
realizada en A42 y el complemento vigente del propio mes.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.agreement_seniority import build_contract_seniority_preview
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.services.training_regularization_review_service import (
    _activity_code,
    _check,
    _close,
    _gross_regularization_total,
    _payroll,
    _regularization_items,
    _review_a42,
    _review_a44,
    _review_a45,
    _training_contract,
    _training_employee,
)
from app.training.regularization_runtime_cases_2026 import (
    BASELINE_SALARY,
    CORRECTED_SALARY,
    RECOGNIZED_SENIORITY_DATE,
    SENIORITY_MONTHLY_AMOUNT,
    SENIORITY_RETROACTIVE_TOTAL,
)


EXPECTED_AUGUST_GROSS_BEFORE_RETROACTIVE = CORRECTED_SALARY + SENIORITY_MONTHLY_AMOUNT
EXPECTED_AUGUST_GROSS_AFTER_RETROACTIVE = EXPECTED_AUGUST_GROSS_BEFORE_RETROACTIVE + SENIORITY_RETROACTIVE_TOTAL


def _review_a43_sequential(db: Session, assignment, task_order: int) -> dict[str, Any]:
    contract = _training_contract(db)
    employee = contract.employee if contract else _training_employee(db)
    date_ok = bool(contract and contract.recognized_seniority_date == RECOGNIZED_SENIORITY_DATE)
    preview = build_contract_seniority_preview(db, contract, date(2026, 6, 30)) if contract else None
    preview_ok = bool(
        preview
        and preview.get("eligibility") == "eligible"
        and int(preview.get("completed_modules") or 0) == 1
        and _close(preview.get("monthly_amount"), SENIORITY_MONTHLY_AMOUNT)
    )

    if task_order == 1:
        passed = date_ok and preview_ok
        return _check(
            passed,
            (
                "La antigüedad reconocida es correcta y la regla aplicable produce un trienio de 32,00 € mensuales."
                if passed
                else "Informa la antigüedad reconocida 01/09/2022 y comprueba que la vista previa produce 32,00 € mensuales en junio."
            ),
            {
                "contract_id": contract.id if contract else None,
                "recognized_seniority_date": str(contract.recognized_seniority_date) if contract and contract.recognized_seniority_date else None,
                "expected_seniority_date": RECOGNIZED_SENIORITY_DATE.isoformat(),
                "completed_modules": preview.get("completed_modules") if preview else None,
                "monthly_amount": float(preview.get("monthly_amount") or 0) if preview else None,
                "date_ok": date_ok,
                "preview_ok": preview_ok,
            },
            rule_type="training_a43_seniority_origin",
        )

    august = _payroll(db, employee.id, 8) if employee else None
    historical = [_payroll(db, employee.id, month) for month in range(1, 7)] if employee else []
    historical_ids = {item.id for item in historical if item}
    items = _regularization_items(db, august, "ANTIGUEDAD")
    gross_delta = _gross_regularization_total(items)

    originals_untouched = bool(
        len(historical) == 6
        and all(item and _close(item.gross_salary, BASELINE_SALARY) for item in historical)
    )
    current_salary_ok = bool(august and _close(august.base_salary, CORRECTED_SALARY))
    current_seniority_ok = bool(august and _close(august.seniority_amount, SENIORITY_MONTHLY_AMOUNT))
    delta_ok = _close(gross_delta, SENIORITY_RETROACTIVE_TOTAL)
    target_total_ok = bool(august and _close(august.gross_salary, EXPECTED_AUGUST_GROSS_AFTER_RETROACTIVE))
    linked_to_history = bool(
        items
        and historical_ids
        and all(item.source_id in historical_ids for item in items)
    )

    passed = bool(
        date_ok
        and preview_ok
        and originals_untouched
        and current_salary_ok
        and current_seniority_ok
        and delta_ok
        and target_total_ok
        and linked_to_history
    )
    return _check(
        passed,
        (
            "Agosto incorpora primero el salario corregido de A42 y el trienio corriente; después añade 192,00 € por los seis meses retroactivos sin tocar los originales."
            if passed
            else (
                "Antes de liquidar el retroactivo, recalcula agosto: debe partir de 1.430,00 € de salario base y 32,00 € de antigüedad. "
                "Después aplica 192,00 € por ANTIGUEDAD vinculados a una nómina histórica de enero-junio."
            )
        ),
        {
            "target_payroll_id": august.id if august else None,
            "regularization_item_ids": [item.id for item in items],
            "gross_delta": float(gross_delta),
            "expected_gross_delta": float(SENIORITY_RETROACTIVE_TOTAL),
            "current_base_salary": float(august.base_salary) if august else None,
            "expected_current_base_salary": float(CORRECTED_SALARY),
            "current_seniority_amount": float(august.seniority_amount) if august else None,
            "expected_current_seniority_amount": float(SENIORITY_MONTHLY_AMOUNT),
            "target_gross_salary": float(august.gross_salary) if august else None,
            "expected_target_gross_salary": float(EXPECTED_AUGUST_GROSS_AFTER_RETROACTIVE),
            "historical_payroll_ids": sorted(historical_ids),
            "originals_untouched": originals_untouched,
            "current_salary_ok": current_salary_ok,
            "current_seniority_ok": current_seniority_ok,
            "linked_to_history": linked_to_history,
            "date_ok": date_ok,
            "preview_ok": preview_ok,
            "delta_ok": delta_ok,
            "target_total_ok": target_total_ok,
        },
        rule_type="training_a43_seniority_regularization",
    )


def handles_training_regularization_review(assignment, task) -> bool:
    return _activity_code(assignment) in {"A42", "A43", "A44", "A45"}


def validate_training_regularization_review(
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
        raise CaseScenarioError("El paso no pertenece al bloque formativo de regularizaciones", code="UNSUPPORTED_TRAINING_REVIEW", status_code=400)

    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    order = int(task.task_order or 1)
    if code == "A42":
        check = _review_a42(db, assignment, order)
    elif code == "A43":
        check = _review_a43_sequential(db, assignment, order)
    elif code == "A44":
        check = _review_a44(db, assignment, order)
    else:
        check = _review_a45(db, assignment)

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
            "Comprobación superada. La regularización mantiene una trazabilidad coherente."
            if check["passed"]
            else "La comprobación no se ha superado. Revisa el origen, el periodo y la diferencia antes de continuar."
        ),
        "checks": [check],
        "scenario": scenario,
    }
