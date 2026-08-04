from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.model111 import ProfessionalInvoice, TaxWithholdingAdjustment
from app.models.model190 import Model190RecipientOverride
from app.models.payroll import Payroll


CENT = Decimal("0.01")
FINAL_PAYROLL_STATUSES = {"reviewed", "closed"}
INCLUDED_INVOICE_STATUSES = {"paid"}
INCLUDED_ADJUSTMENT_STATUSES = {"confirmed"}
SPECIAL_PAYROLL_MONTHS = {13: 7, 14: 12, 15: 12}


class Model190DomainError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 400,
        context: dict | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.context = context or {}


def money(value: Any) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def normalize_nif(value: str | None) -> str:
    return (value or "").strip().upper()


def effective_payroll_month(period_month: int) -> int:
    return SPECIAL_PAYROLL_MONTHS.get(period_month, period_month)


def quarter_for_month(month: int) -> str:
    if month < 1 or month > 12:
        raise ValueError("El mes debe estar entre 1 y 12")
    return f"{((month - 1) // 3) + 1}T"


def quarter_for_date(value: date) -> str:
    return quarter_for_month(value.month)


def payroll_source_date(year: int, period_month: int) -> date:
    month = effective_payroll_month(period_month)
    return date(year, month, monthrange(year, month)[1])


def employee_social_security(payroll: Payroll) -> Decimal:
    recorded_total = money(payroll.employee_social_security)
    if recorded_total != Decimal("0.00"):
        return recorded_total
    return money(
        money(payroll.employee_common_contingencies)
        + money(payroll.employee_unemployment)
        + money(payroll.employee_training)
        + money(payroll.employee_mei)
    )


def employee_surname(employee) -> str | None:
    parts = [employee.last_name, employee.second_last_name]
    value = " ".join(part.strip() for part in parts if part and part.strip())
    return value or None


def employee_province_code(employee) -> str | None:
    value = (employee.province or "").strip()
    return value.zfill(2) if value.isdigit() and len(value) <= 2 else None


def professional_subkey(withholding_rate) -> str:
    return "03" if money(withholding_rate) == Decimal("7.00") else "01"


def recipient_group_key(line: dict) -> tuple[str, str, str | None, int]:
    return (
        normalize_nif(line.get("nif")),
        str(line.get("key") or "").strip().upper(),
        line.get("subkey") or None,
        int(line["accrual_year"]),
    )


def _empty_recipient(line: dict) -> dict:
    return {
        "recipient_key": "|".join(
            [
                normalize_nif(line.get("nif")),
                str(line.get("key") or "").strip().upper(),
                line.get("subkey") or "-",
                str(line["accrual_year"]),
            ]
        ),
        "recipient_type": line["recipient_type"],
        "employee_id": line.get("employee_id"),
        "professional_id": line.get("professional_id"),
        "nif": normalize_nif(line.get("nif")),
        "name": line.get("name") or "",
        "surname": line.get("surname"),
        "key": str(line.get("key") or "").strip().upper(),
        "subkey": line.get("subkey") or None,
        "accrual_year": int(line["accrual_year"]),
        "province_code": line.get("province_code"),
        "cash_income": Decimal("0.00"),
        "cash_withholding": Decimal("0.00"),
        "in_kind_income": Decimal("0.00"),
        "in_kind_payment_on_account": Decimal("0.00"),
        "in_kind_payment_repercuted": Decimal("0.00"),
        "deductible_expenses": Decimal("0.00"),
        "reductions": Decimal("0.00"),
        "classification_source": line.get("classification_source") or "automatic",
        "classification_confirmed": bool(line.get("classification_confirmed")),
        "lines": [],
    }


def aggregate_recipient_lines(lines: list[dict]) -> list[dict]:
    groups: dict[tuple[str, str, str | None, int], dict] = {}

    for source_line in lines:
        line = dict(source_line)
        key = recipient_group_key(line)
        group = groups.setdefault(key, _empty_recipient(line))

        group["employee_id"] = group.get("employee_id") or line.get("employee_id")
        group["professional_id"] = group.get("professional_id") or line.get("professional_id")
        group["name"] = group.get("name") or line.get("name") or ""
        group["surname"] = group.get("surname") or line.get("surname")
        group["province_code"] = group.get("province_code") or line.get("province_code")
        if line.get("classification_source") == "override":
            group["classification_source"] = "override"
        group["classification_confirmed"] = bool(
            group["classification_confirmed"] or line.get("classification_confirmed")
        )

        amount_type = line.get("amount_type") or "cash"
        gross = money(line.get("gross_amount"))
        withholding = money(line.get("withholding_amount"))
        deductible = money(line.get("deductible_expense_amount"))

        if amount_type == "in_kind":
            group["in_kind_income"] += gross
            group["in_kind_payment_on_account"] += withholding
            group["in_kind_payment_repercuted"] += money(
                line.get("in_kind_payment_repercuted")
            )
        elif amount_type == "reduction":
            group["reductions"] += gross
        else:
            group["cash_income"] += gross
            group["cash_withholding"] += withholding

        group["deductible_expenses"] += deductible
        group["lines"].append(line)

    recipients = []
    for group in groups.values():
        for amount_field in (
            "cash_income",
            "cash_withholding",
            "in_kind_income",
            "in_kind_payment_on_account",
            "in_kind_payment_repercuted",
            "deductible_expenses",
            "reductions",
        ):
            group[amount_field] = money(group[amount_field])
        group["source_count"] = len(group["lines"])
        group["lines"].sort(
            key=lambda item: (
                item.get("source_date") or date.min,
                item.get("source_type") or "",
                item.get("source_id") or 0,
            )
        )
        recipients.append(group)

    return sorted(
        recipients,
        key=lambda item: (
            item["nif"],
            item["key"],
            item["subkey"] or "",
            item["accrual_year"],
        ),
    )


def summarize_recipients(recipients: list[dict]) -> dict:
    return {
        "total_recipients": len(recipients),
        "unique_nifs": len({item["nif"] for item in recipients if item["nif"]}),
        "total_cash_income": money(
            sum((money(item["cash_income"]) for item in recipients), Decimal("0.00"))
        ),
        "total_in_kind_income": money(
            sum((money(item["in_kind_income"]) for item in recipients), Decimal("0.00"))
        ),
        "total_withholding": money(
            sum(
                (
                    money(item["cash_withholding"])
                    + money(item["in_kind_payment_on_account"])
                    for item in recipients
                ),
                Decimal("0.00"),
            )
        ),
        "total_deductible_expenses": money(
            sum(
                (money(item["deductible_expenses"]) for item in recipients),
                Decimal("0.00"),
            )
        ),
        "total_reductions": money(
            sum((money(item["reductions"]) for item in recipients), Decimal("0.00"))
        ),
    }


def summarize_sources(lines: list[dict]) -> list[dict]:
    groups: dict[str, dict] = {}
    for line in lines:
        source_type = line.get("source_type") or "other"
        group = groups.setdefault(
            source_type,
            {
                "source_type": source_type,
                "documents": 0,
                "gross_amount": Decimal("0.00"),
                "withholding_amount": Decimal("0.00"),
                "deductible_expense_amount": Decimal("0.00"),
            },
        )
        group["documents"] += 1
        group["gross_amount"] += money(line.get("gross_amount"))
        group["withholding_amount"] += money(line.get("withholding_amount"))
        group["deductible_expense_amount"] += money(
            line.get("deductible_expense_amount")
        )

    result = []
    for group in groups.values():
        for field in (
            "gross_amount",
            "withholding_amount",
            "deductible_expense_amount",
        ):
            group[field] = money(group[field])
        result.append(group)
    return sorted(result, key=lambda item: item["source_type"])


def _override_map(
    db: Session,
    company_id: int,
    year: int,
) -> dict[tuple[str, int], Model190RecipientOverride]:
    items = (
        db.query(Model190RecipientOverride)
        .filter(
            Model190RecipientOverride.company_id == company_id,
            Model190RecipientOverride.year == year,
        )
        .all()
    )
    return {(item.recipient_type, item.recipient_id): item for item in items}


def _apply_override(
    defaults: dict,
    override: Model190RecipientOverride | None,
) -> dict:
    result = dict(defaults)
    if override is None:
        result["classification_source"] = "automatic"
        result["classification_confirmed"] = False
        return result

    for field in ("key", "subkey", "accrual_year", "province_code"):
        value = getattr(override, field)
        if value is not None:
            result[field] = value
    result["classification_source"] = "override"
    result["classification_confirmed"] = bool(override.confirmed)
    return result


def _payroll_lines(
    db: Session,
    company_id: int,
    year: int,
    overrides: dict[tuple[str, int], Model190RecipientOverride],
) -> list[dict]:
    payrolls = (
        db.query(Payroll)
        .options(joinedload(Payroll.employee))
        .filter(
            Payroll.company_id == company_id,
            Payroll.period_year == year,
            Payroll.status.in_(FINAL_PAYROLL_STATUSES),
        )
        .order_by(Payroll.period_month, Payroll.id)
        .all()
    )

    lines = []
    for payroll in payrolls:
        employee = payroll.employee
        if employee is None:
            continue
        month = effective_payroll_month(payroll.period_month)
        classification = _apply_override(
            {
                "key": "A",
                "subkey": None,
                "accrual_year": year,
                "province_code": employee_province_code(employee),
            },
            overrides.get(("employee", employee.id)),
        )
        lines.append(
            {
                "recipient_type": "employee",
                "employee_id": employee.id,
                "professional_id": None,
                "nif": normalize_nif(employee.dni),
                "name": employee.first_name,
                "surname": employee_surname(employee),
                **classification,
                "source_type": "payroll",
                "source_id": payroll.id,
                "source_label": payroll.period_label,
                "source_date": payroll_source_date(year, payroll.period_month),
                "amount_type": "cash",
                "gross_amount": money(payroll.gross_salary),
                "withholding_amount": money(payroll.irpf),
                "deductible_expense_amount": employee_social_security(payroll),
                "quarter": quarter_for_month(month),
                "contract_id": payroll.contract_id,
            }
        )
    return lines


def _professional_invoice_lines(
    db: Session,
    company_id: int,
    year: int,
    overrides: dict[tuple[str, int], Model190RecipientOverride],
) -> list[dict]:
    invoices = (
        db.query(ProfessionalInvoice)
        .options(joinedload(ProfessionalInvoice.professional))
        .filter(
            ProfessionalInvoice.company_id == company_id,
            ProfessionalInvoice.status.in_(INCLUDED_INVOICE_STATUSES),
            ProfessionalInvoice.payment_date >= date(year, 1, 1),
            ProfessionalInvoice.payment_date <= date(year, 12, 31),
        )
        .order_by(ProfessionalInvoice.payment_date, ProfessionalInvoice.id)
        .all()
    )

    lines = []
    for invoice in invoices:
        professional = invoice.professional
        if professional is None or invoice.payment_date is None:
            continue
        classification = _apply_override(
            {
                "key": "G",
                "subkey": professional_subkey(invoice.withholding_rate),
                "accrual_year": year,
                "province_code": professional.province_code,
            },
            overrides.get(("professional", professional.id)),
        )
        lines.append(
            {
                "recipient_type": "professional",
                "employee_id": None,
                "professional_id": professional.id,
                "nif": normalize_nif(professional.nif),
                "name": professional.name,
                "surname": professional.surname,
                **classification,
                "source_type": "professional_invoice",
                "source_id": invoice.id,
                "source_label": f"Factura {invoice.invoice_number}",
                "source_date": invoice.payment_date,
                "amount_type": "cash",
                "gross_amount": money(invoice.tax_base),
                "withholding_amount": money(invoice.withholding_amount),
                "deductible_expense_amount": Decimal("0.00"),
                "quarter": quarter_for_date(invoice.payment_date),
            }
        )
    return lines


def _adjustment_lines(
    db: Session,
    company_id: int,
    year: int,
) -> list[dict]:
    adjustments = (
        db.query(TaxWithholdingAdjustment)
        .filter(
            TaxWithholdingAdjustment.company_id == company_id,
            TaxWithholdingAdjustment.status.in_(INCLUDED_ADJUSTMENT_STATUSES),
            TaxWithholdingAdjustment.source_date >= date(year, 1, 1),
            TaxWithholdingAdjustment.source_date <= date(year, 12, 31),
        )
        .order_by(
            TaxWithholdingAdjustment.source_date,
            TaxWithholdingAdjustment.id,
        )
        .all()
    )

    lines = []
    for adjustment in adjustments:
        is_professional = adjustment.category == "economic_activity"
        key = adjustment.model190_key or ("G" if is_professional else "A")
        subkey = adjustment.model190_subkey
        if subkey is None and key == "G":
            subkey = "01"
        if key == "A":
            subkey = None

        source_type = (
            adjustment.adjustment_type
            if adjustment.adjustment_type in {"arrears", "regularization"}
            else "adjustment"
        )
        lines.append(
            {
                "recipient_type": "professional" if is_professional else "employee",
                "employee_id": None,
                "professional_id": None,
                "nif": normalize_nif(adjustment.recipient_nif),
                "name": adjustment.recipient_name,
                "surname": None,
                "key": key,
                "subkey": subkey,
                "accrual_year": adjustment.accrual_year or year,
                "province_code": None,
                "classification_source": (
                    "adjustment"
                    if adjustment.model190_key or adjustment.model190_subkey
                    else "automatic"
                ),
                "classification_confirmed": bool(
                    adjustment.model190_key or adjustment.model190_subkey
                ),
                "source_type": source_type,
                "source_id": adjustment.id,
                "source_label": (
                    adjustment.notes
                    or f"{adjustment.adjustment_type.replace('_', ' ').title()} "
                    f"{adjustment.source_date.isoformat()}"
                ),
                "source_date": adjustment.source_date,
                "amount_type": "cash",
                "gross_amount": money(adjustment.base_amount),
                "withholding_amount": money(adjustment.withholding_amount),
                "deductible_expense_amount": money(
                    adjustment.deductible_expense_amount
                ),
                "quarter": quarter_for_date(adjustment.source_date),
            }
        )
    return lines


def build_model190_preview(db: Session, company_id: int, year: int) -> dict:
    if year < 2000 or year > 2100:
        raise Model190DomainError("INVALID_YEAR", "El ejercicio indicado no es válido")

    company = db.query(Company).filter(Company.id == company_id).first()
    if company is None:
        raise Model190DomainError(
            "COMPANY_NOT_FOUND",
            "Empresa no encontrada",
            status_code=404,
        )

    overrides = _override_map(db, company_id, year)
    lines = [
        *_payroll_lines(db, company_id, year, overrides),
        *_professional_invoice_lines(db, company_id, year, overrides),
        *_adjustment_lines(db, company_id, year),
    ]
    recipients = aggregate_recipient_lines(lines)
    totals = summarize_recipients(recipients)

    return {
        "company_id": company_id,
        "company_name": company.name,
        "year": year,
        "recipients": recipients,
        "totals": totals,
        "source_summary": summarize_sources(lines),
        "source_count": len(lines),
        "has_operations": bool(lines),
        "capabilities": {
            "cash_income": True,
            "cash_withholding": True,
            "deductible_expenses": True,
            "in_kind_income": False,
            "reductions": False,
            "exempt_income": False,
        },
    }
