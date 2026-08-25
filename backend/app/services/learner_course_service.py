from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.auth_service import AuthPrincipal
from app.services.learner_scope_service import accessible_assignment_ids
from app.services.training_course_projection_2026 import build_master_activity_course_2026


def _recalculate_scoped_course(course: dict[str, Any]) -> dict[str, Any]:
    activities: list[dict[str, Any]] = []
    for topic in course.get("topics", []):
        items = topic.get("activities", [])
        completed = sum(1 for item in items if item.get("is_completed"))
        total = len(items)
        topic["completed"] = completed
        topic["total"] = total
        topic["progress_percentage"] = 0 if not total else round((completed / total) * 100)
        activities.extend(items)

    activities.sort(key=lambda item: int(item.get("course_order") or 999999))
    for index, activity in enumerate(activities, start=1):
        activity["course_order"] = index
        activity["is_current"] = False

    incomplete = [item for item in activities if not item.get("is_completed")]
    current = incomplete[0] if incomplete else (activities[-1] if activities else None)
    next_activity = incomplete[1] if len(incomplete) > 1 else None
    if current:
        current["is_current"] = True

    completed = sum(1 for item in activities if item.get("is_completed"))
    total = len(activities)
    summary = course.setdefault("course", {})
    summary.update(
        {
            "completed": completed,
            "total": total,
            "pending": total - completed,
            "progress_percentage": 0 if not total else round((completed / total) * 100),
            "current_activity_id": current.get("id") if current else None,
            "next_activity_id": next_activity.get("id") if next_activity else None,
            "visible_runtime_steps": total,
        }
    )
    return course


def build_learner_course(db: Session, principal: AuthPrincipal | None) -> dict[str, Any]:
    course = build_master_activity_course_2026(db)
    if principal is None or principal.is_staff:
        return course

    allowed = accessible_assignment_ids(db, principal) or set()
    for topic in course.get("topics", []):
        topic["activities"] = [
            activity
            for activity in topic.get("activities", [])
            if activity.get("assignment_id") in allowed
        ]

    course.setdefault("course", {})["scoped_student_id"] = principal.student_id
    return _recalculate_scoped_course(course)
