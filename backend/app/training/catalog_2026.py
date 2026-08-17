"""Catálogo formativo enriquecido para AN-GL-2026.

Une el blueprint estructural, la especificación pedagógica y las referencias
oficiales. No accede a base de datos y puede consumirse desde seeds, servicios,
API o tests de la Fase B.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .activity_specs_2026 import ACTIVITY_SPECS_2026
from .course_blueprint_2026 import COURSE_BLUEPRINT_2026
from .official_sources_2026 import OFFICIAL_SOURCES_2026


def _source_payload(source_code: str) -> dict[str, Any]:
    source = OFFICIAL_SOURCES_2026[source_code]
    return {"code": source_code, **deepcopy(source)}


def build_training_catalog_2026(*, include_source_metadata: bool = True) -> dict[str, Any]:
    """Devuelve una copia del curso con cada actividad enriquecida.

    El resultado es serializable y no modifica las constantes de definición.
    """
    catalog = deepcopy(COURSE_BLUEPRINT_2026)

    for block in catalog["blocks"]:
        for unit in block["units"]:
            for activity in unit["activities"]:
                code = activity["code"]
                activity.update(deepcopy(ACTIVITY_SPECS_2026[code]))
                activity["block_code"] = block["code"]
                activity["block_title"] = block["title"]
                activity["unit_code"] = unit["code"]
                activity["unit_title"] = unit["title"]
                if include_source_metadata:
                    activity["official_sources"] = [
                        _source_payload(source_code)
                        for source_code in activity["sources"]
                    ]

    return catalog


def list_training_activities_2026(*, include_source_metadata: bool = False) -> list[dict[str, Any]]:
    catalog = build_training_catalog_2026(include_source_metadata=include_source_metadata)
    return [
        activity
        for block in catalog["blocks"]
        for unit in block["units"]
        for activity in unit["activities"]
    ]


def get_training_activity_2026(code: str, *, include_source_metadata: bool = True) -> dict[str, Any] | None:
    normalized = str(code or "").strip().upper()
    return next(
        (
            activity
            for activity in list_training_activities_2026(include_source_metadata=include_source_metadata)
            if activity["code"] == normalized
        ),
        None,
    )


def training_dependency_graph_2026() -> dict[str, list[str]]:
    return {
        code: list(spec["prerequisites"])
        for code, spec in ACTIVITY_SPECS_2026.items()
    }
