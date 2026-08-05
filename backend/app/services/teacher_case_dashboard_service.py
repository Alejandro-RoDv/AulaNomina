from __future__ import annotations

from datetime import datetime
from typing import Any
import unicodedata

from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.case_assignment import CaseAssignment
from app.models.case_progress import CaseTaskProgress
from app.models.case_study import CaseStudy
from app.models.mail import EmailMessage, EmailThread
from app.services.case_scenario_service import CaseScenarioError, ensure_assignment_progress


TUTOR_ADDRESS = "tutor@aulanomina.local"


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def _assignment_query(db: Session):
    return db.query(CaseAssignment).options(
        joinedload(CaseAssignment.case_study).selectinload(CaseStudy.tasks),
        joinedload(CaseAssignment.student),
        joinedload(CaseAssignment.group),
        selectinload(CaseAssignment.progress_entries).joinedload(CaseTaskProgress.task),
        selectinload(CaseAssignment.email_threads)
        .selectinload(EmailThread.messages)
        .selectinload(EmailMessage.attachments),
    )


def _ordered_tasks(assignment: CaseAssignment):
    return sorted(
        assignment.case_study.tasks if assignment.case_study else [],
        key=lambda item: (item.task_order, item.id),
    )


def _progress_by_task(assignment: CaseAssignment):
    return {entry.task_id: entry for entry in assignment.progress_entries}


def _events_for_progress(progress: CaseTaskProgress) -> list[dict[str, Any]]:
    validation_result = progress.validation_result or {}
    return [event for event in validation_result.get("events") or [] if isinstance(event, dict)]


def _event_failed(event: dict[str, Any]) -> bool:
    metadata = event.get("metadata") or {}
    return event.get("event_type") in {"operation_error", "api_error"} or metadata.get("success") is False


def _tutor_messages(assignment: CaseAssignment) -> list[EmailMessage]:
    return [
        message
        for thread in assignment.email_threads
        for message in thread.messages
        if _normalize(message.sender_address) == TUTOR_ADDRESS
    ]


def _last_activity(assignment: CaseAssignment) -> datetime | None:
    candidates = [
        assignment.assigned_at,
        assignment.started_at,
        assignment.completed_at,
        assignment.created_at,
    ]
    for progress in assignment.progress_entries:
        candidates.extend([progress.started_at, progress.completed_at, progress.updated_at])
        candidates.extend(_parse_datetime(event.get("recorded_at")) for event in _events_for_progress(progress))
        candidates.append(_parse_datetime((progress.validation_result or {}).get("validated_at")))
    for thread in assignment.email_threads:
        candidates.extend([thread.created_at, thread.updated_at])
        candidates.extend(message.sent_at for message in thread.messages)
    valid = [value for value in candidates if isinstance(value, datetime)]
    return max(valid) if valid else None


def _elapsed_minutes(assignment: CaseAssignment, last_activity: datetime | None) -> int:
    if not assignment.started_at:
        return 0
    end = assignment.completed_at or last_activity or datetime.utcnow()
    return max(0, round((end - assignment.started_at).total_seconds() / 60))


def _summary(assignment: CaseAssignment) -> dict[str, Any]:
    tasks = _ordered_tasks(assignment)
    progress = _progress_by_task(assignment)
    completed_steps = sum(
        1 for task in tasks if progress.get(task.id) and progress[task.id].status == "completed"
    )
    current_task = next(
        (
            task
            for task in tasks
            if not progress.get(task.id) or progress[task.id].status != "completed"
        ),
        None,
    )
    events = [
        event
        for entry in assignment.progress_entries
        for event in _events_for_progress(entry)
    ]
    tutor_messages = _tutor_messages(assignment)
    last_activity = _last_activity(assignment)
    return {
        "assignment_id": assignment.id,
        "case_study_id": assignment.case_study_id,
        "scenario_code": assignment.case_study.scenario_code if assignment.case_study else None,
        "case_title": assignment.case_title or "Caso sin título",
        "assignee_name": assignment.assignee_name,
        "assignee_type": assignment.assignee_type,
        "status": assignment.status,
        "completion_percentage": assignment.completion_percentage or 0,
        "completed_steps": completed_steps,
        "total_steps": len(tasks),
        "current_step_title": current_task.title if current_task else None,
        "failed_operations": sum(1 for event in events if _event_failed(event)),
        "tutor_messages": len(tutor_messages),
        "elapsed_minutes": _elapsed_minutes(assignment, last_activity),
        "due_date": assignment.due_date,
        "started_at": assignment.started_at,
        "completed_at": assignment.completed_at,
        "last_activity_at": last_activity,
    }


def get_teacher_case_dashboard(
    db: Session,
    *,
    status: str | None = None,
    assignee_type: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    assignments = _assignment_query(db).order_by(CaseAssignment.assigned_at.desc()).all()
    summaries = [_summary(assignment) for assignment in assignments]

    normalized_search = _normalize(search)
    if status:
        summaries = [item for item in summaries if item["status"] == status]
    if assignee_type:
        summaries = [item for item in summaries if item["assignee_type"] == assignee_type]
    if normalized_search:
        summaries = [
            item
            for item in summaries
            if normalized_search
            in _normalize(
                " ".join(
                    filter(
                        None,
                        [
                            item["case_title"],
                            item["scenario_code"],
                            item["assignee_name"],
                            item["current_step_title"],
                        ],
                    )
                )
            )
        ]

    total = len(summaries)
    metrics = {
        "total_assignments": total,
        "assigned": sum(1 for item in summaries if item["status"] == "assigned"),
        "in_progress": sum(1 for item in summaries if item["status"] == "in_progress"),
        "submitted": sum(1 for item in summaries if item["status"] == "submitted"),
        "reviewed": sum(1 for item in summaries if item["status"] == "reviewed"),
        "approved": sum(1 for item in summaries if item["status"] == "approved"),
        "needs_revision": sum(1 for item in summaries if item["status"] == "needs_revision"),
        "average_progress": (
            round(sum(item["completion_percentage"] for item in summaries) / total) if total else 0
        ),
        "failed_operations": sum(item["failed_operations"] for item in summaries),
        "tutor_messages": sum(item["tutor_messages"] for item in summaries),
    }
    return {"metrics": metrics, "assignments": summaries}


def _timeline(assignment: CaseAssignment) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    if assignment.assigned_at:
        entries.append(
            {
                "timestamp": assignment.assigned_at,
                "entry_type": "assignment",
                "title": "Caso asignado",
                "detail": f"Asignado a {assignment.assignee_name}",
                "status": assignment.status,
                "actor": assignment.assigned_by,
                "metadata": {},
            }
        )

    for task in _ordered_tasks(assignment):
        progress = _progress_by_task(assignment).get(task.id)
        if not progress:
            continue
        if progress.started_at:
            entries.append(
                {
                    "timestamp": progress.started_at,
                    "entry_type": "step_started",
                    "title": f"Paso {task.task_order} iniciado",
                    "detail": task.title,
                    "status": progress.status,
                    "task_id": task.id,
                    "task_order": task.task_order,
                    "metadata": {"module": task.module, "expected_action": task.expected_action},
                }
            )
        for event in _events_for_progress(progress):
            timestamp = _parse_datetime(event.get("recorded_at"))
            if not timestamp:
                continue
            metadata = dict(event.get("metadata") or {})
            failed = _event_failed(event)
            entries.append(
                {
                    "timestamp": timestamp,
                    "entry_type": "operation_error" if failed else "operation",
                    "title": event.get("action_code") or event.get("event_type") or "Operación ERP",
                    "detail": metadata.get("path") or event.get("target"),
                    "status": "failed" if failed else "success",
                    "task_id": task.id,
                    "task_order": task.task_order,
                    "actor": metadata.get("actor") or "Alumno",
                    "metadata": {**metadata, "event_id": event.get("event_id")},
                }
            )
        validation_result = progress.validation_result or {}
        validated_at = _parse_datetime(validation_result.get("validated_at"))
        if validated_at:
            passed = validation_result.get("passed") is True
            entries.append(
                {
                    "timestamp": validated_at,
                    "entry_type": "validation",
                    "title": "Validación automática superada" if passed else "Validación pendiente",
                    "detail": " · ".join(
                        check.get("message", "")
                        for check in validation_result.get("checks") or []
                        if check.get("message")
                    ) or None,
                    "status": "success" if passed else "pending",
                    "task_id": task.id,
                    "task_order": task.task_order,
                    "actor": "Motor de validación",
                    "metadata": {"manual_required": validation_result.get("manual_required", False)},
                }
            )
        if progress.completed_at:
            entries.append(
                {
                    "timestamp": progress.completed_at,
                    "entry_type": "step_completed",
                    "title": f"Paso {task.task_order} completado",
                    "detail": task.title,
                    "status": "completed",
                    "task_id": task.id,
                    "task_order": task.task_order,
                    "metadata": {"attempts": progress.attempts},
                }
            )

    for message in _tutor_messages(assignment):
        entries.append(
            {
                "timestamp": message.sent_at,
                "entry_type": "tutor_message",
                "title": "Respuesta del tutor automático",
                "detail": message.body_text,
                "status": "feedback",
                "actor": message.sender_name,
                "metadata": {"message_id": message.id, "thread_id": message.thread_id},
            }
        )

    if assignment.completed_at:
        entries.append(
            {
                "timestamp": assignment.completed_at,
                "entry_type": "assignment_completed",
                "title": "Caso entregado",
                "detail": f"Progreso final: {assignment.completion_percentage}%",
                "status": assignment.status,
                "metadata": {},
            }
        )

    return sorted(entries, key=lambda item: item["timestamp"], reverse=True)


def get_teacher_case_detail(db: Session, assignment_id: int) -> dict[str, Any]:
    assignment = _assignment_query(db).filter(CaseAssignment.id == assignment_id).first()
    if not assignment:
        raise CaseScenarioError(
            "Asignación no encontrada",
            code="ASSIGNMENT_NOT_FOUND",
            status_code=404,
        )
    if len(assignment.progress_entries) < len(_ordered_tasks(assignment)):
        ensure_assignment_progress(db, assignment_id)
        assignment = _assignment_query(db).filter(CaseAssignment.id == assignment_id).first()

    summary = _summary(assignment)
    progress_by_task = _progress_by_task(assignment)
    steps = []
    for task in _ordered_tasks(assignment):
        progress = progress_by_task.get(task.id)
        events = _events_for_progress(progress) if progress else []
        validation_result = progress.validation_result or {} if progress else {}
        steps.append(
            {
                "task_id": task.id,
                "task_order": task.task_order,
                "title": task.title,
                "module": task.module,
                "expected_action": task.expected_action,
                "progress_status": progress.status if progress else "pending",
                "attempts": progress.attempts if progress else 0,
                "event_count": len(events),
                "failed_operations": sum(1 for event in events if _event_failed(event)),
                "student_notes": progress.student_notes if progress else None,
                "started_at": progress.started_at if progress else None,
                "completed_at": progress.completed_at if progress else None,
                "last_validation": {
                    "mode": validation_result.get("mode"),
                    "validated_at": validation_result.get("validated_at"),
                    "passed": validation_result.get("passed"),
                    "manual_required": validation_result.get("manual_required", False),
                    "checks": validation_result.get("checks") or [],
                },
            }
        )

    return {
        **summary,
        "description": assignment.case_study.description if assignment.case_study else None,
        "difficulty": assignment.case_study.difficulty if assignment.case_study else "basic",
        "category": assignment.case_study.category if assignment.case_study else "general",
        "assigned_by": assignment.assigned_by,
        "assigned_at": assignment.assigned_at,
        "notes": assignment.notes,
        "steps": steps,
        "timeline": _timeline(assignment),
    }
