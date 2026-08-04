from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.model111 import Model111Declaration, Model111Line
from app.services.model190_calculator import (
    Model190DomainError,
    build_model190_preview,
    money,
    normalize_nif,
)


QUARTERS = ("1T", "2T", "3T", "4T")
CATEGORIES = ("work", "economic_activity")
CATEGORY_LABELS = {
    "work": "Rendimientos del trabajo",
    "economic_activity": "Actividades económicas",
}
ZERO = Decimal("0.00")


def _empty_amounts() -> dict[str, Any]:
    return {
        "income": ZERO,
        "withholding": ZERO,
        "documents": 0,
        "recipients": 0,
    }


def _empty_category_map() -> dict[str, dict[str, Any]]:
    return {category: _empty_amounts() for category in CATEGORIES}


def _normalize_source_type(value: str | None) -> str:
    normalized = (value or "other").strip().lower()
    if normalized in {"adjustment", "arrears", "regularization", "tax_adjustment"}:
        return "tax_adjustment"
    return normalized


def _line_category(line: dict) -> str:
    category = line.get("category")
    if category in CATEGORIES:
        return category
    return "economic_activity" if line.get("recipient_type") == "professional" else "work"


def _source_identity(line: dict) -> tuple:
    source_type = _normalize_source_type(line.get("source_type"))
    source_id = line.get("source_id")
    if source_id is not None:
        return source_type, int(source_id)
    return (
        source_type,
        str(line.get("source_date") or ""),
        normalize_nif(line.get("recipient_nif") or line.get("nif")),
        money(line.get("base_amount") if "base_amount" in line else line.get("gross_amount")),
        money(line.get("withholding_amount")),
    )


def _serialize_source_line(line: dict, *, origin: str) -> dict:
    return {
        "origin": origin,
        "category": _line_category(line),
        "source_type": _normalize_source_type(line.get("source_type")),
        "source_id": line.get("source_id"),
        "source_label": line.get("source_label") or "",
        "source_date": line.get("source_date"),
        "recipient_nif": normalize_nif(line.get("recipient_nif") or line.get("nif")),
        "recipient_name": line.get("recipient_name") or line.get("name") or "",
        "income": money(line.get("base_amount") if "base_amount" in line else line.get("gross_amount")),
        "withholding": money(line.get("withholding_amount")),
        "quarter": line.get("quarter"),
    }


def _flatten_model190_lines(preview: dict) -> list[dict]:
    lines: list[dict] = []
    for recipient in preview.get("recipients", []):
        for item in recipient.get("lines", []):
            line = dict(item)
            line.setdefault("recipient_type", recipient.get("recipient_type"))
            line.setdefault("recipient_nif", recipient.get("nif"))
            line.setdefault("recipient_name", recipient.get("name"))
            line.setdefault("nif", recipient.get("nif"))
            line.setdefault("name", recipient.get("name"))
            line.setdefault("surname", recipient.get("surname"))
            lines.append(line)
    return lines


def _declaration_sort_key(item: Model111Declaration) -> tuple[datetime, int]:
    return item.presented_at or item.generated_at or item.created_at or datetime.min, item.id or 0


def _declaration_metadata(item: Model111Declaration) -> dict:
    return {
        "id": item.id,
        "period": item.period,
        "declaration_type": item.declaration_type,
        "status": item.status,
        "generated_at": item.generated_at,
        "presented_at": item.presented_at,
        "receipt_number": item.receipt_number,
        "csv": item.csv,
        "locked": item.locked,
    }


def _select_model111_declaration(
    declarations: list[Model111Declaration],
) -> tuple[Model111Declaration | None, Model111Declaration | None]:
    presented = sorted(
        [item for item in declarations if item.status == "presented"],
        key=_declaration_sort_key,
    )
    pending = sorted(
        [item for item in declarations if item.status not in {"presented", "cancelled"}],
        key=_declaration_sort_key,
    )
    return (presented[-1] if presented else None, pending[-1] if pending else None)


def _model111_amounts(declaration: Model111Declaration | None) -> dict[str, dict[str, Any]]:
    result = _empty_category_map()
    if declaration is None:
        return result

    result["work"].update(
        {
            "income": money(declaration.work_base),
            "withholding": money(declaration.work_withholding),
            "recipients": int(declaration.work_perceptors or 0),
            "documents": len([line for line in declaration.lines if line.category == "work"]),
        }
    )
    result["economic_activity"].update(
        {
            "income": money(declaration.professional_base),
            "withholding": money(declaration.professional_withholding),
            "recipients": int(declaration.professional_perceptors or 0),
            "documents": len(
                [line for line in declaration.lines if line.category == "economic_activity"]
            ),
        }
    )
    return result


def _operation_amounts(lines: list[dict]) -> dict[str, dict[str, Any]]:
    result = _empty_category_map()
    recipient_sets: dict[str, set[str]] = {category: set() for category in CATEGORIES}

    for line in lines:
        category = _line_category(line)
        result[category]["income"] += money(line.get("gross_amount"))
        result[category]["withholding"] += money(line.get("withholding_amount"))
        result[category]["documents"] += 1
        recipient_nif = normalize_nif(line.get("recipient_nif") or line.get("nif"))
        if recipient_nif:
            recipient_sets[category].add(recipient_nif)

    for category in CATEGORIES:
        result[category]["income"] = money(result[category]["income"])
        result[category]["withholding"] = money(result[category]["withholding"])
        result[category]["recipients"] = len(recipient_sets[category])
    return result


def _differences(
    operations: dict[str, dict[str, Any]],
    model111: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    result = {}
    for category in CATEGORIES:
        result[category] = {
            "income": money(operations[category]["income"] - model111[category]["income"]),
            "withholding": money(
                operations[category]["withholding"] - model111[category]["withholding"]
            ),
            "documents": operations[category]["documents"] - model111[category]["documents"],
            "recipients": operations[category]["recipients"] - model111[category]["recipients"],
        }
    return result


def _line_map(lines: list[dict]) -> dict[tuple, list[dict]]:
    result: dict[tuple, list[dict]] = defaultdict(list)
    for line in lines:
        result[_source_identity(line)].append(line)
    return result


def _reconcile_documents(
    model190_lines: list[dict],
    model111_lines: list[Model111Line],
) -> dict[str, list[dict]]:
    model190_map = _line_map(model190_lines)
    model111_dicts = [
        {
            "category": item.category,
            "source_type": item.source_type,
            "source_id": item.source_id,
            "source_label": item.source_label,
            "source_date": item.source_date,
            "recipient_nif": item.recipient_nif,
            "recipient_name": item.recipient_name,
            "base_amount": item.base_amount,
            "withholding_amount": item.withholding_amount,
        }
        for item in model111_lines
    ]
    model111_map = _line_map(model111_dicts)

    only_model190 = []
    only_model111 = []
    amount_differences = []

    all_keys = set(model190_map) | set(model111_map)
    for key in sorted(all_keys, key=str):
        current_190 = model190_map.get(key, [])
        frozen_111 = model111_map.get(key, [])

        if not frozen_111:
            only_model190.extend(
                _serialize_source_line(item, origin="model190") for item in current_190
            )
            continue
        if not current_190:
            only_model111.extend(
                _serialize_source_line(item, origin="model111") for item in frozen_111
            )
            continue

        income_190 = money(sum((money(item.get("gross_amount")) for item in current_190), ZERO))
        withholding_190 = money(
            sum((money(item.get("withholding_amount")) for item in current_190), ZERO)
        )
        income_111 = money(
            sum((money(item.get("base_amount")) for item in frozen_111), ZERO)
        )
        withholding_111 = money(
            sum((money(item.get("withholding_amount")) for item in frozen_111), ZERO)
        )
        if income_190 != income_111 or withholding_190 != withholding_111:
            representative = current_190[0]
            amount_differences.append(
                {
                    "category": _line_category(representative),
                    "source_type": _normalize_source_type(representative.get("source_type")),
                    "source_id": representative.get("source_id"),
                    "source_label": representative.get("source_label") or "",
                    "recipient_nif": normalize_nif(
                        representative.get("recipient_nif") or representative.get("nif")
                    ),
                    "model190_income": income_190,
                    "model111_income": income_111,
                    "income_difference": money(income_190 - income_111),
                    "model190_withholding": withholding_190,
                    "model111_withholding": withholding_111,
                    "withholding_difference": money(withholding_190 - withholding_111),
                }
            )

    return {
        "only_in_model190": only_model190,
        "only_in_model111": only_model111,
        "amount_differences": amount_differences,
    }


def _group_by_recipient(
    model190_lines: list[dict],
    model111_lines: list[Model111Line],
) -> list[dict]:
    groups: dict[tuple[str, str], dict] = {}

    def ensure(category: str, nif: str, name: str = "") -> dict:
        key = category, nif
        return groups.setdefault(
            key,
            {
                "category": category,
                "category_label": CATEGORY_LABELS[category],
                "nif": nif,
                "name": name,
                "model190_income": ZERO,
                "model190_withholding": ZERO,
                "model111_income": ZERO,
                "model111_withholding": ZERO,
                "model190_documents": 0,
                "model111_documents": 0,
            },
        )

    for line in model190_lines:
        category = _line_category(line)
        nif = normalize_nif(line.get("recipient_nif") or line.get("nif"))
        item = ensure(category, nif, line.get("recipient_name") or line.get("name") or "")
        item["model190_income"] += money(line.get("gross_amount"))
        item["model190_withholding"] += money(line.get("withholding_amount"))
        item["model190_documents"] += 1

    for line in model111_lines:
        category = line.category
        nif = normalize_nif(line.recipient_nif)
        item = ensure(category, nif, line.recipient_name or "")
        item["model111_income"] += money(line.base_amount)
        item["model111_withholding"] += money(line.withholding_amount)
        item["model111_documents"] += 1

    result = []
    for item in groups.values():
        for field in (
            "model190_income",
            "model190_withholding",
            "model111_income",
            "model111_withholding",
        ):
            item[field] = money(item[field])
        item["income_difference"] = money(
            item["model190_income"] - item["model111_income"]
        )
        item["withholding_difference"] = money(
            item["model190_withholding"] - item["model111_withholding"]
        )
        item["is_balanced"] = (
            item["income_difference"] == ZERO
            and item["withholding_difference"] == ZERO
            and item["model190_documents"] == item["model111_documents"]
        )
        result.append(item)

    return sorted(result, key=lambda item: (item["category"], item["nif"], item["name"]))


def _group_by_source(
    model190_lines: list[dict],
    model111_lines: list[Model111Line],
) -> list[dict]:
    groups: dict[tuple[str, str], dict] = {}

    def ensure(category: str, source_type: str) -> dict:
        key = category, source_type
        return groups.setdefault(
            key,
            {
                "category": category,
                "category_label": CATEGORY_LABELS[category],
                "source_type": source_type,
                "model190_income": ZERO,
                "model190_withholding": ZERO,
                "model111_income": ZERO,
                "model111_withholding": ZERO,
                "model190_documents": 0,
                "model111_documents": 0,
            },
        )

    for line in model190_lines:
        category = _line_category(line)
        source_type = _normalize_source_type(line.get("source_type"))
        item = ensure(category, source_type)
        item["model190_income"] += money(line.get("gross_amount"))
        item["model190_withholding"] += money(line.get("withholding_amount"))
        item["model190_documents"] += 1

    for line in model111_lines:
        category = line.category
        source_type = _normalize_source_type(line.source_type)
        item = ensure(category, source_type)
        item["model111_income"] += money(line.base_amount)
        item["model111_withholding"] += money(line.withholding_amount)
        item["model111_documents"] += 1

    result = []
    for item in groups.values():
        for field in (
            "model190_income",
            "model190_withholding",
            "model111_income",
            "model111_withholding",
        ):
            item[field] = money(item[field])
        item["income_difference"] = money(
            item["model190_income"] - item["model111_income"]
        )
        item["withholding_difference"] = money(
            item["model190_withholding"] - item["model111_withholding"]
        )
        result.append(item)

    return sorted(result, key=lambda item: (item["category"], item["source_type"]))


def _quarter_alerts(
    quarter: str,
    declarations: list[Model111Declaration],
    effective: Model111Declaration | None,
    pending: Model111Declaration | None,
    differences: dict,
    documents: dict,
) -> list[dict]:
    alerts = []
    if not declarations:
        alerts.append(
            {
                "level": "warning",
                "code": "MODEL111_MISSING",
                "quarter": quarter,
                "message": f"No existe Modelo 111 para {quarter}",
            }
        )
    elif effective is None:
        alerts.append(
            {
                "level": "warning",
                "code": "MODEL111_NOT_PRESENTED",
                "quarter": quarter,
                "message": f"El Modelo 111 de {quarter} existe, pero no está presentado",
                "declaration_id": pending.id if pending else None,
            }
        )
    elif pending is not None and _declaration_sort_key(pending) > _declaration_sort_key(effective):
        alerts.append(
            {
                "level": "information",
                "code": "MODEL111_NEWER_PENDING_VERSION",
                "quarter": quarter,
                "message": f"Existe una versión posterior del Modelo 111 de {quarter} pendiente de presentar",
                "declaration_id": pending.id,
            }
        )

    for category in CATEGORIES:
        if differences[category]["income"] != ZERO:
            alerts.append(
                {
                    "level": "warning",
                    "code": "INCOME_DIFFERENCE",
                    "quarter": quarter,
                    "category": category,
                    "message": (
                        f"Diferencia de percepciones en {CATEGORY_LABELS[category]}: "
                        f"{differences[category]['income']}"
                    ),
                    "amount": differences[category]["income"],
                }
            )
        if differences[category]["withholding"] != ZERO:
            alerts.append(
                {
                    "level": "warning",
                    "code": "WITHHOLDING_DIFFERENCE",
                    "quarter": quarter,
                    "category": category,
                    "message": (
                        f"Diferencia de retenciones en {CATEGORY_LABELS[category]}: "
                        f"{differences[category]['withholding']}"
                    ),
                    "amount": differences[category]["withholding"],
                }
            )

    if documents["only_in_model190"]:
        alerts.append(
            {
                "level": "warning",
                "code": "DOCUMENTS_ONLY_IN_MODEL190",
                "quarter": quarter,
                "message": (
                    f"Hay {len(documents['only_in_model190'])} documento(s) incluidos en el Modelo 190 "
                    "que no aparecen en el Modelo 111 efectivo"
                ),
                "count": len(documents["only_in_model190"]),
            }
        )
    if documents["only_in_model111"]:
        alerts.append(
            {
                "level": "warning",
                "code": "DOCUMENTS_ONLY_IN_MODEL111",
                "quarter": quarter,
                "message": (
                    f"Hay {len(documents['only_in_model111'])} documento(s) declarados en el Modelo 111 "
                    "sin línea anual equivalente"
                ),
                "count": len(documents["only_in_model111"]),
            }
        )
    if documents["amount_differences"]:
        alerts.append(
            {
                "level": "warning",
                "code": "DOCUMENT_AMOUNT_DIFFERENCES",
                "quarter": quarter,
                "message": (
                    f"Hay {len(documents['amount_differences'])} documento(s) con importes distintos "
                    "entre los Modelos 111 y 190"
                ),
                "count": len(documents["amount_differences"]),
            }
        )
    return alerts


def _sum_category_maps(items: list[dict[str, dict[str, Any]]]) -> dict[str, dict[str, Any]]:
    result = _empty_category_map()
    for category_map in items:
        for category in CATEGORIES:
            result[category]["income"] += money(category_map[category]["income"])
            result[category]["withholding"] += money(category_map[category]["withholding"])
            result[category]["documents"] += int(category_map[category]["documents"])
            result[category]["recipients"] += int(category_map[category]["recipients"])
    for category in CATEGORIES:
        result[category]["income"] = money(result[category]["income"])
        result[category]["withholding"] = money(result[category]["withholding"])
    return result


def build_model190_reconciliation(db: Session, company_id: int, year: int) -> dict:
    company = db.query(Company).filter(Company.id == company_id).first()
    if company is None:
        raise Model190DomainError(
            "COMPANY_NOT_FOUND",
            "Empresa no encontrada",
            status_code=404,
        )

    preview = build_model190_preview(db, company_id, year)
    model190_lines = _flatten_model190_lines(preview)
    declarations = (
        db.query(Model111Declaration)
        .options(joinedload(Model111Declaration.lines))
        .filter(
            Model111Declaration.company_id == company_id,
            Model111Declaration.year == year,
            Model111Declaration.period.in_(QUARTERS),
            Model111Declaration.status != "cancelled",
        )
        .all()
    )
    declarations_by_quarter = {
        quarter: [item for item in declarations if item.period == quarter]
        for quarter in QUARTERS
    }

    quarter_results = []
    all_alerts = []
    annual_only_model190 = []
    annual_only_model111 = []
    annual_amount_differences = []

    for quarter in QUARTERS:
        quarter_lines = [line for line in model190_lines if line.get("quarter") == quarter]
        quarter_declarations = declarations_by_quarter[quarter]
        effective, pending = _select_model111_declaration(quarter_declarations)
        effective_lines = list(effective.lines) if effective is not None else []

        operations = _operation_amounts(quarter_lines)
        model111 = _model111_amounts(effective)
        differences = _differences(operations, model111)
        documents = _reconcile_documents(quarter_lines, effective_lines)
        alerts = _quarter_alerts(
            quarter,
            quarter_declarations,
            effective,
            pending,
            differences,
            documents,
        )
        all_alerts.extend(alerts)
        annual_only_model190.extend(documents["only_in_model190"])
        annual_only_model111.extend(documents["only_in_model111"])
        annual_amount_differences.extend(documents["amount_differences"])

        is_balanced = (
            all(
                differences[category]["income"] == ZERO
                and differences[category]["withholding"] == ZERO
                for category in CATEGORIES
            )
            and not documents["only_in_model190"]
            and not documents["only_in_model111"]
            and not documents["amount_differences"]
        )

        quarter_results.append(
            {
                "quarter": quarter,
                "operations": operations,
                "model111": model111,
                "differences": differences,
                "is_balanced": is_balanced,
                "declaration": _declaration_metadata(effective) if effective else None,
                "pending_declaration": _declaration_metadata(pending) if pending else None,
                "declarations": [
                    _declaration_metadata(item)
                    for item in sorted(quarter_declarations, key=_declaration_sort_key)
                ],
                "documents": documents,
                "drill_down": {
                    "recipients": _group_by_recipient(quarter_lines, effective_lines),
                    "sources": _group_by_source(quarter_lines, effective_lines),
                },
                "alerts": alerts,
            }
        )

    annual_operations = _sum_category_maps(
        [quarter["operations"] for quarter in quarter_results]
    )
    annual_model111 = _sum_category_maps(
        [quarter["model111"] for quarter in quarter_results]
    )
    annual_differences = _differences(annual_operations, annual_model111)
    annual_balanced = all(quarter["is_balanced"] for quarter in quarter_results)

    return {
        "company_id": company_id,
        "company_name": company.name,
        "year": year,
        "quarters": quarter_results,
        "annual": {
            "operations": annual_operations,
            "model111": annual_model111,
            "differences": annual_differences,
            "is_balanced": annual_balanced,
        },
        "alerts": all_alerts,
        "alert_summary": {
            "warnings": len([item for item in all_alerts if item["level"] == "warning"]),
            "information": len(
                [item for item in all_alerts if item["level"] == "information"]
            ),
        },
        "unmatched_documents": {
            "only_in_model190": annual_only_model190,
            "only_in_model111": annual_only_model111,
            "amount_differences": annual_amount_differences,
        },
        "model190_source_count": preview["source_count"],
    }
