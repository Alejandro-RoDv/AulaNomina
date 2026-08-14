"""Catálogo formativo versionado de AulaNomina.

La Fase A mantiene el temario maestro y sus fuentes separado del motor de casos
actual. La integración con actividades ejecutables se realizará en la Fase B.
"""

from .course_blueprint_2026 import COURSE_BLUEPRINT_2026, blueprint_summary
from .official_sources_2026 import OFFICIAL_SOURCES_2026

__all__ = ["COURSE_BLUEPRINT_2026", "OFFICIAL_SOURCES_2026", "blueprint_summary"]
