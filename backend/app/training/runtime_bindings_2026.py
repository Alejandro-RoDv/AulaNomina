"""Bindings entre el Temario Maestro 2026 y el motor de casos ejecutables.

La Fase B comienza con una secuencia piloto deliberadamente pequeña:
A04 -> A07 -> A29. El objetivo es demostrar que el catálogo formativo puede
alimentar el motor de progreso/validación actual sin duplicar el contenido
pedagógico dentro de los casos demo.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .catalog_2026 import get_training_activity_2026


PILOT_SEQUENCE_CODE = "onboarding-core-2026"
PILOT_ACTIVITY_CODES_2026 = ("A04", "A07", "A29")


RUNTIME_BINDINGS_2026: dict[str, dict[str, Any]] = {
    "A04": {
        "module": "employees",
        "expected_action": "create_employee",
        "trigger_type": "module_event",
        "validation_rules": [{"type": "employee_profile_matches"}],
        "runtime_prerequisites": [],
        "migration_note": "La estructura de empresa se considera preparada en el entorno demo.",
    },
    "A07": {
        "module": "contracts",
        "expected_action": "create_contract",
        "trigger_type": "module_event",
        "validation_rules": [
            {
                "type": "active_contract",
                "contract_family": "indefinite",
            }
        ],
        "runtime_prerequisites": ["A04"],
        "migration_note": "La elección de modalidad A06 se da por resuelta en este piloto guiado.",
    },
    "A29": {
        "module": "affiliations",
        "expected_action": "prepare_affiliation",
        "trigger_type": "module_event",
        "validation_rules": [
            {
                "type": "affiliation_prepared",
                "registration_date": "2026-09-01",
            }
        ],
        "runtime_prerequisites": ["A07"],
        "migration_note": "La revisión previa A28 se integra en los datos y criterios del ejercicio piloto.",
    },
}


def get_runtime_binding_2026(activity_code: str) -> dict[str, Any] | None:
    code = str(activity_code or "").strip().upper()
    binding = RUNTIME_BINDINGS_2026.get(code)
    return deepcopy(binding) if binding else None


def build_runtime_task_definition_2026(activity_code: str, task_order: int) -> dict[str, Any]:
    """Convierte una actividad del catálogo en una definición compatible con CaseTaskCreate."""
    code = str(activity_code or "").strip().upper()
    activity = get_training_activity_2026(code, include_source_metadata=False)
    binding = get_runtime_binding_2026(code)
    if activity is None or binding is None:
        raise ValueError(f"La actividad {code!r} no dispone de binding ejecutable 2026")

    expected_actions = list(activity.get("expected_actions") or [])
    description = ". ".join(action.rstrip(".") for action in expected_actions if action).strip()
    if description and not description.endswith("."):
        description += "."

    return {
        "title": activity["title"],
        "description": description or activity["learning_objective"],
        "module": binding["module"],
        "expected_result": activity["learning_objective"],
        "expected_action": binding["expected_action"],
        "trigger_type": binding["trigger_type"],
        "trigger_condition": {
            "training_code": code,
            "course_code": "AN-GL-2026",
            "course_version": "2026.1-phase-a",
            "runtime_sequence": PILOT_SEQUENCE_CODE,
            "runtime_prerequisites": list(binding["runtime_prerequisites"]),
        },
        "validation_rules": deepcopy(binding["validation_rules"]),
        "feedback_config": {},
        "task_order": task_order,
        "is_required": True,
        "blocking": True,
        "status": "pending",
    }


def build_pilot_task_definitions_2026() -> list[dict[str, Any]]:
    return [
        build_runtime_task_definition_2026(code, position)
        for position, code in enumerate(PILOT_ACTIVITY_CODES_2026, start=1)
    ]
