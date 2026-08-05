from __future__ import annotations

from typing import Any

from app.models.case_study import CaseTask
from app.schemas.case_scenario import CaseContextEventCreate


FEEDBACK_KEYS = {"success", "pending", "error", "manual"}


def feedback_kind(
    payload: CaseContextEventCreate,
    validation: dict[str, Any] | None,
) -> str:
    if payload.operation_status == "error":
        return "error"
    if validation and validation.get("passed"):
        return "success"
    if validation and validation.get("manual_required"):
        return "manual"
    return "pending"


def render_configured_feedback(
    task: CaseTask,
    payload: CaseContextEventCreate,
    validation: dict[str, Any] | None,
    fallback: str,
) -> str:
    config = task.feedback_config or {}
    template = config.get(feedback_kind(payload, validation))
    if not isinstance(template, str) or not template.strip():
        return fallback

    failed_checks = [
        item.get("message", "")
        for item in (validation or {}).get("checks", [])
        if not item.get("passed")
    ]
    replacements = {
        "{accion}": payload.response_summary or payload.action_code or task.title,
        "{paso}": task.title,
        "{detalle}": " ".join(item for item in failed_checks[:2] if item),
    }
    rendered = template.strip()
    for placeholder, value in replacements.items():
        rendered = rendered.replace(placeholder, value or "")
    return rendered


def normalized_feedback_config(config: dict[str, Any] | None) -> dict[str, Any]:
    source = config or {}
    criteria = source.get("criteria") or []
    if isinstance(criteria, str):
        criteria = [line.strip() for line in criteria.splitlines() if line.strip()]
    return {
        "criteria": [str(item).strip() for item in criteria if str(item).strip()],
        **{
            key: str(source.get(key) or "").strip()
            for key in FEEDBACK_KEYS
            if str(source.get(key) or "").strip()
        },
    }
