from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.services.case_scenario_service import ensure_assignment_progress


COURSE_TITLE = "Curso práctico de gestión laboral"

COURSE_TOPICS = [
    (1, "environment", "Entorno y expediente laboral"),
    (2, "hiring", "Contratación"),
    (3, "payroll", "Nómina"),
    (4, "labor", "Gestión laboral"),
    (5, "social-security", "Seguridad Social"),
    (6, "tax", "Fiscalidad"),
    (7, "documents", "Gestión documental"),
    (8, "integral", "Casos integrales"),
]

MODULE_TOPIC = {
    "employees": "environment",
    "companies": "environment",
    "work-centers": "environment",
    "contracts": "hiring",
    "payrolls": "payroll",
    "regularizations": "payroll",
    "incidents": "labor",
    "affiliations": "social-security",
    "fie": "social-security",
    "siltra": "social-security",
    "social-security": "social-security",
    "irpf": "tax",
    "tax": "tax",
    "model111": "tax",
    "model190": "tax",
    "documents": "documents",
}

MODULE_LEARNING = {
    "employees": {
        "title": "Expediente laboral",
        "body": "El expediente reúne los datos personales y administrativos que identifican al trabajador y permiten relacionar después contratos, incidencias, nóminas y documentación.",
        "hint": "Encontrarás esta operación en Personas → Trabajadores.",
    },
    "contracts": {
        "title": "Contrato de trabajo",
        "body": "El contrato define la relación laboral, su modalidad, fecha de inicio, jornada y demás condiciones que condicionan procesos posteriores de nómina y Seguridad Social.",
        "hint": "La operación se gestiona desde Contratación → Contratos.",
    },
    "incidents": {
        "title": "Incidencias laborales",
        "body": "Las incidencias registran hechos que alteran la prestación ordinaria de servicios, como una IT, una ausencia, vacaciones o una variación con impacto laboral o económico.",
        "hint": "Revisa Gestión laboral → Incidencias.",
    },
    "payrolls": {
        "title": "Nómina",
        "body": "La nómina transforma la situación contractual y las incidencias del periodo en devengos, bases, deducciones y líquido. Una modificación previa puede obligar a recalcularla.",
        "hint": "Trabaja desde el área de Nómina y revisa el periodo afectado.",
    },
    "regularizations": {
        "title": "Regularización",
        "body": "Una regularización corrige diferencias de periodos ya calculados manteniendo trazabilidad entre el importe original y el resultado actualizado.",
        "hint": "Localiza la nómina afectada y su flujo de regularización.",
    },
    "affiliations": {
        "title": "Afiliación a la Seguridad Social",
        "body": "Las altas, bajas y variaciones comunican cambios en la relación del trabajador con la Seguridad Social y deben ser coherentes con las fechas y datos contractuales.",
        "hint": "Encontrarás los movimientos en Seguridad Social → Afiliación.",
    },
    "fie": {
        "title": "Comunicación FIE",
        "body": "El FIE facilita información del INSS que debe revisarse y, cuando procede, conciliarse con las incidencias registradas en el expediente del trabajador.",
        "hint": "Consulta Seguridad Social → Comunicaciones INSS (FIE).",
    },
    "documents": {
        "title": "Gestión documental laboral",
        "body": "El expediente documental permite controlar qué documentos existen, cuáles están pendientes y qué evidencias respaldan cada proceso laboral.",
        "hint": "Revisa Documentación → Documentos y el expediente del trabajador.",
    },
}

DEFAULT_LEARNING = {
    "title": "Proceso de gestión laboral",
    "body": "Interpreta la situación, identifica el proceso profesional afectado y ejecuta la operación dentro del ERP manteniendo coherencia con el resto del expediente.",
    "hint": "Identifica primero qué área del ERP corresponde al resultado solicitado.",
}

ACTIVITY_CONTEXT = {
    "create_employee": "El proceso comienza con la creación del expediente de la persona que va a incorporarse. Este paso debe quedar resuelto antes de continuar con su contratación y documentación.",
    "assign_employee": "El trabajador debe quedar vinculado a la estructura de la organización. Completa su empresa y centro para que el resto del expediente utilice la adscripción correcta.",
    "create_contract": "Con los datos personales preparados, el siguiente paso es formalizar la relación laboral mediante el contrato indicado en el caso.",
    "review_contract": "Hay que comprobar que la información contractual relevante coincide con la situación planteada antes de modificar conceptos o cálculos posteriores.",
    "prepare_affiliation": "La relación laboral ya está preparada y ahora debes dejar coherente el movimiento de afiliación que se comunicará a la Seguridad Social.",
    "review_fie": "Se ha recibido información del INSS que afecta al expediente. Antes de continuar, revisa la comunicación y contrástala con la situación del trabajador.",
    "reconcile_fie": "La comunicación del INSS debe quedar relacionada con la incidencia laboral correspondiente para mantener una única situación coherente en el expediente.",
    "create_incident": "Existe un hecho laboral que altera la situación ordinaria del trabajador. Regístralo con los datos y fechas indicados antes de revisar sus efectos posteriores.",
    "recalculate_payroll": "El expediente contiene un cambio con impacto económico. Debes volver a calcular el periodo afectado para que la nómina refleje la situación actual.",
    "update_payroll_concept": "Se ha detectado una diferencia en la estructura salarial. Revisa el concepto afectado y deja configurado el importe o criterio que corresponda.",
    "create_regularization": "Existe una diferencia sobre un periodo ya calculado. Genera la regularización necesaria conservando la trazabilidad entre el cálculo anterior y el nuevo resultado.",
    "filter_documents": "El expediente contiene documentación pendiente de revisión. Identifica primero qué elementos requieren actuación antes de modificar sus estados.",
    "update_document": "Ya se ha identificado un documento que requiere tratamiento. Actualiza su estado de acuerdo con la evidencia disponible en el expediente.",
    "review_documents": "El proceso documental debe terminar con un expediente coherente, sin elementos críticos pendientes de tratar.",
    "reply_mail": "La situación requiere una respuesta profesional por correo. Redacta la comunicación utilizando únicamente la información disponible en el expediente y en el hilo recibido.",
}

SUPPORTED_AUTOMATIC_ACTIONS = {
    "create_employee",
    "create_contract",
    "prepare_affiliation",
    "review_contract",
    "update_payroll_concept",
    "recalculate_payroll",
    "review_fie",
    "reconcile_fie",
    "reply_mail",
}

ASSIGNMENT_STATUS_PRIORITY = {
    "in_progress": 0,
    "assigned": 1,
    "needs_revision": 2,
    "submitted": 3,
    "reviewed": 4,
    "approved": 5,
}


def _topic_for_task(task: CaseTask) -> tuple[int, str, str]:
    topic_key = MODULE_TOPIC.get((task.module or "").strip().lower(), "integral")
    return next(item for item in COURSE_TOPICS if item[1] == topic_key)


def _learning_for_task(task: CaseTask, difficulty: str | None) -> dict[str, str]:
    learning = MODULE_LEARNING.get((task.module or "").strip().lower(), DEFAULT_LEARNING)
    hint = learning["hint"]
    level = (difficulty or "basic").lower()
    if level in {"advanced", "expert"}:
        hint = "Identifica el proceso correcto a partir de la situación y del resultado esperado."
    elif level in {"intermediate", "medium"}:
        hint = hint.replace("Encontrarás esta operación en ", "Revisa el área ").replace("Encontrarás los movimientos en ", "Revisa ")
    return {**learning, "hint": hint}


def _situation_for_task(case_study: CaseStudy, task: CaseTask) -> str:
    action = (task.expected_action or "").strip()
    specific = ACTIVITY_CONTEXT.get(action)
    if specific:
        return specific

    module = (task.module or "").strip().lower()
    if module == "documents":
        return ACTIVITY_CONTEXT["review_documents"]
    if module == "incidents":
        return ACTIVITY_CONTEXT["create_incident"]

    return (
        f"Estás trabajando en el caso «{case_study.title}». "
        "Resuelve este paso antes de continuar con las siguientes operaciones del expediente."
    )


def _select_assignments(db: Session) -> list[CaseAssignment]:
    assignments = (
        db.query(CaseAssignment)
        .join(CaseStudy, CaseAssignment.case_study_id == CaseStudy.id)
        .filter(CaseStudy.status == "active")
        .order_by(CaseStudy.id.asc(), CaseAssignment.id.asc())
        .all()
    )

    selected: dict[int, CaseAssignment] = {}
    for assignment in assignments:
        current = selected.get(assignment.case_study_id)
        if current is None:
            selected[assignment.case_study_id] = assignment
            continue
        candidate_rank = ASSIGNMENT_STATUS_PRIORITY.get(assignment.status, 99)
        current_rank = ASSIGNMENT_STATUS_PRIORITY.get(current.status, 99)
        if (candidate_rank, assignment.id) < (current_rank, current.id):
            selected[assignment.case_study_id] = assignment

    return [selected[key] for key in sorted(selected)]


def _condition_for_task(task: CaseTask) -> dict[str, Any]:
    rules = list(task.validation_rules or [])
    if not rules and task.expected_action:
        rules = [{"type": task.expected_action}]
    action = task.expected_action or (rules[0].get("type") if rules else None)
    automatic = bool(rules) and (
        action in SUPPORTED_AUTOMATIC_ACTIONS
        or any((rule.get("type") or "") in {
            "employee_exists",
            "active_contract",
            "affiliation_prepared",
            "incident_exists",
            "review_fie",
            "reconcile_fie",
            "payroll_recalculated",
            "seniority_date_checked",
            "payroll_concept_exists",
            "reply_mail",
        } for rule in rules)
    )
    return {
        "action": action,
        "rules": rules,
        "automatic": automatic,
    }


def _activity_context(assignment: CaseAssignment, task: CaseTask) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    return {
        "assignmentId": assignment.id,
        "taskId": task.id,
        "actionCode": task.expected_action,
        "moduleCode": task.module,
        "scenarioCode": assignment.case_study.scenario_code,
        "employeeName": state.get("employee") or state.get("substitute"),
        "companyId": assignment.case_study.company_id,
        "period": state.get("payroll_period"),
        "startDate": state.get("start_date") or state.get("leave_start") or state.get("effective_date"),
    }


def build_activity_course(db: Session) -> dict[str, Any]:
    assignments = _select_assignments(db)
    activities: list[dict[str, Any]] = []

    for lightweight_assignment in assignments:
        assignment = ensure_assignment_progress(db, lightweight_assignment.id)
        if not assignment.case_study:
            continue

        progress_by_task = {entry.task_id: entry for entry in assignment.progress_entries}
        mail_thread_ids = [thread.id for thread in assignment.email_threads]
        case_study = assignment.case_study

        for task in sorted(case_study.tasks, key=lambda item: (item.task_order, item.id)):
            topic_order, topic_key, topic_title = _topic_for_task(task)
            progress = progress_by_task.get(task.id)
            status = progress.status if progress else "pending"
            learning = _learning_for_task(task, case_study.difficulty)
            requires_mail = task.trigger_type == "mail_response"
            condition = _condition_for_task(task)
            activities.append(
                {
                    "id": f"{assignment.id}:{task.id}",
                    "assignment_id": assignment.id,
                    "task_id": task.id,
                    "scenario_code": case_study.scenario_code,
                    "topic_key": topic_key,
                    "topic_order": topic_order,
                    "topic_title": topic_title,
                    "unit": case_study.title,
                    "order": task.task_order,
                    "title": task.title,
                    "situation": _situation_for_task(case_study, task),
                    "objective": task.expected_result or task.title,
                    "instructions": task.description or task.expected_result or task.title,
                    "concepts": {
                        "title": learning["title"],
                        "body": learning["body"],
                    },
                    "hint": learning["hint"],
                    "requires_mail": requires_mail,
                    "related_mail_thread_ids": mail_thread_ids if requires_mail else [],
                    "completion_condition": condition,
                    "status": status,
                    "is_completed": status == "completed",
                    "difficulty": case_study.difficulty,
                    "module": task.module,
                    "context": _activity_context(assignment, task),
                    "validation_result": progress.validation_result if progress else {},
                }
            )

    activities.sort(key=lambda item: (item["topic_order"], item["assignment_id"], item["order"], item["task_id"]))
    for index, activity in enumerate(activities, start=1):
        activity["course_order"] = index

    incomplete = [activity for activity in activities if not activity["is_completed"]]
    current_activity_id = incomplete[0]["id"] if incomplete else (activities[-1]["id"] if activities else None)
    next_activity_id = incomplete[1]["id"] if len(incomplete) > 1 else None

    topic_activities: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for activity in activities:
        topic_activities[activity["topic_key"]].append(activity)

    topics = []
    for topic_order, topic_key, topic_title in COURSE_TOPICS:
        items = topic_activities.get(topic_key, [])
        completed = sum(1 for item in items if item["is_completed"])
        for position, item in enumerate(items, start=1):
            item["display_number"] = f"{topic_order}.{position}"
            item["is_current"] = item["id"] == current_activity_id
        total = len(items)
        topics.append(
            {
                "key": topic_key,
                "order": topic_order,
                "title": topic_title,
                "completed": completed,
                "total": total,
                "progress_percentage": 0 if total == 0 else round((completed / total) * 100),
                "activities": items,
            }
        )

    total = len(activities)
    completed = sum(1 for activity in activities if activity["is_completed"])
    pending = total - completed

    return {
        "course": {
            "title": COURSE_TITLE,
            "completed": completed,
            "total": total,
            "pending": pending,
            "progress_percentage": 0 if total == 0 else round((completed / total) * 100),
            "current_activity_id": current_activity_id,
            "next_activity_id": next_activity_id,
        },
        "topics": topics,
    }
