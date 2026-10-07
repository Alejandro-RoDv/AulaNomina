from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.crud.payroll_salary_structure import get_payroll_items
from app.services.payroll_amounts import money
from app.models.agreement_extra_pay import AgreementExtraPay
from app.models.contract import Contract
from app.models.payroll import Payroll
from app.schemas.contract_extra_pay import ContractExtraPayPayrollCreateRequest
from app.schemas.payroll_preparation import PayrollGenerationRequest
from app.services.contract_extra_pay_generation import create_contract_extra_payroll


SPECIAL_PAYROLL_PERIODS = set(range(13, 20))


def _employee_name(contract: Contract) -> str:
    employee = contract.employee
    if not employee:
        return ""
    return " ".join(
        str(value).strip()
        for value in (employee.first_name, employee.last_name, getattr(employee, "second_last_name", None))
        if value and str(value).strip()
    )


def _contract_code(contract: Contract) -> str:
    if contract.contract_code:
        return contract.contract_code
    if contract.employee and contract.employee.employee_code:
        return f"{contract.employee.employee_code}.{contract.id}"
    return str(contract.id)


def _base_item(contract: Contract) -> dict:
    return {
        "employee_id": contract.employee_id,
        "employee_name": _employee_name(contract),
        "contract_id": contract.id,
        "contract_code": _contract_code(contract),
        "company_id": contract.company_id,
        "company_name": contract.company.name if contract.company else None,
    }


def _existing_payroll(db: Session, contract_id: int, period_month: int, period_year: int) -> Payroll | None:
    return (
        db.query(Payroll)
        .filter(
            Payroll.contract_id == contract_id,
            Payroll.period_month == period_month,
            Payroll.period_year == period_year,
            Payroll.status != "cancelled",
        )
        .order_by(Payroll.id.desc())
        .first()
    )


def _resolve_extra_pay(db: Session, contract: Contract, payroll_period: int) -> AgreementExtraPay | None:
    if not contract.collective_agreement_id:
        return None

    table_id = contract.salary_table_row.salary_table_id if contract.salary_table_row else None
    query = db.query(AgreementExtraPay).filter(
        AgreementExtraPay.collective_agreement_id == contract.collective_agreement_id,
        AgreementExtraPay.payroll_period == payroll_period,
        AgreementExtraPay.is_active == True,
    )
    if table_id is not None:
        query = query.filter(
            or_(AgreementExtraPay.salary_table_id.is_(None), AgreementExtraPay.salary_table_id == table_id)
        )

    candidates = query.order_by(AgreementExtraPay.id.asc()).all()
    if table_id is not None:
        exact = next((item for item in candidates if item.salary_table_id == table_id), None)
        if exact:
            return exact
    return next((item for item in candidates if item.salary_table_id is None), candidates[0] if candidates else None)


def generate_special_payrolls(db: Session, request: PayrollGenerationRequest) -> dict:
    if request.period_month not in SPECIAL_PAYROLL_PERIODS:
        raise HTTPException(status_code=400, detail="Periodo extraordinario no válido")

    query = (
        db.query(Contract)
        .options(
            joinedload(Contract.employee),
            joinedload(Contract.company),
            joinedload(Contract.work_center),
            joinedload(Contract.salary_table_row),
        )
    )

    if not (request.recalculate_existing and request.contract_ids):
        query = query.filter(Contract.status == "active")

    if request.company_ids:
        query = query.filter(Contract.company_id.in_(request.company_ids))
    if request.center_id:
        query = query.filter(Contract.center_id == request.center_id)
    if request.employee_ids:
        query = query.filter(Contract.employee_id.in_(request.employee_ids))
    if request.contract_ids:
        query = query.filter(Contract.id.in_(request.contract_ids))

    contracts = query.order_by(Contract.company_id, Contract.employee_id, Contract.id).all()
    generated_count = 0
    existing_count = 0
    skipped_count = 0
    items: list[dict] = []

    for contract in contracts:
        base = _base_item(contract)
        employee = contract.employee
        existing = _existing_payroll(db, contract.id, request.period_month, request.period_year)
        if existing and request.recalculate_existing:
            recalculate_saved_extra_payroll(db, existing)
            generated_count += 1
            items.append({**base, "payroll_id": existing.id, "status": existing.status, "source": "extra_pay", "message": "Paga extraordinaria recalculada"})
            continue
        if not employee or not employee.is_active:
            skipped_count += 1
            items.append({**base, "status": "skipped", "source": "extra_pay", "message": "Trabajador inactivo"})
            continue

        if existing:
            existing_count += 1
            items.append({
                **base,
                "payroll_id": existing.id,
                "status": existing.status,
                "source": "existing",
                "message": "La paga extraordinaria ya estaba generada",
            })
            continue

        if contract.status != "active":
            skipped_count += 1
            items.append({**base, "status": "skipped", "source": "extra_pay", "message": "El contrato no está activo y no existe una paga para recalcular"})
            continue
        extra_pay = _resolve_extra_pay(db, contract, request.period_month)
        if not extra_pay:
            skipped_count += 1
            items.append({
                **base,
                "status": "skipped",
                "source": "extra_pay",
                "message": "El convenio no tiene configurada una paga extraordinaria para este periodo",
            })
            continue

        try:
            generated = create_contract_extra_payroll(
                db,
                extra_pay.id,
                contract.id,
                ContractExtraPayPayrollCreateRequest(period_year=request.period_year, status="pending"),
            )
        except HTTPException as exc:
            skipped_count += 1
            items.append({
                **base,
                "status": "skipped",
                "source": "extra_pay",
                "message": str(exc.detail),
            })
            continue

        generated_count += 1
        items.append({
            **base,
            "payroll_id": generated["payroll_id"],
            "status": generated["status"],
            "source": "extra_pay",
            "message": extra_pay.name,
        })

    return {
        "period_month": request.period_month,
        "period_year": request.period_year,
        "generated_count": generated_count,
        "existing_count": existing_count,
        "skipped_count": skipped_count,
        "items": items,
    }


def recalculate_saved_extra_payroll(db: Session, payroll: Payroll) -> None:
    """Recalculate the saved extra-payment lines without creating another payroll."""
    items = get_payroll_items(db, payroll.id)
    gross = Decimal("0")
    taxable = Decimal("0")
    deductions = Decimal("0")
    for item in items:
        concept = item.concept
        if not concept:
            continue
        amount = money(item.amount)
        component = concept.category == "PAGA_EXTRA" and concept.concept_type == "BASE_INFORMATIVA"
        if component or (concept.concept_type == "DEVENGO" and concept.affects_gross):
            gross += amount
            if component or concept.is_taxable:
                taxable += amount
        elif concept.concept_type == "DEDUCCION" and concept.affects_net and concept.code.upper() != "IRPF":
            deductions += amount
    payroll.base_salary = money(gross)
    payroll.worked_base_salary = money(gross)
    payroll.gross_salary = money(gross)
    payroll.irpf_base = money(taxable)
    irpf_lines = [item for item in items if item.concept and item.concept.code.upper() == "IRPF"]
    payroll.irpf = money(sum((item.amount for item in irpf_lines), Decimal("0"))) if irpf_lines else money(taxable * Decimal(str(payroll.irpf_percentage or 0)) / Decimal("100"))
    payroll.total_deductions = money(payroll.irpf + deductions)
    payroll.net_salary = money(gross - payroll.total_deductions)
    payroll.company_total_cost = money(gross)
    payroll.status = "calculated"
    payroll.calculation_version = int(payroll.calculation_version or 0) + 1
    payroll.last_calculated_at = datetime.utcnow()
    payroll.calculation_fingerprint = None
    db.commit()
    db.refresh(payroll)
