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
from app.services.payroll_core_concepts import ensure_core_payroll_concepts

GENERATED_STATUSES = {"pending", "calculated", "reviewed", "closed"}
PREPARATION_OVERRIDE_MARKER = "[PREPARATION_OVERRIDE]"
SYSTEM_DEDUCTION_CODES = {
    "SS_CONTINGENCIAS_COMUNES",
    "SS_DESEMPLEO",
    "SS_FORMACION",
    "SS_MEI",
    "IRPF",
}
SYSTEM_BASE_CODES = {
    "BASE_CC",
    "BASE_CP",
    "BASE_DESEMPLEO_FORMACION_FOGASA",
    "BASE_IRPF",
}
COMPANY_COST_CODES = {
    "COSTE_EMPRESA_CC",
    "COSTE_EMPRESA_DESEMPLEO",
    "COSTE_EMPRESA_FOGASA",
    "COSTE_EMPRESA_FORMACION",
    "COSTE_EMPRESA_AT_EP",
    "COSTE_EMPRESA_MEI",
    "COSTE_EMPRESA_TOTAL",
}


def _employee_name(employee: Employee | None) -> str:
    if not employee:
        return ""
    parts = [employee.first_name, employee.last_name, getattr(employee, "second_last_name", None)]
    return " ".join(str(part).strip() for part in parts if part and str(part).strip())


def _contract_code(contract: Contract | None) -> str | None:
    if not contract:
        return None
    return payroll_crud.build_contract_code(contract)


def _preparation_items(db: Session, payroll_id: int) -> list[PayrollItem]:
    """Every line visible in the payroll preparation workspace.

    Preparation is intentionally wider than the old editable-item subset: earnings,
    deductions, contribution bases and company-cost lines all belong to the same
    workspace so the student can understand and, when needed, override them.
    """
    return get_payroll_items(db, payroll_id)


def _is_manual_override(item: PayrollItem) -> bool:
    source = str(item.source_type or "").lower()
    notes = str(item.notes or "")
    return source in {"manual", "custom"} or PREPARATION_OVERRIDE_MARKER in notes


def _items_for_code(items: list[PayrollItem], code: str) -> list[PayrollItem]:
    return [
        item
        for item in items
        if item.concept and str(item.concept.code or "").upper() == code
    ]


def _resolved_code_amount(items: list[PayrollItem], code: str, fallback: Decimal) -> Decimal:
    matches = _items_for_code(items, code)
    overrides = [item for item in matches if _is_manual_override(item)]
    if overrides:
        return money(sum((money(item.amount) for item in overrides), Decimal("0.00")))
    return money(fallback)


def _line_payload(item: PayrollItem, effective_amounts: dict[str, Decimal] | None = None) -> dict:
    concept = item.concept
    code = str(concept.code if concept else f"ITEM_{item.id}").upper()
    quantity = money(item.quantity or Decimal("1.00"))
    amount = money(item.amount)
    if effective_amounts and code in effective_amounts:
        amount = money(effective_amounts[code])
    if effective_amounts and code in effective_amounts and quantity != Decimal("0.00"):
        unit_price = money(amount / quantity)
    else:
        unit_price = money(item.unit_price)
    return {
        "id": item.id,
        "concept_id": item.concept_id,
        "code": code,
        "name": concept.name if concept else item.description or "Concepto",
        "description": item.description,
        "amount": amount,
        "quantity": quantity,
        "unit_price": unit_price,
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


def calculate_preparation_preview(db: Session, payroll: Payroll) -> dict:
    """Calculate a non-persistent preview from the preparation matrix.

    Automatic SS/IRPF/base/cost rows are recalculated while the draft changes. If a
    user edits one of those automatic rows, the PREPARATION_OVERRIDE marker makes the
    explicit amount authoritative for that payroll only.
    """
    items = _preparation_items(db, payroll.id)
    generated = payroll.status in GENERATED_STATUSES

    gross_from_lines = Decimal("0.00")
    derived_common_base = Decimal("0.00")
    derived_professional_base = Decimal("0.00")
    derived_irpf_base = Decimal("0.00")
    other_deductions = Decimal("0.00")

    for item in items:
        concept = item.concept
        if not concept:
            continue
        code = str(concept.code or "").upper()
        amount = money(item.amount)
        concept_type = str(concept.concept_type or "DEVENGO").upper()

        if concept_type == "DEVENGO":
            if concept.affects_gross:
                gross_from_lines += amount
            if concept.is_contribution_base:
                derived_professional_base += amount
                if concept.category != "HORAS_EXTRA":
                    derived_common_base += amount
            if concept.is_taxable:
                derived_irpf_base += amount
        elif concept_type == "DEDUCCION" and concept.affects_net and code not in SYSTEM_DEDUCTION_CODES:
            other_deductions += amount

    if generated:
        gross_salary = money(payroll.gross_salary or gross_from_lines)
        common_default = money(payroll.common_contingencies_base or derived_common_base)
        professional_default = money(payroll.professional_contingencies_base or derived_professional_base)
        unemployment_default = money(payroll.unemployment_training_fogasa_base or professional_default)
        irpf_base_default = money(payroll.irpf_base or derived_irpf_base)
    else:
        gross_salary = money(gross_from_lines)
        common_default = money(derived_common_base)
        professional_default = money(derived_professional_base)
        unemployment_default = money(derived_professional_base)
        irpf_base_default = money(derived_irpf_base)

    common_base = _resolved_code_amount(items, "BASE_CC", common_default)
    professional_base = _resolved_code_amount(items, "BASE_CP", professional_default)
    unemployment_base = _resolved_code_amount(items, "BASE_DESEMPLEO_FORMACION_FOGASA", unemployment_default)
    irpf_base = _resolved_code_amount(items, "BASE_IRPF", irpf_base_default)

    calculated = calculate_social_security_amounts_from_bases(
        gross_salary=gross_salary,
        common_contingencies_base=common_base,
        professional_contingencies_base=professional_base,
        unemployment_training_fogasa_base=unemployment_base,
        irpf_base=irpf_base,
        irpf_percentage=money(payroll.irpf_percentage),
    )

    employee_common = _resolved_code_amount(
        items,
        "SS_CONTINGENCIAS_COMUNES",
        money(payroll.employee_common_contingencies) if generated else calculated["employee_common_contingencies"],
    )
    employee_unemployment = _resolved_code_amount(
        items,
        "SS_DESEMPLEO",
        money(payroll.employee_unemployment) if generated else calculated["employee_unemployment"],
    )
    employee_training = _resolved_code_amount(
        items,
        "SS_FORMACION",
        money(payroll.employee_training) if generated else calculated["employee_training"],
    )
    employee_mei = _resolved_code_amount(
        items,
        "SS_MEI",
        money(payroll.employee_mei) if generated else calculated["employee_mei"],
    )
    irpf = _resolved_code_amount(
        items,
        "IRPF",
        money(payroll.irpf) if generated else calculated["irpf"],
    )
    employee_social_security = money(employee_common + employee_unemployment + employee_training + employee_mei)

    if generated:
        total_deductions = money(payroll.total_deductions)
        net_salary = money(payroll.net_salary)
    else:
        total_deductions = money(employee_social_security + irpf + other_deductions)
        net_salary = money(gross_salary - total_deductions)

    company_common = _resolved_code_amount(
        items,
        "COSTE_EMPRESA_CC",
        money(payroll.company_common_contingencies) if generated else calculated["company_common_contingencies"],
    )
    company_unemployment = _resolved_code_amount(
        items,
        "COSTE_EMPRESA_DESEMPLEO",
        money(payroll.company_unemployment) if generated else calculated["company_unemployment"],
    )
    company_fogasa = _resolved_code_amount(
        items,
        "COSTE_EMPRESA_FOGASA",
        money(payroll.company_fogasa) if generated else calculated["company_fogasa"],
    )
    company_training = _resolved_code_amount(
        items,
        "COSTE_EMPRESA_FORMACION",
        money(payroll.company_training) if generated else calculated["company_training"],
    )
    company_at_ep = _resolved_code_amount(
        items,
        "COSTE_EMPRESA_AT_EP",
        money(payroll.company_at_ep) if generated else calculated["company_at_ep"],
    )
    company_mei = _resolved_code_amount(
        items,
        "COSTE_EMPRESA_MEI",
        money(payroll.company_mei) if generated else calculated["company_mei"],
    )
    company_total_social_security = money(
        company_common + company_unemployment + company_fogasa + company_training + company_at_ep + company_mei
    )
    company_total_cost = _resolved_code_amount(
        items,
        "COSTE_EMPRESA_TOTAL",
        money(payroll.company_total_cost) if generated else money(gross_salary + company_total_social_security),
    )

    effective_amounts = {
        "BASE_CC": common_base,
        "BASE_CP": professional_base,
        "BASE_DESEMPLEO_FORMACION_FOGASA": unemployment_base,
        "BASE_IRPF": irpf_base,
        "SS_CONTINGENCIAS_COMUNES": employee_common,
        "SS_DESEMPLEO": employee_unemployment,
        "SS_FORMACION": employee_training,
        "SS_MEI": employee_mei,
        "IRPF": irpf,
        "COSTE_EMPRESA_CC": company_common,
        "COSTE_EMPRESA_DESEMPLEO": company_unemployment,
        "COSTE_EMPRESA_FOGASA": company_fogasa,
        "COSTE_EMPRESA_FORMACION": company_training,
        "COSTE_EMPRESA_AT_EP": company_at_ep,
        "COSTE_EMPRESA_MEI": company_mei,
        "COSTE_EMPRESA_TOTAL": company_total_cost,
    }

    return {
        "payroll_id": payroll.id,
        "gross_salary": gross_salary,
        "contribution_base": common_base,
        "professional_base": professional_base,
        "unemployment_base": unemployment_base,
        "irpf_base": irpf_base,
        "employee_common_contingencies": employee_common,
        "employee_unemployment": employee_unemployment,
        "employee_training": employee_training,
        "employee_mei": employee_mei,
        "employee_social_security": employee_social_security,
        "irpf": irpf,
        "manual_deductions": money(other_deductions),
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "company_common_contingencies": company_common,
        "company_unemployment": company_unemployment,
        "company_fogasa": company_fogasa,
        "company_training": company_training,
        "company_at_ep": company_at_ep,
        "company_mei": company_mei,
        "company_total_social_security": company_total_social_security,
        "company_total_cost": company_total_cost,
        "effective_amounts": effective_amounts,
        "calculated": calculated,
    }


def build_preparation_response(db: Session, payroll: Payroll) -> dict:
    payroll = payroll_crud.get_payroll(db, payroll.id) or payroll
    preview = calculate_preparation_preview(db, payroll)
    employee = payroll.employee
    contract = payroll.contract
    company = payroll.company
    center = payroll.work_center
    public_preview = {
        key: value
        for key, value in preview.items()
        if key not in {"calculated", "effective_amounts"}
    }
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
        "lines": [
            _line_payload(item, preview["effective_amounts"])
            for item in _preparation_items(db, payroll.id)
        ],
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
    ensure_core_payroll_concepts(db)
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

    items = _preparation_items(db, payroll.id)
    preview = calculate_preparation_preview(db, payroll)

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
    payroll.unemployment_training_fogasa_base = preview["unemployment_base"]
    payroll.irpf_base = preview["irpf_base"]
    days = Decimal(str(payroll.contribution_days or 30))
    payroll.daily_common_base = money(preview["contribution_base"] / days) if days else Decimal("0.00")
    payroll.daily_professional_base = money(preview["professional_base"] / days) if days else Decimal("0.00")
    payroll.employee_common_contingencies = preview["employee_common_contingencies"]
    payroll.employee_unemployment = preview["employee_unemployment"]
    payroll.employee_training = preview["employee_training"]
    payroll.employee_mei = preview["employee_mei"]
    payroll.employee_social_security = preview["employee_social_security"]
    payroll.irpf = preview["irpf"]
    payroll.total_deductions = preview["total_deductions"]
    payroll.net_salary = preview["net_salary"]
    payroll.company_common_contingencies = preview["company_common_contingencies"]
    payroll.company_unemployment = preview["company_unemployment"]
    payroll.company_fogasa = preview["company_fogasa"]
    payroll.company_training = preview["company_training"]
    payroll.company_at_ep = preview["company_at_ep"]
    payroll.company_mei = preview["company_mei"]
    payroll.company_total_social_security = preview["company_total_social_security"]
    payroll.company_total_cost = preview["company_total_cost"]
    payroll.status = "calculated"
    payroll.calculation_version = int(payroll.calculation_version or 0) + 1
    payroll.calculation_engine_version = "preparation-v2"
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
