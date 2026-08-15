"""Auditoría estática de la calidad de validación del Temario Maestro 2026.

La proyección del curso garantiza que existen las 60 prácticas. Este módulo añade
una segunda comprobación: cada práctica debe disponer de una ruta de validación
fiable y no depender de una confirmación manual silenciosa.

La auditoría no sustituye a los tests funcionales de cada dominio. Su objetivo es
hacer visibles los huecos de arquitectura y las comprobaciones deliberadamente
más débiles para poder endurecerlas antes de estabilizar el curso.
"""

from __future__ import annotations

import inspect
from collections import defaultdict
from types import SimpleNamespace
from typing import Any, Callable, Iterable

from app.crud.case_study import _demo_cases
from app.services.integrated_demo_case_service import TASK_DEFINITIONS as C02_TASK_DEFINITIONS
from app.services.training_course_projection_2026 import MASTER_ACTIVITY_CODES_2026
from app.services.training_payroll_structure_review_service import _review_a14, _review_a15
from app.training.document_runtime_cases_2026 import build_document_runtime_cases_2026
from app.training.fiscal_runtime_cases_2026 import build_fiscal_runtime_cases_2026
from app.training.foundation_runtime_cases_2026 import build_foundation_runtime_cases_2026
from app.training.hiring_runtime_cases_2026 import build_hiring_runtime_cases_2026
from app.training.incident_runtime_cases_2026 import build_incident_runtime_cases_2026
from app.training.integrated_runtime_cases_2026 import build_integrated_runtime_cases_2026
from app.training.regularization_runtime_cases_2026 import build_regularization_runtime_cases_2026
from app.training.social_security_runtime_cases_2026 import build_social_security_runtime_cases_2026
from app.training.termination_runtime_cases_2026 import build_termination_runtime_cases_2026


CaseBuilder = Callable[[], list[Any]]

RUNTIME_CASE_BUILDERS: tuple[CaseBuilder, ...] = (
    build_foundation_runtime_cases_2026,
    build_hiring_runtime_cases_2026,
    build_incident_runtime_cases_2026,
    build_social_security_runtime_cases_2026,
    build_fiscal_runtime_cases_2026,
    build_regularization_runtime_cases_2026,
    build_termination_runtime_cases_2026,
    build_document_runtime_cases_2026,
    build_integrated_runtime_cases_2026,
)

# A04 y A16 conservan deliberadamente el validador general: A04 compara el
# perfil completo del alta y A16 acredita la existencia de un cálculo real del
# periodo, cuyo contenido económico se revisa inmediatamente en A18-A22.
GENERIC_RULE_CODES_2026 = frozenset({"A04", "A16"})
SPECIALIZED_REVIEW_CODES_2026 = frozenset(
    set(MASTER_ACTIVITY_CODES_2026) - set(GENERIC_RULE_CODES_2026)
)

LEGACY_SCENARIO_CODES = {
    "ALT-2026-021": "A09",
    "LAB-2026-001": "C02",
}

GENERIC_SUPPORTED_ACTIONS = {
    "create_employee",
    "assign_employee",
    "create_contract",
    "prepare_affiliation",
    "review_contract",
    "update_payroll_concept",
    "recalculate_payroll",
    "create_regularization",
    "review_fie",
    "reconcile_fie",
    "reply_mail",
}


def _case_training_sequence(case_study: Any) -> list[str]:
    state = case_study.initial_state or {}
    return [
        str(code).strip().upper()
        for code in state.get("training_sequence") or []
        if str(code).strip()
    ]


def _task_training_code(case_study: Any, task: Any) -> str | None:
    explicit = (task.trigger_condition or {}).get("training_code")
    if explicit:
        return str(explicit).strip().upper()

    scenario_code = str(case_study.scenario_code or "").strip().upper()
    legacy = LEGACY_SCENARIO_CODES.get(scenario_code)
    if legacy == "A09":
        return "A09" if task.expected_action == "create_contract" else None
    if legacy:
        return legacy

    sequence = _case_training_sequence(case_study)
    return sequence[0] if len(sequence) == 1 else None


def _c02_case_definition() -> Any:
    return SimpleNamespace(
        scenario_code="LAB-2026-001",
        initial_state={},
        tasks=[
            SimpleNamespace(
                trigger_condition={},
                expected_action=definition.get("expected_action"),
                validation_rules=definition.get("validation_rules") or [],
            )
            for definition in C02_TASK_DEFINITIONS
        ],
    )


def _all_case_definitions() -> Iterable[Any]:
    for builder in RUNTIME_CASE_BUILDERS:
        yield from builder()
    yield from _demo_cases()
    # C02 se materializa mediante integrated_demo_case_service y no forma parte
    # del constructor de los otros capstones, por lo que se incorpora de forma
    # explícita al manifiesto estático.
    yield _c02_case_definition()


def _validation_path(code: str, task: Any) -> str:
    if code in SPECIALIZED_REVIEW_CODES_2026:
        return "specialized_review"

    rules = list(task.validation_rules or [])
    if rules:
        return "generic_rules"
    if str(task.expected_action or "").strip() in GENERIC_SUPPORTED_ACTIONS:
        return "generic_action_alias"
    return "manual_or_unsupported"


def _a14_amount_is_enforced() -> bool:
    source = inspect.getsource(_review_a14)
    return (
        "expected_concept_amount" in source
        and "actual_concept_amount" in source
        and "concept_amount_matches" in source
    )


def _a15_proration_is_enforced() -> bool:
    source = inspect.getsource(_review_a15)
    return (
        "resolve_monthly_extra_pay_proration" in source
        and "proration_total_amount" in source
        and "positive_proration_lines" in source
    )


def build_training_validation_quality_audit_2026() -> dict[str, Any]:
    tasks_by_code: dict[str, list[Any]] = defaultdict(list)
    for case_study in _all_case_definitions():
        for task in case_study.tasks or []:
            code = _task_training_code(case_study, task)
            if code in MASTER_ACTIVITY_CODES_2026:
                tasks_by_code[code].append(task)

    profiles: list[dict[str, Any]] = []
    manual_codes: list[str] = []
    missing_codes: list[str] = []

    for code in MASTER_ACTIVITY_CODES_2026:
        tasks = tasks_by_code.get(code, [])
        if not tasks:
            missing_codes.append(code)
            profiles.append(
                {
                    "code": code,
                    "task_count": 0,
                    "validation_paths": [],
                    "status": "missing_runtime",
                }
            )
            continue

        paths = sorted({_validation_path(code, task) for task in tasks})
        unsupported = "manual_or_unsupported" in paths
        if unsupported:
            manual_codes.append(code)
        profiles.append(
            {
                "code": code,
                "task_count": len(tasks),
                "validation_paths": paths,
                "status": "manual_or_unsupported" if unsupported else "validated",
            }
        )

    hardening_findings: list[dict[str, str]] = []
    if not _a14_amount_is_enforced():
        hardening_findings.append(
            {
                "code": "A14",
                "severity": "high",
                "finding": "El complemento se valida por existencia, no por el importe esperado del caso.",
            }
        )
    if not _a15_proration_is_enforced():
        hardening_findings.append(
            {
                "code": "A15",
                "severity": "high",
                "finding": "La actividad valida la modalidad de pagas, pero no comprueba que la prorrata mensual sea calculable y positiva.",
            }
        )

    scope_notes = [
        {
            "code": "A16",
            "scope": "A16 acredita la ejecución del cálculo ordinario del periodo; A18-A22 validan después bases, cuotas, IRPF, líquido y coste empresa.",
        },
        {
            "code": "A18",
            "scope": "La validación comprueba coherencia base diaria × días; no certifica mínimos/máximos normativos por grupo de cotización.",
        },
    ]

    return {
        "master_practices": len(MASTER_ACTIVITY_CODES_2026),
        "represented_practices": len(tasks_by_code),
        "specialized_review_practices": len(SPECIALIZED_REVIEW_CODES_2026),
        "generic_rule_practices": len(GENERIC_RULE_CODES_2026),
        "missing_codes": missing_codes,
        "manual_or_unsupported_codes": manual_codes,
        "hardening_findings": hardening_findings,
        "scope_notes": scope_notes,
        "profiles": profiles,
        "status": (
            "incomplete"
            if missing_codes or manual_codes
            else "hardening_required"
            if hardening_findings
            else "ready"
        ),
    }
