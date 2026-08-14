"""Catálogo formativo versionado de AulaNomina.

La Fase A mantiene temario, fuentes y especificaciones pedagógicas separados del
motor de casos actual. La integración con actividades ejecutables corresponde a
la Fase B.
"""

from .activity_specs_2026 import ACTIVITY_SPECS_2026, activity_spec
from .catalog_2026 import (
    build_training_catalog_2026,
    get_training_activity_2026,
    list_training_activities_2026,
    training_dependency_graph_2026,
)
from .course_blueprint_2026 import COURSE_BLUEPRINT_2026, blueprint_summary
from .official_sources_2026 import OFFICIAL_SOURCES_2026

__all__ = [
    "ACTIVITY_SPECS_2026",
    "COURSE_BLUEPRINT_2026",
    "OFFICIAL_SOURCES_2026",
    "activity_spec",
    "blueprint_summary",
    "build_training_catalog_2026",
    "get_training_activity_2026",
    "list_training_activities_2026",
    "training_dependency_graph_2026",
]
