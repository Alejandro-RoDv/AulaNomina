from __future__ import annotations

import json
from typing import Any


def safe_trace(value: Any) -> dict:
    """Return a dict for payroll calculation traces stored as JSON/dict/string.

    Some local databases may contain JSON fields returned as serialized strings,
    depending on engine, seed path or previous schema patch. Services must not
    call `.get()` directly on unknown trace values.
    """

    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def trace_bool(trace: dict, key: str, fallback: bool) -> bool:
    """Read a boolean trace value accepting bools and common string forms."""

    if key not in trace:
        return bool(fallback)
    value = trace.get(key)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "si", "sí"}
    return bool(value)
