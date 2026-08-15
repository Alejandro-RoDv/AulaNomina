"""Casos ejecutables del bloque B01 · Fundamentos y entorno de trabajo.

A01 y A03 combinan decisiones profesionales con comprobaciones sobre el ERP.
A02 y A05 se validan contra datos persistidos para que el bloque inicial no sea
una colección de confirmaciones manuales.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.collective_agreement import CollectiveAgreement
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.student import Student
from app.models.work_center import WorkCenter
from app.schemas.case_study import CaseStudyCreate, CaseTaskCreate
from app.services.case_scenario_service import ensure_assignment_progress


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"

FOUNDATION_COMPANY_CIF = "B14990001"
FOUNDATION_COMPANY_NAME = "Aula Gestión Sur, S.L."
FOUNDATION_COMPANY_CCC = "14149990001"
FOUNDATION_CENTER_CODE = "F.01"
FOUNDATION_CENTER_NAME = "Centro Administración Córdoba"
FOUNDATION_CENTER_BASELINE_CCC = "14149990099"
FOUNDATION_CENTER_EXPECTED_CCC = "14149990011"
FOUNDATION_AGREEMENT_CODE = "SIM-ADM-2026"

A03_EMPLOYEE_DNI = "30999001R"
A05_EMPLOYEE_DNI = "30999002W"

FOUNDATION_SCENARIO_CODES = {
    "TRAIN-2026-FOUND-A01",
    "TRAIN-2026-FOUND-A02",
    "TRAIN-2026-FOUND-A03",
    "TRAIN-2026-FOUND-A05",
}


def _response_schema(
    *,
    prompt: str,
    options: list[tuple[str, str]],
    expected_decision: str,
    evidence_keywords: list[str],
    explanation_placeholder: str,
) -> dict[str, Any]:
    return {
        "type": "decision",
        "prompt": prompt,
        "options": [{"value": value, "label": label} for value, label in options],
        "expected_decision": expected_decision,
        "evidence_keywords": evidence_keywords,
        "minimum_keyword_matches": 2,
        "explanation_required": True,
        "explanation_label": "Justificación profesional",
        "explanation_placeholder": explanation_placeholder,
    }


def _task(
    *,
    title: str,
    description: str,
    module: str,
    expected_result: str,
    expected_action: str,
    order: int,
    training_code: str | None = None,
    response_schema: dict[str, Any] | None = None,
    case_facts: list[dict[str, str]] | None = None,
) -> CaseTaskCreate:
    trigger: dict[str, Any] = {
        "course_code": COURSE_CODE,
        "course_version": COURSE_VERSION,
        "validation_interaction": "explicit_review",
        "use_catalog_result_criteria": True,
    }
    if training_code:
        trigger["training_code"] = training_code
    if response_schema:
        trigger["response_schema"] = response_schema
    if case_facts:
        trigger["case_facts"] = case_facts
    return CaseTaskCreate(
        title=title,
        description=description,
        module=module,
        expected_result=expected_result,
        expected_action=expected_action,
        trigger_type="system",
        trigger_condition=trigger,
        validation_rules=[],
        task_order=order,
        is_required=True,
        blocking=True,
        status="pending",
    )


def build_foundation_runtime_cases_2026() -> list[CaseStudyCreate]:
    relationship_options = [
        ("ordinary_labor", "Relación laboral ordinaria"),
        ("special_labor", "Relación laboral de carácter especial"),
        ("non_labor", "Prestación no laboral por cuenta propia / excluida del ámbito ordinario"),
    ]
    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-FOUND-A01",
            title="Clasificación de relaciones de trabajo",
            description="Práctica A01: distinguir tres prestaciones de servicios atendiendo a voluntariedad, retribución, dependencia y ajenidad.",
            difficulty="basic",
            category="environment",
            status="active",
            created_by="Profesor demo",
            initial_state={"training_sequence": ["A01"]},
            completion_message="Los tres supuestos han sido clasificados atendiendo a sus elementos materiales y no solo a la denominación utilizada por las partes.",
            tasks=[
                _task(
                    title="Clasificar una prestación integrada en la organización",
                    description="Una administrativa presta servicios personalmente de lunes a viernes, con horario fijado por la empresa, herramientas de la empresa y retribución mensual fija. La empresa organiza el trabajo y asume el resultado económico.",
                    module="general",
                    expected_result="Clasificación correcta y justificación basada en los elementos de la relación",
                    expected_action="review_employment_relationship_decision",
                    order=1,
                    response_schema=_response_schema(
                        prompt="¿Cómo clasificarías esta prestación?",
                        options=relationship_options,
                        expected_decision="ordinary_labor",
                        evidence_keywords=["dependencia", "ajenidad", "retribución", "voluntariedad", "horario", "organiza"],
                        explanation_placeholder="Explica qué indicios de dependencia, ajenidad, voluntariedad o retribución observas.",
                    ),
                    case_facts=[
                        {"label": "Horario", "value": "Fijado por la empresa"},
                        {"label": "Herramientas", "value": "Aportadas por la empresa"},
                        {"label": "Retribución", "value": "Mensual fija"},
                        {"label": "Organización", "value": "La empresa dirige y asume el resultado"},
                    ],
                ),
                _task(
                    title="Clasificar una prestación autónoma",
                    description="Un consultor organiza libremente su horario, fija el precio de cada encargo, trabaja con sus propios medios y asume el riesgo de repetir sin coste un trabajo defectuoso.",
                    module="general",
                    expected_result="Prestación no laboral identificada por ausencia de dependencia y ajenidad",
                    expected_action="review_employment_relationship_decision",
                    order=2,
                    response_schema=_response_schema(
                        prompt="¿Cómo clasificarías esta prestación?",
                        options=relationship_options,
                        expected_decision="non_labor",
                        evidence_keywords=["autónom", "riesgo", "horario", "precio", "medios", "organiza", "independ"],
                        explanation_placeholder="Justifica por qué los indicios apuntan o no a dependencia y ajenidad.",
                    ),
                    case_facts=[
                        {"label": "Horario", "value": "Lo decide el profesional"},
                        {"label": "Precio", "value": "Lo fija por encargo"},
                        {"label": "Medios", "value": "Propios"},
                        {"label": "Riesgo", "value": "Asumido por el profesional"},
                    ],
                ),
                _task(
                    title="Identificar una relación laboral especial",
                    description="Una persona es contratada directamente por un hogar familiar para realizar de forma retribuida tareas domésticas habituales bajo la organización de la persona empleadora.",
                    module="general",
                    expected_result="Relación laboral especial correctamente diferenciada de una relación ordinaria",
                    expected_action="review_employment_relationship_decision",
                    order=3,
                    response_schema=_response_schema(
                        prompt="¿Cómo clasificarías esta prestación?",
                        options=relationship_options,
                        expected_decision="special_labor",
                        evidence_keywords=["especial", "hogar", "domést", "servicio", "retribu", "empleador"],
                        explanation_placeholder="Indica por qué existe relación laboral y qué elemento hace que su régimen sea especial.",
                    ),
                    case_facts=[
                        {"label": "Empleador", "value": "Hogar familiar"},
                        {"label": "Actividad", "value": "Tareas domésticas habituales"},
                        {"label": "Retribución", "value": "Sí"},
                        {"label": "Organización", "value": "A cargo de la persona empleadora"},
                    ],
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-FOUND-A02",
            title="Empresa y centro listos para operar",
            description="Práctica A02: revisar la estructura administrativa de una empresa y corregir el CCC principal erróneo de su centro de trabajo.",
            difficulty="basic",
            category="environment",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A02"],
                "company_name": FOUNDATION_COMPANY_NAME,
                "company_data": {
                    "cif": FOUNDATION_COMPANY_CIF,
                    "ccc": FOUNDATION_COMPANY_CCC,
                    "city": "Córdoba",
                },
                "center_data": {
                    "center_code": FOUNDATION_CENTER_CODE,
                    "name": FOUNDATION_CENTER_NAME,
                    "general_ccc": FOUNDATION_COMPANY_CCC,
                    "expected_main_ccc": FOUNDATION_CENTER_EXPECTED_CCC,
                },
            },
            completion_message="La empresa está identificada y el centro queda adscrito con el CCC principal correcto para los procesos posteriores.",
            tasks=[
                _task(
                    title="Corregir la estructura empresa-centro",
                    description=f"Revisa {FOUNDATION_COMPANY_NAME}. El centro {FOUNDATION_CENTER_NAME} está adscrito a la empresa, pero su CCC principal debe quedar como {FOUNDATION_CENTER_EXPECTED_CCC}.",
                    module="companies",
                    expected_result="Empresa y centro coherentes, activos y con CCC principal correcto",
                    expected_action="review_company_structure",
                    order=1,
                    training_code="A02",
                    case_facts=[
                        {"label": "Empresa", "value": FOUNDATION_COMPANY_NAME},
                        {"label": "CIF", "value": FOUNDATION_COMPANY_CIF},
                        {"label": "CCC empresa", "value": FOUNDATION_COMPANY_CCC},
                        {"label": "Centro", "value": FOUNDATION_CENTER_NAME},
                        {"label": "Código centro", "value": FOUNDATION_CENTER_CODE},
                        {"label": "CCC principal correcto", "value": FOUNDATION_CENTER_EXPECTED_CCC},
                    ],
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-FOUND-A03",
            title="Convenio aplicable y variables afectadas",
            description="Práctica A03: asignar el convenio simulado correcto a un contrato y reconocer qué variables laborales condiciona.",
            difficulty="basic",
            category="environment",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A03"],
                "employee": "Elena Ruiz Mora",
                "company_name": FOUNDATION_COMPANY_NAME,
                "center_name": FOUNDATION_CENTER_NAME,
                "agreement_data": {
                    "agreement_code": FOUNDATION_AGREEMENT_CODE,
                    "agreement_name": "Convenio Simulado de Servicios Administrativos",
                    "job_position": "Auxiliar administrativa",
                },
            },
            completion_message="El contrato queda vinculado al convenio del supuesto y se identifican sus principales efectos sobre clasificación, jornada y retribución.",
            tasks=[
                _task(
                    title="Asignar el convenio al contrato de Elena",
                    description=f"Abre el contrato activo de Elena Ruiz Mora y asígnale el convenio {FOUNDATION_AGREEMENT_CODE}. Mantén el puesto de Auxiliar administrativa.",
                    module="contracts",
                    expected_result=f"Contrato activo vinculado a {FOUNDATION_AGREEMENT_CODE}",
                    expected_action="review_collective_agreement_assignment",
                    order=1,
                    case_facts=[
                        {"label": "Trabajadora", "value": "Elena Ruiz Mora"},
                        {"label": "Puesto", "value": "Auxiliar administrativa"},
                        {"label": "Empresa", "value": FOUNDATION_COMPANY_NAME},
                        {"label": "Convenio aplicable", "value": FOUNDATION_AGREEMENT_CODE},
                    ],
                ),
                _task(
                    title="Interpretar el alcance del convenio",
                    description="Tras asignarlo, identifica el grupo de variables que debes revisar porque el convenio puede condicionarlas.",
                    module="general",
                    expected_result="Se reconocen clasificación profesional, jornada y retribución como variables relevantes",
                    expected_action="review_collective_agreement_scope",
                    order=2,
                    response_schema=_response_schema(
                        prompt="¿Qué conjunto resume mejor las variables que debes contrastar con el convenio?",
                        options=[
                            ("salary_worktime_classification", "Salario, jornada y clasificación profesional"),
                            ("identity_bank", "DNI, cuenta bancaria y domicilio particular"),
                            ("tax_only", "Únicamente el porcentaje de IRPF"),
                        ],
                        expected_decision="salary_worktime_classification",
                        evidence_keywords=["salario", "retribu", "jornada", "clasificación", "categoría", "grupo"],
                        explanation_placeholder="Explica al menos dos variables laborales que revisarías y por qué.",
                    ),
                    case_facts=[
                        {"label": "Convenio", "value": FOUNDATION_AGREEMENT_CODE},
                        {"label": "Puesto", "value": "Auxiliar administrativa"},
                    ],
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-FOUND-A05",
            title="Corrección de datos del expediente",
            description="Práctica A05: comparar la ficha de una trabajadora con la información recibida y corregir solo los campos inconsistentes.",
            difficulty="basic",
            category="environment",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A05"],
                "employee": "Nuria Gómez Alba",
                "company_name": FOUNDATION_COMPANY_NAME,
                "center_name": FOUNDATION_CENTER_NAME,
                "source_document": "Ficha de incorporación actualizada",
                "expected_employee_data": {
                    "mobile_phone": "611222333",
                    "postal_code": "14004",
                    "dni": A05_EMPLOYEE_DNI,
                    "naf": "149990000002",
                    "email": "nuria.gomez@aulagestionsur.demo",
                },
            },
            completion_message="El expediente coincide con la fuente recibida y los datos que ya eran correctos se han conservado.",
            tasks=[
                _task(
                    title="Corregir móvil y código postal de Nuria",
                    description="La ficha recibida indica móvil 611222333 y código postal 14004. Corrige únicamente esos dos campos y conserva DNI, NAF y correo electrónico.",
                    module="employees",
                    expected_result="Expediente utilizable, con los dos errores corregidos y datos protegidos sin cambios",
                    expected_action="review_employee_data_correction",
                    order=1,
                    training_code="A05",
                    case_facts=[
                        {"label": "Trabajadora", "value": "Nuria Gómez Alba"},
                        {"label": "Fuente", "value": "Ficha de incorporación actualizada"},
                        {"label": "Móvil correcto", "value": "611222333"},
                        {"label": "Código postal correcto", "value": "14004"},
                        {"label": "No modificar", "value": "DNI · NAF · correo electrónico"},
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


def seed_foundation_runtime_cases_2026(db: Session) -> None:
    for definition in build_foundation_runtime_cases_2026():
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
        metadata = definition.model_dump(exclude={"tasks"})
        for field, value in metadata.items():
            if getattr(case_study, field) != value:
                setattr(case_study, field, value)
                changed = True

        existing_by_order = {task.task_order: task for task in case_study.tasks}
        defined_orders = {task.task_order for task in definition.tasks}
        for task_definition in definition.tasks:
            values = _task_values(task_definition)
            existing = existing_by_order.get(task_definition.task_order)
            if existing is None:
                db.add(CaseTask(case_study_id=case_study.id, **values))
                changed = True
                continue
            for field, value in values.items():
                if getattr(existing, field) != value:
                    setattr(existing, field, value)
                    changed = True

        for stale in list(case_study.tasks):
            if stale.task_order not in defined_orders:
                db.delete(stale)
                changed = True

        if changed:
            _reset_case_progress(case_study)
        db.commit()


def _upsert_company(db: Session) -> Company:
    company = db.query(Company).filter(Company.cif == FOUNDATION_COMPANY_CIF).first()
    if company is None:
        company = Company(name=FOUNDATION_COMPANY_NAME, cif=FOUNDATION_COMPANY_CIF)
        db.add(company)
        db.flush()
    company.name = FOUNDATION_COMPANY_NAME
    company.ccc = FOUNDATION_COMPANY_CCC
    company.address = "Avenida de la Gestión, 25"
    company.city = "Córdoba"
    company.province = "Córdoba"
    company.company_email = "rrhh@aulagestionsur.demo"
    company.status = "alta"
    company.is_active = True
    return company


def _upsert_center(db: Session, company: Company) -> WorkCenter:
    center = db.query(WorkCenter).filter(WorkCenter.center_code == FOUNDATION_CENTER_CODE).first()
    if center is None:
        center = WorkCenter(company_id=company.id, center_code=FOUNDATION_CENTER_CODE, name=FOUNDATION_CENTER_NAME)
        db.add(center)
        db.flush()
    center.company_id = company.id
    center.name = FOUNDATION_CENTER_NAME
    center.general_ccc = FOUNDATION_COMPANY_CCC
    center.main_ccc = FOUNDATION_CENTER_BASELINE_CCC
    center.address = "Calle Administración, 12"
    center.city = "Córdoba"
    center.province = "Córdoba"
    center.email = "centro@aulagestionsur.demo"
    center.is_active = True
    return center


def _upsert_employee(
    db: Session,
    *,
    company: Company,
    center: WorkCenter,
    employee_code: str,
    dni: str,
    first_name: str,
    last_name: str,
    second_last_name: str,
    naf: str,
    email: str,
    mobile_phone: str,
    postal_code: str,
) -> Employee:
    employee = db.query(Employee).filter(Employee.dni == dni).first()
    if employee is None:
        employee = Employee(employee_code=employee_code, dni=dni, first_name=first_name, last_name=last_name)
        db.add(employee)
        db.flush()
    employee.employee_code = employee_code
    employee.company_id = company.id
    employee.center_id = center.id
    employee.document_type = "DNI"
    employee.dni = dni
    employee.naf = naf
    employee.first_name = first_name
    employee.last_name = last_name
    employee.second_last_name = second_last_name
    employee.birth_date = date(1997, 5, 16)
    employee.nationality = "Española"
    employee.address = "Calle Formación, 18"
    employee.city = "Córdoba"
    employee.province = "Córdoba"
    employee.postal_code = postal_code
    employee.mobile_phone = mobile_phone
    employee.phone = mobile_phone
    employee.email = email
    employee.is_active = True
    employee.status = "active"
    return employee


def prepare_foundation_training_data_2026(db: Session) -> None:
    """Restablece los errores controlados que el alumno debe detectar en A02, A03 y A05."""
    company = _upsert_company(db)
    center = _upsert_center(db, company)

    elena = _upsert_employee(
        db,
        company=company,
        center=center,
        employee_code="F.03",
        dni=A03_EMPLOYEE_DNI,
        first_name="Elena",
        last_name="Ruiz",
        second_last_name="Mora",
        naf="149990000001",
        email="elena.ruiz@aulagestionsur.demo",
        mobile_phone="611111111",
        postal_code="14003",
    )
    contract = (
        db.query(Contract)
        .filter(Contract.employee_id == elena.id, Contract.start_date == date(2026, 2, 1))
        .first()
    )
    if contract is None:
        contract = Contract(employee_id=elena.id, contract_type="Indefinido", start_date=date(2026, 2, 1))
        db.add(contract)
        db.flush()
    contract.company_id = company.id
    contract.center_id = center.id
    contract.contract_type = "Indefinido"
    contract.contract_family = "indefinite"
    contract.contract_code = "100"
    contract.status = "active"
    contract.job_position = "Auxiliar administrativa"
    contract.professional_category = "Auxiliar administrativa"
    contract.working_day_type = "full_time"
    contract.weekly_hours = 40
    contract.full_time_weekly_hours = 40
    contract.partiality_coefficient = 100
    contract.salary_base = Decimal("1500.00")
    contract.collective_agreement_id = None
    contract.collective_agreement_code = None
    contract.professional_category_id = None
    contract.salary_table_row_id = None

    _upsert_employee(
        db,
        company=company,
        center=center,
        employee_code="F.05",
        dni=A05_EMPLOYEE_DNI,
        first_name="Nuria",
        last_name="Gómez",
        second_last_name="Alba",
        naf="149990000002",
        email="nuria.gomez@aulagestionsur.demo",
        mobile_phone="600000000",
        postal_code="14099",
    )
    db.commit()


def seed_foundation_runtime_assignments_2026(db: Session) -> None:
    student = db.query(Student).order_by(Student.id.asc()).first()
    if student is None:
        return
    cases = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code.in_(sorted(FOUNDATION_SCENARIO_CODES)))
        .order_by(CaseStudy.id.asc())
        .all()
    )
    for case_study in cases:
        assignment = (
            db.query(CaseAssignment)
            .filter(CaseAssignment.case_study_id == case_study.id, CaseAssignment.student_id == student.id)
            .order_by(CaseAssignment.id.asc())
            .first()
        )
        if assignment is None:
            assignment = CaseAssignment(
                case_study_id=case_study.id,
                student_id=student.id,
                assigned_by="Profesor demo",
                status="assigned",
                notes="Práctica guiada del bloque B01 del Temario Maestro 2026.",
            )
            db.add(assignment)
            db.commit()
        ensure_assignment_progress(db, assignment.id)
