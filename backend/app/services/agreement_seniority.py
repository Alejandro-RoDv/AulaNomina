from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.agreement_seniority import AgreementSeniorityRule
from app.models.contract import Contract
from app.services.contract_salary_summary import get_partiality


MONEY = Decimal("0.01")
RATIO = Decimal("0.0001")


def as_money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def as_ratio(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(RATIO, rounding=ROUND_HALF_UP)


def safe_anniversary(source: date, years: int) -> date:
    try:
        return source.replace(year=source.year + years)
    except ValueError:
        return source.replace(year=source.year + years, month=2, day=28)


def seniority_date_for_contract(contract: Contract) -> tuple[date, str]:
    if contract.recognized_seniority_date:
        return contract.recognized_seniority_date, "recognized_seniority_date"
    if contract.seniority_date:
        return contract.seniority_date, "seniority_date"
    return contract.start_date, "contract_start_date"


def completed_years(start: date, as_of: date) -> int:
    if as_of < start:
        return 0
    years = as_of.year - start.year
    anniversary = safe_anniversary(start, years)
    if anniversary > as_of:
        years -= 1
    return max(0, years)


def contract_salary_table_id(contract: Contract) -> int | None:
    if contract.salary_table_row:
        return contract.salary_table_row.salary_table_id
    return None


def load_applicable_seniority_rule(db: Session, contract: Contract, as_of: date) -> AgreementSeniorityRule | None:
    table_id = contract_salary_table_id(contract)
    rules = (
        db.query(AgreementSeniorityRule)
        .options(
            joinedload(AgreementSeniorityRule.salary_table),
            joinedload(AgreementSeniorityRule.professional_category),
        )
        .filter(
            AgreementSeniorityRule.collective_agreement_id == contract.collective_agreement_id,
            AgreementSeniorityRule.is_active == True,
            or_(AgreementSeniorityRule.effective_from.is_(None), AgreementSeniorityRule.effective_from <= as_of),
            or_(AgreementSeniorityRule.effective_to.is_(None), AgreementSeniorityRule.effective_to >= as_of),
            or_(AgreementSeniorityRule.salary_table_id.is_(None), AgreementSeniorityRule.salary_table_id == table_id),
            or_(
                AgreementSeniorityRule.professional_category_id.is_(None),
                AgreementSeniorityRule.professional_category_id == contract.professional_category_id,
            ),
        )
        .all()
    )
    if not rules:
        return None

    def priority(rule: AgreementSeniorityRule):
        return (
            1 if rule.salary_table_id == table_id and table_id is not None else 0,
            1 if rule.professional_category_id == contract.professional_category_id and contract.professional_category_id is not None else 0,
            rule.display_order or 0,
            rule.id,
        )

    return sorted(rules, key=priority, reverse=True)[0]


def amount_per_module(contract: Contract, rule: AgreementSeniorityRule) -> tuple[Decimal, str]:
    mode = rule.calculation_mode
    if mode == "fixed_amount":
        amount = as_money(rule.fixed_amount)
        source = "fixed_amount"
    elif mode == "percentage":
        base = as_money(contract.salary_base)
        amount = as_money(base * Decimal(str(rule.percentage or 0)) / Decimal("100"))
        source = "contract_salary_base"
    else:
        row_amount = contract.salary_table_row.seniority_amount if contract.salary_table_row else None
        amount = as_money(row_amount)
        source = "salary_table_row"

    if rule.applies_partiality:
        partiality = as_ratio(get_partiality(contract) / Decimal("100"))
        amount = as_money(amount * partiality)
    return amount, source


def maturity_dates(start: date, module_years: int, max_modules: int | None, as_of: date) -> list[date]:
    result = []
    module_number = 1
    while True:
        if max_modules is not None and module_number > max_modules:
            break
        maturity = safe_anniversary(start, module_number * module_years)
        if maturity > as_of:
            break
        result.append(maturity)
        module_number += 1
    return result


def next_maturity(start: date, module_years: int, completed_modules: int, max_modules: int | None) -> date | None:
    next_number = completed_modules + 1
    if max_modules is not None and next_number > max_modules:
        return None
    return safe_anniversary(start, next_number * module_years)


def build_contract_seniority_preview(db: Session, contract: Contract, as_of: date) -> dict:
    seniority_date, source = seniority_date_for_contract(contract)
    warnings = []
    if source == "contract_start_date":
        warnings.append("No hay fecha de antigüedad específica; se utiliza la fecha de inicio del contrato.")

    if not contract.collective_agreement_id:
        return {
            "contract_id": contract.id,
            "employee_id": contract.employee_id,
            "employee_code": contract.employee.employee_code if contract.employee else None,
            "employee_name": contract.employee_name,
            "contract_code": contract.contract_code,
            "seniority_date": seniority_date,
            "seniority_date_source": source,
            "as_of_date": as_of,
            "eligibility": "blocked",
            "reason": "El contrato no tiene convenio vinculado.",
            "warnings": warnings,
        }

    rule = load_applicable_seniority_rule(db, contract, as_of)
    if not rule:
        return {
            "contract_id": contract.id,
            "employee_id": contract.employee_id,
            "employee_code": contract.employee.employee_code if contract.employee else None,
            "employee_name": contract.employee_name,
            "contract_code": contract.contract_code,
            "seniority_date": seniority_date,
            "seniority_date_source": source,
            "as_of_date": as_of,
            "eligibility": "blocked",
            "reason": "No existe una regla de antigüedad aplicable.",
            "warnings": warnings,
        }

    years = completed_years(seniority_date, as_of)
    modules = years // rule.module_years
    capped = False
    if rule.max_modules is not None and modules > rule.max_modules:
        modules = rule.max_modules
        capped = True

    per_module, amount_source = amount_per_module(contract, rule)
    monthly_amount = as_money(per_module * modules)
    dates = maturity_dates(seniority_date, rule.module_years, rule.max_modules, as_of)
    maturities = [
        {
            "module_number": index,
            "maturity_date": maturity,
            "amount": per_module,
            "status": "recognized",
        }
        for index, maturity in enumerate(dates, start=1)
    ]
    next_date = next_maturity(seniority_date, rule.module_years, modules, rule.max_modules)
    warnings.append(f"Importe por módulo resuelto desde {amount_source}.")

    return {
        "contract_id": contract.id,
        "employee_id": contract.employee_id,
        "employee_code": contract.employee.employee_code if contract.employee else None,
        "employee_name": contract.employee_name,
        "contract_code": contract.contract_code,
        "seniority_date": seniority_date,
        "seniority_date_source": source,
        "as_of_date": as_of,
        "rule_id": rule.id,
        "rule_name": rule.name,
        "module_years": rule.module_years,
        "completed_modules": modules,
        "max_modules": rule.max_modules,
        "amount_per_module": per_module,
        "monthly_amount": monthly_amount,
        "next_maturity_date": next_date,
        "capped": capped,
        "eligibility": "eligible",
        "reason": None,
        "maturities": maturities,
        "warnings": warnings,
    }


def calculate_monthly_seniority(db: Session, contract: Contract, period_month: int, period_year: int, contribution_days: int = 30) -> dict:
    if period_month < 1 or period_month > 12:
        return {"amount": Decimal("0.00"), "rule": None, "lines": [], "warnings": []}

    last_day = monthrange(period_year, period_month)[1]
    period_start = date(period_year, period_month, 1)
    period_end = date(period_year, period_month, last_day)
    preview = build_contract_seniority_preview(db, contract, period_end)
    if preview["eligibility"] != "eligible":
        return {"amount": Decimal("0.00"), "rule": None, "lines": [], "warnings": preview.get("warnings", []) + [preview.get("reason")]}

    rule = db.query(AgreementSeniorityRule).filter(AgreementSeniorityRule.id == preview["rule_id"]).first()
    seniority_date, _ = seniority_date_for_contract(contract)
    per_module = as_money(preview["amount_per_module"])
    modules_before = completed_years(seniority_date, period_start.replace(day=1)) // rule.module_years
    if safe_anniversary(seniority_date, modules_before * rule.module_years) == period_start and modules_before > 0:
        pass
    elif period_start > seniority_date:
        day_before = period_start.fromordinal(period_start.toordinal() - 1)
        modules_before = completed_years(seniority_date, day_before) // rule.module_years
    else:
        modules_before = 0
    if rule.max_modules is not None:
        modules_before = min(modules_before, rule.max_modules)

    full_amount = as_money(per_module * modules_before)
    lines = []
    if full_amount > 0:
        lines.append({
            "rule_id": rule.id,
            "concept_name": rule.name,
            "module_number": modules_before,
            "maturity_date": None,
            "amount": full_amount,
            "detail": f"{modules_before} módulos consolidados",
        })

    modules_end = preview["completed_modules"]
    for module_number in range(modules_before + 1, modules_end + 1):
        maturity = safe_anniversary(seniority_date, module_number * rule.module_years)
        if maturity < period_start or maturity > period_end:
            continue
        if rule.daily_proration_on_maturity:
            eligible_days = period_end.day - maturity.day + 1
            ratio = as_ratio(Decimal(eligible_days) / Decimal(last_day))
            amount = as_money(per_module * ratio)
        else:
            eligible_days = last_day
            amount = per_module
        lines.append({
            "rule_id": rule.id,
            "concept_name": rule.name,
            "module_number": module_number,
            "maturity_date": maturity,
            "amount": amount,
            "detail": f"Vencimiento módulo {module_number}: {eligible_days}/{last_day} días",
        })
        full_amount += amount

    remuneration_ratio = as_ratio(Decimal(max(0, min(30, contribution_days))) / Decimal("30"))
    final_amount = as_money(full_amount * remuneration_ratio)
    if full_amount > 0 and remuneration_ratio != Decimal("1.0000"):
        lines.append({
            "rule_id": rule.id,
            "concept_name": rule.name,
            "module_number": modules_end,
            "maturity_date": None,
            "amount": as_money(final_amount - full_amount),
            "detail": f"Ajuste por días cotizados: {contribution_days}/30",
        })

    return {
        "amount": final_amount,
        "rule": rule,
        "lines": lines,
        "warnings": preview.get("warnings", []),
        "completed_modules": modules_end,
        "next_maturity_date": preview.get("next_maturity_date"),
    }


def get_contract_or_404(db: Session, contract_id: int) -> Contract:
    contract = (
        db.query(Contract)
        .options(
            joinedload(Contract.employee),
            joinedload(Contract.salary_table_row),
            joinedload(Contract.agreement_professional_category),
        )
        .filter(Contract.id == contract_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return contract
