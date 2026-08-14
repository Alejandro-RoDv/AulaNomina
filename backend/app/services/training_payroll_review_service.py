"""Validación pedagógica de las revisiones de nómina del Temario Maestro 2026.

Las actividades de análisis no necesitan mutar el ERP, pero sí comprobar que el
alumno está revisando un cálculo real y coherente. El resto de pasos sigue
delegándose en el validador general de casos.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.payroll import Payroll
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.services.case_validation_service import validate_assignment_step as validate_legacy_assignment_step


PAYROLL_REVIEW_CODES = {"A18", "A20", "A21", "A22"}
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


def _parse_period(value: str | None) -> tuple[int, int] | None:
    if not value:
        return None
    try:
        year, month = str(value).split("-", 1)
        return int(year), int(month)
    except (TypeError, ValueError):
        return None


def _payroll_for_assignment(db: Session, assignment) -> Payroll | None:
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


def _review_common_base(payroll: Payroll | None) -> dict[str, Any]:
    if not _is_calculated(payroll):
        return {
            "passed": False,
            "message": "No existe todavía una nómina calculada para revisar la base de contingencias comunes.",
            "evidence": {"payroll_id": payroll.id if payroll else None},
        }

    base = _money(payroll.common_contingencies_base)
    daily = _money(payroll.daily_common_base)
    days = int(payroll.contribution_days or 0)
    positive = base > 0 and daily > 0 and days > 0
    reconstructed = _money(daily * Decimal(days)) if positive else Decimal("0.00")
    coherent = positive and _close(base, reconstructed)
    return {
        "passed": coherent,
        "message": (
            "La base de contingencias comunes es positiva y cuadra con la base diaria y los días de cotización."
            if coherent
            else "La base de contingencias comunes no cuadra con la base diaria o los días de cotización del periodo."
        ),
        "evidence": {
            "payroll_id": payroll.id,
            "common_contingencies_base": str(base),
            "daily_common_base": str(daily),
            "contribution_days": days,
            "reconstructed_base": str(reconstructed),
        },
    }


def _review_employee_social_security(payroll: Payroll | None) -> dict[str, Any]:
    if not _is_calculated(payroll):
        return {
            "passed": False,
            "message": "No existe todavía una nómina calculada para revisar las aportaciones de Seguridad Social.",
            "evidence": {"payroll_id": payroll.id if payroll else None},
        }

    components = {
        "common_contingencies": _money(payroll.employee_common_contingencies),
        "unemployment": _money(payroll.employee_unemployment),
        "training": _money(payroll.employee_training),
        "mei": _money(payroll.employee_mei),
    }
    expected_total = _money(sum(components.values(), Decimal("0.00")))
    actual_total = _money(payroll.employee_social_security)
    coherent = actual_total >= 0 and _close(actual_total, expected_total)
    return {
        "passed": coherent,
        "message": (
            "Las aportaciones del trabajador cuadran con el total de Seguridad Social deducido en nómina."
            if coherent
            else "La suma de contingencias comunes, desempleo, formación y MEI no coincide con el total de Seguridad Social del trabajador."
        ),
        "evidence": {
            "payroll_id": payroll.id,
            "components": {key: str(value) for key, value in components.items()},
            "expected_total": str(expected_total),
            "employee_social_security": str(actual_total),
        },
    }


def _review_irpf(payroll: Payroll | None) -> dict[str, Any]:
    if not _is_calculated(payroll):
        return {
            "passed": False,
            "message": "No existe todavía una nómina calculada para revisar la retención de IRPF.",
            "evidence": {"payroll_id": payroll.id if payroll else None},
        }

    base = _money(payroll.irpf_base)
    percentage = _money(payroll.irpf_percentage)
    suggested = _money(payroll.suggested_irpf_percentage)
    actual = _money(payroll.irpf)
    expected = _money(base * percentage / Decimal("100"))
    amount_coherent = base >= 0 and percentage >= 0 and _close(actual, expected)
    percentage_coherent = True
    if _normalize(payroll.irpf_mode) == "auto":
        percentage_coherent = _close(percentage, suggested, Decimal("0.01"))
    coherent = amount_coherent and percentage_coherent
    return {
        "passed": coherent,
        "message": (
            "La base, el porcentaje aplicado y la cuota de IRPF son coherentes con el cálculo de la nómina."
            if coherent
            else "La retención aplicada no cuadra con la base y el porcentaje, o el modo automático no coincide con el tipo sugerido."
        ),
        "evidence": {
            "payroll_id": payroll.id,
            "irpf_mode": payroll.irpf_mode,
            "irpf_base": str(base),
            "irpf_percentage": str(percentage),
            "suggested_irpf_percentage": str(suggested),
            "expected_irpf": str(expected),
            "actual_irpf": str(actual),
            "amount_coherent": amount_coherent,
            "percentage_coherent": percentage_coherent,
        },
    }


def _review_net_and_company_cost(payroll: Payroll | None) -> dict[str, Any]:
    if not _is_calculated(payroll):
        return {
            "passed": False,
            "message": "No existe todavía una nómina calculada para revisar líquido y coste empresa.",
            "evidence": {"payroll_id": payroll.id if payroll else None},
        }

    gross = _money(payroll.gross_salary)
    deductions = _money(payroll.total_deductions)
    net = _money(payroll.net_salary)
    company_social_security = _money(payroll.company_total_social_security)
    company_cost = _money(payroll.company_total_cost)
    expected_net = _money(gross - deductions)
    expected_company_cost = _money(gross + company_social_security)
    net_coherent = gross >= 0 and deductions >= 0 and _close(net, expected_net)
    company_cost_coherent = company_social_security >= 0 and _close(company_cost, expected_company_cost)
    coherent = net_coherent and company_cost_coherent
    return {
        "passed": coherent,
        "message": (
            "El líquido cuadra con bruto menos deducciones y el coste empresa incorpora las cuotas empresariales."
            if coherent
            else "El líquido o el coste total de empresa no cuadran con los componentes de la nómina."
        ),
        "evidence": {
            "payroll_id": payroll.id,
            "gross_salary": str(gross),
            "total_deductions": str(deductions),
            "expected_net_salary": str(expected_net),
            "net_salary": str(net),
            "company_total_social_security": str(company_social_security),
            "expected_company_total_cost": str(expected_company_cost),
            "company_total_cost": str(company_cost),
            "net_coherent": net_coherent,
            "company_cost_coherent": company_cost_coherent,
        },
    }


def _review_for_code(code: str, payroll: Payroll | None) -> dict[str, Any]:
    if code == "A18":
        return _review_common_base(payroll)
    if code == "A20":
        return _review_employee_social_security(payroll)
    if code == "A21":
        return _review_irpf(payroll)
    if code == "A22":
        return _review_net_and_company_cost(payroll)
    raise ValueError(f"No existe revisión de nómina para {code}")


def validate_training_aware_assignment_step(
    db: Session,
    assignment_id: int,
    task_id: int,
) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)

    code = _training_code(task)
    if code not in PAYROLL_REVIEW_CODES:
        return validate_legacy_assignment_step(db, assignment_id, task_id)

    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    review = _review_for_code(code, _payroll_for_assignment(db, assignment))
    check = {
        "rule_type": f"training_{code.lower()}_review",
        "supported": True,
        "passed": bool(review["passed"]),
        "message": review["message"],
        "evidence": review["evidence"],
    }
    previous_result = dict(progress.validation_result or {})
    validation_result = {
        **previous_result,
        "mode": "explicit_review",
        "validated_at": datetime.utcnow().isoformat(),
        "passed": check["passed"],
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
        "passed": check["passed"],
        "manual_required": False,
        "message": (
            "Comprobación superada. La revisión de nómina queda completada."
            if check["passed"]
            else "La comprobación no se ha superado. Revisa los importes mostrados en la nómina."
        ),
        "checks": [check],
        "scenario": scenario,
    }
