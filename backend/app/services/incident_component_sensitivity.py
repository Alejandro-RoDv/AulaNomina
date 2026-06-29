from __future__ import annotations

from decimal import Decimal
from typing import Any


COMPONENT_FIELDS = (
    "salary_supplements",
    "seniority_amount",
    "variable_incentives",
    "extra_pay_proration",
)

MAINTAIN_ALL = {field: "maintain" for field in COMPONENT_FIELDS}

DEFAULT_SENSITIVITY_BY_KIND: dict[str, dict[str, Any]] = {
    "normal_work": MAINTAIN_ALL,
    "unconfigured": MAINTAIN_ALL,
    "paid_time": MAINTAIN_ALL,
    "medical": MAINTAIN_ALL,
    "unpaid_time": {
        "salary_supplements": "salary_percentage",
        "seniority_amount": "salary_percentage",
        "variable_incentives": "worked",
        "extra_pay_proration": "salary_percentage",
    },
}


def sensitivity_modes(configuration: dict[str, Any], kind: str | None) -> dict[str, Any]:
    defaults = DEFAULT_SENSITIVITY_BY_KIND.get(kind or "", MAINTAIN_ALL)
    configured = configuration.get("concept_sensitivity") or {}
    return {
        field: configured.get(field, defaults.get(field, "maintain"))
        for field in COMPONENT_FIELDS
    }


def sensitivity_factor(
    mode: Any,
    *,
    salary_percentage: Decimal,
    segment_type: str,
) -> Decimal:
    if isinstance(mode, dict):
        mode_name = str(mode.get("mode") or "maintain").lower()
        if mode_name in {"percentage", "fixed_percentage"}:
            raw = Decimal(str(mode.get("value") or 0))
            return max(Decimal("0"), min(Decimal("1"), raw / Decimal("100")))
        mode = mode_name

    if isinstance(mode, (int, float, Decimal)):
        raw = Decimal(str(mode))
        if raw > 1:
            raw = raw / Decimal("100")
        return max(Decimal("0"), min(Decimal("1"), raw))

    normalized = str(mode or "maintain").strip().lower()
    if normalized in {"maintain", "full", "keep"}:
        return Decimal("1")
    if normalized in {"salary", "salary_percentage", "proportional"}:
        return max(Decimal("0"), min(Decimal("1"), salary_percentage))
    if normalized in {"worked", "worked_days", "normal_work"}:
        return Decimal("1") if segment_type == "normal_work" else Decimal("0")
    if normalized in {"exclude", "none", "zero"}:
        return Decimal("0")
    raise ValueError(f"Modo de sensibilidad salarial no soportado: {mode}")


def component_factors(
    configuration: dict[str, Any],
    *,
    kind: str | None,
    salary_percentage: Decimal,
    segment_type: str,
) -> tuple[dict[str, Decimal], dict[str, Any]]:
    modes = sensitivity_modes(configuration, kind)
    factors = {
        field: sensitivity_factor(
            modes[field],
            salary_percentage=salary_percentage,
            segment_type=segment_type,
        )
        for field in COMPONENT_FIELDS
    }
    return factors, modes
