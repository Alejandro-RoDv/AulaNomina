from __future__ import annotations

from contextvars import ContextVar
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

import app.services.activity_service as activity_service
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy
from app.models.company import Company
from app.models.employee import Employee
from app.models.work_center import WorkCenter
from app.services.auth_service import AuthPrincipal
from app.services.learner_scope_service import accessible_assignment_ids
from app.services.training_course_projection_2026 import build_master_activity_course_2026


_ASSIGNMENT_SCOPE: ContextVar[frozenset[int] | None] = ContextVar(
    "aulanomina_training_assignment_scope",
    default=None,
)
_ORIGINAL_SELECT_ASSIGNMENTS = activity_service._select_assignments


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _select_scoped_assignments(db: Session) -> list[CaseAssignment]:
    assignment_ids = _ASSIGNMENT_SCOPE.get()
    if assignment_ids is None:
        return _ORIGINAL_SELECT_ASSIGNMENTS(db)
    if not assignment_ids:
        return []

    assignments = (
        db.query(CaseAssignment)
        .join(CaseStudy, CaseAssignment.case_study_id == CaseStudy.id)
        .filter(
            CaseStudy.status == "active",
            CaseAssignment.id.in_(sorted(assignment_ids)),
        )
        .order_by(CaseStudy.id.asc(), CaseAssignment.id.asc())
        .all()
    )

    selected: dict[int, CaseAssignment] = {}
    for assignment in assignments:
        current = selected.get(assignment.case_study_id)
        if current is None:
            selected[assignment.case_study_id] = assignment
            continue
        candidate_rank = activity_service.ASSIGNMENT_STATUS_PRIORITY.get(assignment.status, 99)
        current_rank = activity_service.ASSIGNMENT_STATUS_PRIORITY.get(current.status, 99)
        if (candidate_rank, assignment.id) < (current_rank, current.id):
            selected[assignment.case_study_id] = assignment

    return [selected[key] for key in sorted(selected)]


if not getattr(activity_service._select_assignments, "_learner_scope_aware", False):
    _select_scoped_assignments._learner_scope_aware = True
    activity_service._select_assignments = _select_scoped_assignments


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


def _case_value(activity: dict[str, Any], label: str) -> str | None:
    for row in activity.get("case_data") or []:
        if _normalize(row.get("label")) == _normalize(label):
            value = str(row.get("value") or "").strip()
            return value or None
    return None


def _remap_workspace_contexts(db: Session, course: dict[str, Any], assignment_ids: set[int]) -> None:
    assignments = (
        db.query(CaseAssignment)
        .filter(CaseAssignment.id.in_(sorted(assignment_ids)))
        .all()
        if assignment_ids
        else []
    )
    state_by_assignment = {
        assignment.id: (assignment.case_study.initial_state or {})
        for assignment in assignments
        if assignment.case_study is not None
    }

    companies = db.query(Company).all()
    centers = db.query(WorkCenter).all()
    employees = db.query(Employee).all()
    company_by_name = {_normalize(item.name): item for item in companies}
    employee_by_name = {
        _normalize(f"{item.first_name} {item.last_name} {item.second_last_name or ''}"): item
        for item in employees
    }
    employee_by_short_name = {
        _normalize(f"{item.first_name} {item.last_name}"): item
        for item in employees
    }

    for topic in course.get("topics", []):
        for activity in topic.get("activities", []):
            context = activity.get("context") or {}
            assignment_id = int(activity.get("assignment_id") or 0)
            state = state_by_assignment.get(assignment_id, {})

            company_name = (
                state.get("company_name")
                or state.get("company")
                or _case_value(activity, "Empresa")
            )
            company = company_by_name.get(_normalize(company_name)) if company_name else None
            if company is None and context.get("companyId"):
                company = next((item for item in companies if item.id == context.get("companyId")), None)

            center_name = (
                state.get("center_name")
                or state.get("center")
                or _case_value(activity, "Centro")
            )
            center = None
            if center_name:
                expected_center = _normalize(center_name)
                center = next(
                    (
                        item
                        for item in centers
                        if _normalize(item.name) == expected_center
                        and (company is None or item.company_id == company.id)
                    ),
                    None,
                )

            employee_name = context.get("employeeName") or _case_value(activity, "Trabajador")
            employee = None
            if employee_name:
                employee = employee_by_name.get(_normalize(employee_name)) or employee_by_short_name.get(_normalize(employee_name))

            context["companyId"] = company.id if company else None
            context["centerId"] = center.id if center else None
            context["employeeId"] = employee.id if employee else None
            activity["context"] = context


def build_learner_course(db: Session, principal: AuthPrincipal | None) -> dict[str, Any]:
    if principal is None or principal.is_staff:
        return build_master_activity_course_2026(db)

    # Group templates are materialized before the course is built. The ContextVar
    # then makes the existing activity runtime select only this learner's direct
    # assignments without introducing process-global mutable request state.
    allowed = accessible_assignment_ids(db, principal) or set()
    token = _ASSIGNMENT_SCOPE.set(frozenset(allowed))
    try:
        course = build_master_activity_course_2026(db)
    finally:
        _ASSIGNMENT_SCOPE.reset(token)

    _remap_workspace_contexts(db, course, allowed)
    course.setdefault("course", {})["scoped_student_id"] = principal.student_id
    course["course"]["workspace_id"] = principal.workspace_id
    return _recalculate_scoped_course(course)
