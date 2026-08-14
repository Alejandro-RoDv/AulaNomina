"""Adaptador entre el curso ejecutable heredado y el Temario Maestro 2026.

Solo las tareas que declaran ``trigger_condition.training_code`` se enriquecen
con el catálogo. El resto de casos demo continúa funcionando sin cambios hasta
que sea migrado en posteriores iteraciones de la Fase B.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_study import CaseTask
from app.services.activity_service import build_activity_course as build_legacy_activity_course
from app.training import get_training_activity_2026
from app.training.runtime_bindings_2026 import get_runtime_binding_2026


TRAINING_CASE_DATA_LABELS = {
    "working_day": "Jornada",
    "weekly_hours": "Horas semanales",
    "job_position": "Puesto",
    "company_name": "Empresa",
    "center_name": "Centro",
    "start_date": "Fecha de inicio",
}


def _training_code(task: CaseTask | None) -> str | None:
    if task is None:
        return None
    code = (task.trigger_condition or {}).get("training_code")
    return str(code).strip().upper() if code else None


def _append_case_row(rows: list[dict[str, str]], label: str, value: Any) -> None:
    if value in {None, ""}:
        return
    if any(item.get("label") == label for item in rows):
        return
    rows.append({"label": label, "value": str(value)})


def _training_case_data(task: CaseTask, code: str, current_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    rows = [dict(item) for item in (current_rows or [])]
    state = task.case_study.initial_state or {}
    employee_data = state.get("employee_data") or {}
    contract_data = state.get("contract_data") or {}

    if code == "A07":
        _append_case_row(rows, "Fecha de inicio", state.get("start_date"))
        _append_case_row(rows, "Jornada", contract_data.get("working_day"))
        _append_case_row(rows, "Horas semanales", contract_data.get("weekly_hours"))
        _append_case_row(rows, "Puesto", contract_data.get("job_position"))

    if code == "A29":
        _append_case_row(rows, "NAF", employee_data.get("naf"))
        _append_case_row(rows, "Fecha de alta", state.get("start_date"))
        _append_case_row(rows, "Empresa", state.get("company_name"))
        _append_case_row(rows, "Centro", state.get("center_name"))

    return rows[:8]


def _enrich_activity(activity: dict[str, Any], task: CaseTask) -> dict[str, Any]:
    code = _training_code(task)
    if not code:
        return activity

    training = get_training_activity_2026(code, include_source_metadata=False)
    binding = get_runtime_binding_2026(code)
    if training is None or binding is None:
        return activity

    enriched = deepcopy(activity)
    enriched.update(
        {
            "training_code": code,
            "catalog_code": "AN-GL-2026",
            "catalog_version": "2026.1-phase-a",
            "display_number": code,
            "title": training["title"],
            "unit": training["unit_title"],
            "topic_title": training["block_title"],
            "situation": training["professional_situation"],
            "objective": training["learning_objective"],
            "instructions": ". ".join(training.get("expected_actions") or []) + ".",
            "concepts": {
                "title": "Conceptos relacionados",
                "body": ". ".join(training.get("theory_topics") or []) + ".",
            },
            "hint": (training.get("feedback_if_failed") or [activity.get("hint")])[0],
            "case_data": _training_case_data(task, code, activity.get("case_data") or []),
            "catalog_prerequisites": list(training.get("prerequisites") or []),
            "runtime_prerequisites": list(binding.get("runtime_prerequisites") or []),
            "student_inputs": list(training.get("student_inputs") or []),
            "expected_actions": list(training.get("expected_actions") or []),
            "evaluation_criteria": list(training.get("evaluation_criteria") or []),
            "theory_topics": list(training.get("theory_topics") or []),
            "feedback_if_failed": list(training.get("feedback_if_failed") or []),
            "official_source_codes": list(training.get("sources") or []),
            "runtime_migrated": True,
        }
    )
    enriched["context"] = {
        **(enriched.get("context") or {}),
        "trainingCode": code,
        "courseCode": "AN-GL-2026",
    }
    return enriched


def build_activity_course(db: Session) -> dict[str, Any]:
    """Devuelve el Centro de Actividades enriquecido con las tareas ya migradas."""
    course = build_legacy_activity_course(db)
    task_ids = [
        activity.get("task_id")
        for topic in course.get("topics", [])
        for activity in topic.get("activities", [])
        if activity.get("task_id")
    ]
    tasks = {}
    if task_ids:
        tasks = {
            task.id: task
            for task in db.query(CaseTask).filter(CaseTask.id.in_(task_ids)).all()
        }

    migrated = 0
    for topic in course.get("topics", []):
        for index, activity in enumerate(topic.get("activities", [])):
            task = tasks.get(activity.get("task_id"))
            enriched = _enrich_activity(activity, task) if task else activity
            topic["activities"][index] = enriched
            if enriched.get("runtime_migrated"):
                migrated += 1

    course.setdefault("course", {})["catalog_code"] = "AN-GL-2026"
    course["course"]["catalog_version"] = "2026.1-phase-a"
    course["course"]["migrated_training_activities"] = migrated
    course["course"]["migration_mode"] = "hybrid"
    return course
