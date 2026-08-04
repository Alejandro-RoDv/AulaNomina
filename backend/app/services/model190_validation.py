from __future__ import annotations

import re
from collections import defaultdict
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.model190 import Tax190Key, Tax190Subkey
from app.services.model190_calculator import money, normalize_nif


ZERO = Decimal("0.00")
NIF_PATTERN = re.compile(r"^[A-Z0-9]{9}$")


def _add(items: list[dict], level: str, code: str, message: str, **context: Any) -> None:
    items.append({"level": level, "code": code, "message": message, **context})


def _active_catalog(db: Session, year: int) -> tuple[dict[str, Tax190Key], set[tuple[str, str]]]:
    keys = (
        db.query(Tax190Key)
        .filter(
            Tax190Key.active.is_(True),
            Tax190Key.valid_from <= year,
            (Tax190Key.valid_to.is_(None) | (Tax190Key.valid_to >= year)),
        )
        .all()
    )
    subkeys = (
        db.query(Tax190Subkey)
        .filter(
            Tax190Subkey.active.is_(True),
            Tax190Subkey.valid_from <= year,
            (Tax190Subkey.valid_to.is_(None) | (Tax190Subkey.valid_to >= year)),
        )
        .all()
    )
    return {item.code: item for item in keys}, {(item.key_code, item.code) for item in subkeys}


def _recipient_label(recipient: dict) -> str:
    name = " ".join(
        part.strip()
        for part in [recipient.get("name"), recipient.get("surname")]
        if part and part.strip()
    )
    return f"{normalize_nif(recipient.get('nif')) or 'Sin NIF'} · {name or 'Sin nombre'}"


def build_model190_validations(
    db: Session,
    preview: dict,
    reconciliation: dict | None = None,
) -> dict:
    items: list[dict] = []
    recipients = preview.get("recipients") or []
    year = int(preview["year"])
    valid_keys, valid_subkeys = _active_catalog(db, year)

    if not recipients:
        _add(
            items,
            "error",
            "DECLARATION_WITHOUT_RECIPIENTS",
            "La declaración no contiene perceptores.",
        )

    names_by_nif: dict[str, set[str]] = defaultdict(set)
    types_by_nif: dict[str, set[str]] = defaultdict(set)

    for recipient in recipients:
        recipient_key = recipient.get("recipient_key")
        label = _recipient_label(recipient)
        nif = normalize_nif(recipient.get("nif"))
        key = str(recipient.get("key") or "").strip().upper()
        subkey = str(recipient.get("subkey") or "").strip().zfill(2) if recipient.get("subkey") else None
        full_name = " ".join(
            part.strip()
            for part in [recipient.get("name"), recipient.get("surname")]
            if part and part.strip()
        )

        if not nif:
            _add(
                items,
                "error",
                "RECIPIENT_NIF_REQUIRED",
                f"{label}: falta el NIF del perceptor.",
                recipient_key=recipient_key,
            )
        elif not NIF_PATTERN.fullmatch(nif):
            _add(
                items,
                "warning",
                "RECIPIENT_NIF_FORMAT_REVIEW",
                f"{label}: el NIF no tiene el formato alfanumérico educativo de nueve posiciones.",
                recipient_key=recipient_key,
            )

        if not full_name:
            _add(
                items,
                "error",
                "RECIPIENT_NAME_REQUIRED",
                f"{label}: faltan los datos identificativos del perceptor.",
                recipient_key=recipient_key,
            )

        catalog_key = valid_keys.get(key)
        if not key:
            _add(
                items,
                "error",
                "RECIPIENT_KEY_REQUIRED",
                f"{label}: falta la clave fiscal.",
                recipient_key=recipient_key,
            )
        elif catalog_key is None:
            _add(
                items,
                "error",
                "RECIPIENT_KEY_INVALID",
                f"{label}: la clave {key} no está vigente en el catálogo del ejercicio {year}.",
                recipient_key=recipient_key,
                key=key,
            )
        elif catalog_key.recipient_type != recipient.get("recipient_type"):
            _add(
                items,
                "error",
                "RECIPIENT_KEY_TYPE_MISMATCH",
                f"{label}: la clave {key} no corresponde al tipo de perceptor indicado.",
                recipient_key=recipient_key,
                key=key,
            )

        if key == "G" and not subkey:
            _add(
                items,
                "error",
                "RECIPIENT_SUBKEY_REQUIRED",
                f"{label}: la clave G requiere una subclave.",
                recipient_key=recipient_key,
            )
        elif subkey and (key, subkey) not in valid_subkeys:
            _add(
                items,
                "error",
                "RECIPIENT_SUBKEY_INVALID",
                f"{label}: la subclave {key}-{subkey} no está vigente en el ejercicio {year}.",
                recipient_key=recipient_key,
                key=key,
                subkey=subkey,
            )

        if not recipient.get("accrual_year"):
            _add(
                items,
                "error",
                "ACCRUAL_YEAR_REQUIRED",
                f"{label}: falta el ejercicio de devengo.",
                recipient_key=recipient_key,
            )

        monetary_fields = (
            "cash_income",
            "cash_withholding",
            "in_kind_income",
            "in_kind_payment_on_account",
            "in_kind_payment_repercuted",
            "deductible_expenses",
            "reductions",
        )
        if any(abs(money(recipient.get(field))) >= Decimal("1000000000000.00") for field in monetary_fields):
            _add(
                items,
                "error",
                "RECIPIENT_AMOUNT_OUT_OF_RANGE",
                f"{label}: existe un importe anual fuera del rango admitido por el fichero educativo.",
                recipient_key=recipient_key,
            )

        if recipient.get("recipient_type") == "employee" and money(recipient.get("deductible_expenses")) == ZERO:
            _add(
                items,
                "warning",
                "DEDUCTIBLE_EXPENSES_MISSING",
                f"{label}: no constan gastos deducibles de Seguridad Social.",
                recipient_key=recipient_key,
            )

        total_income = money(recipient.get("cash_income")) + money(recipient.get("in_kind_income"))
        total_withholding = money(recipient.get("cash_withholding")) + money(
            recipient.get("in_kind_payment_on_account")
        )
        if total_income != ZERO and total_withholding == ZERO:
            _add(
                items,
                "warning",
                "ZERO_WITHHOLDING",
                f"{label}: existen percepciones con retención anual cero.",
                recipient_key=recipient_key,
            )

        if recipient.get("classification_source") == "automatic" and not recipient.get("classification_confirmed"):
            _add(
                items,
                "warning",
                "AUTOMATIC_CLASSIFICATION_PENDING",
                f"{label}: la clasificación fiscal automática está pendiente de revisión.",
                recipient_key=recipient_key,
            )

        lines = recipient.get("lines") or []
        contract_ids = {line.get("contract_id") for line in lines if line.get("contract_id")}
        invoice_ids = {
            line.get("source_id")
            for line in lines
            if line.get("source_type") == "professional_invoice" and line.get("source_id")
        }
        manual_adjustments = [
            line
            for line in lines
            if line.get("source_type") in {"adjustment", "regularization"}
        ]
        arrears_without_prior_year = [
            line
            for line in lines
            if line.get("source_type") == "arrears" and int(recipient.get("accrual_year") or year) == year
        ]

        if len(contract_ids) > 1:
            _add(
                items,
                "information",
                "MULTIPLE_CONTRACTS",
                f"{label}: el resumen acumula {len(contract_ids)} contratos.",
                recipient_key=recipient_key,
                count=len(contract_ids),
            )
        if len(invoice_ids) > 1:
            _add(
                items,
                "information",
                "MULTIPLE_PROFESSIONAL_INVOICES",
                f"{label}: el resumen acumula {len(invoice_ids)} facturas profesionales.",
                recipient_key=recipient_key,
                count=len(invoice_ids),
            )
        if manual_adjustments:
            _add(
                items,
                "information",
                "MANUAL_ADJUSTMENTS_INCLUDED",
                f"{label}: se han incluido {len(manual_adjustments)} ajustes o regularizaciones manuales.",
                recipient_key=recipient_key,
                count=len(manual_adjustments),
            )
        if arrears_without_prior_year:
            _add(
                items,
                "warning",
                "ARREARS_ACCRUAL_REVIEW",
                f"{label}: existen atrasos sin un ejercicio de devengo anterior identificado.",
                recipient_key=recipient_key,
                count=len(arrears_without_prior_year),
            )

        if nif:
            names_by_nif[nif].add(full_name.upper())
            types_by_nif[nif].add(str(recipient.get("recipient_type") or ""))

    for nif, names in names_by_nif.items():
        if len(names) > 1:
            _add(
                items,
                "warning",
                "DIFFERENT_NAMES_FOR_NIF",
                f"El NIF {nif} aparece con nombres distintos en el resumen anual.",
                nif=nif,
                names=sorted(names),
            )
        if len(types_by_nif[nif]) > 1:
            _add(
                items,
                "warning",
                "INCOMPATIBLE_RECIPIENT_TYPES_FOR_NIF",
                f"El NIF {nif} figura simultáneamente como trabajador y profesional.",
                nif=nif,
            )

    if reconciliation:
        for alert in reconciliation.get("alerts") or []:
            _add(
                items,
                "warning" if alert.get("level") == "warning" else "information",
                alert.get("code") or "RECONCILIATION_ALERT",
                alert.get("message") or "Aviso de conciliación 111/190.",
                quarter=alert.get("quarter"),
                category=alert.get("category"),
            )

    totals = preview.get("totals") or {}
    calculated_cash = money(sum((money(item.get("cash_income")) for item in recipients), ZERO))
    calculated_kind = money(sum((money(item.get("in_kind_income")) for item in recipients), ZERO))
    calculated_withholding = money(
        sum(
            (
                money(item.get("cash_withholding"))
                + money(item.get("in_kind_payment_on_account"))
                for item in recipients
            ),
            ZERO,
        )
    )
    calculated_expenses = money(
        sum((money(item.get("deductible_expenses")) for item in recipients), ZERO)
    )
    expected_totals = {
        "total_cash_income": calculated_cash,
        "total_in_kind_income": calculated_kind,
        "total_withholding": calculated_withholding,
        "total_deductible_expenses": calculated_expenses,
    }
    for field, expected in expected_totals.items():
        if money(totals.get(field)) != expected:
            _add(
                items,
                "error",
                "ANNUAL_TOTAL_MISMATCH",
                f"El total anual {field} no coincide con la suma de perceptores.",
                field=field,
                expected=expected,
                actual=money(totals.get(field)),
            )

    counts = {"error": 0, "warning": 0, "information": 0}
    for item in items:
        counts[item["level"]] += 1

    return {
        "is_valid": counts["error"] == 0,
        "counts": counts,
        "items": items,
    }
