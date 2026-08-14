"""Adaptador entre el motor ejecutable y el Temario Maestro AulaNomina 2026.

La Fase B es progresiva: las tareas ya migradas toman su contenido del catálogo
versionado y las tareas heredadas siguen siendo ejecutables. Los casos complejos
pueden representar una práctica integral mediante varios subpasos de CaseTask.
"""

from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_study import CaseTask
from app.services.activity_service import build_activity_course as build_legacy_activity_course
from app.training import COURSE_BLUEPRINT_2026, get_training_activity_2026, list_training_activities_2026
from app.training.runtime_bindings_2026 import get_runtime_binding_2026


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"

TRAINING_BLOCKS = [
    {
        "code": block["code"],
        "order": index,
        "title": block["title"],
    }
    for index, block in enumerate(COURSE_BLUEPRINT_2026["blocks"], start=1)
]
TRAINING_BLOCK_BY_CODE = {item["code"]: item for item in TRAINING_BLOCKS}
TRAINING_ACTIVITY_ORDER = {
    activity["code"]: index
    for index, activity in enumerate(list_training_activities_2026(include_source_metadata=False), start=1)
}

LEGACY_BLOCK_BY_TOPIC = {
    "environment": "B01",
    "hiring": "B02",
    "payroll": "B03",
    "labor": "B04",
    "social-security": "B05",
    "tax": "B06",
    "documents": "B09",
    "integral": "B10",
}

INTEGRAL_CASE_CODES = {
    "IT-2026-008": "C02",
    "NOM-2026-014": "C03",
}

GUIDED_MULTISTEP_SCENARIOS = {
    "TRAIN-2026-INCIDENT-A23": "A23",
    "TRAIN-2026-INCIDENT-A24": "A24",
    "TRAIN-2026-INCIDENT-A25": "A25",
    "TRAIN-2026-INCIDENT-A26": "A26",
    "TRAIN-2026-INCIDENT-A27": "A27",
    "TRAIN-2026-SS-A35": "A35",
}

MULTISTEP_CASE_TITLES = {
    "Expediente documental incompleto": "A52",
}


def _explicit_training_code(task: CaseTask | None) -> str | None:
    if task is None:
        return None
    code = (task.trigger_condition or {}).get("training_code")
    return str(code).strip().upper() if code else None


def _runtime_descriptor(task: CaseTask | None) -> dict[str, Any] | None:
    """Resuelve qué práctica maestra representa una tarea heredada o migrada."""
    if task is None or task.case_study is None:
        return None

    explicit = _explicit_training_code(task)
    if explicit:
        return {
            "code": explicit,
            "kind": "guided",
            "substep": None,
            "substep_total": None,
            "inferred": False,
        }

    scenario_code = str(task.case_study.scenario_code or "").strip().upper()
    integral_code = INTEGRAL_CASE_CODES.get(scenario_code)
    if integral_code:
        total = len(task.case_study.tasks or [])
        return {
            "code": integral_code,
            "kind": "integral_case",
            "substep": int(task.task_order or 1),
            "substep_total": total,
            "inferred": True,
        }

    guided_code = GUIDED_MULTISTEP_SCENARIOS.get(scenario_code)
    if guided_code:
        total = len(task.case_study.tasks or [])
        return {
            "code": guided_code,
            "kind": "guided_multistep",
            "substep": int(task.task_order or 1),
            "substep_total": total,
            "inferred": True,
        }

    multistep_code = MULTISTEP_CASE_TITLES.get(str(task.case_study.title or "").strip())
    if multistep_code:
        total = len(task.case_study.tasks or [])
        return {
            "code": multistep_code,
            "kind": "guided_multistep",
            "substep": int(task.task_order or 1),
            "substep_total": total,
            "inferred": True,
        }

    if scenario_code == "ALT-2026-021" and task.expected_action == "create_contract":
        return {
            "code": "A09",
            "kind": "guided",
            "substep": None,
            "substep_total": None,
            "inferred": True,
        }

    return None


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
    salary_structure = state.get("salary_structure") or {}
    incident_data = state.get("incident_data") or {}
    workday_change = state.get("workday_change") or {}
    affiliation_data = state.get("affiliation_data") or {}
    fie_data = state.get("fie_data") or {}
    cra_data = state.get("cra_data") or {}
    settlement_data = state.get("settlement_data") or {}
    siltra_data = state.get("siltra_data") or {}

    if code == "A07":
        _append_case_row(rows, "Fecha de inicio", state.get("start_date"))
        _append_case_row(rows, "Jornada", contract_data.get("working_day"))
        _append_case_row(rows, "Horas semanales", contract_data.get("weekly_hours"))
        _append_case_row(rows, "Puesto", contract_data.get("job_position"))

    if code == "A09":
        _append_case_row(rows, "Persona sustituta", state.get("substitute"))
        _append_case_row(rows, "Persona sustituida", state.get("replaced_employee"))
        _append_case_row(rows, "Fecha de inicio", state.get("start_date"))

    if code == "A29":
        _append_case_row(rows, "NAF", employee_data.get("naf"))
        _append_case_row(rows, "Fecha de alta", state.get("start_date"))
        _append_case_row(rows, "Empresa", state.get("company_name"))
        _append_case_row(rows, "Centro", state.get("center_name"))

    if code == "A14":
        _append_case_row(rows, "Salario base", salary_structure.get("base_salary"))
        _append_case_row(rows, "Complemento", salary_structure.get("complement_name"))
        _append_case_row(rows, "Importe complemento", salary_structure.get("complement_amount"))
        _append_case_row(rows, "Pagas actuales", salary_structure.get("current_pay_schedule_label") or salary_structure.get("pay_schedule_label"))

    if code == "A15":
        _append_case_row(rows, "Modalidad actual", salary_structure.get("current_pay_schedule_label"))
        _append_case_row(rows, "Objetivo", salary_structure.get("target_pay_schedule_label"))
        _append_case_row(rows, "Contrato", "Modificar la modalidad de abono de pagas")

    if code == "A16":
        _append_case_row(rows, "Periodo", state.get("payroll_period"))
        _append_case_row(rows, "Tipo de cálculo", "Nómina mensual ordinaria")
        _append_case_row(rows, "Pagas", salary_structure.get("target_pay_schedule_label") or salary_structure.get("pay_schedule_label"))
        _append_case_row(rows, "Incidencias", "Sin incidencias en el periodo")

    if code == "A17":
        _append_case_row(rows, "Periodo", state.get("payroll_period"))
        _append_case_row(rows, "Fecha de alta", state.get("start_date"))
        _append_case_row(rows, "Días esperados", state.get("expected_payroll_days"))
        _append_case_row(rows, "Salario mensual", salary_structure.get("base_salary"))

    if code == "A18":
        _append_case_row(rows, "Periodo", state.get("payroll_period"))
        _append_case_row(rows, "Revisión", "Base de contingencias comunes")
        _append_case_row(rows, "Referencia", "Bases y tipos 2026")

    if code == "A19":
        _append_case_row(rows, "Periodo", state.get("payroll_period"))
        _append_case_row(rows, "Revisión", "Base común frente a base profesional")
        _append_case_row(rows, "Horas extraordinarias", salary_structure.get("overtime_amount") or "0,00 €")

    if code == "A20":
        _append_case_row(rows, "Periodo", state.get("payroll_period"))
        _append_case_row(rows, "Revisión", "Aportaciones de la persona trabajadora")
        _append_case_row(rows, "Cuotas", "CC · desempleo · formación · MEI")

    if code == "A21":
        _append_case_row(rows, "Periodo", state.get("payroll_period"))
        _append_case_row(rows, "Revisión", "Retención IRPF aplicada")
        _append_case_row(rows, "Criterio", "Perfil fiscal + cálculo IRPF 2026")

    if code == "A22":
        _append_case_row(rows, "Periodo", state.get("payroll_period"))
        _append_case_row(rows, "Revisión", "Bruto · deducciones · líquido · coste empresa")
        _append_case_row(rows, "Criterio", "Líquido = bruto - deducciones")

    if code in {"A23", "A24", "A25", "A26"}:
        _append_case_row(rows, "Trabajador", state.get("employee"))
        _append_case_row(rows, "Fecha inicial", incident_data.get("start_date"))
        _append_case_row(rows, "Fecha final", incident_data.get("end_date"))
        _append_case_row(rows, "Tipo", incident_data.get("incident_type"))
        if incident_data.get("process_type"):
            _append_case_row(rows, "Contingencia", incident_data.get("process_type"))
        if incident_data.get("expected_days"):
            _append_case_row(rows, "Días", incident_data.get("expected_days"))
        if state.get("payroll_period"):
            _append_case_row(rows, "Periodo nómina", state.get("payroll_period"))
        if incident_data.get("fie_process_reference"):
            _append_case_row(rows, "Referencia FIE", incident_data.get("fie_process_reference"))

    if code == "A27":
        _append_case_row(rows, "Trabajador", state.get("employee"))
        _append_case_row(rows, "Fecha de efectos", workday_change.get("effective_date"))
        _append_case_row(rows, "Jornada anterior", f"{workday_change.get('previous_weekly_hours')} h/semana" if workday_change.get("previous_weekly_hours") else None)
        _append_case_row(rows, "Nueva jornada", f"{workday_change.get('target_weekly_hours')} h/semana" if workday_change.get("target_weekly_hours") else None)
        _append_case_row(rows, "Parcialidad objetivo", f"{workday_change.get('target_partiality_coefficient')} %" if workday_change.get("target_partiality_coefficient") else None)
        _append_case_row(rows, "Periodo nómina", state.get("payroll_period"))

    if code == "A28":
        _append_case_row(rows, "Trabajador", state.get("employee"))
        _append_case_row(rows, "Empresa", state.get("company_name"))
        _append_case_row(rows, "Centro", state.get("center_name"))
        _append_case_row(rows, "CCC esperado", affiliation_data.get("expected_ccc"))
        _append_case_row(rows, "Fecha de referencia", affiliation_data.get("reference_date"))

    if code == "A30":
        _append_case_row(rows, "Trabajador", state.get("employee"))
        _append_case_row(rows, "Movimiento", affiliation_data.get("movement_type"))
        _append_case_row(rows, "Fecha de efectos", affiliation_data.get("effective_date"))
        _append_case_row(rows, "CCC", affiliation_data.get("expected_ccc"))

    if code in {"A31", "A32"}:
        _append_case_row(rows, "Trabajador", state.get("employee"))
        _append_case_row(rows, "Referencia FIE", fie_data.get("process_reference"))
        _append_case_row(rows, "Tipo", fie_data.get("communication_type"))
        _append_case_row(rows, "Contingencia", fie_data.get("contingency_type"))
        _append_case_row(rows, "Fecha", fie_data.get("event_date") or fie_data.get("expected_incident_start"))
        if code == "A32":
            _append_case_row(rows, "Resultado esperado", fie_data.get("expected_status"))

    if code == "A33":
        _append_case_row(rows, "Empresa", state.get("company_name"))
        _append_case_row(rows, "Periodo", cra_data.get("period"))
        _append_case_row(rows, "CCC", cra_data.get("ccc"))
        _append_case_row(rows, "Contenido", "Trabajadores TRB y conceptos CRE")

    if code == "A34":
        _append_case_row(rows, "Empresa", state.get("company_name"))
        _append_case_row(rows, "Periodo", settlement_data.get("period"))
        _append_case_row(rows, "CCC", settlement_data.get("ccc"))
        _append_case_row(rows, "Revisión", "RNT nominal + RLC total")

    if code == "A35":
        _append_case_row(rows, "Empresa", state.get("company_name"))
        _append_case_row(rows, "Periodo", siltra_data.get("period"))
        _append_case_row(rows, "CCC", siltra_data.get("ccc"))
        _append_case_row(rows, "Fichero", siltra_data.get("source_file_type"))
        _append_case_row(rows, "Primer escenario", siltra_data.get("first_scenario"))

    return rows[:8]


def _catalog_result_criteria(
    activity: dict[str, Any],
    training: dict[str, Any],
    binding: dict[str, Any] | None,
) -> list[dict[str, str]]:
    if not (binding or {}).get("use_catalog_result_criteria"):
        return list(activity.get("result_criteria") or [])

    labels = list(training.get("evaluation_criteria") or [])
    if not labels:
        return list(activity.get("result_criteria") or [])

    validation = activity.get("validation_result") or {}
    if activity.get("is_completed") or validation.get("passed") is True:
        status = "passed"
    elif validation.get("validated_at"):
        status = "failed"
    else:
        status = "pending"
    return [{"label": label, "status": status} for label in labels]


def _enrich_activity(activity: dict[str, Any], task: CaseTask) -> dict[str, Any]:
    descriptor = _runtime_descriptor(task)
    if not descriptor:
        return activity

    code = descriptor["code"]
    training = get_training_activity_2026(code, include_source_metadata=False)
    if training is None:
        return activity

    binding = get_runtime_binding_2026(code)
    enriched = deepcopy(activity)
    is_substep = descriptor["substep"] is not None

    if is_substep:
        display_number = f"{code}.{descriptor['substep']}"
        display_title = activity.get("title") or training["title"]
        instructions = activity.get("instructions") or activity.get("objective") or display_title
    else:
        display_number = code
        display_title = training["title"]
        actions = [action.rstrip(".") for action in (training.get("expected_actions") or []) if action]
        instructions = ". ".join(actions)
        if instructions and not instructions.endswith("."):
            instructions += "."

    trigger_condition = task.trigger_condition or {}
    validation_interaction = (
        trigger_condition.get("validation_interaction")
        or (binding or {}).get("validation_interaction")
        or "operation"
    )

    enriched.update(
        {
            "training_code": code,
            "master_activity_title": training["title"],
            "catalog_code": COURSE_CODE,
            "catalog_version": COURSE_VERSION,
            "display_number": display_number,
            "title": display_title,
            "unit": training["unit_title"],
            "unit_code": training["unit_code"],
            "topic_key": training["block_code"].lower(),
            "topic_order": TRAINING_BLOCK_BY_CODE[training["block_code"]]["order"],
            "topic_title": training["block_title"],
            "block_code": training["block_code"],
            "situation": training["professional_situation"],
            "objective": training["learning_objective"],
            "instructions": instructions or training["learning_objective"],
            "concepts": {
                "title": "Conceptos relacionados",
                "body": ". ".join(training.get("theory_topics") or []) + ".",
            },
            "hint": (training.get("feedback_if_failed") or [activity.get("hint")])[0],
            "case_data": _training_case_data(task, code, activity.get("case_data") or []),
            "catalog_prerequisites": list(training.get("prerequisites") or []),
            "runtime_prerequisites": list((binding or {}).get("runtime_prerequisites") or []),
            "student_inputs": list(training.get("student_inputs") or []),
            "expected_actions": list(training.get("expected_actions") or []),
            "evaluation_criteria": list(training.get("evaluation_criteria") or []),
            "theory_topics": list(training.get("theory_topics") or []),
            "feedback_if_failed": list(training.get("feedback_if_failed") or []),
            "official_source_codes": list(training.get("sources") or []),
            "validation_interaction": validation_interaction,
            "runtime_migrated": True,
            "runtime_migration_kind": descriptor["kind"],
            "runtime_binding_inferred": descriptor["inferred"],
            "training_substep": descriptor["substep"],
            "training_substep_total": descriptor["substep_total"],
        }
    )
    enriched["result_criteria"] = _catalog_result_criteria(enriched, training, binding)
    enriched["context"] = {
        **(enriched.get("context") or {}),
        "trainingCode": code,
        "courseCode": COURSE_CODE,
        "trainingSubstep": descriptor["substep"],
    }
    return enriched


def _legacy_block_code(activity: dict[str, Any]) -> str:
    if activity.get("module") == "regularizations":
        return "B07"
    return LEGACY_BLOCK_BY_TOPIC.get(activity.get("topic_key"), "B10")


def _activity_sort_key(activity: dict[str, Any]) -> tuple[int, int, int]:
    code = activity.get("training_code")
    if code:
        return (
            0,
            TRAINING_ACTIVITY_ORDER.get(code, 9999),
            int(activity.get("training_substep") or 0),
        )
    return (1, int(activity.get("course_order") or 9999), int(activity.get("task_id") or 0))


def _regroup_course_topics(course: dict[str, Any]) -> dict[str, Any]:
    """Reconstruye las columnas usando los 10 bloques del Temario Maestro."""
    activities = [
        activity
        for topic in course.get("topics", [])
        for activity in topic.get("activities", [])
    ]

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for activity in activities:
        block_code = activity.get("block_code") or _legacy_block_code(activity)
        activity["block_code"] = block_code
        grouped[block_code].append(activity)

    rebuilt_topics = []
    ordered_activities: list[dict[str, Any]] = []
    for block in TRAINING_BLOCKS:
        items = sorted(grouped.get(block["code"], []), key=_activity_sort_key)
        legacy_position = 0
        for item in items:
            if not item.get("runtime_migrated"):
                legacy_position += 1
                item["display_number"] = f"{block['order']}.{legacy_position}"
                item["topic_key"] = block["code"].lower()
                item["topic_order"] = block["order"]
                item["topic_title"] = block["title"]
            ordered_activities.append(item)

        completed = sum(1 for item in items if item.get("is_completed"))
        total = len(items)
        rebuilt_topics.append(
            {
                "key": block["code"].lower(),
                "code": block["code"],
                "order": block["order"],
                "title": block["title"],
                "completed": completed,
                "total": total,
                "progress_percentage": 0 if total == 0 else round((completed / total) * 100),
                "activities": items,
            }
        )

    for index, activity in enumerate(ordered_activities, start=1):
        activity["course_order"] = index
        activity["is_current"] = False

    migrated_incomplete = [
        activity
        for activity in ordered_activities
        if activity.get("runtime_migrated") and not activity.get("is_completed")
    ]
    any_incomplete = [activity for activity in ordered_activities if not activity.get("is_completed")]
    candidate_pool = migrated_incomplete or any_incomplete
    current = candidate_pool[0] if candidate_pool else (ordered_activities[-1] if ordered_activities else None)
    next_activity = candidate_pool[1] if len(candidate_pool) > 1 else None
    if current:
        current["is_current"] = True

    course["topics"] = rebuilt_topics
    course.setdefault("course", {})["current_activity_id"] = current.get("id") if current else None
    course["course"]["next_activity_id"] = next_activity.get("id") if next_activity else None
    return course


def build_activity_course(db: Session) -> dict[str, Any]:
    """Devuelve el Centro de Actividades enriquecido y ordenado por temario 2026."""
    course = build_legacy_activity_course(db)
    task_ids = [
        activity.get("task_id")
        for topic in course.get("topics", [])
        for activity in topic.get("activities", [])
        if activity.get("task_id")
    ]
    tasks: dict[int, CaseTask] = {}
    if task_ids:
        tasks = {
            task.id: task
            for task in db.query(CaseTask).filter(CaseTask.id.in_(task_ids)).all()
        }

    migrated = 0
    migrated_codes: set[str] = set()
    for topic in course.get("topics", []):
        for index, activity in enumerate(topic.get("activities", [])):
            task = tasks.get(activity.get("task_id"))
            enriched = _enrich_activity(activity, task) if task else activity
            topic["activities"][index] = enriched
            if enriched.get("runtime_migrated"):
                migrated += 1
                migrated_codes.add(enriched["training_code"])

    course = _regroup_course_topics(course)
    course.setdefault("course", {})["catalog_code"] = COURSE_CODE
    course["course"]["catalog_version"] = COURSE_VERSION
    course["course"]["catalog_total_practices"] = len(TRAINING_ACTIVITY_ORDER)
    course["course"]["migrated_runtime_steps"] = migrated
    course["course"]["migrated_training_practices"] = len(migrated_codes)
    course["course"]["migrated_training_codes"] = sorted(
        migrated_codes,
        key=lambda code: TRAINING_ACTIVITY_ORDER.get(code, 9999),
    )
    course["course"]["migration_mode"] = "hybrid-master-syllabus"
    return course
