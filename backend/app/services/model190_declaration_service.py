from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.model190 import (
    Model190Declaration,
    Model190Recipient,
    Model190RecipientLine,
)
from app.schemas.model190 import Model190DeclarationCreate
from app.services.model190_calculator import (
    Model190DomainError,
    build_model190_preview,
    money,
)
from app.services.model190_file_service import build_model190_files
from app.services.model190_reconciliation import build_model190_reconciliation
from app.services.model190_validation import build_model190_validations


ALLOWED_ORIGINAL_STATUSES = {"generated", "validated", "presented"}
FILE_FORMATS = {"readable", "fixed_width"}


def _json_default(value):
    if isinstance(value, Decimal):
        return format(money(value), "f")
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(f"Tipo no serializable: {type(value)!r}")


def _dump_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=_json_default)


def _load_json(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def _recipient_payload(recipient: dict) -> dict:
    return {
        "recipient_key": recipient.get("recipient_key"),
        "recipient_type": recipient.get("recipient_type"),
        "employee_id": recipient.get("employee_id"),
        "professional_id": recipient.get("professional_id"),
        "nif": recipient.get("nif") or "",
        "name": recipient.get("name") or "",
        "surname": recipient.get("surname"),
        "key": recipient.get("key") or "",
        "subkey": recipient.get("subkey"),
        "accrual_year": int(recipient.get("accrual_year")),
        "province_code": recipient.get("province_code"),
        "cash_income": money(recipient.get("cash_income")),
        "cash_withholding": money(recipient.get("cash_withholding")),
        "in_kind_income": money(recipient.get("in_kind_income")),
        "in_kind_payment_on_account": money(recipient.get("in_kind_payment_on_account")),
        "in_kind_payment_repercuted": money(recipient.get("in_kind_payment_repercuted")),
        "deductible_expenses": money(recipient.get("deductible_expenses")),
        "reductions": money(recipient.get("reductions")),
        "classification_source": recipient.get("classification_source"),
        "classification_confirmed": bool(recipient.get("classification_confirmed")),
        "source_count": int(recipient.get("source_count") or len(recipient.get("lines") or [])),
        "lines": [
            {
                "source_type": line.get("source_type") or "adjustment",
                "source_id": line.get("source_id"),
                "source_label": line.get("source_label") or "Origen sin etiqueta",
                "source_date": line.get("source_date"),
                "amount_type": line.get("amount_type") or "cash",
                "gross_amount": money(line.get("gross_amount")),
                "withholding_amount": money(line.get("withholding_amount")),
                "deductible_expense_amount": money(line.get("deductible_expense_amount")),
                "quarter": line.get("quarter"),
                "contract_id": line.get("contract_id"),
            }
            for line in recipient.get("lines") or []
        ],
    }


def _reconciliation_snapshot(reconciliation: dict) -> dict:
    return {
        "annual": reconciliation.get("annual"),
        "alert_summary": reconciliation.get("alert_summary"),
        "quarters": [
            {
                "quarter": item.get("quarter"),
                "is_balanced": bool(item.get("is_balanced")),
                "declaration": item.get("declaration"),
                "pending_declaration": item.get("pending_declaration"),
                "operations": item.get("operations"),
                "model111": item.get("model111"),
                "differences": item.get("differences"),
                "alerts": item.get("alerts") or [],
            }
            for item in reconciliation.get("quarters") or []
        ],
        "unmatched_documents": reconciliation.get("unmatched_documents"),
    }


def _build_snapshot(
    company: Company,
    request: Model190DeclarationCreate,
    preview: dict,
    reconciliation: dict,
    validations: dict,
    generated_at: datetime,
) -> dict:
    snapshot = {
        "model": "190",
        "educational_simulation": True,
        "presentable": False,
        "frozen_at": generated_at,
        "company": {
            "id": company.id,
            "name": company.name,
            "nif": company.cif,
            "address": company.address,
            "city": company.city,
            "province": company.province,
        },
        "year": request.year,
        "declaration_type": request.declaration_type,
        "original_declaration_id": request.original_declaration_id,
        "totals": {
            "total_recipients": int(preview["totals"]["total_recipients"]),
            "unique_nifs": int(preview["totals"]["unique_nifs"]),
            "total_cash_income": money(preview["totals"]["total_cash_income"]),
            "total_in_kind_income": money(preview["totals"]["total_in_kind_income"]),
            "total_withholding": money(preview["totals"]["total_withholding"]),
            "total_deductible_expenses": money(preview["totals"]["total_deductible_expenses"]),
            "total_reductions": money(preview["totals"]["total_reductions"]),
        },
        "source_summary": preview.get("source_summary") or [],
        "source_count": int(preview.get("source_count") or 0),
        "capabilities": preview.get("capabilities") or {},
        "reconciliation": _reconciliation_snapshot(reconciliation),
        "validations": validations,
        "recipients": [_recipient_payload(item) for item in preview.get("recipients") or []],
    }
    snapshot["files"] = build_model190_files(snapshot)
    return snapshot


def _declaration_query(db: Session):
    return db.query(Model190Declaration).options(
        joinedload(Model190Declaration.company),
        joinedload(Model190Declaration.recipients).joinedload(Model190Recipient.lines),
    )


def _line_response(item: Model190RecipientLine) -> dict:
    return {
        "id": item.id,
        "source_type": item.source_type,
        "source_id": item.source_id,
        "source_label": item.source_label,
        "source_date": item.source_date,
        "amount_type": item.amount_type,
        "gross_amount": money(item.gross_amount),
        "withholding_amount": money(item.withholding_amount),
        "deductible_expense_amount": money(item.deductible_expense_amount),
        "model111_declaration_id": item.model111_declaration_id,
        "quarter": item.quarter,
    }


def _recipient_response(item: Model190Recipient) -> dict:
    return {
        "id": item.id,
        "recipient_type": item.recipient_type,
        "employee_id": item.employee_id,
        "professional_id": item.professional_id,
        "nif": item.nif,
        "name": item.name,
        "surname": item.surname,
        "full_name": item.full_name,
        "key": item.key,
        "subkey": item.subkey,
        "accrual_year": item.accrual_year,
        "province_code": item.province_code,
        "cash_income": money(item.cash_income),
        "cash_withholding": money(item.cash_withholding),
        "in_kind_income": money(item.in_kind_income),
        "in_kind_payment_on_account": money(item.in_kind_payment_on_account),
        "in_kind_payment_repercuted": money(item.in_kind_payment_repercuted),
        "deductible_expenses": money(item.deductible_expenses),
        "reductions": money(item.reductions),
        "lines": [_line_response(line) for line in item.lines],
    }


def _file_metadata(payload: dict) -> dict:
    return {
        name: {key: value for key, value in file_data.items() if key != "content"}
        for name, file_data in (payload.get("files") or {}).items()
    }


def declaration_response(item: Model190Declaration, *, include_recipients: bool = True) -> dict:
    payload = _load_json(item.payload, {})
    validations = _load_json(item.validation_result, {"is_valid": False, "counts": {}, "items": []})
    return {
        "id": item.id,
        "company_id": item.company_id,
        "company_name": item.company.name if item.company else None,
        "company_nif": item.company.cif if item.company else None,
        "year": item.year,
        "declaration_type": item.declaration_type,
        "original_declaration_id": item.original_declaration_id,
        "status": item.status,
        "generated_at": item.generated_at,
        "presented_at": item.presented_at,
        "locked": item.locked,
        "total_recipients": item.total_recipients,
        "total_cash_income": money(item.total_cash_income),
        "total_in_kind_income": money(item.total_in_kind_income),
        "total_withholding": money(item.total_withholding),
        "total_deductible_expenses": money(item.total_deductible_expenses),
        "validation_result": validations,
        "file_metadata": _file_metadata(payload),
        "receipt_number": item.receipt_number,
        "csv": item.csv,
        "presentation_reference": item.presentation_reference,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "recipients": [_recipient_response(recipient) for recipient in item.recipients]
        if include_recipients
        else [],
    }


def _validate_generation_request(
    db: Session,
    request: Model190DeclarationCreate,
) -> Model190Declaration | None:
    if request.declaration_type == "ordinary":
        duplicate = (
            db.query(Model190Declaration)
            .filter(
                Model190Declaration.company_id == request.company_id,
                Model190Declaration.year == request.year,
                Model190Declaration.declaration_type == "ordinary",
                Model190Declaration.status != "cancelled",
            )
            .first()
        )
        if duplicate:
            raise Model190DomainError(
                "DUPLICATE_ORDINARY_DECLARATION",
                "Ya existe una declaración ordinaria no cancelada para la empresa y el ejercicio.",
                status_code=409,
                context={"declaration_id": duplicate.id},
            )
        return None

    original = (
        db.query(Model190Declaration)
        .filter(Model190Declaration.id == request.original_declaration_id)
        .first()
    )
    if original is None:
        raise Model190DomainError(
            "ORIGINAL_DECLARATION_NOT_FOUND",
            "No se ha encontrado la declaración original indicada.",
            status_code=404,
        )
    if (original.company_id, original.year) != (request.company_id, request.year):
        raise Model190DomainError(
            "ORIGINAL_DECLARATION_SCOPE_MISMATCH",
            "La declaración original no corresponde a la misma empresa y ejercicio.",
        )
    if original.status not in ALLOWED_ORIGINAL_STATUSES or not original.locked:
        raise Model190DomainError(
            "ORIGINAL_DECLARATION_NOT_FROZEN",
            "La declaración original debe estar generada y congelada.",
        )
    return original


def generate_model190_declaration(
    db: Session,
    request: Model190DeclarationCreate,
) -> dict:
    company = db.query(Company).filter(Company.id == request.company_id).first()
    if company is None:
        raise Model190DomainError("COMPANY_NOT_FOUND", "Empresa no encontrada", status_code=404)

    _validate_generation_request(db, request)
    preview = build_model190_preview(db, request.company_id, request.year)
    reconciliation = build_model190_reconciliation(db, request.company_id, request.year)
    validations = build_model190_validations(db, preview, reconciliation)
    if not validations["is_valid"]:
        raise Model190DomainError(
            "MODEL190_VALIDATION_FAILED",
            "La declaración contiene errores bloqueantes y no puede generarse.",
            status_code=422,
            context={"validations": validations},
        )

    generated_at = datetime.utcnow()
    snapshot = _build_snapshot(company, request, preview, reconciliation, validations, generated_at)
    effective_declarations = {
        item["quarter"]: item.get("declaration", {}).get("id")
        if item.get("declaration")
        else None
        for item in reconciliation.get("quarters") or []
    }

    declaration = Model190Declaration(
        company_id=request.company_id,
        year=request.year,
        declaration_type=request.declaration_type,
        original_declaration_id=request.original_declaration_id,
        status="generated",
        generated_at=generated_at,
        locked=True,
        total_recipients=preview["totals"]["total_recipients"],
        total_cash_income=preview["totals"]["total_cash_income"],
        total_in_kind_income=preview["totals"]["total_in_kind_income"],
        total_withholding=preview["totals"]["total_withholding"],
        total_deductible_expenses=preview["totals"]["total_deductible_expenses"],
        payload=_dump_json(snapshot),
        validation_result=_dump_json(validations),
    )
    db.add(declaration)
    db.flush()

    for recipient_data in preview.get("recipients") or []:
        recipient = Model190Recipient(
            declaration_id=declaration.id,
            recipient_type=recipient_data["recipient_type"],
            employee_id=recipient_data.get("employee_id"),
            professional_id=recipient_data.get("professional_id"),
            nif=recipient_data.get("nif") or "",
            name=recipient_data.get("name") or "",
            surname=recipient_data.get("surname"),
            key=recipient_data.get("key") or "",
            subkey=recipient_data.get("subkey"),
            cash_income=money(recipient_data.get("cash_income")),
            cash_withholding=money(recipient_data.get("cash_withholding")),
            in_kind_income=money(recipient_data.get("in_kind_income")),
            in_kind_payment_on_account=money(recipient_data.get("in_kind_payment_on_account")),
            in_kind_payment_repercuted=money(recipient_data.get("in_kind_payment_repercuted")),
            deductible_expenses=money(recipient_data.get("deductible_expenses")),
            reductions=money(recipient_data.get("reductions")),
            accrual_year=int(recipient_data["accrual_year"]),
            province_code=recipient_data.get("province_code"),
        )
        declaration.recipients.append(recipient)
        for line_data in recipient_data.get("lines") or []:
            recipient.lines.append(
                Model190RecipientLine(
                    source_type=line_data.get("source_type") or "adjustment",
                    source_id=line_data.get("source_id"),
                    source_label=line_data.get("source_label") or "Origen sin etiqueta",
                    source_date=line_data["source_date"],
                    amount_type=line_data.get("amount_type") or "cash",
                    gross_amount=money(line_data.get("gross_amount")),
                    withholding_amount=money(line_data.get("withholding_amount")),
                    deductible_expense_amount=money(line_data.get("deductible_expense_amount")),
                    model111_declaration_id=effective_declarations.get(line_data.get("quarter")),
                    quarter=line_data.get("quarter"),
                )
            )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise Model190DomainError(
            "MODEL190_SNAPSHOT_CONFLICT",
            "No se ha podido congelar la relación de perceptores por un conflicto de datos.",
            status_code=409,
        ) from exc

    item = _declaration_query(db).filter(Model190Declaration.id == declaration.id).one()
    return declaration_response(item)


def list_model190_declarations(
    db: Session,
    *,
    company_id: int | None = None,
    year: int | None = None,
) -> list[dict]:
    query = _declaration_query(db)
    if company_id is not None:
        query = query.filter(Model190Declaration.company_id == company_id)
    if year is not None:
        query = query.filter(Model190Declaration.year == year)
    items = query.order_by(
        Model190Declaration.year.desc(),
        Model190Declaration.created_at.desc(),
        Model190Declaration.id.desc(),
    ).all()
    return [declaration_response(item, include_recipients=False) for item in items]


def get_model190_declaration(db: Session, declaration_id: int) -> dict:
    item = _declaration_query(db).filter(Model190Declaration.id == declaration_id).first()
    if item is None:
        raise Model190DomainError(
            "MODEL190_DECLARATION_NOT_FOUND",
            "Declaración del Modelo 190 no encontrada.",
            status_code=404,
        )
    return declaration_response(item)


def get_model190_file(
    db: Session,
    declaration_id: int,
    file_format: str = "fixed_width",
) -> dict:
    if file_format not in FILE_FORMATS:
        raise Model190DomainError(
            "MODEL190_FILE_FORMAT_INVALID",
            "Formato de fichero no válido. Usa readable o fixed_width.",
        )
    item = db.query(Model190Declaration).filter(Model190Declaration.id == declaration_id).first()
    if item is None:
        raise Model190DomainError(
            "MODEL190_DECLARATION_NOT_FOUND",
            "Declaración del Modelo 190 no encontrada.",
            status_code=404,
        )
    payload = _load_json(item.payload, {})
    file_data = (payload.get("files") or {}).get(file_format)
    if not file_data:
        raise Model190DomainError(
            "MODEL190_FILE_NOT_AVAILABLE",
            "La declaración no contiene el fichero congelado solicitado.",
            status_code=404,
        )
    return file_data
