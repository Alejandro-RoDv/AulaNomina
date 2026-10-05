from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_task_attempt import CaseTaskAttempt
from app.services.case_scenario_service import CaseScenarioError, ensure_assignment_progress
from app.services.evaluation_policy_service import evaluation_code_for_case


PASS_MARK = 50

SECTION_BY_MODULE = {
    "employees": ("record", "Expediente"),
    "companies": ("record", "Expediente"),
    "work-centers": ("record", "Expediente"),
    "contracts": ("contracts", "Contratación"),
    "affiliations": ("social-security", "Seguridad Social"),
    "fie": ("social-security", "Seguridad Social"),
    "siltra": ("social-security", "Seguridad Social"),
    "social-security": ("social-security", "Seguridad Social"),
    "documents": ("documents", "Documentación"),
    "payrolls": ("payroll", "Nómina"),
    "regularizations": ("payroll", "Nómina"),
    "incidents": ("incidents", "Incidencias"),
    "irpf": ("tax", "Fiscalidad"),
    "tax": ("tax", "Fiscalidad"),
    "model111": ("tax", "Fiscalidad"),
    "model190": ("tax", "Fiscalidad"),
    "terminations": ("termination", "Extinción laboral"),
    "general": ("professional", "Gestión profesional"),
}


def _section_for_module(module: str | None) -> tuple[str, str]:
    normalized = str(module or "general").strip().lower()
    fallback_label = normalized.replace("-", " ").title() or "General"
    return SECTION_BY_MODULE.get(normalized, (normalized or "general", fallback_label))


def _score_from_validation(result: dict[str, Any] | None, completed: bool) -> int:
    result = result or {}
    checks = [item for item in result.get("checks") or [] if item.get("supported") is not False]
    if checks:
        passed = sum(1 for item in checks if item.get("passed") is True)
        return round((passed / len(checks)) * 100)
    if result.get("passed") is True or completed:
        return 100
    return 0


def _latest_attempts(db: Session, assignment_id: int):
    attempts = (
        db.query(CaseTaskAttempt)
        .filter(CaseTaskAttempt.assignment_id == assignment_id)
        .order_by(CaseTaskAttempt.task_id.asc(), CaseTaskAttempt.attempt_number.desc(), CaseTaskAttempt.id.desc())
        .all()
    )
    latest = {}
    counts = defaultdict(int)
    for attempt in attempts:
        counts[attempt.task_id] += 1
        if attempt.task_id not in latest:
            latest[attempt.task_id] = attempt
    return latest, dict(counts)


def get_evaluation_result(db: Session, assignment_id: int) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    evaluation_code = evaluation_code_for_case(assignment.case_study)
    if not evaluation_code:
        raise CaseScenarioError(
            "La asignación no corresponde a una evaluación práctica C01-C06",
            code="ASSIGNMENT_NOT_EVALUATION",
            status_code=409,
        )

    latest_attempts, attempt_counts = _latest_attempts(db, assignment.id)
    progress_by_task = {entry.task_id: entry for entry in assignment.progress_entries}
    tasks = sorted(assignment.case_study.tasks or [], key=lambda item: (item.task_order, item.id))

    scored_tasks = []
    for task in tasks:
        progress = progress_by_task.get(task.id)
        attempt = latest_attempts.get(task.id)
        completed = bool(progress and progress.status == "completed")
        if attempt and attempt.score is not None:
            score = max(0, min(100, int(attempt.score)))
        else:
            score = _score_from_validation(progress.validation_result if progress else {}, completed)
        section_key, section_label = _section_for_module(task.module)
        scored_tasks.append({
            "task_id": task.id,
            "title": task.title,
            "module": task.module,
            "section_key": section_key,
            "section": section_label,
            "score": score,
            "attempts": attempt_counts.get(task.id, int(progress.attempts or 0) if progress else 0),
            "status": progress.status if progress else "pending",
            "last_attempt_at": attempt.created_at if attempt else None,
        })

    grouped = defaultdict(list)
    section_labels = {}
    for task_result in scored_tasks:
        grouped[task_result["section_key"]].append(task_result)
        section_labels[task_result["section_key"]] = task_result["section"]

    sections = []
    for key, items in grouped.items():
        section_score = round(sum(item["score"] for item in items) / len(items)) if items else 0
        task_rows = []
        for item in items:
            task_rows.append({
                "task_id": item["task_id"],
                "title": item["title"],
                "module": item["module"],
                "section": item["section"],
                "score": item["score"],
                "attempts": item["attempts"],
                "status": item["status"],
                "last_attempt_at": item["last_attempt_at"],
            })
        sections.append({
            "key": key,
            "label": section_labels[key],
            "score": section_score,
            "completed_tasks": sum(1 for item in items if item["status"] == "completed"),
            "total_tasks": len(items),
            "tasks": task_rows,
        })

    total_tasks = len(scored_tasks)
    completed_tasks = sum(1 for item in scored_tasks if item["status"] == "completed")
    score = round(sum(item["score"] for item in scored_tasks) / total_tasks) if total_tasks else 0
    complete = total_tasks > 0 and completed_tasks == total_tasks

    return {
        "assignment_id": assignment.id,
        "evaluation_code": evaluation_code,
        "title": assignment.case_study.title,
        "status": "completed" if complete else "in_progress" if assignment.started_at else "pending",
        "score": score,
        "passed": complete and score >= PASS_MARK,
        "pass_mark": PASS_MARK,
        "completed_tasks": completed_tasks,
        "total_tasks": total_tasks,
        "sections": sections,
        "started_at": assignment.started_at,
        "completed_at": assignment.completed_at,
    }
