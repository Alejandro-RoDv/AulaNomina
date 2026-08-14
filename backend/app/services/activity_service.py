from __future__ import annotations

from collections import defaultdict
import re
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.company import Company
from app.models.work_center import WorkCenter
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
    "create_employee": "Se incorpora una nueva persona y todavía no existe su expediente laboral en AulaNomina. Crea su ficha con los datos indicados para poder continuar con el resto del proceso.",
    "assign_employee": "La ficha personal ya está preparada, pero falta completar su adscripción dentro de la organización. Debes dejar asignadas la empresa y el centro de trabajo correctos.",
    "create_contract": "Los datos personales están preparados y ahora hay que formalizar la relación laboral mediante el contrato indicado en el caso.",
    "review_contract": "Antes de modificar conceptos o cálculos posteriores, comprueba que la información contractual relevante coincide con la situación planteada.",
    "prepare_affiliation": "La relación laboral ya está preparada y ahora debes dejar coherente el movimiento de afiliación que se comunicará a la Seguridad Social.",
    "review_fie": "Se ha recibido información del INSS que afecta al expediente. Revisa la comunicación y contrástala con la situación del trabajador antes de continuar.",
    "reconcile_fie": "La comunicación del INSS debe quedar relacionada con la incidencia laboral correspondiente para mantener una única situación coherente en el expediente.",
    "create_incident": "Existe un hecho laboral que altera la situación ordinaria del trabajador. Regístralo con los datos y fechas indicados antes de revisar sus efectos posteriores.",
    "recalculate_payroll": "El expediente contiene un cambio con impacto económico. Vuelve a calcular el periodo afectado para que la nómina refleje la situación actual.",
    "update_payroll_concept": "Se ha detectado una diferencia en la estructura salarial. Revisa el concepto afectado y deja configurado el importe o criterio que corresponda.",
    "create_regularization": "Existe una diferencia sobre un periodo ya calculado. Genera la regularización necesaria conservando la trazabilidad entre el cálculo anterior y el nuevo resultado.",
    "filter_documents": "El expediente contiene documentación pendiente de revisión. Identifica qué elementos requieren actuación antes de modificar sus estados.",
    "update_document": "Ya se ha identificado un documento que requiere tratamiento. Actualiza su estado de acuerdo con la evidencia disponible en el expediente.",
    "review_documents": "El proceso documental debe terminar con un expediente coherente, sin elementos críticos pendientes de tratar.",
    "reply_mail": "La situación requiere una respuesta profesional por correo. Redacta la comunicación utilizando únicamente la información disponible en el expediente y en el hilo recibido.",
}

SUPPORTED_AUTOMATIC_ACTIONS = {
    "create_employee",
    "assign_employee",
    "create_contract",
    "prepare_affiliation",
    "review_contract",
    "update_payroll_concept",
    "recalculate_payroll",
    "create_regularization",
    "review_fie",
    "reconcile_fie",
    "reply_mail",
}

EMPLOYEE_DATA_LABELS = [
    ("first_name", "Nombre"),
    ("last_name", "Apellidos"),
    ("second_last_name", "Segundo apellido"),
    ("dni", "DNI/NIE"),
    ("naf", "NAF"),
    ("birth_date", "Fecha de nacimiento"),
    ("nationality", "Nacionalidad"),
    ("email", "Email"),
]

ASSIGNMENT_STATUS_PRIORITY = {
    "in_progress": 0,
    "assigned": 1,
    "needs_revision": 2,
    "submitted": 3,
    "reviewed": 4,
    "approved": 5,
}


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


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
        f"Continúas trabajando en el caso «{case_study.title}». "
        "Resuelve este paso manteniendo coherencia con los datos disponibles en el expediente."
    )


def _case_employee_name(case_study: CaseStudy) -> str | None:
    state = case_study.initial_state or {}
    direct = state.get("employee") or state.get("substitute")
    if direct:
        return str(direct).strip()

    for task in sorted(case_study.tasks, key=lambda item: (item.task_order, item.id)):
        description = str(task.description or "").strip()
        title = str(task.title or "").strip()
        if task.expected_action == "create_employee":
            match = re.search(r"Dar de alta a\s+(.+?)\s+con\b", description, flags=re.IGNORECASE)
            if match:
                return match.group(1).strip()
            match = re.search(r"Crear expediente de\s+(.+)$", title, flags=re.IGNORECASE)
            if match:
                return match.group(1).strip()
    return None


def _assignment_names(case_study: CaseStudy) -> tuple[str | None, str | None]:
    state = case_study.initial_state or {}
    company_name = state.get("company_name") or state.get("company")
    center_name = state.get("center_name") or state.get("center")

    task = next((item for item in case_study.tasks if item.expected_action == "assign_employee"), None)
    if task and (not company_name or not center_name):
        match = re.search(
            r"Vincular el trabajador a\s+(.+?)\s+y\s+(.+?)(?:\.|$)",
            str(task.description or ""),
            flags=re.IGNORECASE,
        )
        if match:
            company_name = company_name or match.group(1).strip()
            center_name = center_name or match.group(2).strip()
    return company_name, center_name


def _find_company_id(db: Session, name: str | None) -> int | None:
    if not name:
        return None
    expected = _normalize(name)
    for company in db.query(Company).all():
        if _normalize(company.name) == expected:
            return company.id
    return None


def _find_center_id(db: Session, name: str | None, company_id: int | None = None) -> int | None:
    if not name:
        return None
    expected = _normalize(name)
    query = db.query(WorkCenter)
    if company_id:
        query = query.filter(WorkCenter.company_id == company_id)
    for center in query.all():
        if _normalize(center.name) == expected:
            return center.id
    return None


def _case_data(db: Session, case_study: CaseStudy, task: CaseTask) -> list[dict[str, str]]:
    state = case_study.initial_state or {}
    action = (task.expected_action or "").strip()
    rows: list[dict[str, str]] = []

    employee_name = _case_employee_name(case_study)
    employee_data = state.get("employee_data") or {}
    if action == "create_employee" and employee_data:
        for field, label in EMPLOYEE_DATA_LABELS:
            value = employee_data.get(field)
            if value not in {None, ""}:
                rows.append({"label": label, "value": str(value)})
    elif employee_name:
        rows.append({"label": "Trabajador", "value": employee_name})

    if action == "assign_employee":
        company_name, center_name = _assignment_names(case_study)
        if company_name:
            rows.append({"label": "Empresa", "value": str(company_name)})
        if center_name:
            rows.append({"label": "Centro", "value": str(center_name)})
    elif action != "create_employee":
        replaced = state.get("replaced_employee")
        if replaced and _normalize(replaced) != _normalize(employee_name):
            rows.append({"label": "Persona sustituida", "value": str(replaced)})

        date_value = state.get("start_date") or state.get("leave_start") or state.get("effective_date")
        if date_value:
            rows.append({"label": "Fecha", "value": str(date_value)})

        period = state.get("payroll_period")
        if period:
            rows.append({"label": "Periodo", "value": str(period)})

    if case_study.scenario_code and len(rows) < 8:
        rows.append({"label": "Referencia", "value": case_study.scenario_code})

    return rows[:8]


def _expected_items(case_study: CaseStudy, task: CaseTask) -> list[str]:
    action = (task.expected_action or "").strip()
    state = case_study.initial_state or {}

    if action == "create_employee":
        if state.get("employee_data"):
            return [
                "Trabajador localizado en AulaNomina",
                "Datos identificativos coinciden con el caso",
                "Expediente activo",
            ]
        employee_name = _case_employee_name(case_study)
        return [f"Trabajador creado y activo: {employee_name}" if employee_name else "Trabajador creado y activo"]

    if action == "assign_employee":
        company_name, center_name = _assignment_names(case_study)
        items = []
        if company_name:
            items.append(f"Empresa: {company_name}")
        if center_name:
            items.append(f"Centro: {center_name}")
        return items or [task.expected_result or task.title]

    if action == "review_contract":
        return ["Contrato activo localizado", "Fecha de antigüedad informada en el contrato"]

    if action == "prepare_affiliation":
        items = ["Movimiento de alta preparado"]
        if state.get("start_date"):
            items.append(f"Fecha de alta: {state['start_date']}")
        return items

    if action == "create_incident":
        items = ["Incidencia registrada para el trabajador"]
        if state.get("leave_start"):
            items.append(f"Fecha de inicio: {state['leave_start']}")
        return items

    labels = {
        "create_contract": "Contrato activo registrado",
        "review_fie": "Comunicación FIE revisada",
        "reconcile_fie": "Comunicación FIE conciliada con la incidencia",
        "recalculate_payroll": "Nómina del periodo recalculada",
        "update_payroll_concept": "Concepto salarial requerido activo",
        "create_regularization": "Regularización aplicada y trazable",
        "reply_mail": "Respuesta enviada dentro del hilo profesional",
    }
    if action in labels:
        return [labels[action]]

    return [task.expected_result or task.title]


def _validation_attempted(validation_result: dict[str, Any]) -> bool:
    events = validation_result.get("events") or []
    return any(item.get("operation_status") in {"success", "error"} for item in events)


def _check_for(validation_result: dict[str, Any], *rule_types: str) -> dict[str, Any] | None:
    wanted = set(rule_types)
    return next(
        (item for item in (validation_result.get("checks") or []) if item.get("rule_type") in wanted),
        None,
    )


def _result_criteria(
    case_study: CaseStudy,
    task: CaseTask,
    validation_result: dict[str, Any],
    is_completed: bool,
) -> list[dict[str, str]]:
    labels = _expected_items(case_study, task)
    if is_completed or validation_result.get("passed") is True:
        return [{"label": label, "status": "passed"} for label in labels]

    if not _validation_attempted(validation_result):
        return [{"label": label, "status": "pending"} for label in labels]

    action = (task.expected_action or "").strip()
    if action == "create_employee" and len(labels) >= 3:
        check = _check_for(validation_result, "employee_profile_matches", "employee_exists") or {}
        evidence = check.get("evidence") or {}
        employee_found = bool(evidence.get("employee_id"))
        field_matches = evidence.get("field_matches") or {}
        identity_status = "passed" if field_matches and all(field_matches.values()) else "failed"
        if not field_matches and employee_found:
            identity_status = "pending"
        return [
            {"label": labels[0], "status": "passed" if employee_found else "failed"},
            {"label": labels[1], "status": identity_status},
            {"label": labels[2], "status": "passed" if evidence.get("is_active") else "failed"},
        ]

    if action == "assign_employee" and len(labels) >= 2:
        check = _check_for(validation_result, "employee_assignment") or {}
        evidence = check.get("evidence") or {}
        return [
            {"label": labels[0], "status": "passed" if evidence.get("company_matches") else "failed"},
            {"label": labels[1], "status": "passed" if evidence.get("center_matches") else "failed"},
        ]

    if action == "review_contract" and len(labels) >= 2:
        check = _check_for(validation_result, "seniority_date_checked") or {}
        evidence = check.get("evidence") or {}
        return [
            {"label": labels[0], "status": "passed" if evidence.get("contract_id") else "failed"},
            {"label": labels[1], "status": "passed" if evidence.get("seniority_date") else "failed"},
        ]

    if action == "prepare_affiliation" and len(labels) >= 2:
        check = _check_for(validation_result, "affiliation_prepared") or {}
        evidence = check.get("evidence") or {}
        return [
            {"label": labels[0], "status": "passed" if evidence.get("registration_id") else "failed"},
            {"label": labels[1], "status": "passed" if evidence.get("date_matches") else "failed"},
        ]

    failed = any(not item.get("passed") for item in (validation_result.get("checks") or []) if item.get("supported", True))
    status = "failed" if failed else "pending"
    return [{"label": label, "status": status} for label in labels]


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
    explicit_review = (task.trigger_condition or {}).get("validation_interaction") == "explicit_review"
    automatic = explicit_review or (bool(rules) and (
        action in SUPPORTED_AUTOMATIC_ACTIONS
        or any((rule.get("type") or "") in {
            "employee_exists",
            "employee_profile_matches",
            "employee_assignment",
            "active_contract",
            "affiliation_prepared",
            "incident_exists",
            "review_fie",
            "reconcile_fie",
            "payroll_recalculated",
            "seniority_date_checked",
            "payroll_concept_exists",
            "regularization_created",
            "reply_mail",
        } for rule in rules)
    ))
    return {
        "action": action,
        "rules": rules,
        "automatic": automatic,
    }


def _activity_context(db: Session, assignment: CaseAssignment, task: CaseTask) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    company_name, center_name = _assignment_names(assignment.case_study)
    company_id = assignment.case_study.company_id or _find_company_id(db, company_name)
    center_id = _find_center_id(db, center_name, company_id)
    return {
        "assignmentId": assignment.id,
        "taskId": task.id,
        "actionCode": task.expected_action,
        "moduleCode": task.module,
        "scenarioCode": assignment.case_study.scenario_code,
        "employeeName": _case_employee_name(assignment.case_study),
        "companyId": company_id,
        "centerId": center_id,
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
        ordered_tasks = sorted(case_study.tasks, key=lambda item: (item.task_order, item.id))
        total_case_steps = len(ordered_tasks)

        for case_position, task in enumerate(ordered_tasks, start=1):
            topic_order, topic_key, topic_title = _topic_for_task(task)
            progress = progress_by_task.get(task.id)
            status = progress.status if progress else "pending"
            validation_result = progress.validation_result if progress else {}
            learning = _learning_for_task(task, case_study.difficulty)
            requires_mail = task.trigger_type == "mail_response"
            condition = _condition_for_task(task)
            is_completed = status == "completed"
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
                    "case_step": case_position,
                    "case_total_steps": total_case_steps,
                    "title": task.title,
                    "situation": _situation_for_task(case_study, task),
                    "objective": task.expected_result or task.title,
                    "expected_items": _expected_items(case_study, task),
                    "result_criteria": _result_criteria(case_study, task, validation_result, is_completed),
                    "case_data": _case_data(db, case_study, task),
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
                    "is_completed": is_completed,
                    "difficulty": case_study.difficulty,
                    "module": task.module,
                    "context": _activity_context(db, assignment, task),
                    "validation_result": validation_result,
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
