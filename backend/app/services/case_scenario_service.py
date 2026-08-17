from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.case_assignment import CaseAssignment
from app.models.case_progress import CaseTaskProgress
from app.models.case_study import CaseStudy, CaseTask
from app.models.case_task_attempt import CaseTaskAttempt
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


def _task_for_assignment(assignment: CaseAssignment, task_id: int) -> CaseTask:
    task = next((item for item in _ordered_tasks(assignment) if item.id == task_id), None)
    if not task:
        raise CaseScenarioError(
            "El paso no pertenece a esta asignación",
            code="TASK_NOT_IN_ASSIGNMENT",
            status_code=404,
        )
    return task


def _training_code(task: CaseTask) -> str:
    return str((task.trigger_condition or {}).get("training_code") or "").strip().upper()


def _is_evaluation_task(task: CaseTask) -> bool:
    code = _training_code(task)
    return len(code) == 3 and code.startswith("C") and code[1:].isdigit()


def _task_help_levels(task: CaseTask) -> list[tuple[str, str]]:
    config = task.feedback_config or {}
    configured_hints = config.get("hints")
    hints = [str(item).strip() for item in configured_hints] if isinstance(configured_hints, list) else []
    hints = [item for item in hints if item]

    first_hint = str(config.get("hint_1") or (hints[0] if hints else "")).strip()
    second_hint = str(config.get("hint_2") or (hints[1] if len(hints) > 1 else "")).strip()
    procedure = str(config.get("procedure") or "").strip()

    module_name = str(task.module or "módulo relacionado").strip()
    if not first_hint:
        first_hint = "Vuelve al encargo y revisa primero los datos que identifican a la persona, empresa, periodo o expediente del caso."
    if not second_hint:
        second_hint = f"Contrasta esos datos en «{module_name}» antes de modificar nada y vuelve después a comprobar la actividad."
    if not procedure:
        procedure = f"Abre «{module_name}», localiza el registro indicado en el encargo, revisa los campos relacionados con el resultado esperado y regresa al Centro de Actividades para comprobarlo."

    return [("hint", first_hint), ("hint", second_hint), ("procedure", procedure)]


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

    any_started = any(entry.status in {"in_progress", "checking", "completed", "failed"} for entry in assignment.progress_entries)
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
    if target_status not in {"in_progress", "checking", "completed"}:
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


def _score_validation(validation_result: dict, status: str) -> int | None:
    checks = [item for item in validation_result.get("checks") or [] if item.get("supported") is not False]
    if checks:
        passed = sum(1 for item in checks if item.get("passed"))
        return round((passed / len(checks)) * 100)
    if validation_result.get("passed") is True or status == "completed":
        return 100
    if validation_result.get("passed") is False or status == "failed":
        return 0
    return None


def _record_attempt(
    db: Session,
    assignment: CaseAssignment,
    task: CaseTask,
    progress: CaseTaskProgress,
    *,
    status: str,
    validation_result: dict,
    now: datetime,
) -> None:
    last_number = (
        db.query(func.max(CaseTaskAttempt.attempt_number))
        .filter(
            CaseTaskAttempt.assignment_id == assignment.id,
            CaseTaskAttempt.task_id == task.id,
        )
        .scalar()
        or 0
    )
    passed = validation_result.get("passed")
    attempt_status = "completed" if status == "completed" or passed is True else "failed" if status == "failed" or passed is False else status
    db.add(
        CaseTaskAttempt(
            assignment_id=assignment.id,
            task_id=task.id,
            attempt_number=last_number + 1,
            status=attempt_status,
            score=_score_validation(validation_result, attempt_status),
            hints_used=progress.hints_used or 0,
            validation_result=validation_result or {},
            started_at=progress.started_at,
            completed_at=now,
            created_at=now,
        )
    )


def update_assignment_step(
    db: Session,
    assignment_id: int,
    task_id: int,
    payload: CaseTaskProgressUpdate,
) -> dict:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = _task_for_assignment(assignment, task_id)

    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task_id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    _validate_step_sequence(assignment, task, payload.status)

    now = datetime.utcnow()
    previous_status = progress.status
    previous_result = dict(progress.validation_result or {})
    previous_validated_at = previous_result.get("validated_at")
    next_validated_at = (payload.validation_result or {}).get("validated_at")

    progress.status = payload.status
    progress.student_notes = payload.student_notes
    progress.validation_result = payload.validation_result
    progress.updated_at = now

    if payload.status in {"in_progress", "checking", "completed", "failed"}:
        progress.started_at = progress.started_at or now
    if payload.status == "completed":
        progress.completed_at = now
    elif payload.status != "completed":
        progress.completed_at = None

    terminal_transition = payload.status in {"completed", "failed"} and payload.status != previous_status
    validation_attempt = bool(next_validated_at and next_validated_at != previous_validated_at)
    if terminal_transition or validation_attempt:
        progress.attempts += 1
        _record_attempt(
            db,
            assignment,
            task,
            progress,
            status=payload.status,
            validation_result=payload.validation_result or {},
            now=now,
        )

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


def reveal_next_task_hint(db: Session, assignment_id: int, task_id: int) -> dict:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = _task_for_assignment(assignment, task_id)
    if _is_evaluation_task(task):
        raise CaseScenarioError(
            "Las evaluaciones prácticas no muestran pistas durante la realización.",
            code="HINTS_DISABLED_FOR_EVALUATION",
            status_code=403,
        )

    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task_id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    levels = _task_help_levels(task)
    next_level = min((progress.hints_used or 0) + 1, len(levels))
    kind, text_value = levels[next_level - 1]
    progress.hints_used = max(progress.hints_used or 0, next_level)
    progress.started_at = progress.started_at or datetime.utcnow()
    if progress.status == "pending":
        progress.status = "in_progress"
    progress.updated_at = datetime.utcnow()
    db.commit()

    return {
        "task_id": task.id,
        "level": next_level,
        "kind": kind,
        "text": text_value,
        "hints_used": progress.hints_used,
        "total_levels": len(levels),
    }


def get_assignment_attempts(db: Session, assignment_id: int, task_id: int | None = None) -> list[CaseTaskAttempt]:
    assignment = get_assignment(db, assignment_id)
    if not assignment:
        raise CaseScenarioError("Asignación no encontrada", code="ASSIGNMENT_NOT_FOUND", status_code=404)

    query = db.query(CaseTaskAttempt).filter(CaseTaskAttempt.assignment_id == assignment_id)
    if task_id is not None:
        _task_for_assignment(assignment, task_id)
        query = query.filter(CaseTaskAttempt.task_id == task_id)
    return query.order_by(CaseTaskAttempt.created_at.desc(), CaseTaskAttempt.id.desc()).all()


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
                "hints_used": progress.hints_used or 0,
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
