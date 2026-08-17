"""Casos ejecutables de B02 · Contratación.

A07 y A09 ya están cubiertas por los pilotos previos. Este módulo incorpora
A06, A08 y A10-A13 sobre el contrato real y su trazabilidad de ciclo de vida.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.contract import Contract
from app.models.contract_lifecycle_event import ContractLifecycleEvent
from app.models.employee import Employee
from app.models.student import Student
from app.schemas.case_study import CaseStudyCreate, CaseTaskCreate
from app.services.case_scenario_service import ensure_assignment_progress
from app.training.foundation_runtime_cases_2026 import (
    FOUNDATION_CENTER_CODE,
    FOUNDATION_COMPANY_CIF,
    prepare_foundation_training_data_2026,
)


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"

HIRING_SCENARIO_CODES = {
    "TRAIN-2026-HIRE-A06",
    "TRAIN-2026-HIRE-A08",
    "TRAIN-2026-HIRE-A10",
    "TRAIN-2026-HIRE-A11",
    "TRAIN-2026-HIRE-A12",
    "TRAIN-2026-HIRE-A13",
}

EMPLOYEE_DATA = {
    "A08": ("H.08", "30999108T", "Marta", "Soler", "Vidal", "149991000008"),
    "A10": ("H.10", "30999110P", "Sergio", "León", "Campos", "149991000010"),
    "A11": ("H.11", "30999111D", "Paula", "Reyes", "Díaz", "149991000011"),
    "A12": ("H.12", "30999112X", "Iván", "Torres", "Luna", "149991000012"),
    "A13": ("H.13", "30999113B", "Claudia", "Pérez", "Rojas", "149991000013"),
}

HIRING_DECISION_RULES: dict[str, dict[str, Any]] = {
    "A06": {
        "expected_decision": "temporary_production",
        "evidence_keywords": ["temporal", "produccion", "producción", "incremento", "ocasional", "causa", "duracion", "duración"],
        "minimum_keyword_matches": 2,
    },
    "A13": {
        "expected_decision": "extension",
        "evidence_keywords": ["prorroga", "prórroga", "misma", "modalidad", "vigencia", "fecha", "duracion", "duración"],
        "minimum_keyword_matches": 2,
    },
}


def _response_schema(*, prompt: str, options: list[tuple[str, str]], validation_key: str, placeholder: str) -> dict[str, Any]:
    return {
        "type": "decision",
        "prompt": prompt,
        "options": [{"value": value, "label": label} for value, label in options],
        "validation_key": validation_key,
        "explanation_required": True,
        "explanation_label": "Justificación profesional",
        "explanation_placeholder": placeholder,
    }


def _task(
    *,
    code: str,
    title: str,
    description: str,
    expected_action: str,
    expected_result: str,
    response_schema: dict[str, Any] | None = None,
    case_facts: list[dict[str, str]] | None = None,
) -> CaseTaskCreate:
    trigger: dict[str, Any] = {
        "course_code": COURSE_CODE,
        "course_version": COURSE_VERSION,
        "training_code": code,
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
    }
    if response_schema:
        trigger["response_schema"] = response_schema
    if case_facts:
        trigger["case_facts"] = case_facts
    return CaseTaskCreate(
        title=title,
        description=description,
        module="contracts" if code != "A06" else "general",
        expected_result=expected_result,
        expected_action=expected_action,
        trigger_type="system",
        trigger_condition=trigger,
        validation_rules=[],
        task_order=1,
        is_required=True,
        blocking=True,
        status="pending",
    )


def build_hiring_runtime_cases_2026() -> list[CaseStudyCreate]:
    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-HIRE-A06",
            title="Elegir modalidad contractual por la causa real",
            description="Práctica A06: seleccionar la modalidad a partir de la necesidad empresarial, no por preferencia administrativa.",
            difficulty="basic",
            category="contract",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A06"],
                "need": "Incremento ocasional e imprevisible de pedidos durante cuatro meses",
                "expected_duration": "01/09/2026–31/12/2026",
            },
            completion_message="La modalidad se ha elegido a partir de la naturaleza y duración de la necesidad y la causa queda razonada.",
            tasks=[
                _task(
                    code="A06",
                    title="Seleccionar la modalidad antes de contratar",
                    description="La empresa prevé un incremento ocasional e imprevisible de pedidos durante cuatro meses. No existe una vacante estructural ni una persona con reserva de puesto a sustituir.",
                    expected_action="review_contract_modality_decision",
                    expected_result="Modalidad causal coherente y justificación basada en la necesidad",
                    response_schema=_response_schema(
                        prompt="¿Qué modalidad utilizarías para este supuesto?",
                        options=[
                            ("indefinite", "Contrato indefinido ordinario"),
                            ("temporary_production", "Duración determinada por circunstancias de la producción"),
                            ("replacement", "Duración determinada por sustitución"),
                            ("alternance", "Contrato de formación en alternancia"),
                        ],
                        validation_key="A06",
                        placeholder="Explica qué elemento hace temporal la necesidad y por qué descartas sustitución o formación.",
                    ),
                    case_facts=[
                        {"label": "Necesidad", "value": "Incremento ocasional e imprevisible de pedidos"},
                        {"label": "Duración prevista", "value": "4 meses"},
                        {"label": "Vacante estructural", "value": "No"},
                        {"label": "Persona sustituida", "value": "No existe"},
                    ],
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-HIRE-A08",
            title="Contrato temporal con causa documentada",
            description="Práctica A08: formalizar un contrato por circunstancias de la producción especificando la causa y su conexión con la duración.",
            difficulty="basic",
            category="contract",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A08"],
                "employee": "Marta Soler Vidal",
                "contract_data": {
                    "contract_code": "402",
                    "contract_type": "temporal",
                    "start_date": "2026-09-01",
                    "end_date": "2026-12-31",
                    "weekly_hours": 40,
                    "temporary_cause": "Incremento ocasional e imprevisible de pedidos del último cuatrimestre de 2026",
                },
            },
            completion_message="El contrato temporal identifica la causa, las fechas y la jornada del supuesto.",
            tasks=[
                _task(
                    code="A08",
                    title="Formalizar el contrato temporal de Marta",
                    description="Crea el contrato 402 a jornada completa del 01/09/2026 al 31/12/2026 y documenta el incremento ocasional e imprevisible de pedidos que justifica la duración.",
                    expected_action="review_temporary_contract",
                    expected_result="Contrato temporal activo, con causa concreta, duración y jornada coherentes",
                    case_facts=[
                        {"label": "Trabajadora", "value": "Marta Soler Vidal"},
                        {"label": "Código", "value": "402"},
                        {"label": "Inicio", "value": "01/09/2026"},
                        {"label": "Fin", "value": "31/12/2026"},
                        {"label": "Jornada", "value": "40 h/semana"},
                    ],
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-HIRE-A10",
            title="Formación en alternancia con plan y tutoría",
            description="Práctica A10: registrar los elementos laborales y formativos esenciales de una formación en alternancia.",
            difficulty="intermediate",
            category="contract",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A10"],
                "employee": "Sergio León Campos",
                "contract_data": {
                    "contract_code": "421",
                    "start_date": "2026-09-15",
                    "end_date": "2027-06-30",
                    "training_contract_subtype": "alternance",
                    "training_program": "CFGS Administración y Finanzas",
                    "training_center": "IES Aula Córdoba",
                    "training_company_tutor": "Marta Vega Romero",
                    "training_plan_reference": "PF-A10-2026",
                    "training_work_percentage": 65,
                },
            },
            completion_message="El contrato integra actividad laboral y formación mediante programa, centro, tutoría, plan y distribución del tiempo.",
            tasks=[
                _task(
                    code="A10",
                    title="Registrar la formación en alternancia de Sergio",
                    description="Formaliza el contrato 421 y completa programa, centro formativo, persona tutora, referencia del plan individual y un 65 % de tiempo de trabajo efectivo para el primer año del supuesto.",
                    expected_action="review_alternance_contract",
                    expected_result="Contrato formativo con los elementos esenciales del plan y tutoría presentes",
                    case_facts=[
                        {"label": "Trabajador", "value": "Sergio León Campos"},
                        {"label": "Código", "value": "421"},
                        {"label": "Programa", "value": "CFGS Administración y Finanzas"},
                        {"label": "Centro", "value": "IES Aula Córdoba"},
                        {"label": "Tutor empresa", "value": "Marta Vega Romero"},
                        {"label": "Plan", "value": "PF-A10-2026"},
                        {"label": "Trabajo efectivo", "value": "65 %"},
                    ],
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-HIRE-A11",
            title="Práctica profesional vinculada a titulación",
            description="Práctica A11: formalizar la modalidad para obtención de práctica profesional y dejar trazada la titulación y el plan.",
            difficulty="intermediate",
            category="contract",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A11"],
                "employee": "Paula Reyes Díaz",
                "contract_data": {
                    "contract_code": "420",
                    "start_date": "2026-10-01",
                    "end_date": "2027-03-31",
                    "training_contract_subtype": "professional_practice",
                    "qualification_name": "Técnico Superior en Administración y Finanzas",
                    "qualification_date": "2025-06-20",
                    "training_company_tutor": "Álvaro Medina Ruiz",
                    "training_plan_reference": "PF-A11-2026",
                },
            },
            completion_message="La práctica profesional queda vinculada a la titulación habilitante, la duración del caso y su plan formativo individual.",
            tasks=[
                _task(
                    code="A11",
                    title="Formalizar la práctica profesional de Paula",
                    description="Registra un contrato 420 del 01/10/2026 al 31/03/2027 vinculado a la titulación indicada, con tutor y plan formativo individual.",
                    expected_action="review_professional_practice_contract",
                    expected_result="Contrato formativo coherente con titulación, fechas, tutoría y plan individual",
                    case_facts=[
                        {"label": "Trabajadora", "value": "Paula Reyes Díaz"},
                        {"label": "Código", "value": "420"},
                        {"label": "Titulación", "value": "Técnico Superior en Administración y Finanzas"},
                        {"label": "Fecha titulación", "value": "20/06/2025"},
                        {"label": "Tutor empresa", "value": "Álvaro Medina Ruiz"},
                        {"label": "Plan", "value": "PF-A11-2026"},
                    ],
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-HIRE-A12",
            title="Variación de jornada con histórico",
            description="Práctica A12: aplicar una reducción pactada sin sobrescribir la situación contractual anterior.",
            difficulty="intermediate",
            category="contract",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A12"],
                "employee": "Iván Torres Luna",
                "workday_change": {
                    "effective_date": "2026-09-01",
                    "previous_weekly_hours": 40,
                    "new_weekly_hours": 30,
                    "expected_partiality": 75,
                    "reason": "Acuerdo de reducción de jornada con efectos 01/09/2026",
                },
            },
            completion_message="La nueva jornada está vigente y el evento conserva la jornada anterior, la fecha de efectos y el motivo.",
            tasks=[
                _task(
                    code="A12",
                    title="Reducir la jornada de Iván conservando el histórico",
                    description="Usa la operación de variación contractual para pasar de 40 a 30 horas semanales desde el 01/09/2026. No edites directamente la jornada sin generar trazabilidad.",
                    expected_action="review_workday_variation",
                    expected_result="Jornada al 75 % y evento histórico con situación anterior y nueva",
                    case_facts=[
                        {"label": "Trabajador", "value": "Iván Torres Luna"},
                        {"label": "Jornada anterior", "value": "40 h/semana"},
                        {"label": "Nueva jornada", "value": "30 h/semana"},
                        {"label": "Efectos", "value": "01/09/2026"},
                    ],
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-HIRE-A13",
            title="Prórroga frente a transformación contractual",
            description="Práctica A13: decidir si cambia la modalidad o solo la vigencia y registrar la operación sin perder el histórico.",
            difficulty="intermediate",
            category="contract",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A13"],
                "employee": "Claudia Pérez Rojas",
                "contract_data": {
                    "contract_code": "402",
                    "start_date": "2026-03-01",
                    "end_date": "2026-08-31",
                    "new_end_date": "2026-11-30",
                    "decision": "extension",
                },
            },
            completion_message="Se ha distinguido prórroga de transformación y la nueva vigencia conserva la fecha fin anterior en el histórico.",
            tasks=[
                _task(
                    code="A13",
                    title="Decidir y registrar la nueva vigencia de Claudia",
                    description="La necesidad temporal continúa hasta el 30/11/2026 sin cambiar de modalidad. Decide entre prórroga o transformación y ejecuta la operación adecuada desde el historial contractual.",
                    expected_action="review_contract_extension_decision",
                    expected_result="Prórroga registrada hasta 30/11/2026 con decisión justificada y fecha anterior preservada",
                    response_schema=_response_schema(
                        prompt="¿Qué operación corresponde si la modalidad no cambia y únicamente se amplía la vigencia?",
                        options=[
                            ("extension", "Prórroga del contrato existente"),
                            ("transformation", "Transformación a contrato indefinido"),
                            ("new_unrelated", "Crear otro contrato sin relación con el anterior"),
                        ],
                        validation_key="A13",
                        placeholder="Explica la diferencia entre ampliar la vigencia y cambiar la modalidad contractual.",
                    ),
                    case_facts=[
                        {"label": "Trabajadora", "value": "Claudia Pérez Rojas"},
                        {"label": "Modalidad actual", "value": "402 · circunstancias de la producción"},
                        {"label": "Fin actual", "value": "31/08/2026"},
                        {"label": "Nuevo fin", "value": "30/11/2026"},
                        {"label": "Cambio de modalidad", "value": "No"},
                    ],
                )
            ],
        ),
    ]


def _task_values(task: CaseTaskCreate) -> dict[str, Any]:
    return task.model_dump()


def _reset_case_progress(case_study: CaseStudy) -> None:
    for assignment in case_study.assignments:
        assignment.progress_entries.clear()
        assignment.current_task_order = 1
        assignment.completion_percentage = 0
        assignment.started_at = None
        assignment.completed_at = None
        assignment.status = "assigned"


def seed_hiring_runtime_cases_2026(db: Session) -> None:
    for definition in build_hiring_runtime_cases_2026():
        case_study = db.query(CaseStudy).filter(CaseStudy.scenario_code == definition.scenario_code).first()
        if case_study is None:
            case_study = CaseStudy(**definition.model_dump(exclude={"tasks"}))
            db.add(case_study)
            db.flush()
            for task in definition.tasks:
                db.add(CaseTask(case_study_id=case_study.id, **_task_values(task)))
            db.commit()
            continue

        changed = False
        for field, value in definition.model_dump(exclude={"tasks"}).items():
            if getattr(case_study, field) != value:
                setattr(case_study, field, value)
                changed = True
        existing_by_order = {task.task_order: task for task in case_study.tasks}
        for task_definition in definition.tasks:
            values = _task_values(task_definition)
            existing = existing_by_order.get(task_definition.task_order)
            if existing is None:
                db.add(CaseTask(case_study_id=case_study.id, **values))
                changed = True
            else:
                for field, value in values.items():
                    if getattr(existing, field) != value:
                        setattr(existing, field, value)
                        changed = True
        if changed:
            _reset_case_progress(case_study)
        db.commit()


def _employee(db: Session, code: str) -> Employee:
    from app.models.company import Company
    from app.models.work_center import WorkCenter

    company = db.query(Company).filter(Company.cif == FOUNDATION_COMPANY_CIF).first()
    center = db.query(WorkCenter).filter(WorkCenter.center_code == FOUNDATION_CENTER_CODE).first()
    if company is None or center is None:
        prepare_foundation_training_data_2026(db)
        company = db.query(Company).filter(Company.cif == FOUNDATION_COMPANY_CIF).first()
        center = db.query(WorkCenter).filter(WorkCenter.center_code == FOUNDATION_CENTER_CODE).first()

    employee_code, dni, first_name, last_name, second_last_name, naf = EMPLOYEE_DATA[code]
    employee = db.query(Employee).filter(Employee.dni == dni).first()
    if employee is None:
        employee = Employee(employee_code=employee_code, dni=dni, first_name=first_name, last_name=last_name)
        db.add(employee)
        db.flush()
    employee.employee_code = employee_code
    employee.company_id = company.id
    employee.center_id = center.id
    employee.document_type = "DNI"
    employee.naf = naf
    employee.first_name = first_name
    employee.last_name = last_name
    employee.second_last_name = second_last_name
    employee.birth_date = date(1999, 4, 12)
    employee.nationality = "Española"
    employee.email = f"{first_name.lower()}.{last_name.lower()}@aulagestionsur.demo".replace("ó", "o").replace("é", "e")
    employee.is_active = True
    employee.status = "active"
    return employee


def _clear_employee_contracts(db: Session, employee: Employee) -> None:
    contract_ids = [row[0] for row in db.query(Contract.id).filter(Contract.employee_id == employee.id).all()]
    if contract_ids:
        db.query(ContractLifecycleEvent).filter(ContractLifecycleEvent.contract_id.in_(contract_ids)).delete(synchronize_session=False)
        db.query(ContractLifecycleEvent).filter(ContractLifecycleEvent.related_contract_id.in_(contract_ids)).update({ContractLifecycleEvent.related_contract_id: None}, synchronize_session=False)
        db.query(Contract).filter(Contract.id.in_(contract_ids)).delete(synchronize_session=False)
        db.flush()


def prepare_hiring_training_data_2026(db: Session) -> None:
    """Restaura los puntos de partida de A08 y A10-A13."""
    prepare_foundation_training_data_2026(db)
    employees = {code: _employee(db, code) for code in EMPLOYEE_DATA}
    for employee in employees.values():
        _clear_employee_contracts(db, employee)

    from app.models.company import Company
    from app.models.work_center import WorkCenter

    company = db.query(Company).filter(Company.cif == FOUNDATION_COMPANY_CIF).first()
    center = db.query(WorkCenter).filter(WorkCenter.center_code == FOUNDATION_CENTER_CODE).first()

    a12 = Contract(
        employee_id=employees["A12"].id,
        company_id=company.id,
        center_id=center.id,
        contract_type="indefinido",
        contract_code="100",
        contract_family="indefinite",
        start_date=date(2026, 1, 1),
        status="active",
        job_position="Administrativo",
        working_day_type="full_time",
        weekly_hours=40,
        full_time_weekly_hours=40,
        monthly_hours=Decimal("173.33"),
        annual_hours=2080,
        partiality_coefficient=100,
        salary_base=Decimal("1550.00"),
    )
    a13 = Contract(
        employee_id=employees["A13"].id,
        company_id=company.id,
        center_id=center.id,
        contract_type="temporal",
        contract_code="402",
        contract_family="temporary",
        start_date=date(2026, 3, 1),
        end_date=date(2026, 8, 31),
        status="active",
        temporary_cause="Incremento ocasional de actividad previsto en el supuesto docente",
        job_position="Auxiliar administrativa",
        working_day_type="full_time",
        weekly_hours=40,
        full_time_weekly_hours=40,
        partiality_coefficient=100,
        salary_base=Decimal("1450.00"),
    )
    db.add_all([a12, a13])
    db.commit()


def seed_hiring_runtime_assignments_2026(db: Session) -> None:
    student = db.query(Student).order_by(Student.id.asc()).first()
    if student is None:
        return
    for case_study in db.query(CaseStudy).filter(CaseStudy.scenario_code.in_(sorted(HIRING_SCENARIO_CODES))).all():
        assignment = (
            db.query(CaseAssignment)
            .filter(CaseAssignment.case_study_id == case_study.id, CaseAssignment.student_id == student.id)
            .first()
        )
        if assignment is None:
            assignment = CaseAssignment(
                case_study_id=case_study.id,
                student_id=student.id,
                assigned_by="Profesor demo",
                status="assigned",
                notes="Práctica guiada del bloque B02 del Temario Maestro 2026.",
            )
            db.add(assignment)
            db.commit()
        ensure_assignment_progress(db, assignment.id)
