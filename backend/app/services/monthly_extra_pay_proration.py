from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.agreement_extra_pay import AgreementExtraPay
from app.models.contract import Contract
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept, PayrollItem
from app.services.agreement_extra_pay import preview_extra_pay
from app.services.contract_salary_summary import get_partiality
from app.services.extra_pay_accrual_days import (
    contract_active_days,
    date_set,
    inactivity_exclusions,
    incident_exclusions,
)


MONTHLY_PERIODS = set(range(1, 13))
MONEY = Decimal("0.01")
RATIO = Decimal("0.0001")
PRORATION_CONCEPT_PREFIX = "PRORRATA_EXTRA_"


def as_money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def as_ratio(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(RATIO, rounding=ROUND_HALF_UP)


def month_is_in_accrual(extra_pay: AgreementExtraPay, period_month: int) -> bool:
    start = int(extra_pay.accrual_start_month)
    end = int(extra_pay.accrual_end_month)
    if start <= end:
        return start <= period_month <= end
    return period_month >= start or period_month <= end


def contract_salary_table_id(contract: Contract) -> int | None:
    return contract.salary_table_row.salary_table_id if contract.salary_table_row else None


def legacy_proration(contract: Contract) -> dict:
    monthly_salary = as_money(contract.salary_base)
    partiality_ratio = as_ratio(get_partiality(contract) / Decimal("100"))
    full_monthly_salary = as_money(monthly_salary * partiality_ratio)
    full_extra_amount = as_money(full_monthly_salary * Decimal("2"))
    amount = as_money(full_extra_amount / Decimal("12"))
    return {
        "total_amount": amount,
        "source": "legacy",
        "lines": [
            {
                "agreement_id": None,
                "extra_pay_id": None,
                "extra_pay_name": "Prorrata histórica",
                "concept_key": "LEGACY",
                "concept_name": "Prorrata pagas extraordinarias",
                "base_source": "legacy_contract_salary",
                "full_pay_amount": full_extra_amount,
                "monthly_base_amount": amount,
                "day_ratio": Decimal("1.0000"),
                "eligible_days": 30,
                "period_days": 30,
                "amount": amount,
            }
        ] if amount > 0 else [],
        "warnings": ["Prorrata calculada con la fórmula histórica por falta de parametrización completa."],
    }


def load_contract_concept_amounts(
    db: Session,
    contract_id: int,
    concept_keys: set[str],
    period_start: date,
    period_end: date,
) -> dict[str, Decimal]:
    if not concept_keys:
        return {}
    lines = (
        db.query(ContractPayrollConcept)
        .options(joinedload(ContractPayrollConcept.concept))
        .join(PayrollConcept, PayrollConcept.id == ContractPayrollConcept.concept_id)
        .filter(
            ContractPayrollConcept.contract_id == contract_id,
            ContractPayrollConcept.is_active == True,
            PayrollConcept.code.in_(concept_keys),
            or_(ContractPayrollConcept.start_date.is_(None), ContractPayrollConcept.start_date <= period_end),
            or_(ContractPayrollConcept.end_date.is_(None), ContractPayrollConcept.end_date >= period_start),
        )
        .order_by(ContractPayrollConcept.id.desc())
        .all()
    )
    result = {}
    for line in lines:
        if line.concept and line.concept.code not in result:
            result[line.concept.code] = as_money(line.amount)
    return result


def load_configured_extra_pays(db: Session, contract: Contract) -> list[AgreementExtraPay]:
    table_id = contract_salary_table_id(contract)
    if not contract.collective_agreement_id or not table_id:
        return []

    pays = (
        db.query(AgreementExtraPay)
        .options(selectinload(AgreementExtraPay.concept_lines))
        .filter(
            AgreementExtraPay.collective_agreement_id == contract.collective_agreement_id,
            AgreementExtraPay.is_active == True,
            AgreementExtraPay.proration_allowed == True,
            or_(
                AgreementExtraPay.salary_table_id.is_(None),
                AgreementExtraPay.salary_table_id == table_id,
            ),
        )
        .order_by(AgreementExtraPay.salary_table_id.asc().nullsfirst(), AgreementExtraPay.id)
        .all()
    )

    selected = {}
    for pay in pays:
        key = (pay.code or pay.name or str(pay.id)).strip().upper()
        current = selected.get(key)
        if current is None or (current.salary_table_id is None and pay.salary_table_id == table_id):
            selected[key] = pay
    return list(selected.values())


def resolve_monthly_extra_pay_proration(
    db: Session,
    contract: Contract,
    period_month: int,
    period_year: int,
) -> dict:
    if period_month not in MONTHLY_PERIODS or (contract.pay_schedule or "not_prorated_14") != "prorated_12":
        return {"total_amount": Decimal("0.00"), "source": "not_applicable", "lines": [], "warnings": []}

    table_id = contract_salary_table_id(contract)
    if not contract.collective_agreement_id or not contract.professional_category_id or not table_id:
        return legacy_proration(contract)

    configured_pays = load_configured_extra_pays(db, contract)
    if not configured_pays:
        return legacy_proration(contract)

    last_day = monthrange(period_year, period_month)[1]
    period_start = date(period_year, period_month, 1)
    period_end = date(period_year, period_month, last_day)
    period_days = date_set(period_start, period_end)
    active_days = contract_active_days(contract, period_start, period_end)

    total = Decimal("0.00")
    result_lines = []
    warnings = []

    for extra_pay in configured_pays:
        if not month_is_in_accrual(extra_pay, period_month):
            continue

        it_days, unpaid_days, incident_breakdown = incident_exclusions(
            db,
            contract,
            active_days,
            period_start,
            period_end,
            extra_pay,
        )
        inactivity_days = inactivity_exclusions(
            contract,
            active_days,
            period_start,
            period_end,
            extra_pay.deduct_inactivity_days,
        )
        excluded_days = it_days | unpaid_days | inactivity_days
        eligible_days = active_days - excluded_days
        day_ratio = as_ratio(
            Decimal(len(eligible_days)) / Decimal(len(period_days)) if period_days else Decimal("0.00")
        )

        preview = preview_extra_pay(
            db,
            extra_pay.id,
            contract.professional_category_id,
            salary_table_id=extra_pay.salary_table_id or table_id,
        )
        warnings.extend(preview.get("warnings") or [])
        concept_keys = {line["concept_key"] for line in preview["lines"]}
        contract_amounts = load_contract_concept_amounts(
            db,
            contract.id,
            concept_keys,
            period_start,
            period_end,
        )
        salary_base_key = f"AGR_{extra_pay.collective_agreement_id}_SALARY_BASE"
        partiality_ratio = (
            as_ratio(get_partiality(contract) / Decimal("100"))
            if extra_pay.apply_partiality
            else Decimal("1.0000")
        )

        for line in preview["lines"]:
            table_base = as_money(line["base_amount"])
            contract_base = table_base
            base_source = "salary_table"

            if line["concept_key"] == salary_base_key and contract.salary_base is not None:
                contract_base = as_money(contract.salary_base)
                base_source = "contract_salary_base"
            elif line["concept_key"] in contract_amounts:
                contract_base = contract_amounts[line["concept_key"]]
                base_source = "contract_permanent_concept"

            if line["calculation_mode"] == "fixed":
                full_pay_amount = as_money(line["fixed_amount"])
                base_source = "fixed_amount"
            else:
                full_pay_amount = as_money(
                    contract_base * Decimal(str(line.get("percentage") or 0)) / Decimal("100")
                )

            after_partiality = as_money(full_pay_amount * partiality_ratio)
            monthly_base = as_money(
                after_partiality / Decimal(extra_pay.accrual_months)
                if extra_pay.accrual_months
                else Decimal("0.00")
            )
            amount = as_money(monthly_base * day_ratio)
            total += amount

            result_lines.append(
                {
                    "agreement_id": extra_pay.collective_agreement_id,
                    "extra_pay_id": extra_pay.id,
                    "extra_pay_name": extra_pay.name,
                    "concept_key": line["concept_key"],
                    "concept_name": line["concept_name"],
                    "base_source": base_source,
                    "full_pay_amount": full_pay_amount,
                    "monthly_base_amount": monthly_base,
                    "day_ratio": day_ratio,
                    "eligible_days": len(eligible_days),
                    "period_days": len(period_days),
                    "amount": amount,
                    "incident_breakdown": incident_breakdown,
                }
            )

    return {
        "total_amount": as_money(total),
        "source": "configured",
        "lines": result_lines,
        "warnings": list(dict.fromkeys(warnings)),
    }


def sync_monthly_proration_items(db: Session, payroll_id: int, lines: list[dict]) -> int:
    existing_items = (
        db.query(PayrollItem)
        .join(PayrollConcept, PayrollConcept.id == PayrollItem.concept_id)
        .filter(
            PayrollItem.payroll_id == payroll_id,
            PayrollConcept.code.like(f"{PRORATION_CONCEPT_PREFIX}%"),
        )
        .all()
    )
    for item in existing_items:
        db.delete(item)
    db.flush()

    created = 0
    for order, line in enumerate(lines, start=35):
        amount = as_money(line.get("amount"))
        if amount <= 0:
            continue
        extra_pay_id = line.get("extra_pay_id") or "LEGACY"
        concept_key = str(line.get("concept_key") or "TOTAL").upper()
        code = f"{PRORATION_CONCEPT_PREFIX}{extra_pay_id}_{concept_key}"[:120]
        concept = db.query(PayrollConcept).filter(PayrollConcept.code == code).first()
        values = {
            "name": f"Prorrata {line.get('extra_pay_name') or 'pagas extra'} - {line.get('concept_name') or 'Concepto'}",
            "category": "PAGA_EXTRA",
            "concept_type": "BASE_INFORMATIVA",
            "salary_nature": "SALARIAL",
            "source_type": "AGREEMENT" if line.get("extra_pay_id") else "SYSTEM",
            "agreement_id": line.get("agreement_id"),
            "calculation_type": "FIXED_AMOUNT",
            "default_amount": Decimal("0.00"),
            "default_unit_price": Decimal("0.00"),
            "applies_workday_percentage": False,
            "is_system": True,
            "is_taxable": False,
            "is_contribution_base": False,
            "is_active": True,
            "display_order": order,
            "notes": "Línea informativa automática de prorrata mensual de paga extraordinaria.",
        }
        if concept is None:
            concept = PayrollConcept(code=code, **values)
            db.add(concept)
            db.flush()
        else:
            for key, value in values.items():
                setattr(concept, key, value)

        db.add(
            PayrollItem(
                payroll_id=payroll_id,
                concept_id=concept.id,
                description=line.get("extra_pay_name") or "Prorrata pagas extra",
                quantity=Decimal("1.00"),
                unit_price=amount,
                amount=amount,
                display_order=order,
                notes=(
                    f"Origen: {line.get('base_source')}; "
                    f"devengo mensual: {line.get('eligible_days')}/{line.get('period_days')} días."
                ),
            )
        )
        created += 1

    db.flush()
    return created
