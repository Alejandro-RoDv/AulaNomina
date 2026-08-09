from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

import app.crud.payroll as payroll_crud
from app.crud.payroll_salary_structure import get_payroll_items, load_contract_concepts_into_payroll
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.schemas.payroll import PayrollCreate
from app.schemas.payroll_preparation import PayrollGenerationRequest, PayrollPreparationEnsureRequest
from app.services.payroll_amounts import calculate_social_security_amounts_from_bases, money
from app.services.payroll_concept_engine import build_concept_lines_from_payroll
from app.services.payroll_concept_items import ensure_engine_concept, json_safe, sync_engine_concept_items

GENERATED_STATUSES = {"pending", "calculated", "reviewed", "closed"}


def _employee_name(employee: Employee | None) -> str:
    if not employee:
        return ""
    parts = [employee.first_name, employee.last_name, getattr(employee, "second_last_name", None)]
    return " ".join(str(part).strip() for part in parts if part and str(part).strip())


def _contract_code(contract: Contract | None) -> str | None:
    if not contract:
        return None
    return payroll_crud.build_contract_code(contract)


def _is_editable_item(item: PayrollItem) -> bool:
    concept = item.concept
    if not concept:
        return False
    if concept.concept_type == "DEVENGO":
        return True
    if concept.concept_type == "DEDUCCION" and not item.is_automatic:
        return True
    return False


def _line_payload(item: PayrollItem) -> dict:
    concept = item.concept
    return {
        "id": item.id,
        "concept_id": item.concept_id,
        "code": concept.code if concept else f"ITEM_{item.id}",
        "name": concept.name if concept else item.description or "Concepto",
        "description": item.description,
        "amount": money(item.amount),
        "quantity": money(item.quantity or Decimal("1.00")),
        "unit_price": money(item.unit_price),
        "concept_type": concept.concept_type if concept else "DEVENGO",
        "salary_nature": concept.salary_nature if concept else "SALARIAL",
        "category": concept.category if concept else "OTRO",
        "source_type": str(item.source_type or (concept.source_type if concept else "manual")).lower(),
        "is_automatic": bool(item.is_automatic),
        "is_taxable": bool(concept.is_taxable) if concept else True,
        "is_contribution_base": bool(concept.is_contribution_base) if concept else True,
        "affects_gross": bool(concept.affects_gross) if concept else True,
        "affects_net": bool(concept.affects_net) if concept else True,
        "display_order": int(item.display_order or 0),
    }


def _editable_items(db: Session, payroll_id: int) -> list[PayrollItem]:
    return [item for item in get_payroll_items(db, payroll_id) if _is_editable_item(item)]


def calculate_preparation_preview(db: Session, payroll: Payroll) -> dict:
    """Calculate a non-persistent preview from the saved preparation lines."""
    items = _editable_items(db, payroll.id)
    gross_salary = Decimal("0.00")
    common_base = Decimal("0.00")
    professional_base = Decimal("0.00")
    irpf_base = Decimal("0.00")
    manual_deductions = Decimal("0.00")

    for item in items:
        concept = item.concept
        amount = money(item.amount)
        if concept.concept_type == "DEVENGO":
            if concept.affects_gross:
                gross_salary += amount
            if concept.is_contribution_base:
                professional_base += amount
                if concept.category != "HORAS_EXTRA":
                    common_base += amount
            if concept.is_taxable:
                irpf_base += amount
        elif concept.concept_type == "DEDUCCION" and concept.affects_net:
            manual_deductions += amount

    gross_salary = money(gross_salary)
    common_base = money(common_base)
    professional_base = money(professional_base)
    irpf_base = money(irpf_base)
    manual_deductions = money(manual_deductions)

    calculated = calculate_social_security_amounts_from_bases(
        gross_salary=gross_salary,
        common_contingencies_base=common_base,
        professional_contingencies_base=professional_base,
        unemployment_training_fogasa_base=professional_base,
        irpf_base=irpf_base,
        irpf_percentage=money(payroll.irpf_percentage),
    )
    total_deductions = money(calculated["total_deductions"] + manual_deductions)
    net_salary = money(gross_salary - total_deductions)

    return {
        "payroll_id": payroll.id,
        "gross_salary": gross_salary,
        "contribution_base": common_base,
        "professional_base": professional_base,
        "irpf_base": irpf_base,
        "employee_social_security": money(calculated["employee_social_security"]),
        "irpf": money(calculated["irpf"]),
        "manual_deductions": manual_deductions,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "company_total_social_security": money(calculated["company_total_social_security"]),
        "company_total_cost": money(calculated["company_total_cost"]),
        "calculated": calculated,
    }


def build_preparation_response(db: Session, payroll: Payroll) -> dict:
    payroll = payroll_crud.get_payroll(db, payroll.id) or payroll
    preview = calculate_preparation_preview(db, payroll)
    employee = payroll.employee
    contract = payroll.contract
    company = payroll.company
    center = payroll.work_center
    public_preview = {key: value for key, value in preview.items() if key != "calculated"}
    return {
        "payroll_id": payroll.id,
        "status": payroll.status,
        "generated": payroll.status in GENERATED_STATUSES,
        "employee_id": payroll.employee_id,
        "employee_name": _employee_name(employee),
        "employee_code": getattr(employee, "employee_code", None),
        "contract_id": payroll.contract_id,
        "contract_code": _contract_code(contract),
        "company_id": payroll.company_id,
        "company_name": getattr(company, "name", None),
        "center_id": payroll.center_id,
        "center_name": getattr(center, "name", None),
        "period_month": payroll.period_month,
        "period_year": payroll.period_year,
        "lines": [_line_payload(item) for item in _editable_items(db, payroll.id)],
        "preview": public_preview,
    }


def _find_period_payroll(db: Session, contract_id: int, period_month: int, period_year: int) -> Payroll | None:
    return payroll_crud.get_payroll_query(db).filter(
        Payroll.contract_id == contract_id,
        Payroll.period_month == period_month,
        Payroll.period_year == period_year,
        Payroll.status != "cancelled",
    ).order_by(Payroll.id.desc()).first()


def _create_draft_payroll(db: Session, request: PayrollPreparationEnsureRequest, contract: Contract) -> Payroll:
    """Create a draft using the calculation engine without processing incidents as final.

    The CRUD layer calculates period amounts, including the current incident
    picture, but does not mark incidents as processed. Canonical concept lines are
    materialized only to provide the editable starting point for the student.
    """
    created = payroll_crud.create_payroll(
        db,
        PayrollCreate(
            employee_id=request.employee_id,
            contract_id=contract.id,
            company_id=contract.company_id,
            center_id=contract.center_id,
            period_month=request.period_month,
            period_year=request.period_year,
            salary_supplements=Decimal("0.00"),
            variable_incentives=Decimal("0.00"),
            irpf_mode="auto",
            status="draft",
        ),
    )
    try:
        sync_engine_concept_items(db, created.id, build_concept_lines_from_payroll(created))
        db.commit()
    except Exception:
        db.rollback()
        raise
    load_contract_concepts_into_payroll(db, created.id)
    return payroll_crud.get_payroll(db, created.id)


def ensure_preparation(db: Session, request: PayrollPreparationEnsureRequest) -> dict:
    employee = db.query(Employee).filter(Employee.id == request.employee_id, Employee.is_active == True).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    contract = db.query(Contract).filter(Contract.id == request.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    if contract.employee_id != employee.id:
        raise HTTPException(status_code=400, detail="El contrato no pertenece al trabajador")

    skip_reason = payroll_crud.get_contract_period_skip_reason(contract, request.period_month, request.period_year)
    if skip_reason:
        raise HTTPException(status_code=400, detail=skip_reason)

    existing = _find_period_payroll(db, contract.id, request.period_month, request.period_year)
    if existing:
        return build_preparation_response(db, existing)

    created = _create_draft_payroll(db, request, contract)
    return build_preparation_response(db, created)


def get_preparation(db: Session, payroll_id: int) -> dict:
    payroll = payroll_crud.get_payroll(db, payroll_id)
    if not payroll:
        raise HTTPException(status_code=404, detail="Preparación no encontrada")
    return build_preparation_response(db, payroll)


def _sum_by_code(items: list[PayrollItem], code: str) -> Decimal:
    return money(sum((money(item.amount) for item in items if item.concept and item.concept.code == code), Decimal("0.00")))


def _sum_categories(items: list[PayrollItem], categories: set[str]) -> Decimal:
    return money(sum(
        (
            money(item.amount)
            for item in items
            if item.concept
            and item.concept.concept_type == "DEVENGO"
            and item.concept.category in categories
        ),
        Decimal("0.00"),
    ))


def _sync_generated_system_items(db: Session, payroll: Payroll) -> None:
    """Refresh only automatic deductions/bases/costs; keep prepared earnings."""
    prefix = f"ENGINE:{payroll.id}:"
    existing = db.query(PayrollItem).options(joinedload(PayrollItem.concept)).filter(
        PayrollItem.payroll_id == payroll.id,
        PayrollItem.source_key.like(f"{prefix}%"),
    ).all()
    for item in existing:
        if item.concept and item.concept.concept_type != "DEVENGO":
            db.delete(item)
    db.flush()

    for line in build_concept_lines_from_payroll(payroll):
        if line.get("concept_type") == "DEVENGO":
            continue
        concept = ensure_engine_concept(db, line)
        code = str(line["code"]).upper()[:120]
        amount = money(line.get("amount"))
        db.add(PayrollItem(
            payroll_id=payroll.id,
            concept_id=concept.id,
            description=line.get("description") or line.get("name"),
            quantity=money(line.get("quantity") or Decimal("1.00")),
            unit_price=money(line.get("unit_price") if line.get("unit_price") is not None else amount),
            amount=amount,
            display_order=int(line.get("display_order") or concept.display_order or 0),
            notes=line.get("formula"),
            source_type=str(line.get("source_type") or "SYSTEM").lower(),
            source_key=f"{prefix}{code}",
            is_automatic=True,
            calculation_trace=json_safe(line.get("trace") or {}),
        ))
    db.flush()


def finalize_preparation(db: Session, payroll: Payroll) -> Payroll:
    if payroll.status != "draft":
        return payroll

    items = _editable_items(db, payroll.id)
    preview = calculate_preparation_preview(db, payroll)
    calculated = preview["calculated"]

    payroll.base_salary = _sum_by_code(items, "SALARIO_BASE")
    payroll.worked_base_salary = payroll.base_salary
    payroll.salary_supplements = _sum_categories(items, {"COMPLEMENTO", "PLUS"})
    payroll.seniority_amount = _sum_by_code(items, "ANTIGUEDAD")
    payroll.variable_incentives = _sum_by_code(items, "INCENTIVOS_VARIABLES")
    payroll.extra_pay_proration = _sum_by_code(items, "PRORRATA_PAGAS_EXTRA")
    payroll.temporary_disability_benefit = _sum_by_code(items, "PRESTACION_IT")
    payroll.company_disability_complement = _sum_by_code(items, "COMPLEMENTO_EMPRESA_IT")
    payroll.gross_salary = preview["gross_salary"]
    payroll.common_contingencies_base = preview["contribution_base"]
    payroll.professional_contingencies_base = preview["professional_base"]
    payroll.unemployment_training_fogasa_base = preview["professional_base"]
    payroll.irpf_base = preview["irpf_base"]
    payroll.daily_common_base = money(preview["contribution_base"] / Decimal(str(payroll.contribution_days or 30)))
    payroll.daily_professional_base = money(preview["professional_base"] / Decimal(str(payroll.contribution_days or 30)))
    payroll.employee_common_contingencies = calculated["employee_common_contingencies"]
    payroll.employee_unemployment = calculated["employee_unemployment"]
    payroll.employee_training = calculated["employee_training"]
    payroll.employee_mei = calculated["employee_mei"]
    payroll.employee_social_security = calculated["employee_social_security"]
    payroll.irpf = calculated["irpf"]
    payroll.total_deductions = preview["total_deductions"]
    payroll.net_salary = preview["net_salary"]
    payroll.company_common_contingencies = calculated["company_common_contingencies"]
    payroll.company_unemployment = calculated["company_unemployment"]
    payroll.company_fogasa = calculated["company_fogasa"]
    payroll.company_training = calculated["company_training"]
    payroll.company_at_ep = calculated["company_at_ep"]
    payroll.company_mei = calculated["company_mei"]
    payroll.company_total_social_security = calculated["company_total_social_security"]
    payroll.company_total_cost = calculated["company_total_cost"]
    payroll.status = "calculated"
    payroll.calculation_version = int(payroll.calculation_version or 0) + 1
    payroll.calculation_engine_version = "preparation-v1"
    payroll.calculation_fingerprint = None
    payroll.last_calculated_at = datetime.utcnow()

    try:
        _sync_generated_system_items(db, payroll)
        db.commit()
        db.refresh(payroll)
    except Exception:
        db.rollback()
        raise
    return payroll_crud.get_payroll(db, payroll.id)


def generate_payrolls(db: Session, request: PayrollGenerationRequest) -> dict:
    query = db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
        joinedload(Contract.work_center),
    ).filter(Contract.status == "active")

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
    items = []

    for contract in contracts:
        employee = contract.employee
        base_item = {
            "employee_id": contract.employee_id,
            "employee_name": _employee_name(employee),
            "contract_id": contract.id,
            "contract_code": _contract_code(contract),
            "company_id": contract.company_id,
            "company_name": contract.company.name if contract.company else None,
        }
        if not employee or not employee.is_active:
            skipped_count += 1
            items.append({**base_item, "status": "skipped", "source": "automatic", "message": "Trabajador inactivo"})
            continue

        skip_reason = payroll_crud.get_contract_period_skip_reason(contract, request.period_month, request.period_year)
        if skip_reason:
            skipped_count += 1
            items.append({**base_item, "status": "skipped", "source": "automatic", "message": skip_reason})
            continue

        existing = _find_period_payroll(db, contract.id, request.period_month, request.period_year)
        if existing and existing.status != "draft":
            existing_count += 1
            items.append({
                **base_item,
                "payroll_id": existing.id,
                "status": existing.status,
                "source": "existing",
                "message": "La nómina ya estaba generada",
            })
            continue

        source = "prepared" if existing and existing.status == "draft" else "automatic"
        if existing is None:
            preparation = ensure_preparation(
                db,
                PayrollPreparationEnsureRequest(
                    employee_id=contract.employee_id,
                    contract_id=contract.id,
                    period_month=request.period_month,
                    period_year=request.period_year,
                ),
            )
            existing = payroll_crud.get_payroll(db, preparation["payroll_id"])

        generated = finalize_preparation(db, existing)
        generated_count += 1
        items.append({
            **base_item,
            "payroll_id": generated.id,
            "status": generated.status,
            "source": source,
            "message": None,
        })

    return {
        "period_month": request.period_month,
        "period_year": request.period_year,
        "generated_count": generated_count,
        "existing_count": existing_count,
        "skipped_count": skipped_count,
        "items": items,
    }
