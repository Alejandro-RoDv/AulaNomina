import json
import secrets
from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.model111 import (
    Model111Declaration,
    Model111Line,
    Professional,
    ProfessionalInvoice,
    TaxWithholdingAdjustment,
)
from app.models.payroll import Payroll
from app.schemas.model111 import (
    Model111GenerateRequest,
    Model111PresentationRequest,
    ProfessionalCreate,
    ProfessionalInvoiceCreate,
    ProfessionalInvoiceUpdate,
    ProfessionalUpdate,
    TaxWithholdingAdjustmentCreate,
)
from app.services.model111_calculator import (
    build_reconciliation,
    money,
    period_bounds,
    period_contains_month,
    summarize_lines,
)


FINAL_PAYROLL_STATUSES = {"reviewed", "closed"}
INCLUDED_INVOICE_STATUSES = {"confirmed", "paid"}
SPECIAL_PAYROLL_MONTHS = {13: 7, 14: 12, 15: 12}
MONTH_LABELS = {
    1: "enero",
    2: "febrero",
    3: "marzo",
    4: "abril",
    5: "mayo",
    6: "junio",
    7: "julio",
    8: "agosto",
    9: "septiembre",
    10: "octubre",
    11: "noviembre",
    12: "diciembre",
}


class Model111DomainError(Exception):
    def __init__(self, code: str, message: str, *, status_code: int = 400, context: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.context = context or {}


def _json_default(value):
    if isinstance(value, Decimal):
        return format(money(value), "f")
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(f"Tipo no serializable: {type(value)!r}")


def _dump_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, default=_json_default, sort_keys=True)


def _load_json(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def _effective_payroll_month(period_month: int) -> int:
    return SPECIAL_PAYROLL_MONTHS.get(period_month, period_month)


def _payroll_date(year: int, period_month: int) -> date:
    month = _effective_payroll_month(period_month)
    return date(year, month, monthrange(year, month)[1])


def _professional_response(item: Professional) -> dict:
    return {
        "id": item.id,
        "company_id": item.company_id,
        "nif": item.nif,
        "name": item.name,
        "surname": item.surname,
        "full_name": item.full_name,
        "activity_type": item.activity_type,
        "withholding_rate": money(item.withholding_rate),
        "address": item.address,
        "province_code": item.province_code,
        "active": item.active,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _invoice_response(item: ProfessionalInvoice) -> dict:
    professional = item.professional
    return {
        "id": item.id,
        "professional_id": item.professional_id,
        "company_id": item.company_id,
        "professional_name": professional.full_name if professional else "",
        "professional_nif": professional.nif if professional else "",
        "invoice_number": item.invoice_number,
        "invoice_date": item.invoice_date,
        "payment_date": item.payment_date,
        "fiscal_date": item.fiscal_date,
        "tax_base": money(item.tax_base),
        "withholding_rate": money(item.withholding_rate),
        "withholding_amount": money(item.withholding_amount),
        "total_amount": money(item.total_amount),
        "status": item.status,
        "notes": item.notes,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _adjustment_response(item: TaxWithholdingAdjustment) -> dict:
    return {
        "id": item.id,
        "company_id": item.company_id,
        "category": item.category,
        "adjustment_type": item.adjustment_type,
        "source_date": item.source_date,
        "recipient_nif": item.recipient_nif,
        "recipient_name": item.recipient_name,
        "base_amount": money(item.base_amount),
        "withholding_amount": money(item.withholding_amount),
        "status": item.status,
        "notes": item.notes,
        "created_at": item.created_at,
    }


def list_professionals(db: Session, company_id: int | None = None, include_inactive: bool = False) -> list[dict]:
    query = db.query(Professional)
    if company_id is not None:
        query = query.filter(Professional.company_id == company_id)
    if not include_inactive:
        query = query.filter(Professional.active.is_(True))
    return [_professional_response(item) for item in query.order_by(Professional.name, Professional.surname).all()]


def create_professional(db: Session, payload: ProfessionalCreate) -> dict:
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise Model111DomainError("COMPANY_NOT_FOUND", "Empresa no encontrada", status_code=404)

    item = Professional(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise Model111DomainError(
            "DUPLICATE_PROFESSIONAL",
            "Ya existe un profesional con ese NIF en la empresa",
            status_code=409,
        ) from exc
    db.refresh(item)
    return _professional_response(item)


def update_professional(db: Session, professional_id: int, payload: ProfessionalUpdate) -> dict:
    item = db.query(Professional).filter(Professional.id == professional_id).first()
    if not item:
        raise Model111DomainError("PROFESSIONAL_NOT_FOUND", "Profesional no encontrado", status_code=404)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise Model111DomainError(
            "DUPLICATE_PROFESSIONAL",
            "Ya existe un profesional con ese NIF en la empresa",
            status_code=409,
        ) from exc
    db.refresh(item)
    return _professional_response(item)


def list_professional_invoices(
    db: Session,
    company_id: int | None = None,
    year: int | None = None,
    period: str | None = None,
) -> list[dict]:
    query = db.query(ProfessionalInvoice).options(joinedload(ProfessionalInvoice.professional))
    if company_id is not None:
        query = query.filter(ProfessionalInvoice.company_id == company_id)
    items = query.order_by(ProfessionalInvoice.invoice_date.desc(), ProfessionalInvoice.id.desc()).all()

    if year is not None and period:
        start, end, _ = period_bounds(year, period)
        items = [item for item in items if start <= item.fiscal_date <= end]
    elif year is not None:
        items = [item for item in items if item.fiscal_date.year == year]

    return [_invoice_response(item) for item in items]


def create_professional_invoice(db: Session, payload: ProfessionalInvoiceCreate) -> dict:
    professional = db.query(Professional).filter(Professional.id == payload.professional_id).first()
    if not professional:
        raise Model111DomainError("PROFESSIONAL_NOT_FOUND", "Profesional no encontrado", status_code=404)
    if professional.company_id != payload.company_id:
        raise Model111DomainError(
            "PROFESSIONAL_COMPANY_MISMATCH",
            "El profesional no pertenece a la empresa seleccionada",
        )

    values = payload.model_dump()
    base = money(values["tax_base"])
    rate = money(values["withholding_rate"])
    withholding = (
        money(values["withholding_amount"])
        if values.get("withholding_amount") is not None
        else money(base * rate / Decimal("100"))
    )
    total = money(values["total_amount"]) if values.get("total_amount") is not None else money(base - withholding)
    values["tax_base"] = base
    values["withholding_rate"] = rate
    values["withholding_amount"] = withholding
    values["total_amount"] = total

    item = ProfessionalInvoice(**values)
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise Model111DomainError(
            "DUPLICATE_INVOICE",
            "Ya existe una factura con ese número en la empresa",
            status_code=409,
        ) from exc
    db.refresh(item)
    item = (
        db.query(ProfessionalInvoice)
        .options(joinedload(ProfessionalInvoice.professional))
        .filter(ProfessionalInvoice.id == item.id)
        .one()
    )
    return _invoice_response(item)


def update_professional_invoice(
    db: Session,
    invoice_id: int,
    payload: ProfessionalInvoiceUpdate,
) -> dict:
    item = (
        db.query(ProfessionalInvoice)
        .options(joinedload(ProfessionalInvoice.professional))
        .filter(ProfessionalInvoice.id == invoice_id)
        .first()
    )
    if not item:
        raise Model111DomainError("INVOICE_NOT_FOUND", "Factura profesional no encontrada", status_code=404)

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(item, field, value)

    if item.status == "paid" and item.payment_date is None:
        raise Model111DomainError(
            "PAYMENT_DATE_REQUIRED",
            "Una factura pagada debe indicar la fecha de pago",
        )

    base = money(item.tax_base)
    rate = money(item.withholding_rate)
    if "withholding_amount" not in changes and ({"tax_base", "withholding_rate"} & changes.keys()):
        item.withholding_amount = money(base * rate / Decimal("100"))
    if "total_amount" not in changes and ({"tax_base", "withholding_rate", "withholding_amount"} & changes.keys()):
        item.total_amount = money(base - money(item.withholding_amount))

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise Model111DomainError(
            "DUPLICATE_INVOICE",
            "Ya existe una factura con ese número en la empresa",
            status_code=409,
        ) from exc
    db.refresh(item)
    return _invoice_response(item)


def list_adjustments(
    db: Session,
    company_id: int | None = None,
    year: int | None = None,
    period: str | None = None,
) -> list[dict]:
    query = db.query(TaxWithholdingAdjustment)
    if company_id is not None:
        query = query.filter(TaxWithholdingAdjustment.company_id == company_id)
    if year is not None and period:
        start, end, _ = period_bounds(year, period)
        query = query.filter(TaxWithholdingAdjustment.source_date.between(start, end))
    elif year is not None:
        query = query.filter(
            TaxWithholdingAdjustment.source_date >= date(year, 1, 1),
            TaxWithholdingAdjustment.source_date <= date(year, 12, 31),
        )
    return [_adjustment_response(item) for item in query.order_by(TaxWithholdingAdjustment.source_date.desc()).all()]


def create_adjustment(db: Session, payload: TaxWithholdingAdjustmentCreate) -> dict:
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise Model111DomainError("COMPANY_NOT_FOUND", "Empresa no encontrada", status_code=404)
    item = TaxWithholdingAdjustment(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _adjustment_response(item)


def _payroll_lines(db: Session, company_id: int, year: int, period: str) -> tuple[list[dict], list[Payroll]]:
    payrolls = (
        db.query(Payroll)
        .options(joinedload(Payroll.employee))
        .filter(Payroll.company_id == company_id, Payroll.period_year == year)
        .order_by(Payroll.period_month, Payroll.id)
        .all()
    )
    period_payrolls = [
        payroll
        for payroll in payrolls
        if period_contains_month(period, _effective_payroll_month(payroll.period_month))
        and payroll.status != "cancelled"
    ]
    final_payrolls = [payroll for payroll in period_payrolls if payroll.status in FINAL_PAYROLL_STATUSES]

    lines = []
    for payroll in final_payrolls:
        employee = payroll.employee
        effective_month = _effective_payroll_month(payroll.period_month)
        employee_name = payroll.employee_name or f"Trabajador {payroll.employee_id}"
        lines.append(
            {
                "category": "work",
                "source_type": "payroll",
                "source_id": payroll.id,
                "source_date": _payroll_date(year, payroll.period_month),
                "source_label": f"Nómina {payroll.period_label} · {employee_name}",
                "recipient_key": f"employee:{payroll.employee_id}",
                "recipient_nif": employee.dni if employee else None,
                "recipient_name": employee_name,
                "base_amount": money(payroll.irpf_base),
                "withholding_amount": money(payroll.irpf),
                "reconciliation_key": f"payroll:{effective_month:02d}",
                "reconciliation_label": f"Nóminas {MONTH_LABELS[effective_month]}",
                "reconciliation_order": effective_month,
            }
        )
    return lines, period_payrolls


def _professional_invoice_lines(db: Session, company_id: int, start: date, end: date) -> list[dict]:
    invoices = (
        db.query(ProfessionalInvoice)
        .options(joinedload(ProfessionalInvoice.professional))
        .filter(
            ProfessionalInvoice.company_id == company_id,
            ProfessionalInvoice.status.in_(INCLUDED_INVOICE_STATUSES),
        )
        .order_by(ProfessionalInvoice.invoice_date, ProfessionalInvoice.id)
        .all()
    )
    lines = []
    for invoice in invoices:
        if not (start <= invoice.fiscal_date <= end):
            continue
        professional = invoice.professional
        professional_name = professional.full_name if professional else f"Profesional {invoice.professional_id}"
        lines.append(
            {
                "category": "economic_activity",
                "source_type": "professional_invoice",
                "source_id": invoice.id,
                "source_date": invoice.fiscal_date,
                "source_label": f"Factura {invoice.invoice_number} · {professional_name}",
                "recipient_key": f"professional:{invoice.professional_id}",
                "recipient_nif": professional.nif if professional else None,
                "recipient_name": professional_name,
                "base_amount": money(invoice.tax_base),
                "withholding_amount": money(invoice.withholding_amount),
                "reconciliation_key": "professional_invoices",
                "reconciliation_label": "Facturas de profesionales",
                "reconciliation_order": 50,
            }
        )
    return lines


def _adjustment_lines(db: Session, company_id: int, start: date, end: date) -> list[dict]:
    items = (
        db.query(TaxWithholdingAdjustment)
        .filter(
            TaxWithholdingAdjustment.company_id == company_id,
            TaxWithholdingAdjustment.source_date.between(start, end),
            TaxWithholdingAdjustment.status == "confirmed",
        )
        .order_by(TaxWithholdingAdjustment.source_date, TaxWithholdingAdjustment.id)
        .all()
    )
    return [
        {
            "category": item.category,
            "source_type": "tax_adjustment",
            "source_id": item.id,
            "source_date": item.source_date,
            "source_label": f"{item.adjustment_type.title()} · {item.recipient_name}",
            "recipient_key": f"adjustment:{item.category}:{item.recipient_nif}",
            "recipient_nif": item.recipient_nif,
            "recipient_name": item.recipient_name,
            "base_amount": money(item.base_amount),
            "withholding_amount": money(item.withholding_amount),
            "adjustment_type": item.adjustment_type,
            "reconciliation_key": "adjustments",
            "reconciliation_label": "Ajustes y regularizaciones",
            "reconciliation_order": 60,
        }
        for item in items
    ]


def _validation_result(company: Company, lines: list[dict], period_payrolls: list[Payroll], summary: dict) -> dict:
    errors = []
    warnings = []

    if not (company.cif or "").strip():
        errors.append({"code": "COMPANY_NIF_REQUIRED", "message": "La empresa no tiene NIF/CIF informado"})

    pending_payrolls = [payroll for payroll in period_payrolls if payroll.status not in FINAL_PAYROLL_STATUSES]
    if pending_payrolls:
        errors.append(
            {
                "code": "UNCONFIRMED_PAYROLLS",
                "message": f"Hay {len(pending_payrolls)} nómina(s) del periodo sin revisar o cerrar",
                "source_ids": [payroll.id for payroll in pending_payrolls],
            }
        )

    missing_nif = [line for line in lines if not (line.get("recipient_nif") or "").strip()]
    if missing_nif:
        errors.append(
            {
                "code": "RECIPIENT_NIF_REQUIRED",
                "message": f"Hay {len(missing_nif)} percepción(es) sin NIF de perceptor",
                "source_ids": [line.get("source_id") for line in missing_nif],
            }
        )

    invalid_negative_lines = [
        line
        for line in lines
        if money(line.get("withholding_amount")) < 0
        and not (line.get("source_type") == "tax_adjustment" and line.get("adjustment_type") == "regularization")
    ]
    if invalid_negative_lines:
        errors.append(
            {
                "code": "NEGATIVE_WITHHOLDING_NOT_REGULARIZATION",
                "message": "Existen retenciones negativas que no proceden de una regularización",
            }
        )

    if summary["total_withholding"] < 0:
        errors.append(
            {
                "code": "NEGATIVE_DECLARATION_TOTAL",
                "message": "El total de retenciones del periodo no puede ser negativo",
            }
        )

    if not summary["has_operations"]:
        warnings.append(
            {
                "code": "NO_ACTIVITY",
                "message": "No existen operaciones declarables en el periodo; no procede generar el Modelo 111",
            }
        )
    elif summary["total_withholding"] == 0:
        warnings.append(
            {
                "code": "NEGATIVE_DECLARATION",
                "message": "Existen percepciones declarables, pero la retención resultante es 0,00 €",
            }
        )

    return {"is_valid": not errors, "errors": errors, "warnings": warnings}


def build_model111_preview(db: Session, company_id: int, year: int, period: str) -> dict:
    start, end, period_type = period_bounds(year, period)
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise Model111DomainError("COMPANY_NOT_FOUND", "Empresa no encontrada", status_code=404)

    payroll_lines, period_payrolls = _payroll_lines(db, company_id, year, period)
    lines = payroll_lines + _professional_invoice_lines(db, company_id, start, end) + _adjustment_lines(db, company_id, start, end)
    summary = summarize_lines(lines)
    validations = _validation_result(company, lines, period_payrolls, summary)

    return {
        "company": {"id": company.id, "name": company.name, "nif": company.cif},
        "year": year,
        "period": period,
        "period_type": period_type,
        "period_start": start,
        "period_end": end,
        "status": "draft",
        "result_type": summary["result_type"],
        "work": summary["work"],
        "professionals": summary["professionals"],
        "total_withholding": summary["total_withholding"],
        "previous_result": Decimal("0.00"),
        "result_amount": summary["result_amount"],
        "has_operations": summary["has_operations"],
        "reconciliation": build_reconciliation(lines),
        "lines": lines,
        "validations": validations,
    }


def _previous_presented_result(db: Session, company_id: int, year: int, period: str) -> Decimal:
    declarations = (
        db.query(Model111Declaration)
        .filter(
            Model111Declaration.company_id == company_id,
            Model111Declaration.year == year,
            Model111Declaration.period == period,
            Model111Declaration.status == "presented",
        )
        .all()
    )
    return money(sum((money(item.result_amount) for item in declarations), Decimal("0.00")))


def _build_payload(preview: dict, declaration_type: str, previous_result: Decimal) -> dict:
    result_amount = money(preview["total_withholding"] - previous_result)
    return {
        "model": "111",
        "educational_simulation": True,
        "company": preview["company"],
        "accrual": {
            "year": preview["year"],
            "period": preview["period"],
            "period_type": preview["period_type"],
        },
        "declaration_type": declaration_type,
        "boxes": {
            "01": preview["work"]["perceptors"],
            "02": preview["work"]["base"],
            "03": preview["work"]["withholding"],
            "07": preview["professionals"]["perceptors"],
            "08": preview["professionals"]["base"],
            "09": preview["professionals"]["withholding"],
            "28": preview["total_withholding"],
            "29": previous_result,
            "30": result_amount,
        },
        "negative_declaration": preview["has_operations"] and result_amount == 0,
        "source_count": len(preview["lines"]),
    }


def generate_model111_declaration(db: Session, request: Model111GenerateRequest) -> dict:
    preview = build_model111_preview(db, request.company_id, request.year, request.period)
    if not preview["has_operations"]:
        raise Model111DomainError(
            "NO_ACTIVITY",
            "No hay operaciones declarables; no procede generar el Modelo 111",
            status_code=422,
        )
    if not preview["validations"]["is_valid"]:
        raise Model111DomainError(
            "VALIDATION_FAILED",
            "La declaración contiene errores bloqueantes",
            status_code=422,
            context={"validations": preview["validations"]},
        )

    previous_result = Decimal("0.00")
    original = None
    if request.declaration_type == "ordinary":
        duplicate = (
            db.query(Model111Declaration)
            .filter(
                Model111Declaration.company_id == request.company_id,
                Model111Declaration.year == request.year,
                Model111Declaration.period == request.period,
                Model111Declaration.declaration_type == "ordinary",
                Model111Declaration.status != "cancelled",
            )
            .first()
        )
        if duplicate:
            raise Model111DomainError(
                "DUPLICATE_DECLARATION",
                "Ya existe una declaración ordinaria para la empresa y el periodo",
                status_code=409,
                context={"declaration_id": duplicate.id},
            )
    else:
        original = (
            db.query(Model111Declaration)
            .filter(Model111Declaration.id == request.original_declaration_id)
            .first()
        )
        if not original:
            raise Model111DomainError("ORIGINAL_NOT_FOUND", "Declaración original no encontrada", status_code=404)
        if original.status != "presented":
            raise Model111DomainError(
                "ORIGINAL_NOT_PRESENTED",
                "Solo se puede complementar una declaración presentada",
            )
        if (original.company_id, original.year, original.period) != (
            request.company_id,
            request.year,
            request.period,
        ):
            raise Model111DomainError(
                "ORIGINAL_PERIOD_MISMATCH",
                "La declaración original no corresponde a la misma empresa y periodo",
            )
        previous_result = _previous_presented_result(db, request.company_id, request.year, request.period)
        if money(preview["total_withholding"] - previous_result) <= 0:
            raise Model111DomainError(
                "COMPLEMENTARY_NOT_PAYABLE",
                "La complementaria debe producir una cantidad positiva a ingresar; para otros casos procede una rectificación",
                status_code=422,
            )

    result_amount = money(preview["total_withholding"] - previous_result)
    result_type = "negative" if result_amount == 0 else "payable"
    payload = _build_payload(preview, request.declaration_type, previous_result)

    declaration = Model111Declaration(
        company_id=request.company_id,
        year=request.year,
        period=request.period,
        period_type=preview["period_type"],
        period_start=preview["period_start"],
        period_end=preview["period_end"],
        declaration_type=request.declaration_type,
        original_declaration_id=original.id if original else None,
        status="generated",
        result_type=result_type,
        work_perceptors=preview["work"]["perceptors"],
        work_base=preview["work"]["base"],
        work_withholding=preview["work"]["withholding"],
        professional_perceptors=preview["professionals"]["perceptors"],
        professional_base=preview["professionals"]["base"],
        professional_withholding=preview["professionals"]["withholding"],
        total_withholding=preview["total_withholding"],
        previous_result=previous_result,
        result_amount=result_amount,
        payload_json=_dump_json(payload),
        validation_json=_dump_json(preview["validations"]),
    )
    declaration.lines = [
        Model111Line(
            category=line["category"],
            source_type=line["source_type"],
            source_id=line.get("source_id"),
            source_date=line["source_date"],
            source_label=line["source_label"],
            recipient_key=line["recipient_key"],
            recipient_nif=line.get("recipient_nif"),
            recipient_name=line["recipient_name"],
            base_amount=money(line["base_amount"]),
            withholding_amount=money(line["withholding_amount"]),
        )
        for line in preview["lines"]
    ]
    db.add(declaration)
    db.commit()
    db.refresh(declaration)
    return get_model111_declaration(db, declaration.id)


def _line_response(line: Model111Line) -> dict:
    return {
        "id": line.id,
        "category": line.category,
        "source_type": line.source_type,
        "source_id": line.source_id,
        "source_date": line.source_date,
        "source_label": line.source_label,
        "recipient_key": line.recipient_key,
        "recipient_nif": line.recipient_nif,
        "recipient_name": line.recipient_name,
        "base_amount": money(line.base_amount),
        "withholding_amount": money(line.withholding_amount),
    }


def _declaration_response(item: Model111Declaration, include_lines: bool = True) -> dict:
    company = item.company
    response = {
        "id": item.id,
        "company_id": item.company_id,
        "company_name": company.name if company else None,
        "company_nif": company.cif if company else None,
        "year": item.year,
        "period": item.period,
        "period_type": item.period_type,
        "period_start": item.period_start,
        "period_end": item.period_end,
        "declaration_type": item.declaration_type,
        "original_declaration_id": item.original_declaration_id,
        "status": item.status,
        "result_type": item.result_type,
        "work": {
            "perceptors": item.work_perceptors,
            "base": money(item.work_base),
            "withholding": money(item.work_withholding),
        },
        "professionals": {
            "perceptors": item.professional_perceptors,
            "base": money(item.professional_base),
            "withholding": money(item.professional_withholding),
        },
        "total_withholding": money(item.total_withholding),
        "previous_result": money(item.previous_result),
        "result_amount": money(item.result_amount),
        "payload": _load_json(item.payload_json, {}),
        "validations": _load_json(item.validation_json, {"is_valid": True, "errors": [], "warnings": []}),
        "generated_at": item.generated_at,
        "presented_at": item.presented_at,
        "payment_method": item.payment_method,
        "nrc": item.nrc,
        "receipt_number": item.receipt_number,
        "csv": item.csv,
        "locked": item.locked,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }
    if include_lines:
        response["lines"] = [_line_response(line) for line in item.lines]
    return response


def list_model111_declarations(
    db: Session,
    company_id: int | None = None,
    year: int | None = None,
) -> list[dict]:
    query = db.query(Model111Declaration).options(joinedload(Model111Declaration.company))
    if company_id is not None:
        query = query.filter(Model111Declaration.company_id == company_id)
    if year is not None:
        query = query.filter(Model111Declaration.year == year)
    items = query.order_by(Model111Declaration.year.desc(), Model111Declaration.period.desc(), Model111Declaration.id.desc()).all()
    return [_declaration_response(item, include_lines=False) for item in items]


def get_model111_declaration(db: Session, declaration_id: int) -> dict:
    item = (
        db.query(Model111Declaration)
        .options(joinedload(Model111Declaration.company), joinedload(Model111Declaration.lines))
        .filter(Model111Declaration.id == declaration_id)
        .first()
    )
    if not item:
        raise Model111DomainError("DECLARATION_NOT_FOUND", "Declaración no encontrada", status_code=404)
    return _declaration_response(item)


def _simulated_identifier(prefix: str, digits: int) -> str:
    numeric = "".join(str(secrets.randbelow(10)) for _ in range(digits))
    return f"{prefix}{numeric}"


def present_model111_declaration(
    db: Session,
    declaration_id: int,
    request: Model111PresentationRequest,
) -> dict:
    item = (
        db.query(Model111Declaration)
        .options(joinedload(Model111Declaration.company), joinedload(Model111Declaration.lines))
        .filter(Model111Declaration.id == declaration_id)
        .first()
    )
    if not item:
        raise Model111DomainError("DECLARATION_NOT_FOUND", "Declaración no encontrada", status_code=404)
    if item.locked or item.status == "presented":
        raise Model111DomainError("DECLARATION_LOCKED", "La declaración ya está presentada y bloqueada", status_code=409)
    if item.status != "generated":
        raise Model111DomainError("INVALID_DECLARATION_STATUS", "La declaración no está preparada para presentar")

    if item.result_type == "negative":
        if request.payment_method != "negative":
            raise Model111DomainError(
                "NEGATIVE_PAYMENT_METHOD",
                "Una declaración negativa debe presentarse como resultado negativo",
            )
        nrc = None
    else:
        if request.payment_method == "negative":
            raise Model111DomainError(
                "PAYMENT_METHOD_REQUIRED",
                "La declaración tiene resultado a ingresar y necesita una forma de pago",
            )
        nrc = request.nrc or _simulated_identifier("NRC111", 16)

    item.status = "presented"
    item.locked = True
    item.payment_method = request.payment_method
    item.nrc = nrc
    item.presented_at = datetime.utcnow()
    item.receipt_number = _simulated_identifier("111", 10)
    item.csv = secrets.token_hex(10).upper()

    payload = _load_json(item.payload_json, {})
    payload["presentation"] = {
        "simulated": True,
        "presented_at": item.presented_at,
        "payment_method": item.payment_method,
        "nrc": item.nrc,
        "receipt_number": item.receipt_number,
        "csv": item.csv,
    }
    item.payload_json = _dump_json(payload)
    db.commit()
    db.refresh(item)
    return _declaration_response(item)
