"""Proyección estricta del runtime sobre el Temario Maestro AulaNomina 2026.

El motor histórico sigue conservando casos y tareas demo útiles para otras pantallas,
pero el Centro de Actividades no debe mezclarlos con las 60 prácticas del curso.
Esta capa elimina tareas legacy de la vista formativa, normaliza la numeración y
expone métricas de auditoría para detectar prácticas maestras sin runtime.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.services.training_activity_runtime_service import (
    build_activity_course as build_runtime_activity_course,
)
from app.training import list_training_activities_2026


MASTER_ACTIVITY_CATALOG_2026 = tuple(
    list_training_activities_2026(include_source_metadata=False)
)
MASTER_ACTIVITY_CODES_2026 = tuple(
    activity["code"] for activity in MASTER_ACTIVITY_CATALOG_2026
)
MASTER_ACTIVITY_ORDER_2026 = {
    code: index for index, code in enumerate(MASTER_ACTIVITY_CODES_2026, start=1)
}
MASTER_ACTIVITY_CODES_BY_BLOCK_2026: dict[str, tuple[str, ...]] = {
    block_code: tuple(
        activity["code"]
        for activity in MASTER_ACTIVITY_CATALOG_2026
        if activity["block_code"] == block_code
    )
    for block_code in {activity["block_code"] for activity in MASTER_ACTIVITY_CATALOG_2026}
}

# Estas prácticas registran primero la operación ERP y después pasan por una
# comprobación pedagógica más estricta que el validador genérico por existencia.
FORCE_EXPLICIT_REVIEW_CODES_2026 = frozenset({"A07", "A09", "A14", "A29", "C02"})

# A09 reutiliza el caso profesional de sustitución previo y C02 promueve el
# caso integral LAB-2026-001. Son las únicas fuentes no TRAIN-2026 canónicas.
ALLOWED_LEGACY_RUNTIME_SOURCES_2026 = {
    ("A09", "ALT-2026-021"),
    ("C02", "LAB-2026-001"),
}


def _count_runtime_cases(db: Session, scenario_codes: set[str]) -> int:
    from app.models.case_study import CaseStudy

    return (
        db.query(CaseStudy.scenario_code)
        .filter(CaseStudy.scenario_code.in_(sorted(scenario_codes)))
        .distinct()
        .count()
    )


def _ensure_master_runtime_availability_2026(db: Session) -> None:
    """Materializa únicamente los bloques runtime que falten en bases ya existentes.

    Split 43 puede ejecutarse sobre una base demo creada durante una fase anterior.
    En ese caso el catálogo maestro conoce A01-A54/C01-C06, pero algunos CaseStudy y
    CaseAssignment todavía no existen. El resultado era un bloque con contador
    (por ejemplo 0/6) pero sin filas al desplegarlo.

    La reparación evita un reset global: los casos completos no se reseedean. Solo
    se crean casos/asignaciones ausentes; los bootstraps que restauran datos base se
    ejecutan únicamente cuando un bloque tardío no existía en absoluto.
    """
    from app.training.document_runtime_bootstrap_2026 import bootstrap_document_training_2026
    from app.training.document_runtime_cases_2026 import (
        DOCUMENT_SCENARIO_CODES,
        seed_document_runtime_assignments_2026,
        seed_document_runtime_cases_2026,
    )
    from app.training.fiscal_runtime_cases_2026 import (
        FISCAL_SCENARIO_CODES,
        seed_fiscal_runtime_assignments_2026,
        seed_fiscal_runtime_cases_2026,
    )
    from app.training.foundation_runtime_cases_2026 import (
        seed_foundation_runtime_assignments_2026,
        seed_foundation_runtime_cases_2026,
    )
    from app.training.incident_runtime_cases_2026 import (
        INCIDENT_SCENARIO_CODES,
        ensure_training_incident_fie_2026,
        seed_incident_runtime_assignments_2026,
        seed_incident_runtime_cases_2026,
    )
    from app.training.integrated_runtime_bootstrap_2026 import bootstrap_integrated_training_2026
    from app.training.integrated_runtime_cases_2026 import (
        NEW_INTEGRATED_SCENARIOS,
        seed_integrated_runtime_assignments_2026,
        seed_integrated_runtime_cases_2026,
    )
    from app.training.regularization_reset_2026 import normalize_regularization_training_tables_2026
    from app.training.regularization_runtime_cases_2026 import (
        REGULARIZATION_SCENARIO_CODES,
        prepare_regularization_training_data_2026,
        seed_regularization_runtime_assignments_2026,
        seed_regularization_runtime_cases_2026,
    )
    from app.training.termination_runtime_bootstrap_2026 import bootstrap_termination_training_2026
    from app.training.termination_runtime_cases_2026 import (
        TERMINATION_SCENARIO_CODES,
        seed_termination_runtime_assignments_2026,
        seed_termination_runtime_cases_2026,
    )

    # B01 se reseedea de forma idempotente para que cambios pedagógicos del
    # esquema de respuesta lleguen también a bases creadas antes de la revisión.
    seed_foundation_runtime_cases_2026(db)
    seed_foundation_runtime_assignments_2026(db)

    incident_count = _count_runtime_cases(db, INCIDENT_SCENARIO_CODES)
    if incident_count < len(INCIDENT_SCENARIO_CODES):
        seed_incident_runtime_cases_2026(db)
        ensure_training_incident_fie_2026(db, reset=False)
    seed_incident_runtime_assignments_2026(db)

    fiscal_count = _count_runtime_cases(db, FISCAL_SCENARIO_CODES)
    if fiscal_count < len(FISCAL_SCENARIO_CODES):
        seed_fiscal_runtime_cases_2026(db)
    seed_fiscal_runtime_assignments_2026(db)

    regularization_count = _count_runtime_cases(db, REGULARIZATION_SCENARIO_CODES)
    if regularization_count < len(REGULARIZATION_SCENARIO_CODES):
        seed_regularization_runtime_cases_2026(db)
        if regularization_count == 0:
            normalize_regularization_training_tables_2026(db)
            prepare_regularization_training_data_2026(db)
    seed_regularization_runtime_assignments_2026(db)

    termination_count = _count_runtime_cases(db, TERMINATION_SCENARIO_CODES)
    if termination_count == 0:
        bootstrap_termination_training_2026(db)
    else:
        if termination_count < len(TERMINATION_SCENARIO_CODES):
            seed_termination_runtime_cases_2026(db)
        seed_termination_runtime_assignments_2026(db)

    document_count = _count_runtime_cases(db, DOCUMENT_SCENARIO_CODES)
    if document_count == 0:
        bootstrap_document_training_2026(db)
    else:
        if document_count < len(DOCUMENT_SCENARIO_CODES):
            seed_document_runtime_cases_2026(db)
        seed_document_runtime_assignments_2026(db)

    integrated_count = _count_runtime_cases(db, NEW_INTEGRATED_SCENARIOS)
    if integrated_count == 0:
        bootstrap_integrated_training_2026(db)
    else:
        if integrated_count < len(NEW_INTEGRATED_SCENARIOS):
            seed_integrated_runtime_cases_2026(db)
        seed_integrated_runtime_assignments_2026(db)


def _is_master_runtime_candidate(activity: dict[str, Any]) -> bool:
    code = str(activity.get("training_code") or "").strip().upper()
    if code not in MASTER_ACTIVITY_ORDER_2026 or not activity.get("runtime_migrated"):
        return False

    if not activity.get("runtime_binding_inferred"):
        return True

    scenario_code = str(activity.get("scenario_code") or "").strip().upper()
    if scenario_code.startswith("TRAIN-2026-"):
        return True

    return (code, scenario_code) in ALLOWED_LEGACY_RUNTIME_SOURCES_2026


def _source_key(activity: dict[str, Any]) -> tuple[str, str]:
    """Separa instancias duplicadas del mismo escenario por su asignación.

    Bases creadas durante migraciones intermedias pueden conservar más de un
    CaseStudy con el mismo scenario_code. Cada uno tiene una asignación distinta.
    Si agrupamos solo por scenario_code, sus tareas se concatenan y A36.1/A36.2
    aparecen dos veces. Una asignación representa una ejecución canónica completa.
    """
    assignment_id = str(activity.get("assignment_id") or "").strip()
    if assignment_id:
        return ("assignment", assignment_id)
    scenario_code = str(activity.get("scenario_code") or "").strip().upper()
    if scenario_code:
        return ("scenario", scenario_code)
    return ("activity", str(activity.get("id") or activity.get("task_id") or ""))


def _source_rank(items: list[dict[str, Any]]) -> tuple[int, int, int]:
    explicit = any(not item.get("runtime_binding_inferred") for item in items)
    scenario_code = str(items[0].get("scenario_code") or "").strip().upper() if items else ""
    course_order = min(int(item.get("course_order") or 999999) for item in items) if items else 999999
    return (
        0 if explicit else 1,
        0 if scenario_code.startswith("TRAIN-2026-") else 1,
        course_order,
    )


def _select_canonical_runtime_steps(
    activities: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    candidates = [activity for activity in activities if _is_master_runtime_candidate(activity)]
    by_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for activity in candidates:
        by_code[str(activity["training_code"]).upper()].append(activity)

    selected: list[dict[str, Any]] = []
    suppressed_duplicate_steps = 0
    for code, code_items in by_code.items():
        by_source: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        for activity in code_items:
            by_source[_source_key(activity)].append(activity)

        sources = list(by_source.values())
        sources.sort(key=_source_rank)
        selected.extend(sources[0])
        suppressed_duplicate_steps += sum(len(source) for source in sources[1:])

    selected.sort(
        key=lambda activity: (
            MASTER_ACTIVITY_ORDER_2026.get(str(activity.get("training_code") or "").upper(), 9999),
            int(activity.get("training_substep") or 0),
            int(activity.get("task_id") or 0),
        )
    )
    return selected, suppressed_duplicate_steps


def _normalise_activity_number(activity: dict[str, Any]) -> None:
    code = str(activity.get("training_code") or "").strip().upper()
    substep = activity.get("training_substep")
    activity["display_number"] = f"{code}.{substep}" if substep else code
    if code in FORCE_EXPLICIT_REVIEW_CODES_2026:
        activity["validation_interaction"] = "explicit_review"


def _completed_master_codes(activities: list[dict[str, Any]]) -> set[str]:
    by_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for activity in activities:
        code = str(activity.get("training_code") or "").strip().upper()
        if code:
            by_code[code].append(activity)
    return {
        code
        for code, steps in by_code.items()
        if steps and all(step.get("is_completed") for step in steps)
    }


def project_master_activity_course_2026(course: dict[str, Any]) -> dict[str, Any]:
    """Elimina ruido legacy y recalcula la vista del curso con numeración maestra."""
    all_runtime_steps = [
        activity
        for topic in course.get("topics", [])
        for activity in topic.get("activities", [])
    ]
    selected, suppressed_duplicate_steps = _select_canonical_runtime_steps(all_runtime_steps)
    selected_ids = {activity.get("id") for activity in selected}
    completed_codes = _completed_master_codes(selected)

    ordered_visible: list[dict[str, Any]] = []
    for topic in course.get("topics", []):
        visible = [
            activity
            for activity in topic.get("activities", [])
            if activity.get("id") in selected_ids
        ]
        visible.sort(
            key=lambda activity: (
                MASTER_ACTIVITY_ORDER_2026.get(str(activity.get("training_code") or "").upper(), 9999),
                int(activity.get("training_substep") or 0),
                int(activity.get("task_id") or 0),
            )
        )
        for activity in visible:
            _normalise_activity_number(activity)
            ordered_visible.append(activity)

        block_code = str(topic.get("code") or "").strip().upper()
        expected_codes = MASTER_ACTIVITY_CODES_BY_BLOCK_2026.get(block_code, ())
        completed_practices = sum(1 for code in expected_codes if code in completed_codes)
        total_practices = len(expected_codes)
        topic["activities"] = visible
        topic["completed"] = completed_practices
        topic["total"] = total_practices
        topic["progress_percentage"] = (
            0
            if total_practices == 0
            else round((completed_practices / total_practices) * 100)
        )

    for index, activity in enumerate(ordered_visible, start=1):
        activity["course_order"] = index
        activity["is_current"] = False

    incomplete = [activity for activity in ordered_visible if not activity.get("is_completed")]
    current = incomplete[0] if incomplete else (ordered_visible[-1] if ordered_visible else None)
    next_activity = incomplete[1] if len(incomplete) > 1 else None
    if current:
        current["is_current"] = True

    represented_codes = {
        str(activity.get("training_code") or "").strip().upper()
        for activity in ordered_visible
        if activity.get("training_code")
    }
    represented_ordered = [code for code in MASTER_ACTIVITY_CODES_2026 if code in represented_codes]
    missing_codes = [code for code in MASTER_ACTIVITY_CODES_2026 if code not in represented_codes]

    completed_practices = len(completed_codes)
    total_practices = len(MASTER_ACTIVITY_CODES_2026)
    visible_runtime_steps = len(ordered_visible)
    course_summary = course.setdefault("course", {})
    course_summary.update(
        {
            "completed": completed_practices,
            "total": total_practices,
            "pending": total_practices - completed_practices,
            "progress_percentage": round((completed_practices / total_practices) * 100),
            "current_activity_id": current.get("id") if current else None,
            "next_activity_id": next_activity.get("id") if next_activity else None,
            "catalog_total_practices": total_practices,
            "visible_runtime_steps": visible_runtime_steps,
            "migrated_runtime_steps": visible_runtime_steps,
            "migrated_training_practices": len(represented_codes),
            "migrated_training_codes": represented_ordered,
            "missing_training_codes": missing_codes,
            "hidden_legacy_runtime_steps": len(all_runtime_steps) - len(selected),
            "suppressed_duplicate_runtime_steps": suppressed_duplicate_steps,
            "runtime_audit_status": "complete" if not missing_codes else "incomplete",
            "migration_mode": "master-syllabus-only",
        }
    )
    return course


def build_master_activity_course_2026(db: Session) -> dict[str, Any]:
    _ensure_master_runtime_availability_2026(db)
    return project_master_activity_course_2026(build_runtime_activity_course(db))