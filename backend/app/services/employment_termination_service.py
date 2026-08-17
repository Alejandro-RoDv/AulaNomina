from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.contract import Contract
from app.models.employment_termination import EmploymentTermination
from app.schemas.employment_termination import (
    EmploymentTerminationCreate,
    EmploymentTerminationPreviewRequest,
    EmploymentTerminationUpdate,
)


MONEY = Decimal("0.01")
DAY_PRECISION = Decimal("0.0001")

REASON_DEFINITIONS: dict[str, dict[str, Any]] = {
    "voluntary_resignation": {
        "label": "Baja voluntaria / dimisión",
        "ss_situation_code": "51",
        "days_per_year": Decimal("0.00"),
        "cap_months": None,
        "legal_reference": "Estatuto de los Trabajadores, art. 49.1.d",
    },
    "temporary_expiry": {
        "label": "Fin de contrato temporal",
        "ss_situation_code": "93",
        "days_per_year": Decimal("12.00"),
        "cap_months": None,
        "legal_reference": "Estatuto de los Trabajadores, art. 49.1.c",
    },
    "disciplinary_dismissal": {
        "label": "Despido disciplinario",
        "ss_situation_code": "53",
        "days_per_year": Decimal("0.00"),
        "cap_months": None,
        "legal_reference": "Estatuto de los Trabajadores, arts. 54 y 55",
    },
    "objective_dismissal": {
        "label": "Extinción por causas objetivas",
        "ss_situation_code": "91",
        "days_per_year": Decimal("20.00"),
        "cap_months": 12,
        "legal_reference": "Estatuto de los Trabajadores, arts. 52 y 53",
    },
    "unfair_dismissal": {
        "label": "Despido improcedente",
        "ss_situation_code": "54",
        "days_per_year": Decimal("33.00"),
        "cap_months": 24,
        "legal_reference": "Estatuto de los Trabajadores, art. 56",
    },
    "other": {
        "label": "Otra causa de extinción",
        "ss_situation_code": "99",
        "days_per_year": Decimal("0.00"),
        "cap_months": None,
        "legal_reference": "Causa no parametrizada: revisar normativa y convenio aplicables",
    },
}


class EmploymentTerminationDomainError(ValueError):
    pass


def money(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def days(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(DAY_PRECISION, rounding=ROUND_HALF_UP)


def _contract_query(db: Session):
    return db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
        joinedload(Contract.work_center),
    )


def get_contract_or_404(db: Session, contract_id: int) -> Contract:
    contract = _contract_query(db).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    if not contract.employee or not contract.company:
        raise HTTPException(status_code=400, detail="El contrato no tiene trabajador o empresa asociados")
    return contract


def _employee_name(contract: Contract) -> str:
    employee = contract.employee
    return " ".join(
        part.strip()
        for part in (employee.first_name, employee.last_name, employee.second_last_name)
        if part and part.strip()
    )


def _service_months(start_date: date, effective_date: date) -> int:
    if effective_date < start_date:
        raise EmploymentTerminationDomainError("La fecha de efectos no puede ser anterior al inicio del contrato")
    month_difference = (effective_date.year - start_date.year) * 12 + (effective_date.month - start_date.month)
    if effective_date.day >= start_date.day:
        month_difference += 1
    return max(1, month_difference)


def _is_temporary_without_statutory_indemnity(contract: Contract) -> bool:
    family = str(contract.contract_family or "").strip().lower()
    contract_type = str(contract.contract_type or "").strip().lower()
    normalized = f"{family} {contract_type}"
    return any(token in normalized for token in ("training", "formacion", "formación", "replacement", "sustitucion", "sustitución"))


def _resolve_rule(contract: Contract, reason_code: str) -> tuple[dict[str, Any], list[str]]:
    definition = dict(REASON_DEFINITIONS[reason_code])
    warnings: list[str] = []

    if reason_code == "temporary_expiry" and _is_temporary_without_statutory_indemnity(contract):
        definition["days_per_year"] = Decimal("0.00")
        warnings.append(
            "El contrato formativo o de sustitución queda excluido de la indemnización general de 12 días/año por fin temporal."
        )

    if reason_code == "unfair_dismissal" and contract.start_date < date(2012, 2, 12):
        raise EmploymentTerminationDomainError(
            "Los contratos anteriores al 12/02/2012 requieren el cálculo transitorio 45/33 días y no se automatizan en esta versión educativa."
        )

    if reason_code == "disciplinary_dismissal":
        warnings.append(
            "El cálculo parte de un despido disciplinario procedente. Si fuese declarado improcedente debe utilizarse la regla específica de improcedencia."
        )
    if reason_code == "other":
        warnings.append("La causa no tiene una regla indemnizatoria automática; el importe se mantiene a cero.")
    return definition, warnings


def _resolve_salary_references(contract: Contract, payload) -> tuple[Decimal, Decimal, list[str]]:
    warnings: list[str] = []
    monthly = money(payload.monthly_salary_reference)
    if monthly <= 0:
        monthly = money(contract.salary_base)
        warnings.append("La referencia mensual se ha tomado del salario base del contrato.")

    annual = money(payload.annual_salary_reference)
    if annual <= 0:
        annual = money(contract.gross_annual_salary)
    if annual <= 0:
        payments = Decimal("12") if contract.pay_schedule == "prorated_12" else Decimal("14")
        annual = money(monthly * payments)
        warnings.append("La referencia anual se ha estimado desde el salario mensual y la modalidad de pagas.")

    if monthly <= 0 or annual <= 0:
        raise EmploymentTerminationDomainError("No existe una referencia salarial suficiente para calcular la liquidación")
    return annual, monthly, warnings


def build_termination_preview(db: Session, payload: EmploymentTerminationPreviewRequest | EmploymentTerminationCreate) -> dict[str, Any]:
    contract = get_contract_or_404(db, payload.contract_id)
    if payload.effective_date < contract.start_date:
        raise EmploymentTerminationDomainError("La fecha de efectos no puede ser anterior al inicio del contrato")

    rule, warnings = _resolve_rule(contract, payload.reason_code)
    annual_salary, monthly_salary, salary_warnings = _resolve_salary_references(contract, payload)
    warnings.extend(salary_warnings)

    service_months = _service_months(contract.start_date, payload.effective_date)
    indemnity_daily_salary = days(annual_salary / Decimal("365"))
    days_per_year = money(rule["days_per_year"])
    indemnity_days = days(days_per_year * Decimal(service_months) / Decimal("12"))
    cap_months = rule.get("cap_months")
    if cap_months:
        maximum_days = days(Decimal(cap_months) * Decimal("30"))
        if indemnity_days > maximum_days:
            indemnity_days = maximum_days
            warnings.append(f"La indemnización queda limitada al máximo de {cap_months} mensualidades.")
    indemnity_amount = money(indemnity_daily_salary * indemnity_days)

    pending_salary_days = money(payload.pending_salary_days)
    unused_vacation_days = money(payload.unused_vacation_days)
    monthly_daily_salary = money(monthly_salary / Decimal("30"))
    pending_salary_amount = money(monthly_daily_salary * pending_salary_days)
    vacation_amount = money(monthly_daily_salary * unused_vacation_days)
    extra_pay_amount = money(payload.extra_pay_amount)
    other_amount = money(payload.other_amount)
    total_settlement = money(
        pending_salary_amount
        + vacation_amount
        + extra_pay_amount
        + indemnity_amount
        + other_amount
    )

    trace = {
        "version": "termination-settlement-2026.1",
        "educational_simulation": True,
        "reason": {
            "code": payload.reason_code,
            "label": rule["label"],
            "ss_situation_code": rule["ss_situation_code"],
            "legal_reference": rule["legal_reference"],
        },
        "service": {
            "contract_start_date": contract.start_date.isoformat(),
            "effective_date": payload.effective_date.isoformat(),
            "months": service_months,
        },
        "salary_references": {
            "annual": str(annual_salary),
            "monthly": str(monthly_salary),
            "indemnity_daily": str(indemnity_daily_salary),
            "settlement_daily": str(monthly_daily_salary),
        },
        "indemnity": {
            "days_per_year": str(days_per_year),
            "days": str(indemnity_days),
            "amount": str(indemnity_amount),
            "cap_months": cap_months,
        },
        "settlement": {
            "pending_salary_days": str(pending_salary_days),
            "pending_salary_amount": str(pending_salary_amount),
            "unused_vacation_days": str(unused_vacation_days),
            "vacation_amount": str(vacation_amount),
            "extra_pay_amount": str(extra_pay_amount),
            "other_amount": str(other_amount),
            "total": str(total_settlement),
        },
        "warnings": list(warnings),
    }

    return {
        "contract_id": contract.id,
        "employee_id": contract.employee_id,
        "employee_name": _employee_name(contract),
        "company_id": contract.company_id,
        "center_id": contract.center_id,
        "reason_code": payload.reason_code,
        "ss_situation_code": rule["ss_situation_code"],
        "effective_date": payload.effective_date,
        "communication_date": payload.communication_date,
        "document_reference": payload.document_reference,
        "annual_salary_reference": annual_salary,
        "monthly_salary_reference": monthly_salary,
        "indemnity_daily_salary": indemnity_daily_salary,
        "service_months": service_months,
        "indemnity_days_per_year": days_per_year,
        "indemnity_days": indemnity_days,
        "indemnity_amount": indemnity_amount,
        "pending_salary_days": pending_salary_days,
        "pending_salary_amount": pending_salary_amount,
        "unused_vacation_days": unused_vacation_days,
        "vacation_amount": vacation_amount,
        "extra_pay_amount": extra_pay_amount,
        "other_amount": other_amount,
        "total_settlement": total_settlement,
        "legal_reference": rule["legal_reference"],
        "warnings": warnings,
        "calculation_trace": trace,
    }


def _apply_preview(record: EmploymentTermination, preview: dict[str, Any], *, notes: str | None, created_by: str | None) -> None:
    for field in (
        "employee_id",
        "company_id",
        "center_id",
        "reason_code",
        "ss_situation_code",
        "effective_date",
        "communication_date",
        "document_reference",
        "annual_salary_reference",
        "monthly_salary_reference",
        "indemnity_daily_salary",
        "service_months",
        "indemnity_days_per_year",
        "indemnity_days",
        "indemnity_amount",
        "pending_salary_days",
        "pending_salary_amount",
        "unused_vacation_days",
        "vacation_amount",
        "extra_pay_amount",
        "other_amount",
        "total_settlement",
        "calculation_trace",
    ):
        setattr(record, field, preview[field])
    if notes is not None:
        record.notes = notes
    if created_by:
        record.created_by = created_by


def _sync_contract_termination(contract: Contract, preview: dict[str, Any]) -> None:
    contract.end_date = preview["effective_date"]
    contract.status = "ended"
    contract.termination_reason = preview["ss_situation_code"]


def create_or_replace_termination(db: Session, payload: EmploymentTerminationCreate) -> EmploymentTermination:
    preview = build_termination_preview(db, payload)
    contract = get_contract_or_404(db, payload.contract_id)
    record = db.query(EmploymentTermination).filter(EmploymentTermination.contract_id == contract.id).first()
    if record is None:
        record = EmploymentTermination(
            contract_id=contract.id,
            employee_id=contract.employee_id,
            company_id=contract.company_id,
            center_id=contract.center_id,
            reason_code=payload.reason_code,
            ss_situation_code=preview["ss_situation_code"],
            effective_date=payload.effective_date,
        )
        db.add(record)
    _apply_preview(record, preview, notes=payload.notes, created_by=payload.created_by)
    record.status = "registered"
    _sync_contract_termination(contract, preview)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(record)
    return get_termination(db, record.id)


def get_termination(db: Session, termination_id: int) -> EmploymentTermination | None:
    return (
        db.query(EmploymentTermination)
        .options(
            joinedload(EmploymentTermination.contract),
            joinedload(EmploymentTermination.employee),
            joinedload(EmploymentTermination.company),
            joinedload(EmploymentTermination.work_center),
        )
        .filter(EmploymentTermination.id == termination_id)
        .first()
    )


def get_termination_by_contract(db: Session, contract_id: int) -> EmploymentTermination | None:
    return (
        db.query(EmploymentTermination)
        .options(
            joinedload(EmploymentTermination.contract),
            joinedload(EmploymentTermination.employee),
            joinedload(EmploymentTermination.company),
            joinedload(EmploymentTermination.work_center),
        )
        .filter(EmploymentTermination.contract_id == contract_id)
        .first()
    )


def list_terminations(db: Session) -> list[EmploymentTermination]:
    return (
        db.query(EmploymentTermination)
        .options(
            joinedload(EmploymentTermination.contract),
            joinedload(EmploymentTermination.employee),
            joinedload(EmploymentTermination.company),
            joinedload(EmploymentTermination.work_center),
        )
        .order_by(EmploymentTermination.effective_date.desc(), EmploymentTermination.id.desc())
        .all()
    )


def update_termination(db: Session, termination_id: int, payload: EmploymentTerminationUpdate) -> EmploymentTermination:
    record = get_termination(db, termination_id)
    if not record:
        raise HTTPException(status_code=404, detail="Extinción no encontrada")
    contract = get_contract_or_404(db, record.contract_id)
    updates = payload.model_dump(exclude_unset=True)
    merged = EmploymentTerminationCreate(
        contract_id=record.contract_id,
        reason_code=updates.get("reason_code", record.reason_code),
        effective_date=updates.get("effective_date", record.effective_date),
        communication_date=updates.get("communication_date", record.communication_date),
        document_reference=updates.get("document_reference", record.document_reference),
        annual_salary_reference=updates.get("annual_salary_reference", record.annual_salary_reference),
        monthly_salary_reference=updates.get("monthly_salary_reference", record.monthly_salary_reference),
        pending_salary_days=updates.get("pending_salary_days", record.pending_salary_days),
        unused_vacation_days=updates.get("unused_vacation_days", record.unused_vacation_days),
        extra_pay_amount=updates.get("extra_pay_amount", record.extra_pay_amount),
        other_amount=updates.get("other_amount", record.other_amount),
        notes=updates.get("notes", record.notes),
        created_by=updates.get("created_by", record.created_by),
    )
    preview = build_termination_preview(db, merged)
    _apply_preview(record, preview, notes=merged.notes, created_by=merged.created_by)
    if record.status == "settled":
        record.status = "registered"
    _sync_contract_termination(contract, preview)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(record)
    return get_termination(db, record.id)


def finalize_termination(db: Session, termination_id: int) -> EmploymentTermination:
    record = get_termination(db, termination_id)
    if not record:
        raise HTTPException(status_code=404, detail="Extinción no encontrada")
    if not record.document_reference and record.reason_code in {"disciplinary_dismissal", "objective_dismissal"}:
        raise EmploymentTerminationDomainError(
            "La extinción debe tener una referencia documental antes de cerrar el finiquito"
        )
    record.status = "settled"
    trace = dict(record.calculation_trace or {})
    trace["finalized"] = True
    trace["finalized_total"] = str(money(record.total_settlement))
    record.calculation_trace = trace
    db.commit()
    db.refresh(record)
    return get_termination(db, record.id)


def serialize_termination(record: EmploymentTermination) -> dict[str, Any]:
    trace = dict(record.calculation_trace or {})
    reason = trace.get("reason") or {}
    return {
        "id": record.id,
        "contract_id": record.contract_id,
        "contract_code": record.contract_code,
        "employee_id": record.employee_id,
        "employee_name": record.employee_name,
        "company_id": record.company_id,
        "center_id": record.center_id,
        "reason_code": record.reason_code,
        "ss_situation_code": record.ss_situation_code,
        "effective_date": record.effective_date,
        "communication_date": record.communication_date,
        "document_reference": record.document_reference,
        "status": record.status,
        "annual_salary_reference": money(record.annual_salary_reference),
        "monthly_salary_reference": money(record.monthly_salary_reference),
        "indemnity_daily_salary": days(record.indemnity_daily_salary),
        "service_months": int(record.service_months or 0),
        "indemnity_days_per_year": money(record.indemnity_days_per_year),
        "indemnity_days": days(record.indemnity_days),
        "indemnity_amount": money(record.indemnity_amount),
        "pending_salary_days": money(record.pending_salary_days),
        "pending_salary_amount": money(record.pending_salary_amount),
        "unused_vacation_days": money(record.unused_vacation_days),
        "vacation_amount": money(record.vacation_amount),
        "extra_pay_amount": money(record.extra_pay_amount),
        "other_amount": money(record.other_amount),
        "total_settlement": money(record.total_settlement),
        "legal_reference": reason.get("legal_reference") or REASON_DEFINITIONS[record.reason_code]["legal_reference"],
        "warnings": list(trace.get("warnings") or []),
        "calculation_trace": trace,
        "notes": record.notes,
        "created_by": record.created_by,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }
