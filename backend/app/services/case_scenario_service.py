from datetime import datetime

from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.case_assignment import CaseAssignment
from app.models.case_progress import CaseTaskProgress
from app.models.case_study import CaseStudy, CaseTask
from app.schemas.case_scenario import CaseTaskProgressUpdate


class CaseScenarioError(Exception):
    def __init__(self, message: str, *, code: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _assignment_query(db: Session):
    return db.query(CaseAssignment).options(
        joinedload(CaseAssignment.case_study).selectinload(CaseStudy.tasks),
        joinedload(CaseAssignment.student),
        joinedload(CaseAssignment.group),
        selectinload(CaseAssignment.progress_entries).joinedload(CaseTaskProgress.task),
        selectinload(CaseAssignment.email_threads),
    )


def get_assignment(db: Session, assignment_id: int) -> CaseAssignment | None:
    return _assignment_query(db).filter(CaseAssignment.id == assignment_id).first()


def _ordered_tasks(assignment: CaseAssignment) -> list[CaseTask]:
    return sorted(assignment.case_study.tasks if assignment.case_study else [], key=lambda item: (item.task_order, item.id))


def ensure_assignment_progress(db: Session, assignment_id: int) -> CaseAssignment:
    assignment = get_assignment(db, assignment_id)
    if not assignment:
        raise CaseScenarioError("Asignación no encontrada", code="ASSIGNMENT_NOT_FOUND", status_code=404)

    existing_task_ids = {entry.task_id for entry in assignment.progress_entries}
    created = False
    for task in _ordered_tasks(assignment):
        if task.id in existing_task_ids:
            continue
        db.add(CaseTaskProgress(assignment_id=assignment.id, task_id=task.id, status="pending"))
        created = True

    if created:
        db.commit()
        assignment = get_assignment(db, assignment_id)

    _recalculate_assignment(db, assignment, commit=True)
    return get_assignment(db, assignment_id)


def _recalculate_assignment(db: Session, assignment: CaseAssignment, *, commit: bool) -> None:
    tasks = _ordered_tasks(assignment)
    progress_by_task = {entry.task_id: entry for entry in assignment.progress_entries}
    required_tasks = [task for task in tasks if task.is_required]
    completed_required = sum(
        1
        for task in required_tasks
        if progress_by_task.get(task.id) and progress_by_task[task.id].status == "completed"
    )
    failed_steps = sum(1 for entry in assignment.progress_entries if entry.status == "failed")

    assignment.completion_percentage = (
        100 if not required_tasks else round((completed_required / len(required_tasks)) * 100)
    )

    current_task = next(
        (
            task
            for task in tasks
            if not progress_by_task.get(task.id) or progress_by_task[task.id].status != "completed"
        ),
        None,
    )
    assignment.current_task_order = current_task.task_order if current_task else (tasks[-1].task_order + 1 if tasks else 1)

    any_started = any(entry.status in {"in_progress", "completed", "failed"} for entry in assignment.progress_entries)
    all_required_completed = bool(required_tasks) and completed_required == len(required_tasks)

    if all_required_completed:
        if assignment.status not in {"reviewed", "approved"}:
            assignment.status = "submitted"
        assignment.completed_at = assignment.completed_at or datetime.utcnow()
    elif any_started:
        if assignment.status in {"assigned", "submitted"}:
            assignment.status = "in_progress"
        assignment.started_at = assignment.started_at or datetime.utcnow()
        assignment.completed_at = None
    elif assignment.status not in {"reviewed", "approved", "needs_revision"}:
        assignment.status = "assigned"
        assignment.started_at = None
        assignment.completed_at = None

    for thread in assignment.email_threads:
        thread.case_task_id = current_task.id if current_task else (tasks[-1].id if tasks else None)
        if all_required_completed:
            thread.status = "resolved"
        elif any_started or failed_steps:
            thread.status = "in_progress"
        else:
            thread.status = "open"
        thread.updated_at = datetime.utcnow()

    if commit:
        db.commit()


def start_assignment(db: Session, assignment_id: int) -> dict:
    assignment = ensure_assignment_progress(db, assignment_id)
    if assignment.status in {"reviewed", "approved"}:
        raise CaseScenarioError(
            "La asignación ya está revisada y no puede reiniciarse desde el buzón",
            code="ASSIGNMENT_LOCKED",
            status_code=409,
        )

    ordered_progress = sorted(
        assignment.progress_entries,
        key=lambda entry: (entry.task.task_order if entry.task else 999999, entry.id),
    )
    first_pending = next((entry for entry in ordered_progress if entry.status == "pending"), None)
    now = datetime.utcnow()
    if first_pending:
        first_pending.status = "in_progress"
        first_pending.started_at = first_pending.started_at or now
        first_pending.updated_at = now

    assignment.status = "in_progress"
    assignment.started_at = assignment.started_at or now
    _recalculate_assignment(db, assignment, commit=True)
    return build_assignment_scenario(db, assignment_id)


def _validate_step_sequence(assignment: CaseAssignment, task: CaseTask, target_status: str) -> None:
    if target_status not in {"in_progress", "completed"}:
        return

    progress_by_task = {entry.task_id: entry for entry in assignment.progress_entries}
    blocking_pending = [
        previous
        for previous in _ordered_tasks(assignment)
        if previous.task_order < task.task_order
        and previous.blocking
        and (
            progress_by_task.get(previous.id) is None
            or progress_by_task[previous.id].status != "completed"
        )
    ]
    if blocking_pending:
        raise CaseScenarioError(
            f"Completa antes el paso bloqueante: {blocking_pending[0].title}",
            code="BLOCKING_STEP_PENDING",
            status_code=409,
        )


def update_assignment_step(
    db: Session,
    assignment_id: int,
    task_id: int,
    payload: CaseTaskProgressUpdate,
) -> dict:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in _ordered_tasks(assignment) if item.id == task_id), None)
    if not task:
        raise CaseScenarioError(
            "El paso no pertenece a esta asignación",
            code="TASK_NOT_IN_ASSIGNMENT",
            status_code=404,
        )

    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task_id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    _validate_step_sequence(assignment, task, payload.status)

    now = datetime.utcnow()
    previous_status = progress.status
    progress.status = payload.status
    progress.student_notes = payload.student_notes
    progress.validation_result = payload.validation_result
    progress.updated_at = now

    if payload.status in {"in_progress", "completed", "failed"}:
        progress.started_at = progress.started_at or now
    if payload.status == "completed":
        progress.completed_at = now
    elif payload.status != "completed":
        progress.completed_at = None

    if payload.status in {"completed", "failed"} and payload.status != previous_status:
        progress.attempts += 1

    assignment.started_at = assignment.started_at or now
    if assignment.status in {"assigned", "submitted"}:
        assignment.status = "in_progress"

    if payload.status == "completed":
        progress_by_task = {entry.task_id: entry for entry in assignment.progress_entries}
        next_task = next(
            (
                item
                for item in _ordered_tasks(assignment)
                if item.task_order > task.task_order
                and progress_by_task.get(item.id)
                and progress_by_task[item.id].status == "pending"
            ),
            None,
        )
        if next_task:
            next_progress = progress_by_task[next_task.id]
            next_progress.status = "in_progress"
            next_progress.started_at = next_progress.started_at or now
            next_progress.updated_at = now

    _recalculate_assignment(db, assignment, commit=True)
    return build_assignment_scenario(db, assignment_id)


def reset_assignment_progress(db: Session, assignment_id: int) -> dict:
    assignment = get_assignment(db, assignment_id)
    if not assignment:
        raise CaseScenarioError("Asignación no encontrada", code="ASSIGNMENT_NOT_FOUND", status_code=404)

    if assignment.status in {"reviewed", "approved"}:
        raise CaseScenarioError(
            "La asignación revisada no puede reiniciarse",
            code="ASSIGNMENT_LOCKED",
            status_code=409,
        )

    db.query(CaseTaskProgress).filter(CaseTaskProgress.assignment_id == assignment_id).delete(
        synchronize_session=False
    )
    assignment.status = "assigned"
    assignment.started_at = None
    assignment.completed_at = None
    assignment.current_task_order = 1
    assignment.completion_percentage = 0
    for thread in assignment.email_threads:
        thread.status = "open"
        thread.case_task_id = None
        thread.updated_at = datetime.utcnow()
    db.commit()

    ensure_assignment_progress(db, assignment_id)
    return build_assignment_scenario(db, assignment_id)


def build_assignment_scenario(db: Session, assignment_id: int) -> dict:
    assignment = get_assignment(db, assignment_id)
    if not assignment:
        raise CaseScenarioError("Asignación no encontrada", code="ASSIGNMENT_NOT_FOUND", status_code=404)

    if len(assignment.progress_entries) < len(_ordered_tasks(assignment)):
        assignment = ensure_assignment_progress(db, assignment_id)

    progress_by_task = {entry.task_id: entry for entry in assignment.progress_entries}
    steps = []
    for task in _ordered_tasks(assignment):
        progress = progress_by_task[task.id]
        steps.append(
            {
                "task_id": task.id,
                "title": task.title,
                "description": task.description,
                "module": task.module,
                "expected_result": task.expected_result,
                "expected_action": task.expected_action,
                "trigger_type": task.trigger_type,
                "trigger_condition": task.trigger_condition or {},
                "validation_rules": task.validation_rules or [],
                "message_template": task.message_template,
                "task_order": task.task_order,
                "is_required": task.is_required,
                "blocking": task.blocking,
                "progress_id": progress.id,
                "progress_status": progress.status,
                "attempts": progress.attempts,
                "validation_result": progress.validation_result or {},
                "student_notes": progress.student_notes,
                "started_at": progress.started_at,
                "completed_at": progress.completed_at,
            }
        )

    return {
        "assignment_id": assignment.id,
        "case_study_id": assignment.case_study_id,
        "scenario_code": assignment.case_study.scenario_code,
        "title": assignment.case_study.title,
        "description": assignment.case_study.description,
        "difficulty": assignment.case_study.difficulty,
        "category": assignment.case_study.category,
        "assignment_status": assignment.status,
        "assignee_name": assignment.assignee_name,
        "assignee_type": assignment.assignee_type,
        "initial_state": assignment.case_study.initial_state or {},
        "validation_rules": assignment.case_study.validation_rules or [],
        "completion_message": assignment.case_study.completion_message,
        "total_steps": len(steps),
        "completed_steps": sum(1 for step in steps if step["progress_status"] == "completed"),
        "failed_steps": sum(1 for step in steps if step["progress_status"] == "failed"),
        "current_task_order": assignment.current_task_order,
        "completion_percentage": assignment.completion_percentage,
        "started_at": assignment.started_at,
        "completed_at": assignment.completed_at,
        "steps": steps,
    }
