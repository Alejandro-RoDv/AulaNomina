"""Validación pedagógica bajo demanda para regularizaciones y retroactivos."""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any
import unicodedata

from sqlalchemy.orm import Session, joinedload

from app.models.collective_agreement import CollectiveAgreement, SalaryTable
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.agreement_seniority import build_contract_seniority_preview
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.training.regularization_runtime_cases_2026 import (
    BASELINE_SALARY,
    CORRECTED_SALARY,
    RECOGNIZED_SENIORITY_DATE,
    REGULARIZATION_AGREEMENT_CODE,
    REGULARIZATION_EMPLOYEE_DNI,
    REGULARIZATION_SOURCE_TABLE_NAME,
    REGULARIZATION_TARGET_TABLE_NAME,
    REVISED_TABLE_SALARY,
    SALARY_CORRECTION_DELTA,
    SALARY_TABLE_ARREARS_TOTAL,
    SENIORITY_MONTHLY_AMOUNT,
    SENIORITY_RETROACTIVE_TOTAL,
)


REGULARIZATION_SCENARIO_CODES = {
    "TRAIN-2026-REG-A42": "A42",
    "TRAIN-2026-REG-A43": "A43",
    "TRAIN-2026-REG-A44": "A44",
    "TRAIN-2026-REG-A45": "A45",
}
MONEY_TOLERANCE = Decimal("0.05")


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _close(left: Any, right: Any, tolerance: Decimal = MONEY_TOLERANCE) -> bool:
    return abs(_money(left) - _money(right)) <= tolerance


def _check(passed: bool, message: str, evidence: dict[str, Any], *, rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _activity_code(assignment) -> str | None:
    scenario = str(assignment.case_study.scenario_code or "").strip().upper()
    return REGULARIZATION_SCENARIO_CODES.get(scenario)


def _training_employee(db: Session) -> Employee | None:
    return db.query(Employee).filter(Employee.dni == REGULARIZATION_EMPLOYEE_DNI).first()


def _training_contract(db: Session) -> Contract | None:
    employee = _training_employee(db)
    if employee is None:
        return None
    return (
        db.query(Contract)
        .options(joinedload(Contract.employee), joinedload(Contract.salary_table_row))
        .filter(Contract.employee_id == employee.id, Contract.status == "active")
        .order_by(Contract.id.desc())
        .first()
    )


def _payroll(db: Session, employee_id: int, month: int) -> Payroll | None:
    return (
        db.query(Payroll)
        .filter(
            Payroll.employee_id == employee_id,
            Payroll.period_year == 2026,
            Payroll.period_month == month,
        )
        .order_by(Payroll.id.desc())
        .first()
    )


def _regularization_items(db: Session, payroll: Payroll | None, reason: str) -> list[PayrollItem]:
    if payroll is None:
        return []
    items = (
        db.query(PayrollItem)
        .options(joinedload(PayrollItem.concept))
        .filter(PayrollItem.payroll_id == payroll.id)
        .order_by(PayrollItem.id.asc())
        .all()
    )
    return [
        item
        for item in items
        if _normalize(item.source_type) == "regularization"
        and str((item.calculation_trace or {}).get("reason") or "").upper() == reason.upper()
    ]


def _gross_regularization_total(items: list[PayrollItem]) -> Decimal:
    return _money(sum(
        (
            _money(item.amount)
            for item in items
            if item.concept is not None and bool(item.concept.affects_gross)
        ),
        Decimal("0.00"),
    ))


def _review_a42(db: Session, assignment, task_order: int) -> dict[str, Any]:
    contract = _training_contract(db)
    employee = contract.employee if contract else _training_employee(db)
    june = _payroll(db, employee.id, 6) if employee else None
    july = _payroll(db, employee.id, 7) if employee else None
    salary_ok = bool(contract and _close(contract.salary_base, CORRECTED_SALARY))
    original_untouched = bool(
        june
        and _close(june.base_salary, BASELINE_SALARY)
        and _close(june.gross_salary, BASELINE_SALARY)
    )

    if task_order == 1:
        passed = salary_ok and original_untouched
        return _check(
            passed,
            (
                "La causa permanente está corregida en el contrato y la nómina histórica de junio permanece intacta."
                if passed
                else "Corrige el salario base del contrato a 1.430,00 € sin modificar la nómina histórica de junio."
            ),
            {
                "contract_id": contract.id if contract else None,
                "contract_salary_base": float(contract.salary_base) if contract and contract.salary_base is not None else None,
                "expected_contract_salary_base": float(CORRECTED_SALARY),
                "origin_payroll_id": june.id if june else None,
                "origin_base_salary": float(june.base_salary) if june else None,
                "origin_gross_salary": float(june.gross_salary) if june else None,
                "salary_ok": salary_ok,
                "original_untouched": original_untouched,
            },
            rule_type="training_a42_origin_correction",
        )

    items = _regularization_items(db, july, "CAMBIO_SALARIAL")
    gross_delta = _gross_regularization_total(items)
    linked_to_june = bool(items and june and all(item.source_id == june.id for item in items))
    delta_ok = _close(gross_delta, SALARY_CORRECTION_DELTA)
    target_total_ok = bool(july and _close(july.gross_salary, BASELINE_SALARY + SALARY_CORRECTION_DELTA))
    passed = salary_ok and original_untouched and linked_to_june and delta_ok and target_total_ok
    return _check(
        passed,
        (
            "La diferencia salarial está aplicada en julio, enlazada con junio y el cálculo original sigue preservado."
            if passed
            else "Aplica en julio una regularización CAMBIO_SALARIAL de 30,00 € vinculada a la nómina de junio."
        ),
        {
            "origin_payroll_id": june.id if june else None,
            "target_payroll_id": july.id if july else None,
            "regularization_item_ids": [item.id for item in items],
            "gross_delta": float(gross_delta),
            "expected_gross_delta": float(SALARY_CORRECTION_DELTA),
            "target_gross_salary": float(july.gross_salary) if july else None,
            "linked_to_origin": linked_to_june,
            "delta_ok": delta_ok,
            "target_total_ok": target_total_ok,
            "original_untouched": original_untouched,
        },
        rule_type="training_a42_regularization",
    )


def _review_a43(db: Session, assignment, task_order: int) -> dict[str, Any]:
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
    items = _regularization_items(db, august, "ANTIGUEDAD")
    gross_delta = _gross_regularization_total(items)
    historical = [_payroll(db, employee.id, month) for month in range(1, 7)] if employee else []
    originals_untouched = bool(
        len(historical) == 6
        and all(item and _close(item.gross_salary, BASELINE_SALARY) for item in historical)
    )
    delta_ok = _close(gross_delta, SENIORITY_RETROACTIVE_TOTAL)
    target_total_ok = bool(august and _close(august.gross_salary, BASELINE_SALARY + SENIORITY_RETROACTIVE_TOTAL))
    passed = date_ok and preview_ok and originals_untouched and delta_ok and target_total_ok and bool(items)
    return _check(
        passed,
        (
            "Los seis meses enero-junio permanecen intactos y el retroactivo de antigüedad de 192,00 € queda aplicado en agosto."
            if passed
            else "Regulariza en agosto 192,00 € por ANTIGUEDAD y conserva sin cambios las seis nóminas históricas afectadas."
        ),
        {
            "target_payroll_id": august.id if august else None,
            "regularization_item_ids": [item.id for item in items],
            "gross_delta": float(gross_delta),
            "expected_gross_delta": float(SENIORITY_RETROACTIVE_TOTAL),
            "historical_payroll_ids": [item.id for item in historical if item],
            "originals_untouched": originals_untouched,
            "date_ok": date_ok,
            "preview_ok": preview_ok,
            "delta_ok": delta_ok,
            "target_total_ok": target_total_ok,
        },
        rule_type="training_a43_seniority_regularization",
    )


def _training_agreement(db: Session) -> CollectiveAgreement | None:
    return db.query(CollectiveAgreement).filter(CollectiveAgreement.agreement_code == REGULARIZATION_AGREEMENT_CODE).first()


def _training_tables(db: Session) -> tuple[SalaryTable | None, SalaryTable | None]:
    agreement = _training_agreement(db)
    if agreement is None:
        return None, None
    tables = db.query(SalaryTable).filter(SalaryTable.collective_agreement_id == agreement.id).all()
    source = next((item for item in tables if item.name == REGULARIZATION_SOURCE_TABLE_NAME), None)
    target = next((item for item in tables if item.name == REGULARIZATION_TARGET_TABLE_NAME), None)
    return source, target


def _arrears_payroll(db: Session, employee: Employee | None) -> Payroll | None:
    if employee is None:
        return None
    return (
        db.query(Payroll)
        .options(joinedload(Payroll.items).joinedload(PayrollItem.concept))
        .filter(
            Payroll.employee_id == employee.id,
            Payroll.period_year == 2026,
            Payroll.period_month == 15,
        )
        .order_by(Payroll.id.desc())
        .first()
    )


def _arrears_trace(payroll: Payroll | None) -> dict[str, Any]:
    if payroll is None:
        return {"items": [], "months": [], "total": Decimal("0.00"), "line_amounts": []}
    items = [
        item
        for item in (payroll.items or [])
        if item.concept is not None and _normalize(item.concept.category) == "atrasos"
    ]
    months: list[int] = []
    line_amounts: list[Decimal] = []
    for item in items:
        match = re.search(r"(\d{2})/2026", str(item.description or ""))
        if match:
            months.append(int(match.group(1)))
        line_amounts.append(_money(item.amount))
    return {
        "items": items,
        "months": sorted(months),
        "total": _money(sum(line_amounts, Decimal("0.00"))),
        "line_amounts": line_amounts,
    }


def _review_a44(db: Session, assignment, task_order: int) -> dict[str, Any]:
    source, target = _training_tables(db)
    source_row = source.rows[0] if source and source.rows else None
    target_row = target.rows[0] if target and target.rows else None
    source_amount_ok = bool(source_row and _close(source_row.base_salary, BASELINE_SALARY))
    target_amount_ok = bool(target_row and _close(target_row.base_salary, REVISED_TABLE_SALARY))
    dates_ok = bool(target and str(target.effective_from) == "2026-01-01")
    statuses_ok = bool(source and target and source.status == "historical" and target.status == "active")

    if task_order == 1:
        passed = source_amount_ok and target_amount_ok and dates_ok and statuses_ok
        return _check(
            passed,
            (
                "La revisión salarial está activa con efectos 01/01/2026 y la tabla anterior queda conservada como histórica."
                if passed
                else "Revisa los importes y activa la tabla salarial revisada; la original debe pasar a histórica."
            ),
            {
                "source_table_id": source.id if source else None,
                "source_status": source.status if source else None,
                "source_base_salary": float(source_row.base_salary) if source_row and source_row.base_salary is not None else None,
                "target_table_id": target.id if target else None,
                "target_status": target.status if target else None,
                "target_base_salary": float(target_row.base_salary) if target_row and target_row.base_salary is not None else None,
                "target_effective_from": str(target.effective_from) if target else None,
                "statuses_ok": statuses_ok,
                "amounts_ok": source_amount_ok and target_amount_ok,
                "dates_ok": dates_ok,
            },
            rule_type="training_a44_salary_table_revision",
        )

    employee = _training_employee(db)
    complement = _arrears_payroll(db, employee)
    trace = _arrears_trace(complement)
    months_ok = trace["months"] == [1, 2, 3, 4, 5, 6]
    lines_ok = len(trace["items"]) == 6 and all(_close(amount, Decimal("50.00")) for amount in trace["line_amounts"])
    total_ok = _close(trace["total"], SALARY_TABLE_ARREARS_TOTAL) and bool(complement and _close(complement.gross_salary, SALARY_TABLE_ARREARS_TOTAL))
    passed = statuses_ok and source_amount_ok and target_amount_ok and months_ok and lines_ok and total_ok
    return _check(
        passed,
        (
            "La complementaria recoge exactamente enero-junio, seis diferencias de 50,00 € y un total bruto de 300,00 €."
            if passed
            else "Genera los atrasos únicamente entre enero y junio: deben resultar seis líneas de 50,00 € y 300,00 € en total."
        ),
        {
            "payroll_id": complement.id if complement else None,
            "gross_salary": float(complement.gross_salary) if complement else None,
            "trace_item_ids": [item.id for item in trace["items"]],
            "source_months": trace["months"],
            "line_amounts": [float(value) for value in trace["line_amounts"]],
            "trace_total": float(trace["total"]),
            "months_ok": months_ok,
            "lines_ok": lines_ok,
            "total_ok": total_ok,
        },
        rule_type="training_a44_salary_table_arrears",
    )


def _review_a45(db: Session, assignment) -> dict[str, Any]:
    employee = _training_employee(db)
    complement = _arrears_payroll(db, employee)
    trace = _arrears_trace(complement)
    historical = [_payroll(db, employee.id, month) for month in range(1, 7)] if employee else []
    original_months_ok = bool(
        len(historical) == 6
        and all(
            payroll
            and _close(payroll.base_salary, BASELINE_SALARY)
            and _close(payroll.gross_salary, BASELINE_SALARY)
            for payroll in historical
        )
    )
    trace_months_ok = trace["months"] == [1, 2, 3, 4, 5, 6]
    differences_ok = len(trace["line_amounts"]) == 6 and all(
        _close(amount, REVISED_TABLE_SALARY - BASELINE_SALARY)
        for amount in trace["line_amounts"]
    )
    total_ok = _close(trace["total"], SALARY_TABLE_ARREARS_TOTAL)
    source_links_ok = bool(trace["items"]) and all(
        "Nómina origen" in str(item.notes or "") and "tabla" in _normalize(item.notes)
        for item in trace["items"]
    )
    passed = original_months_ok and trace_months_ok and differences_ok and total_ok and source_links_ok
    return _check(
        passed,
        (
            "La trazabilidad separa los seis cálculos originales de 1.400,00 €, las diferencias mensuales de 50,00 € y la complementaria total de 300,00 €."
            if passed
            else "Revisa la evidencia: los originales deben permanecer intactos y cada línea de la complementaria debe identificar su nómina origen y diferencia."
        ),
        {
            "original_payroll_ids": [payroll.id for payroll in historical if payroll],
            "original_months_ok": original_months_ok,
            "complementary_payroll_id": complement.id if complement else None,
            "trace_item_ids": [item.id for item in trace["items"]],
            "source_months": trace["months"],
            "line_amounts": [float(value) for value in trace["line_amounts"]],
            "difference_total": float(trace["total"]),
            "expected_difference_total": float(SALARY_TABLE_ARREARS_TOTAL),
            "trace_months_ok": trace_months_ok,
            "differences_ok": differences_ok,
            "source_links_ok": source_links_ok,
            "total_ok": total_ok,
        },
        rule_type="training_a45_regularization_trace",
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
        check = _review_a43(db, assignment, order)
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
