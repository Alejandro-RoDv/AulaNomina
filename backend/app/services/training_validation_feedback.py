"""Convierte la evidencia técnica de los validadores en correcciones útiles."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


FIELD_LABELS = {
    "activity": "la actividad o ejercicio",
    "agreement": "el convenio asignado",
    "amounts": "los importes",
    "annual_totals": "los totales anuales",
    "base": "la base de cotización",
    "ccc": "el CCC",
    "center": "el centro de trabajo",
    "children": "los datos familiares",
    "company": "la empresa",
    "contingency": "la contingencia",
    "content": "el contenido del documento",
    "contract": "el contrato",
    "current_salary": "el salario actual",
    "current_seniority": "la antigüedad actual",
    "date": "la fecha",
    "dates": "las fechas",
    "delta": "la diferencia calculada",
    "differences": "las diferencias calculadas",
    "document": "el documento",
    "employee": "el trabajador",
    "expiry": "la fecha de caducidad",
    "identity": "los datos identificativos",
    "indefinite": "el tipo de contrato indefinido",
    "issue": "la incidencia indicada",
    "job_position": "el puesto de trabajo",
    "lines": "las líneas del cálculo",
    "mobile": "el teléfono móvil",
    "months": "los meses incluidos",
    "naf": "el NAF",
    "original_months": "los meses de origen",
    "postal_code": "el código postal",
    "preview": "la previsualización del cálculo",
    "process": "el proceso generado",
    "rate": "el porcentaje aplicado",
    "regularization": "la regularización",
    "salary": "el salario",
    "source_links": "la trazabilidad con el origen",
    "start": "la fecha de inicio",
    "start_date": "la fecha de inicio",
    "status": "el estado",
    "statuses": "los estados",
    "target_total": "el total esperado",
    "terminal": "la fecha de fin",
    "total": "el importe total",
    "totals": "los totales",
    "trace_months": "los meses de trazabilidad",
    "type": "el tipo seleccionado",
    "withholding": "la retención",
    "worker_count": "el número de trabajadores",
    "workday": "la jornada",
}


def _criterion_name(key: str) -> str | None:
    suffixes = (
        "_matches_expected",
        "_corrected",
        "_preserved",
        "_ok",
    )
    name = key
    for suffix in suffixes:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    else:
        if key not in {"indefinite", "active", "workday", "job_position", "company", "center"}:
            return None
    return FIELD_LABELS.get(name, name.replace("_", " "))


def check_issues(check: dict[str, Any]) -> list[str]:
    evidence = check.get("evidence") if isinstance(check.get("evidence"), dict) else {}
    explicit = evidence.get("issues")
    if isinstance(explicit, list) and explicit:
        return [str(issue) for issue in explicit if str(issue).strip()]

    issues: list[str] = []
    for key, value in evidence.items():
        if value is not False:
            continue
        label = _criterion_name(str(key))
        if label:
            message = f"Revisa {label}."
            if message not in issues:
                issues.append(message)
    if not issues and check.get("message"):
        issues.append(str(check["message"]))
    return issues


def enrich_validation_result(result: Any) -> Any:
    if not isinstance(result, dict):
        return result
    enriched = deepcopy(result)
    all_issues: list[str] = []
    for check in enriched.get("checks") or []:
        if not isinstance(check, dict) or check.get("supported") is False or check.get("passed") is True:
            continue
        issues = check_issues(check)
        check["issues"] = issues
        for issue in issues:
            if issue not in all_issues:
                all_issues.append(issue)
    enriched["issues"] = all_issues
    return enriched
