from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.agreement_parameterization import AgreementRuleDetail, AgreementRuleHeader
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem


FOUR = Decimal("0.0001")
MONEY = Decimal("0.01")
PERCENT = Decimal("100")


def four(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(FOUR, rounding=ROUND_HALF_UP)


def money(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def contract_is_part_time_or_discontinuous(contract) -> bool:
    coefficient = Decimal(str(getattr(contract, "partiality_coefficient", 100) or 100))
    labels = " ".join(
        str(value or "").lower()
        for value in (
            getattr(contract, "working_day_type", None),
            getattr(contract, "relation_type", None),
            getattr(contract, "relation_subtype", None),
            getattr(contract, "contract_family", None),
            getattr(contract, "contract_code_description", None),
        )
    )
    return coefficient < PERCENT or any(
        marker in labels
        for marker in ("fijo discontinuo", "fixed discontinuous", "tiempo parcial", "part time", "parcial")
    )


def previous_monthly_payrolls(db: Session, contract_id: int, before_date: date, limit: int) -> list[Payroll]:
    return (
        db.query(Payroll)
        .filter(
            Payroll.contract_id == contract_id,
            Payroll.period_month.between(1, 12),
            Payroll.status.in_(["calculated", "reviewed", "closed"]),
            or_(
                Payroll.period_year < before_date.year,
                and_(Payroll.period_year == before_date.year, Payroll.period_month < before_date.month),
            ),
        )
        .order_by(Payroll.period_year.desc(), Payroll.period_month.desc())
        .limit(limit)
        .all()
    )


def overtime_concept_ids(db: Session) -> list[int]:
    return [
        row.id
        for row in db.query(PayrollConcept.id).filter(
            or_(
                PayrollConcept.code == "INC_OVERTIME",
                PayrollConcept.category == "HORAS_EXTRA",
            )
        ).all()
    ]


def overtime_amount_for_payrolls(db: Session, payroll_ids: list[int]) -> Decimal:
    if not payroll_ids:
        return Decimal("0")
    concept_ids = overtime_concept_ids(db)
    if not concept_ids:
        return Decimal("0")
    rows = db.query(PayrollItem.amount).filter(
        PayrollItem.payroll_id.in_(payroll_ids),
        PayrollItem.concept_id.in_(concept_ids),
    ).all()
    return money(sum((Decimal(str(row.amount or 0)) for row in rows), Decimal("0")))


def advanced_regulatory_daily_base(
    db: Session,
    contract,
    incident,
    configuration: dict[str, Any],
    fallback_daily_salary: Decimal,
) -> tuple[Decimal, str, list[str], dict[str, Any]]:
    from app.services.incident_segmenter import incident_process_start

    process_start = incident_process_start(incident)
    professional = configuration.get("regulatory_base") == "professional"
    warnings: list[str] = []
    trace: dict[str, Any] = {
        "professional_contingency": professional,
        "process_start": process_start.isoformat(),
    }

    if contract_is_part_time_or_discontinuous(contract):
        payrolls = previous_monthly_payrolls(db, contract.id, process_start, 3)
        valid = []
        for payroll in payrolls:
            base = payroll.professional_contingencies_base if professional else payroll.common_contingencies_base
            days = Decimal(str(payroll.contribution_days or 0))
            if Decimal(str(base or 0)) > 0 and days > 0:
                valid.append((payroll, Decimal(str(base)), days))
        if valid:
            base_sum = sum((row[1] for row in valid), Decimal("0"))
            day_sum = sum((row[2] for row in valid), Decimal("0"))
            daily = four(base_sum / day_sum)
            trace.update(
                {
                    "method": "part_time_three_month_average",
                    "payroll_ids": [row[0].id for row in valid],
                    "base_sum": str(money(base_sum)),
                    "contribution_days_sum": str(day_sum),
                }
            )
            if len(valid) < 3:
                warnings.append(
                    f"La base reguladora parcial usa {len(valid)} mes(es) disponible(s) de los tres anteriores."
                )
            return daily, "part_time_three_month_average", warnings, trace

    previous = previous_monthly_payrolls(db, contract.id, process_start, 1)
    if previous:
        payroll = previous[0]
        days = Decimal(str(payroll.contribution_days or 0))
        if professional:
            professional_base = Decimal(str(payroll.professional_contingencies_base or 0))
            previous_overtime = overtime_amount_for_payrolls(db, [payroll.id])
            ordinary_component = max(Decimal("0"), professional_base - previous_overtime)
            annual_payrolls = previous_monthly_payrolls(db, contract.id, process_start, 12)
            annual_overtime = overtime_amount_for_payrolls(db, [item.id for item in annual_payrolls])
            if days > 0 and professional_base > 0:
                ordinary_daily = ordinary_component / days
                overtime_daily = annual_overtime / Decimal("365")
                daily = four(ordinary_daily + overtime_daily)
                trace.update(
                    {
                        "method": "professional_previous_month_plus_annual_overtime",
                        "previous_payroll_id": payroll.id,
                        "professional_base": str(money(professional_base)),
                        "previous_month_overtime": str(previous_overtime),
                        "ordinary_daily_component": str(four(ordinary_daily)),
                        "annual_overtime": str(annual_overtime),
                        "annual_overtime_daily_component": str(four(overtime_daily)),
                        "annual_payroll_ids": [item.id for item in annual_payrolls],
                    }
                )
                return daily, "professional_previous_month_plus_annual_overtime", warnings, trace
        else:
            common_base = Decimal(str(payroll.common_contingencies_base or 0))
            if common_base > 0 and days > 0:
                daily = four(common_base / days)
                trace.update(
                    {
                        "method": "previous_month_common_base",
                        "previous_payroll_id": payroll.id,
                        "common_base": str(money(common_base)),
                        "contribution_days": str(days),
                    }
                )
                return daily, "previous_month_common_base", warnings, trace

    warnings.append(
        "No existe una base de cotización anterior suficiente; se usa el salario mensual dividido entre 30."
    )
    trace.update({"method": "salary_fallback", "fallback_daily_salary": str(four(fallback_daily_salary))})
    return four(fallback_daily_salary), "salary_fallback", warnings, trace


def process_type_matches(options: dict[str, Any], process_type: str | None) -> bool:
    configured = options.get("process_types") or options.get("process_type")
    if not configured:
        return True
    if isinstance(configured, str):
        configured = [configured]
    return process_type in configured


def resolve_agreement_it_target(
    db: Session,
    contract,
    incident,
    calculation_date: date,
    process_day: int,
    process_type: str | None,
) -> tuple[Decimal | None, dict[str, Any]]:
    agreement_id = getattr(contract, "collective_agreement_id", None)
    if not agreement_id:
        return None, {}

    headers = (
        db.query(AgreementRuleHeader)
        .filter(
            AgreementRuleHeader.collective_agreement_id == agreement_id,
            AgreementRuleHeader.rule_type.in_(["it_complement", "incapacidad_temporal"]),
            AgreementRuleHeader.is_active.is_(True),
            or_(AgreementRuleHeader.effective_from.is_(None), AgreementRuleHeader.effective_from <= calculation_date),
            or_(AgreementRuleHeader.effective_to.is_(None), AgreementRuleHeader.effective_to >= calculation_date),
        )
        .order_by(AgreementRuleHeader.is_default.desc(), AgreementRuleHeader.effective_from.desc())
        .all()
    )

    category_id = getattr(contract, "professional_category_id", None)
    for header in headers:
        header_options = header.options or {}
        if not process_type_matches(header_options, process_type):
            continue
        details = [detail for detail in header.details if detail.is_active]
        details.sort(key=lambda detail: detail.display_order)
        for detail in details:
            if detail.professional_category_id and detail.professional_category_id != category_id:
                continue
            options = detail.options or {}
            if not process_type_matches(options, process_type):
                continue
            lower = int(detail.minimum_value or 1)
            upper = int(detail.maximum_value) if detail.maximum_value is not None else None
            if process_day < lower or (upper is not None and process_day > upper):
                continue
            raw_target = detail.percentage
            if raw_target is None:
                raw_target = detail.company_percentage
            if raw_target is None:
                raw_target = options.get("target_percentage")
            if raw_target is None:
                continue
            target = Decimal(str(raw_target)) / PERCENT
            return target, {
                "agreement_rule_header_id": header.id,
                "agreement_rule_detail_id": detail.id,
                "agreement_rule_code": header.code,
                "agreement_rule_name": header.name,
                "agreement_target_percentage": str(money(target * PERCENT)),
                "agreement_process_day": process_day,
            }

        raw_default = header_options.get("target_percentage")
        if raw_default is not None:
            target = Decimal(str(raw_default)) / PERCENT
            return target, {
                "agreement_rule_header_id": header.id,
                "agreement_rule_code": header.code,
                "agreement_rule_name": header.name,
                "agreement_target_percentage": str(money(target * PERCENT)),
                "agreement_process_day": process_day,
                "agreement_default": True,
            }
    return None, {}
