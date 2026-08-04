from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.model190 import Model190Declaration, Tax190Key, Tax190Subkey
from app.schemas.model190 import Model190PresentationRequest
from app.services.model190_calculator import Model190DomainError, money, normalize_nif
from app.services.model190_declaration_service import (
    _declaration_query,
    _dump_json,
    _load_json,
    declaration_response,
)
from app.services.model190_file_service import NIF_PATTERN, RECORD_LENGTH


SIGNED_AMOUNT_PATTERN = re.compile(r"^[+-]\d{14}$")
TYPE_CODES = {"ordinary": "O", "complementary": "C", "substitutive": "S"}


def _error(record: int, code: str, message: str, *, field: str | None = None) -> dict:
    result = {"record": record, "code": code, "message": message}
    if field:
        result["field"] = field
    return result


def _signed_amount(value: str, record: int, field: str, errors: list[dict]) -> Decimal | None:
    if not SIGNED_AMOUNT_PATTERN.fullmatch(value):
        errors.append(
            _error(
                record,
                "AMOUNT_FORMAT_INVALID",
                f"El campo {field} no utiliza signo y catorce dígitos.",
                field=field,
            )
        )
        return None
    try:
        sign = Decimal("-1") if value[0] == "-" else Decimal("1")
        return money(sign * Decimal(value[1:]) / Decimal("100"))
    except (InvalidOperation, ValueError):
        errors.append(
            _error(
                record,
                "AMOUNT_FORMAT_INVALID",
                f"El campo {field} no contiene un importe válido.",
                field=field,
            )
        )
        return None


def _valid_catalogue(db: Session, year: int) -> tuple[set[str], set[tuple[str, str]]]:
    keys = {
        item.code
        for item in db.query(Tax190Key)
        .filter(
            Tax190Key.active.is_(True),
            Tax190Key.valid_from <= year,
            or_(Tax190Key.valid_to.is_(None), Tax190Key.valid_to >= year),
        )
        .all()
    }
    subkeys = {
        (item.key_code, item.code)
        for item in db.query(Tax190Subkey)
        .filter(
            Tax190Subkey.active.is_(True),
            Tax190Subkey.valid_from <= year,
            or_(Tax190Subkey.valid_to.is_(None), Tax190Subkey.valid_to >= year),
        )
        .all()
    }
    return keys, subkeys


def validate_model190_file_content(
    content: str,
    *,
    expected_year: int,
    expected_company_nif: str,
    expected_declaration_type: str,
    expected_recipients: int,
    expected_cash_income,
    expected_withholding,
    expected_deductible_expenses,
    valid_keys: set[str],
    valid_subkeys: set[tuple[str, str]],
    expected_sha256: str | None = None,
) -> dict:
    errors: list[dict] = []
    record_errors: dict[int, list[dict]] = {}
    calculated_sha256 = hashlib.sha256(content.encode("utf-8")).hexdigest()

    def add(item: dict) -> None:
        errors.append(item)
        record_errors.setdefault(item["record"], []).append(item)

    if expected_sha256 and calculated_sha256 != expected_sha256.lower():
        add(
            _error(
                0,
                "FILE_HASH_MISMATCH",
                "El fichero importado no coincide con el fichero congelado en AulaNomina.",
                field="sha256",
            )
        )

    records = content.splitlines()
    if not records:
        add(_error(0, "EMPTY_FILE", "El fichero no contiene registros."))
        return {
            "records_read": 0,
            "correct_records": 0,
            "error_records": 0,
            "errors": errors,
            "sha256": calculated_sha256,
            "can_present": False,
        }

    for number, record in enumerate(records, start=1):
        if len(record) != RECORD_LENGTH:
            add(
                _error(
                    number,
                    "RECORD_LENGTH_INVALID",
                    f"El registro tiene {len(record)} posiciones y debe tener {RECORD_LENGTH}.",
                    field="record_length",
                )
            )

    header = records[0]
    if len(header) >= RECORD_LENGTH:
        if header[0:1] != "1":
            add(_error(1, "HEADER_RECORD_TYPE", "El primer registro debe ser de tipo 1.", field="record_type"))
        if header[1:4] != "190":
            add(_error(1, "MODEL_CODE_INVALID", "El registro de declarante no corresponde al Modelo 190.", field="model"))
        if header[4:8] != str(expected_year).zfill(4):
            add(_error(1, "YEAR_MISMATCH", "El ejercicio del fichero no coincide con la declaración.", field="year"))

        header_nif = normalize_nif(header[8:17])
        expected_nif = normalize_nif(expected_company_nif)
        if not NIF_PATTERN.fullmatch(header_nif):
            add(_error(1, "DECLARANT_NIF_INVALID", "El NIF del declarante no tiene un formato válido.", field="nif"))
        elif header_nif != expected_nif:
            add(_error(1, "DECLARANT_NIF_MISMATCH", "El NIF del fichero no coincide con la empresa.", field="nif"))

        expected_type = TYPE_CODES.get(expected_declaration_type, "O")
        if header[57:58] != expected_type:
            add(_error(1, "DECLARATION_TYPE_MISMATCH", "El tipo de declaración del fichero no coincide.", field="declaration_type"))

        count_value = header[58:63]
        if not count_value.isdigit():
            add(_error(1, "RECIPIENT_COUNT_FORMAT", "El número de perceptores no es numérico.", field="recipient_count"))
        elif int(count_value) != expected_recipients:
            add(_error(1, "RECIPIENT_COUNT_MISMATCH", "El número de perceptores del fichero no coincide con el snapshot.", field="recipient_count"))

        for field, start, end, expected in (
            ("total_cash_income", 63, 78, expected_cash_income),
            ("total_withholding", 78, 93, expected_withholding),
            ("total_deductible_expenses", 93, 108, expected_deductible_expenses),
        ):
            field_errors: list[dict] = []
            parsed = _signed_amount(header[start:end], 1, field, field_errors)
            for item in field_errors:
                add(item)
            if parsed is not None and parsed != money(expected):
                add(
                    _error(
                        1,
                        "HEADER_AMOUNT_MISMATCH",
                        f"El campo {field} no coincide con la declaración congelada.",
                        field=field,
                    )
                )

        if "SIMULACION EDUCATIVA" not in header[108:250]:
            add(_error(1, "EDUCATIONAL_MARKER_MISSING", "Falta la marca de simulación educativa.", field="marker"))

    identities: set[tuple[str, str, str, str]] = set()
    for number, record in enumerate(records[1:], start=2):
        if len(record) < RECORD_LENGTH:
            continue
        if record[0:1] != "2":
            add(_error(number, "RECIPIENT_RECORD_TYPE", "El registro de perceptor debe ser de tipo 2.", field="record_type"))
            continue

        nif = normalize_nif(record[1:10])
        name = record[10:50].strip()
        key = record[50:51].strip()
        subkey = record[51:53].strip()
        accrual_text = record[53:57]

        if not NIF_PATTERN.fullmatch(nif):
            add(_error(number, "RECIPIENT_NIF_INVALID", "El NIF del perceptor no tiene un formato válido.", field="nif"))
        if not name:
            add(_error(number, "RECIPIENT_NAME_REQUIRED", "El registro no contiene nombre de perceptor.", field="name"))
        if key not in valid_keys:
            add(_error(number, "KEY_NOT_ALLOWED", f"La clave {key or 'vacía'} no está admitida para el ejercicio.", field="key"))
        if key == "G" and not subkey:
            add(_error(number, "SUBKEY_REQUIRED", "La clave G requiere subclave.", field="subkey"))
        elif subkey and (key, subkey) not in valid_subkeys:
            add(_error(number, "SUBKEY_INCOMPATIBLE", f"La subclave {subkey} no es compatible con la clave {key}.", field="subkey"))
        elif key == "A" and subkey:
            add(_error(number, "SUBKEY_INCOMPATIBLE", "La clave A no admite subclave en el catálogo educativo.", field="subkey"))

        if not accrual_text.isdigit():
            add(_error(number, "ACCRUAL_YEAR_FORMAT", "El ejercicio de devengo no es numérico.", field="accrual_year"))
        else:
            accrual_year = int(accrual_text)
            if accrual_year < 1900 or accrual_year > expected_year:
                add(_error(number, "ACCRUAL_YEAR_INVALID", "El ejercicio de devengo no es válido para la declaración.", field="accrual_year"))

        for field, start, end in (
            ("cash_income", 59, 74),
            ("cash_withholding", 74, 89),
            ("deductible_expenses", 89, 104),
            ("in_kind_income", 104, 119),
            ("in_kind_payment_on_account", 119, 134),
            ("reductions", 134, 149),
        ):
            field_errors = []
            _signed_amount(record[start:end], number, field, field_errors)
            for item in field_errors:
                add(item)

        identity = (nif, key, subkey, accrual_text)
        if identity in identities:
            add(_error(number, "DUPLICATE_RECIPIENT", "El fichero contiene un perceptor duplicado con la misma clave, subclave y devengo."))
        identities.add(identity)

        if "SIMULACION EDUCATIVA" not in record[149:250]:
            add(_error(number, "EDUCATIONAL_MARKER_MISSING", "Falta la marca de simulación educativa.", field="marker"))

    if len(records) - 1 != expected_recipients:
        add(_error(1, "PHYSICAL_RECORD_COUNT_MISMATCH", "El número físico de registros tipo 2 no coincide con la declaración."))

    error_record_numbers = {number for number in record_errors if number > 0}
    correct_records = sum(1 for number in range(1, len(records) + 1) if number not in error_record_numbers)
    return {
        "records_read": len(records),
        "correct_records": correct_records,
        "error_records": len(error_record_numbers),
        "errors": errors,
        "sha256": calculated_sha256,
        "can_present": not errors,
    }


def _get_declaration(db: Session, declaration_id: int) -> Model190Declaration:
    item = _declaration_query(db).filter(Model190Declaration.id == declaration_id).first()
    if item is None:
        raise Model190DomainError(
            "DECLARATION_NOT_FOUND",
            "Declaración del Modelo 190 no encontrada.",
            status_code=404,
        )
    return item


def validate_model190_import(db: Session, declaration_id: int) -> dict:
    item = _get_declaration(db, declaration_id)
    payload = _load_json(item.payload, {})
    fixed = (payload.get("files") or {}).get("fixed_width") or {}
    content = fixed.get("content")
    if not content:
        raise Model190DomainError(
            "MODEL190_FILE_NOT_FOUND",
            "La declaración no conserva un fichero fijo importable.",
            status_code=404,
        )

    valid_keys, valid_subkeys = _valid_catalogue(db, item.year)
    report = validate_model190_file_content(
        content,
        expected_year=item.year,
        expected_company_nif=item.company.cif if item.company else "",
        expected_declaration_type=item.declaration_type,
        expected_recipients=item.total_recipients,
        expected_cash_income=item.total_cash_income,
        expected_withholding=item.total_withholding,
        expected_deductible_expenses=item.total_deductible_expenses,
        valid_keys=valid_keys,
        valid_subkeys=valid_subkeys,
        expected_sha256=fixed.get("sha256"),
    )
    report.update(
        {
            "declaration_id": item.id,
            "status": item.status,
            "filename": fixed.get("filename"),
            "record_length": fixed.get("record_length", RECORD_LENGTH),
            "expected_records": int(item.total_recipients or 0) + 1,
            "already_presented": item.status == "presented",
            "can_present": report["can_present"] and item.status == "generated",
            "validated_at": datetime.utcnow(),
        }
    )
    return report


def _identifier(prefix: str, digits: int) -> str:
    return prefix + "".join(str(secrets.randbelow(10)) for _ in range(digits))


def present_model190_declaration(
    db: Session,
    declaration_id: int,
    request: Model190PresentationRequest,
) -> dict:
    item = _get_declaration(db, declaration_id)
    if item.status == "presented":
        raise Model190DomainError(
            "DECLARATION_ALREADY_PRESENTED",
            "La declaración ya está presentada y no puede enviarse de nuevo.",
            status_code=409,
        )
    if item.status != "generated":
        raise Model190DomainError(
            "INVALID_DECLARATION_STATUS",
            "Solo una declaración generada puede presentarse.",
            status_code=409,
        )

    report = validate_model190_import(db, declaration_id)
    if request.file_sha256.lower() != report["sha256"]:
        raise Model190DomainError(
            "FILE_HASH_MISMATCH",
            "La huella del fichero firmado no coincide con el fichero validado.",
            status_code=409,
            context={"expected_sha256": report["sha256"]},
        )
    if not report["can_present"]:
        raise Model190DomainError(
            "IMPORT_VALIDATION_FAILED",
            "El fichero contiene errores y no puede presentarse.",
            status_code=422,
            context={"validation": report},
        )
    if not request.confirm_information:
        raise Model190DomainError(
            "SIGNATURE_CONFIRMATION_REQUIRED",
            "Debes confirmar la declaración informativa antes de firmar y enviar.",
        )

    presented_at = datetime.utcnow()
    item.status = "presented"
    item.presented_at = presented_at
    item.locked = True
    item.receipt_number = _identifier("190", 12)
    item.csv = secrets.token_hex(12).upper()
    item.presentation_reference = (
        f"AULANOMINA-190-{item.year}-{item.id}-{secrets.token_hex(4).upper()}"
    )

    payload = _load_json(item.payload, {})
    payload["presentation"] = {
        "simulated": True,
        "presented_at": presented_at,
        "receipt_number": item.receipt_number,
        "csv": item.csv,
        "presentation_reference": item.presentation_reference,
        "file_sha256": report["sha256"],
        "filename": report["filename"],
        "records_read": report["records_read"],
        "correct_records": report["correct_records"],
        "error_records": report["error_records"],
        "signature": {
            "signer_name": request.signer_name,
            "certificate_alias": request.certificate_alias,
            "confirmation": request.confirm_information,
        },
    }
    item.payload = _dump_json(payload)
    db.commit()
    db.refresh(item)
    response = declaration_response(item)
    response["presentation_validation"] = report
    return response


def build_model190_error_report(db: Session, declaration_id: int) -> dict:
    report = validate_model190_import(db, declaration_id)
    lines = [
        "AULANOMINA | MODELO 190 | INFORME DE ERRORES DE IMPORTACION",
        "SIMULACION EDUCATIVA | SIN VALIDEZ FISCAL",
        f"Declaracion: {declaration_id}",
        f"Fichero: {report.get('filename') or 'sin nombre'}",
        f"Registros leidos: {report['records_read']}",
        f"Registros correctos: {report['correct_records']}",
        f"Registros con errores: {report['error_records']}",
        "",
    ]
    if report["errors"]:
        for item in report["errors"]:
            field = f" | Campo: {item['field']}" if item.get("field") else ""
            lines.append(
                f"Registro {item['record']} | {item['code']}{field} | {item['message']}"
            )
    else:
        lines.append("No se han detectado errores de importacion.")
    content = "\n".join(lines) + "\n"
    return {
        "filename": f"modelo-190-{declaration_id}-errores-simulados.txt",
        "content": content,
        "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "error_count": len(report["errors"]),
    }
