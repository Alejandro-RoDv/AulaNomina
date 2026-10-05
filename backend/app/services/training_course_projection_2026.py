"""Proyección del runtime sobre el curso visible de AulaNomina 2026.

Los casos, tareas y validadores internos siguen siendo granulares, pero el alumno
no debe ver cada CaseTask como una actividad distinta. La vista formativa agrupa
los subpasos técnicos en una única práctica, integra la teoría conceptual en la
operación ERP y elimina ejercicios puramente teóricos que duplicaban contenido.
"""
from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from typing import Any

from sqlalchemy.orm import Session

from app.services.training_activity_runtime_service import (
    build_activity_course as build_runtime_activity_course,
)
from app.training import list_training_activities_2026
from app.training.student_course_2026 import (
    HIDDEN_STANDALONE_ACTIVITY_CODES_2026,
    STUDENT_ACTIVITY_CODES_2026,
    STUDENT_ACTIVITY_ORDER_2026,
    STUDENT_BLOCKS_2026,
    student_activity_copy_2026,
)


MASTER_ACTIVITY_CATALOG_2026 = tuple(
    list_training_activities_2026(include_source_metadata=False)
)
MASTER_ACTIVITY_CODES_2026 = tuple(
    activity["code"] for activity in MASTER_ACTIVITY_CATALOG_2026
)
MASTER_ACTIVITY_ORDER_2026 = {
    code: index for index, code in enumerate(MASTER_ACTIVITY_CODES_2026, start=1)
}

FORCE_EXPLICIT_REVIEW_CODES_2026 = frozenset({"A07", "A09", "A14", "A29", "C02"})

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
    """Materializa únicamente los bloques runtime que falten en bases existentes."""
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
        FOUNDATION_SCENARIO_CODES,
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

    # La capa visible aplica los nuevos textos sin tocar las tareas persistidas.
    # Solo reparamos B01 si realmente faltan escenarios; leer el curso nunca debe
    # reiniciar el progreso de asignaciones ya existentes.
    foundation_count = _count_runtime_cases(db, FOUNDATION_SCENARIO_CODES)
    if foundation_count < len(FOUNDATION_SCENARIO_CODES):
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
    elif document_count < len(DOCUMENT_SCENARIO_CODES):
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


def _step_module(activity: dict[str, Any]) -> str:
    context = activity.get("context") or {}
    return str(context.get("moduleCode") or activity.get("module") or "").strip().lower()


def _student_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Quita subpasos puramente conceptuales si la práctica ya tiene operación ERP."""
    operational = [
        step for step in steps
        if _step_module(step) not in {"", "general", "learning"}
    ]
    return operational or steps


def _collapse_practice(code: str, steps: list[dict[str, Any]]) -> dict[str, Any]:
    visible_steps = _student_steps(sorted(
        steps,
        key=lambda item: (int(item.get("training_substep") or 0), int(item.get("task_id") or 0)),
    ))
    current_step = next((step for step in visible_steps if not step.get("is_completed")), None)
    current_step = current_step or visible_steps[-1]
    practice = deepcopy(current_step)
    completed_steps = sum(1 for step in visible_steps if step.get("is_completed"))
    copy = student_activity_copy_2026(code)

    practice.update(
        {
            "id": f"practice:{code}",
            "runtime_step_id": current_step.get("id"),
            "runtime_step_count": len(visible_steps),
            "runtime_completed_steps": completed_steps,
            "is_completed": completed_steps == len(visible_steps),
            "title": copy.get("title") or practice.get("master_activity_title") or practice.get("title"),
            "theory": copy.get("theory") or practice.get("objective") or "",
            "instructions": copy.get("task") or practice.get("instructions") or practice.get("objective") or "",
            "simple_course_view": True,
            "training_substep": None,
            "training_substep_total": None,
        }
    )
    if code in FORCE_EXPLICIT_REVIEW_CODES_2026:
        practice["validation_interaction"] = "explicit_review"
    return practice


def _group_practices(selected: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    by_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for step in selected:
        code = str(step.get("training_code") or "").strip().upper()
        if code in STUDENT_ACTIVITY_ORDER_2026:
            by_code[code].append(step)
    return {
        code: _collapse_practice(code, steps)
        for code, steps in by_code.items()
        if steps
    }


def project_master_activity_course_2026(course: dict[str, Any]) -> dict[str, Any]:
    """Construye el curso simple: una práctica visible por objetivo formativo."""
    all_runtime_steps = [
        activity
        for topic in course.get("topics", [])
        for activity in topic.get("activities", [])
    ]
    selected, suppressed_duplicate_steps = _select_canonical_runtime_steps(all_runtime_steps)
    practices = _group_practices(selected)

    topics: list[dict[str, Any]] = []
    ordered_visible: list[dict[str, Any]] = []
    for topic_order, block in enumerate(STUDENT_BLOCKS_2026, start=1):
        items: list[dict[str, Any]] = []
        for activity_position, code in enumerate(block["activity_codes"], start=1):
            practice = practices.get(code)
            if practice is None:
                continue
            practice["display_number"] = f"{topic_order}.{activity_position}"
            practice["topic_key"] = block["code"].lower()
            practice["topic_order"] = topic_order
            practice["topic_title"] = block["title"]
            practice["block_code"] = block["code"]
            items.append(practice)
            ordered_visible.append(practice)

        completed = sum(1 for item in items if item.get("is_completed"))
        total = len(block["activity_codes"])
        topics.append(
            {
                "key": block["code"].lower(),
                "code": block["code"],
                "order": topic_order,
                "title": block["title"],
                "completed": completed,
                "total": total,
                "progress_percentage": 0 if total == 0 else round((completed / total) * 100),
                "activities": items,
            }
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
    represented_ordered = [code for code in STUDENT_ACTIVITY_CODES_2026 if code in represented_codes]
    missing_codes = [code for code in STUDENT_ACTIVITY_CODES_2026 if code not in represented_codes]
    completed_practices = sum(1 for activity in ordered_visible if activity.get("is_completed"))
    total_practices = len(STUDENT_ACTIVITY_CODES_2026)
    course_summary = course.setdefault("course", {})

    course["topics"] = topics
    course_summary.update(
        {
            "completed": completed_practices,
            "total": total_practices,
            "pending": total_practices - completed_practices,
            "progress_percentage": 0 if total_practices == 0 else round((completed_practices / total_practices) * 100),
            "current_activity_id": current.get("id") if current else None,
            "next_activity_id": next_activity.get("id") if next_activity else None,
            "catalog_total_practices": len(MASTER_ACTIVITY_CODES_2026),
            "student_total_practices": total_practices,
            "visible_runtime_steps": len(ordered_visible),
            "underlying_runtime_steps": len(selected),
            "migrated_runtime_steps": len(selected),
            "migrated_training_practices": len(represented_codes),
            "migrated_training_codes": represented_ordered,
            "missing_training_codes": missing_codes,
            "hidden_standalone_training_codes": sorted(HIDDEN_STANDALONE_ACTIVITY_CODES_2026),
            "hidden_legacy_runtime_steps": len(all_runtime_steps) - len(selected),
            "suppressed_duplicate_runtime_steps": suppressed_duplicate_steps,
            "runtime_audit_status": "complete" if not missing_codes else "incomplete",
            "migration_mode": "student-integrated-practices",
        }
    )
    return course


def build_master_activity_course_2026(db: Session) -> dict[str, Any]:
    _ensure_master_runtime_availability_2026(db)
    return project_master_activity_course_2026(build_runtime_activity_course(db))
