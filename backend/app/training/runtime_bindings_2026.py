"""Bindings entre el Temario Maestro 2026 y el motor de casos ejecutables.

La Fase B migra el catálogo por secuencias controladas. Los bindings describen
qué operación ERP y qué regla de validación hacen ejecutable una práctica sin
duplicar su contenido pedagógico.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Iterable

from .catalog_2026 import get_training_activity_2026


PILOT_SEQUENCE_CODE = "onboarding-core-2026"
PILOT_ACTIVITY_CODES_2026 = ("A04", "A07", "A29")

PAYROLL_CORE_SEQUENCE_CODE = "payroll-core-2026"
PAYROLL_CORE_ACTIVITY_CODES_2026 = ("A14", "A16", "A18", "A20", "A21", "A22")


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
    "A14": {
        "module": "payrolls",
        "expected_action": "update_payroll_concept",
        "trigger_type": "module_event",
        "validation_rules": [
            {"type": "active_contract"},
            {"type": "payroll_concept_exists", "concept": "COMPLEMENTO_CONVENIO"},
        ],
        "runtime_prerequisites": [],
        "validation_interaction": "operation",
        "use_catalog_result_criteria": True,
        "migration_note": "El salario base está precargado; el alumno completa y revisa la estructura salarial aplicable.",
    },
    "A16": {
        "module": "payrolls",
        "expected_action": "recalculate_payroll",
        "trigger_type": "module_event",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-06"}],
        "runtime_prerequisites": ["A14"],
        "validation_interaction": "operation",
        "use_catalog_result_criteria": True,
        "migration_note": "A15 se considera resuelta por los datos del caso: pagas extraordinarias no prorrateadas.",
    },
    "A18": {
        "module": "payrolls",
        "expected_action": "review_payroll",
        "trigger_type": "system",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-06"}],
        "runtime_prerequisites": ["A16"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "La base se calcula en el motor; el alumno debe revisarla y solicitar la comprobación explícita.",
    },
    "A20": {
        "module": "payrolls",
        "expected_action": "review_payroll",
        "trigger_type": "system",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-06"}],
        "runtime_prerequisites": ["A18"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "A19 se trabajará después como comparación específica de bases; esta secuencia se centra en la aportación del trabajador.",
    },
    "A21": {
        "module": "payrolls",
        "expected_action": "review_payroll",
        "trigger_type": "system",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-06"}],
        "runtime_prerequisites": ["A20"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "La retención aplicada procede del perfil fiscal y del algoritmo IRPF 2026 ya integrado en nómina.",
    },
    "A22": {
        "module": "payrolls",
        "expected_action": "review_payroll",
        "trigger_type": "system",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-06"}],
        "runtime_prerequisites": ["A21"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "Cierra el itinerario distinguiendo bruto, líquido y coste total de empresa sobre la misma nómina calculada.",
    },
}


def get_runtime_binding_2026(activity_code: str) -> dict[str, Any] | None:
    code = str(activity_code or "").strip().upper()
    binding = RUNTIME_BINDINGS_2026.get(code)
    return deepcopy(binding) if binding else None


def build_runtime_task_definition_2026(
    activity_code: str,
    task_order: int,
    *,
    runtime_sequence: str = PILOT_SEQUENCE_CODE,
) -> dict[str, Any]:
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

    trigger_condition = {
        "training_code": code,
        "course_code": "AN-GL-2026",
        "course_version": "2026.1-phase-a",
        "runtime_sequence": runtime_sequence,
        "runtime_prerequisites": list(binding["runtime_prerequisites"]),
    }
    if binding.get("validation_interaction"):
        trigger_condition["validation_interaction"] = binding["validation_interaction"]
    if binding.get("use_catalog_result_criteria"):
        trigger_condition["use_catalog_result_criteria"] = True

    return {
        "title": activity["title"],
        "description": description or activity["learning_objective"],
        "module": binding["module"],
        "expected_result": activity["learning_objective"],
        "expected_action": binding["expected_action"],
        "trigger_type": binding["trigger_type"],
        "trigger_condition": trigger_condition,
        "validation_rules": deepcopy(binding["validation_rules"]),
        "feedback_config": {},
        "task_order": task_order,
        "is_required": True,
        "blocking": True,
        "status": "pending",
    }


def build_runtime_sequence_task_definitions_2026(
    activity_codes: Iterable[str],
    *,
    runtime_sequence: str,
) -> list[dict[str, Any]]:
    return [
        build_runtime_task_definition_2026(
            code,
            position,
            runtime_sequence=runtime_sequence,
        )
        for position, code in enumerate(activity_codes, start=1)
    ]


def build_pilot_task_definitions_2026() -> list[dict[str, Any]]:
    return build_runtime_sequence_task_definitions_2026(
        PILOT_ACTIVITY_CODES_2026,
        runtime_sequence=PILOT_SEQUENCE_CODE,
    )


def build_payroll_core_task_definitions_2026() -> list[dict[str, Any]]:
    return build_runtime_sequence_task_definitions_2026(
        PAYROLL_CORE_ACTIVITY_CODES_2026,
        runtime_sequence=PAYROLL_CORE_SEQUENCE_CODE,
    )
