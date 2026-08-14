"""Catálogo formativo versionado de AulaNomina.

La Fase A mantiene temario, fuentes y especificaciones pedagógicas separados del
motor de casos actual. La integración con actividades ejecutables corresponde a
la Fase B.
"""

from .activity_specs_2026 import ACTIVITY_SPECS_2026, activity_spec
from .course_blueprint_2026 import COURSE_BLUEPRINT_2026, blueprint_summary
from .official_sources_2026 import OFFICIAL_SOURCES_2026

__all__ = [
    "ACTIVITY_SPECS_2026",
    "COURSE_BLUEPRINT_2026",
    "OFFICIAL_SOURCES_2026",
    "activity_spec",
    "blueprint_summary",
]
