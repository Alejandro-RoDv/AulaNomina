from __future__ import annotations

import hashlib
import re
import unicodedata
from decimal import Decimal
from typing import Any

from app.services.model190_calculator import money, normalize_nif


RECORD_LENGTH = 250
FILE_VERSION = "AULANOMINA-M190-EDU-1"
NIF_PATTERN = re.compile(r"^[A-Z0-9]{9}$")


def _ascii(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _text(value: Any, width: int, *, align: str = "left") -> str:
    cleaned = " ".join(_ascii(value).upper().split())[:width]
    return cleaned.rjust(width) if align == "right" else cleaned.ljust(width)


def _signed_cents(value: Any, width: int = 15) -> str:
    amount = money(value)
    sign = "-" if amount < 0 else "+"
    cents = int(abs(amount) * Decimal("100"))
    digits = str(cents)
    if len(digits) > width - 1:
        raise ValueError("Importe fuera del rango del registro educativo")
    return sign + digits.zfill(width - 1)


def _record(*parts: str) -> str:
    value = "".join(parts)
    if len(value) > RECORD_LENGTH:
        raise ValueError("El registro educativo supera la longitud fija configurada")
    return value.ljust(RECORD_LENGTH)


def _declaration_type_code(value: str) -> str:
    return {"ordinary": "O", "complementary": "C", "substitutive": "S"}.get(value, "O")


def _recipient_name(recipient: dict) -> str:
    return " ".join(
        part.strip()
        for part in [recipient.get("surname"), recipient.get("name")]
        if part and part.strip()
    )


def validate_fixed_width_records(snapshot: dict) -> list[dict]:
    errors: list[dict] = []
    company_nif = normalize_nif(snapshot.get("company", {}).get("nif"))
    if not NIF_PATTERN.fullmatch(company_nif):
        errors.append(
            {
                "record": 1,
                "code": "DECLARANT_NIF_FORMAT",
                "message": "El NIF del declarante no tiene nueve posiciones alfanuméricas.",
            }
        )

    for index, recipient in enumerate(snapshot.get("recipients") or [], start=2):
        nif = normalize_nif(recipient.get("nif"))
        if not NIF_PATTERN.fullmatch(nif):
            errors.append(
                {
                    "record": index,
                    "code": "RECIPIENT_NIF_FORMAT",
                    "message": f"El NIF {nif or 'vacío'} no tiene nueve posiciones alfanuméricas.",
                    "recipient_key": recipient.get("recipient_key"),
                }
            )
        if not recipient.get("key"):
            errors.append(
                {
                    "record": index,
                    "code": "RECIPIENT_KEY_REQUIRED",
                    "message": "El registro de perceptor no contiene clave.",
                    "recipient_key": recipient.get("recipient_key"),
                }
            )
        if recipient.get("key") == "G" and not recipient.get("subkey"):
            errors.append(
                {
                    "record": index,
                    "code": "RECIPIENT_SUBKEY_REQUIRED",
                    "message": "La clave G requiere subclave en el fichero educativo.",
                    "recipient_key": recipient.get("recipient_key"),
                }
            )
    return errors


def build_fixed_width_file(snapshot: dict) -> dict:
    totals = snapshot["totals"]
    company = snapshot["company"]
    recipients = snapshot.get("recipients") or []
    marker = _text("SIMULACION EDUCATIVA - NO PRESENTABLE ANTE LA AEAT", 142)
    records = [
        _record(
            "1",
            "190",
            str(snapshot["year"]).zfill(4),
            _text(normalize_nif(company.get("nif")), 9),
            _text(company.get("name"), 40),
            _declaration_type_code(snapshot.get("declaration_type", "ordinary")),
            str(len(recipients)).zfill(5),
            _signed_cents(totals.get("total_cash_income")),
            _signed_cents(totals.get("total_withholding")),
            _signed_cents(totals.get("total_deductible_expenses")),
            marker,
        )
    ]

    for recipient in recipients:
        records.append(
            _record(
                "2",
                _text(normalize_nif(recipient.get("nif")), 9),
                _text(_recipient_name(recipient), 40),
                _text(recipient.get("key"), 1),
                _text(recipient.get("subkey"), 2),
                str(recipient.get("accrual_year") or snapshot["year"]).zfill(4)[-4:],
                _text(recipient.get("province_code"), 2),
                _signed_cents(recipient.get("cash_income")),
                _signed_cents(recipient.get("cash_withholding")),
                _signed_cents(recipient.get("deductible_expenses")),
                _signed_cents(recipient.get("in_kind_income")),
                _signed_cents(recipient.get("in_kind_payment_on_account")),
                _signed_cents(recipient.get("reductions")),
                _text("SIMULACION EDUCATIVA", 101),
            )
        )

    content = "\r\n".join(records) + "\r\n"
    errors = validate_fixed_width_records(snapshot)
    return {
        "format": "fixed_width",
        "version": FILE_VERSION,
        "filename": f"modelo-190-{snapshot['year']}-{snapshot['company']['nif']}-simulado.txt",
        "content": content,
        "record_length": RECORD_LENGTH,
        "record_count": len(records),
        "validation_errors": errors,
        "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "presentable": False,
    }


def build_readable_file(snapshot: dict) -> dict:
    totals = snapshot["totals"]
    company = snapshot["company"]
    lines = [
        "SIMULACION EDUCATIVA | MODELO 190 | NO PRESENTABLE ANTE LA AEAT",
        (
            f"TIPO 1 | DECLARANTE | {company['nif']} | {company['name']} | {snapshot['year']} | "
            f"{snapshot['declaration_type'].upper()} | {totals['total_recipients']} PERCEPTORES | "
            f"PERCEPCIONES {money(totals['total_cash_income'])} | "
            f"RETENCIONES {money(totals['total_withholding'])}"
        ),
    ]
    for recipient in snapshot.get("recipients") or []:
        lines.append(
            " | ".join(
                [
                    "TIPO 2",
                    normalize_nif(recipient.get("nif")),
                    _recipient_name(recipient),
                    str(recipient.get("key") or ""),
                    str(recipient.get("subkey") or ""),
                    str(recipient.get("accrual_year") or snapshot["year"]),
                    f"PERCEPCIONES {money(recipient.get('cash_income'))}",
                    f"RETENCIONES {money(recipient.get('cash_withholding'))}",
                    f"GASTOS {money(recipient.get('deductible_expenses'))}",
                ]
            )
        )
    content = "\n".join(lines) + "\n"
    return {
        "format": "readable",
        "version": FILE_VERSION,
        "filename": f"modelo-190-{snapshot['year']}-{snapshot['company']['nif']}-educativo.txt",
        "content": content,
        "record_count": len(lines) - 1,
        "validation_errors": [],
        "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "presentable": False,
    }


def build_model190_files(snapshot: dict) -> dict:
    return {
        "readable": build_readable_file(snapshot),
        "fixed_width": build_fixed_width_file(snapshot),
    }
