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
PAYROLL_CORE_ACTIVITY_CODES_2026 = (
    "A14",
    "A15",
    "A16",
    "A18",
    "A19",
    "A20",
    "A21",
    "A22",
)

PAYROLL_PARTIAL_SEQUENCE_CODE = "payroll-partial-period-2026"
PAYROLL_PARTIAL_ACTIVITY_CODES_2026 = ("A17",)

INCIDENT_ACTIVITY_CODES_2026 = ("A23", "A24", "A25", "A26", "A27")
SOCIAL_SECURITY_ACTIVITY_CODES_2026 = ("A28", "A29", "A30", "A31", "A32", "A33", "A34", "A35")
FISCAL_ACTIVITY_CODES_2026 = ("A36", "A37", "A38", "A39", "A40", "A41")


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
        "migration_note": "La revisión A28 existe como práctica independiente; el piloto de incorporación mantiene A29 encadenada directamente tras el contrato.",
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
    "A15": {
        "module": "contracts",
        "expected_action": "review_extra_pay",
        "trigger_type": "system",
        "validation_rules": [{"type": "active_contract"}],
        "runtime_prerequisites": ["A14"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "El alumno cambia el contrato a 12 pagas prorrateadas y después solicita una comprobación del estado resultante.",
    },
    "A16": {
        "module": "payrolls",
        "expected_action": "recalculate_payroll",
        "trigger_type": "module_event",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-06"}],
        "runtime_prerequisites": ["A15"],
        "validation_interaction": "operation",
        "use_catalog_result_criteria": True,
        "migration_note": "La nómina ordinaria se calcula ya con la modalidad de pagas configurada en A15.",
    },
    "A17": {
        "module": "payrolls",
        "expected_action": "review_partial_payroll",
        "trigger_type": "system",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-01"}],
        "runtime_prerequisites": ["A16"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "Se ejecuta como caso independiente sobre un alta dentro del mes para no alterar la nómina ordinaria del itinerario principal.",
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
    "A19": {
        "module": "payrolls",
        "expected_action": "review_payroll",
        "trigger_type": "system",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-06"}],
        "runtime_prerequisites": ["A18"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "La actividad compara base común y profesional y explica la diferencia mediante conceptos exclusivos de contingencias profesionales, especialmente horas extraordinarias.",
    },
    "A20": {
        "module": "payrolls",
        "expected_action": "review_payroll",
        "trigger_type": "system",
        "validation_rules": [{"type": "payroll_recalculated", "period": "2026-06"}],
        "runtime_prerequisites": ["A19"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "La revisión de cuotas parte de las bases ya comprobadas en A18 y A19.",
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
    "A23": {
        "module": "incidents",
        "expected_action": "create_incident",
        "trigger_type": "module_event",
        "validation_rules": [{"type": "incident_exists", "incident_type": "IT"}],
        "runtime_prerequisites": ["A16"],
        "migration_note": "Se ejecuta en tres subpasos: alta de IT común, conciliación FIE y revisión del efecto en nómina.",
    },
    "A24": {
        "module": "incidents",
        "expected_action": "create_incident",
        "trigger_type": "module_event",
        "validation_rules": [{"type": "incident_exists", "incident_type": "IT"}],
        "runtime_prerequisites": ["A23"],
        "migration_note": "La contingencia profesional se guarda en details.process_type y se revisa después contra el cálculo de nómina.",
    },
    "A25": {
        "module": "incidents",
        "expected_action": "create_incident",
        "trigger_type": "module_event",
        "validation_rules": [{"type": "incident_exists", "incident_type": "VACACIONES"}],
        "runtime_prerequisites": ["A04"],
        "migration_note": "El motor de incidencias ya impide solapamientos incompatibles; un segundo subpaso comprueba el intervalo completo.",
    },
    "A26": {
        "module": "incidents",
        "expected_action": "create_incident",
        "trigger_type": "module_event",
        "validation_rules": [{"type": "incident_exists", "incident_type": "PERMISO_NO_RETRIBUIDO"}],
        "runtime_prerequisites": ["A16"],
        "migration_note": "La ausencia se registra como no retribuida y la revisión comprueba días no cotizados e impacto económico.",
    },
    "A27": {
        "module": "contracts",
        "expected_action": "review_workday_change",
        "trigger_type": "system",
        "validation_rules": [{"type": "active_contract"}],
        "runtime_prerequisites": ["A12", "A16"],
        "migration_note": "Se valida bajo demanda tras modificar la jornada y de nuevo tras recalcular el periodo afectado.",
    },
    "A28": {
        "module": "affiliations",
        "expected_action": "review_affiliation_data",
        "trigger_type": "system",
        "validation_rules": [{"type": "employee_profile_matches"}, {"type": "active_contract"}],
        "runtime_prerequisites": ["A04"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "Comprueba expediente, NAF, empresa/CCC, contrato y fecha antes de generar cualquier movimiento RED.",
    },
    "A30": {
        "module": "affiliations",
        "expected_action": "review_affiliation_movement",
        "trigger_type": "system",
        "validation_rules": [{"type": "active_contract"}],
        "runtime_prerequisites": ["A29"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "Se practica una baja real del motor de remesas de afiliación para distinguirla de un alta o una modificación.",
    },
    "A31": {
        "module": "fie",
        "expected_action": "review_fie_content",
        "trigger_type": "system",
        "validation_rules": [{"type": "review_fie"}],
        "runtime_prerequisites": ["A28"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "La comunicación FIE formativa se prepara en estado recibido para que el alumno interprete trabajador, proceso y fechas.",
    },
    "A32": {
        "module": "fie",
        "expected_action": "review_fie_reconciliation",
        "trigger_type": "system",
        "validation_rules": [{"type": "reconcile_fie"}],
        "runtime_prerequisites": ["A31", "A23"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "Valida que la comparación FIE haya enlazado la comunicación con la incidencia exacta y sus fechas.",
    },
    "A33": {
        "module": "cra",
        "expected_action": "review_cra_file",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A16"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "El alumno genera el CRA desde nóminas reales del periodo y comprueba que contiene trabajadores y conceptos comunicables.",
    },
    "A34": {
        "module": "social-security",
        "expected_action": "review_social_security_settlement",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A18", "A20"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "La liquidación se revisa contra sus líneas nominales: trabajadores, bases, cuotas y total debido.",
    },
    "A35": {
        "module": "siltra",
        "expected_action": "review_siltra_cycle",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A34", "A33"],
        "validation_interaction": "explicit_review",
        "migration_note": "Usa el flujo CRA/SILTRA ya existente: rechazo didáctico, fichero corrector y segundo envío aceptado.",
    },
    "A36": {
        "module": "irpf",
        "expected_action": "review_model145_profile",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A04"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "Se contrasta el Modelo 145 documental con el perfil fiscal persistido del trabajador; no se infieren datos no comunicados.",
    },
    "A37": {
        "module": "irpf",
        "expected_action": "review_irpf_calculation",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A36"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "El validador vuelve a ejecutar el motor IRPF 2026 con el perfil guardado y contrasta el porcentaje aplicado.",
    },
    "A38": {
        "module": "irpf",
        "expected_action": "review_irpf_regularization",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A37"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "La práctica introduce un descendiente comunicado durante el ejercicio, recalcula el tipo y exige dejar trazabilidad de regularización.",
    },
    "A39": {
        "module": "tax",
        "expected_action": "review_professional_withholding",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A37"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "Usa Professional y ProfessionalInvoice del dominio del Modelo 111 para evitar mezclar perceptores profesionales con trabajadores en nómina.",
    },
    "A40": {
        "module": "model111",
        "expected_action": "review_model_111",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A21", "A39"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "La declaración se genera desde fuentes reales, se revisan cajas y líneas y se valida la presentación simulada bloqueada.",
    },
    "A41": {
        "module": "model190",
        "expected_action": "review_model_190",
        "trigger_type": "system",
        "validation_rules": [],
        "runtime_prerequisites": ["A40"],
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
        "migration_note": "El resumen anual se genera con perceptores reales y se contrasta con la conciliación 111/190 del ejercicio.",
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


def build_payroll_partial_task_definitions_2026() -> list[dict[str, Any]]:
    return build_runtime_sequence_task_definitions_2026(
        PAYROLL_PARTIAL_ACTIVITY_CODES_2026,
        runtime_sequence=PAYROLL_PARTIAL_SEQUENCE_CODE,
    )
