"""Casos runtime del bloque B05 · Seguridad Social y Sistema RED."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.fie import FieCommunication, FieProcessingEvent
from app.models.incident import Incident
from app.models.incident_detail import IncidentDetail
from app.models.student import Student
from app.schemas.case_study import CaseStudyCreate, CaseTaskCreate
from app.services.case_scenario_service import ensure_assignment_progress


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"
DEMO_COMPANY_CIF = "G14999999"
DEMO_CCC_SAN_RAFAEL = "14000000011"
FIE_A31_MESSAGE_ID = "FIE-TRAIN-2026-A31"
FIE_A31_PROCESS_REFERENCE = "IT-TRAIN-A31-2026"
SOCIAL_SECURITY_SCENARIO_CODES = {
    "TRAIN-2026-SS-A28",
    "TRAIN-2026-SS-A30",
    "TRAIN-2026-SS-A31",
    "TRAIN-2026-SS-A32",
    "TRAIN-2026-SS-A33",
    "TRAIN-2026-SS-A34",
    "TRAIN-2026-SS-A35",
}


def _task(
    *,
    title: str,
    description: str,
    module: str,
    expected_result: str,
    expected_action: str,
    task_order: int,
    training_code: str | None = None,
    validation_interaction: str = "explicit_review",
) -> CaseTaskCreate:
    trigger_condition = {
        "course_code": COURSE_CODE,
        "course_version": COURSE_VERSION,
        "validation_interaction": validation_interaction,
    }
    if training_code:
        trigger_condition["training_code"] = training_code
    return CaseTaskCreate(
        title=title,
        description=description,
        module=module,
        expected_result=expected_result,
        expected_action=expected_action,
        trigger_type="system",
        trigger_condition=trigger_condition,
        validation_rules=[],
        task_order=task_order,
        is_required=True,
        blocking=True,
        status="pending",
    )


def build_social_security_runtime_cases_2026() -> list[CaseStudyCreate]:
    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-SS-A28",
            title="Revisión previa de afiliación",
            description="Práctica A28: revisar identificadores, NAF, CCC, contrato y fecha antes de preparar un movimiento RED.",
            difficulty="basic",
            category="social-security",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A28"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "affiliation_data": {
                    "expected_ccc": DEMO_CCC_SAN_RAFAEL,
                    "reference_date": "2026-09-01",
                    "required_fields": ["dni", "naf", "company", "ccc", "contract"],
                },
            },
            completion_message="El expediente contiene los datos críticos necesarios para preparar el movimiento de afiliación.",
            tasks=[
                _task(
                    title="Comprobar datos previos al movimiento RED",
                    description="Revisa DNI/NIE, NAF, empresa, CCC, contrato vigente y fecha antes de generar el movimiento.",
                    module="affiliations",
                    expected_result="Expediente de afiliación completo y coherente",
                    expected_action="review_affiliation_data",
                    task_order=1,
                    training_code="A28",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-SS-A30",
            title="Baja de afiliación",
            description="Práctica A30: preparar una baja y distinguirla de un alta o una modificación dentro del generador de remesas.",
            difficulty="intermediate",
            category="social-security",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A30"],
                "employee": "Javier Romero Sánchez",
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "affiliation_data": {
                    "movement_type": "BAJA",
                    "effective_date": "2026-06-30",
                    "expected_ccc": DEMO_CCC_SAN_RAFAEL,
                },
            },
            completion_message="La remesa contiene una baja de afiliación con persona, contrato, CCC y fecha correctos.",
            tasks=[
                _task(
                    title="Preparar la baja del trabajador",
                    description="En Afiliación, localiza la baja de Javier con efectos 30/06/2026, crea el borrador y genera la remesa.",
                    module="affiliations",
                    expected_result="Fichero de afiliación generado con movimiento BAJA",
                    expected_action="review_affiliation_movement",
                    task_order=1,
                    training_code="A30",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-SS-A31",
            title="Interpretación de comunicación FIE",
            description="Práctica A31: interpretar persona, proceso, contingencia y fechas de una comunicación FIE recibida.",
            difficulty="intermediate",
            category="social-security",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A31"],
                "employee": "Laura Martín Ruiz",
                "fie_data": {
                    "external_message_id": FIE_A31_MESSAGE_ID,
                    "process_reference": FIE_A31_PROCESS_REFERENCE,
                    "communication_type": "SICK_LEAVE",
                    "contingency_type": "COMMON_DISEASE",
                    "event_date": "2026-12-01",
                    "estimated_duration": 3,
                },
            },
            completion_message="La comunicación FIE ha sido interpretada correctamente antes de conciliarla.",
            tasks=[
                _task(
                    title="Interpretar la comunicación recibida",
                    description=f"Localiza {FIE_A31_PROCESS_REFERENCE} y revisa trabajador, contingencia y fecha de baja.",
                    module="fie",
                    expected_result="Persona, proceso y fechas FIE identificados",
                    expected_action="review_fie_content",
                    task_order=1,
                    training_code="A31",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-SS-A32",
            title="Conciliación FIE con expediente",
            description="Práctica A32: comparar la comunicación FIE con la IT del expediente y dejar ambas evidencias enlazadas.",
            difficulty="intermediate",
            category="social-security",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A32"],
                "employee": "Laura Martín Ruiz",
                "fie_data": {
                    "external_message_id": FIE_A31_MESSAGE_ID,
                    "process_reference": FIE_A31_PROCESS_REFERENCE,
                    "expected_incident_start": "2026-12-01",
                    "expected_incident_end": "2026-12-03",
                    "expected_status": "MATCHED",
                },
            },
            completion_message="El FIE ha quedado conciliado con la incidencia correcta del expediente.",
            tasks=[
                _task(
                    title="Conciliar FIE e incidencia",
                    description="Compara la comunicación con la IT de Laura iniciada el 01/12/2026 y deja la comunicación vinculada al proceso correcto.",
                    module="fie",
                    expected_result="FIE conciliado, incidencia vinculada y fechas coherentes",
                    expected_action="review_fie_reconciliation",
                    task_order=1,
                    training_code="A32",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-SS-A33",
            title="Generación y validación CRA",
            description="Práctica A33: generar un fichero CRA a partir de nóminas reales del periodo y revisar su contenido comunicable.",
            difficulty="intermediate",
            category="social-security",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A33"],
                "company_name": "Fundación AulaNomina",
                "cra_data": {
                    "period": "2026-05",
                    "ccc": DEMO_CCC_SAN_RAFAEL,
                    "minimum_workers": 1,
                    "minimum_records": 1,
                },
            },
            completion_message="El CRA contiene trabajadores y conceptos retributivos comunicables para el CCC y periodo indicados.",
            tasks=[
                _task(
                    title="Generar y revisar el CRA",
                    description="Genera el CRA de mayo de 2026 para el CCC 14000000011 y revisa trabajadores, claves e importes antes del envío.",
                    module="cra",
                    expected_result="CRA generado con registros comunicables y sin errores estructurales",
                    expected_action="review_cra_file",
                    task_order=1,
                    training_code="A33",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-SS-A34",
            title="Revisión RNT y RLC",
            description="Práctica A34: preparar una liquidación, revisar el detalle nominal y cuadrar bases, cuotas y total debido.",
            difficulty="intermediate",
            category="social-security",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A34"],
                "company_name": "Fundación AulaNomina",
                "settlement_data": {
                    "period": "2026-05",
                    "period_year": 2026,
                    "period_month": 5,
                    "ccc": DEMO_CCC_SAN_RAFAEL,
                },
            },
            completion_message="La liquidación cuadra entre detalle nominal, bases, cuotas y total RLC simulado.",
            tasks=[
                _task(
                    title="Preparar y cuadrar la liquidación",
                    description="Prepara mayo de 2026 para el CCC 14000000011 y contrasta trabajadores, bases, cuotas y total debido.",
                    module="social-security",
                    expected_result="RNT y RLC simulados coherentes con las nóminas del periodo",
                    expected_action="review_social_security_settlement",
                    task_order=1,
                    training_code="A34",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-SS-A35",
            title="Ciclo de rechazo y reenvío SILTRA",
            description="Práctica A35: forzar un rechazo CRA en SILTRA simulado, generar la correctora y completar un segundo envío aceptado.",
            difficulty="intermediate",
            category="social-security",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A35"],
                "company_name": "Fundación AulaNomina",
                "siltra_data": {
                    "source_file_type": "CRA",
                    "period": "2026-05",
                    "ccc": DEMO_CCC_SAN_RAFAEL,
                    "first_scenario": "REJECTED",
                    "accepted_statuses": ["ACCEPTED", "ACCEPTED_WITH_WARNINGS"],
                },
            },
            completion_message="El alumno ha interpretado el rechazo, generado una comunicación correctora y conseguido un segundo envío aceptado.",
            tasks=[
                _task(
                    title="Obtener y revisar un rechazo",
                    description="Selecciona el CRA generado, usa el escenario de práctica Rechazo y envíalo. Revisa el código y los mensajes devueltos.",
                    module="siltra",
                    expected_result="Primer envío rechazado con mensajes de error identificables",
                    expected_action="review_siltra_rejection",
                    task_order=1,
                ),
                _task(
                    title="Generar la comunicación correctora",
                    description="Desde el fichero rechazado, crea la comunicación correctora y comprueba su vínculo con el envío anterior.",
                    module="cra",
                    expected_result="Nuevo CRA corrector generado y trazado contra el rechazado",
                    expected_action="review_siltra_correction",
                    task_order=2,
                ),
                _task(
                    title="Reenviar y obtener aceptación",
                    description="Envía la correctora con validación automática y comprueba que el segundo ciclo termina aceptado.",
                    module="siltra",
                    expected_result="Segundo envío aceptado y respuesta asociada",
                    expected_action="review_siltra_acceptance",
                    task_order=3,
                ),
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


def seed_social_security_runtime_cases_2026(db: Session) -> None:
    for definition in build_social_security_runtime_cases_2026():
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


def seed_social_security_runtime_assignments_2026(db: Session) -> None:
    student = db.query(Student).order_by(Student.id.asc()).first()
    if student is None:
        return
    cases = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code.in_(sorted(SOCIAL_SECURITY_SCENARIO_CODES)))
        .order_by(CaseStudy.id.asc())
        .all()
    )
    for case_study in cases:
        assignment = (
            db.query(CaseAssignment)
            .filter(CaseAssignment.case_study_id == case_study.id)
            .order_by(CaseAssignment.id.asc())
            .first()
        )
        if assignment is None:
            assignment = CaseAssignment(
                case_study_id=case_study.id,
                student_id=student.id,
                assigned_by="Profesor demo",
                status="assigned",
                notes="Práctica guiada del bloque de Seguridad Social y Sistema RED.",
            )
            db.add(assignment)
            db.commit()
        ensure_assignment_progress(db, assignment.id)


def _normalize(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _find_employee(db: Session, name: str) -> Employee | None:
    expected = _normalize(name)
    for employee in db.query(Employee).all():
        full_name = " ".join(part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part)
        if _normalize(full_name) == expected:
            return employee
    return None


def _ensure_contribution_groups(db: Session) -> None:
    for dni, group in (("10000001A", "5"), ("10000002B", "7")):
        employee = db.query(Employee).filter(Employee.dni == dni).first()
        if employee is None:
            continue
        contract = (
            db.query(Contract)
            .filter(Contract.employee_id == employee.id)
            .order_by(Contract.start_date.desc(), Contract.id.desc())
            .first()
        )
        if contract and not contract.contribution_group:
            contract.contribution_group = group
    db.commit()


def _ensure_a31_incident(db: Session) -> Incident | None:
    employee = _find_employee(db, "Laura Martín Ruiz")
    if employee is None:
        return None
    contract = (
        db.query(Contract)
        .filter(
            Contract.employee_id == employee.id,
            Contract.start_date <= date(2026, 12, 1),
            ((Contract.end_date == None) | (Contract.end_date >= date(2026, 12, 1))),
        )
        .order_by(Contract.start_date.desc(), Contract.id.desc())
        .first()
    )
    if contract is None:
        return None
    incident = (
        db.query(Incident)
        .filter(
            Incident.employee_id == employee.id,
            Incident.incident_type == "IT",
            Incident.start_date == date(2026, 12, 1),
        )
        .first()
    )
    if incident is None:
        incident = Incident(
            employee_id=employee.id,
            company_id=employee.company_id,
            center_id=employee.center_id,
            contract_id=contract.id,
            incident_type="IT",
            start_date=date(2026, 12, 1),
            end_date=date(2026, 12, 3),
            description="IT formativa preparada para la conciliación FIE A31/A32.",
            status="open",
            paid=True,
        )
        db.add(incident)
        db.flush()
    else:
        incident.end_date = date(2026, 12, 3)
        incident.status = "open"
        incident.paid = True
        incident.is_cancelled = False
    detail = db.query(IncidentDetail).filter(IncidentDetail.incident_id == incident.id).first()
    if detail is None:
        detail = IncidentDetail(incident_id=incident.id, details={})
        db.add(detail)
    detail.details = {
        **(detail.details or {}),
        "benefit_type": "temporary_disability",
        "process_type": "common_disease",
        "training_scenario": "A31-A32",
    }
    db.commit()
    db.refresh(incident)
    return incident


def ensure_training_fie_a31_2026(db: Session, *, reset: bool = False) -> FieCommunication | None:
    employee = _find_employee(db, "Laura Martín Ruiz")
    incident = _ensure_a31_incident(db)
    if employee is None or employee.company_id is None:
        return None
    contract = incident.contract if incident else None
    communication = db.query(FieCommunication).filter(FieCommunication.external_message_id == FIE_A31_MESSAGE_ID).first()
    values = {
        "company_id": employee.company_id,
        "employee_id": employee.id,
        "contract_id": contract.id if contract else None,
        "incident_id": None,
        "ccc_id": DEMO_CCC_SAN_RAFAEL,
        "naf": employee.naf,
        "external_worker_name": "Laura Martín Ruiz",
        "external_nif": employee.dni,
        "process_reference": FIE_A31_PROCESS_REFERENCE,
        "previous_process_reference": None,
        "communication_type": "SICK_LEAVE",
        "contingency_type": "COMMON_DISEASE",
        "event_date": date(2026, 12, 1),
        "sick_leave_date": date(2026, 12, 1),
        "confirmation_date": None,
        "medical_discharge_date": None,
        "relapse_date": None,
        "estimated_duration": 3,
        "source": "SIMULATION",
        "priority": "NORMAL",
        "received_at": datetime(2026, 12, 1, 8, 30),
        "read_at": None,
        "status": "RECEIVED",
        "reconciliation_result": {},
        "payroll_impact": "NOT_APPLICABLE",
        "raw_content": {
            "format": "AULANOMINA_FIE_V1",
            "simulation": True,
            "scenario_code": "TRAIN-2026-SS-A31-A32",
            "process": {
                "reference": FIE_A31_PROCESS_REFERENCE,
                "communication_type": "SICK_LEAVE",
                "contingency": "COMMON_DISEASE",
                "event_date": "2026-12-01",
                "sick_leave_date": "2026-12-01",
                "estimated_duration": 3,
            },
        },
        "notes": "Comunicación FIE dedicada a las prácticas A31 y A32.",
        "created_by": "Demo formación AulaNomina",
    }
    if communication is None:
        communication = FieCommunication(external_message_id=FIE_A31_MESSAGE_ID, **values)
        db.add(communication)
        db.flush()
    elif reset:
        db.query(FieProcessingEvent).filter(FieProcessingEvent.communication_id == communication.id).delete(synchronize_session=False)
        for field, value in values.items():
            setattr(communication, field, value)
    if not communication.events:
        db.add(
            FieProcessingEvent(
                communication_id=communication.id,
                event_type="RECEIVED",
                actor="INSS simulado",
                detail="Comunicación FIE recibida para A31/A32.",
                payload={"scenario_code": "TRAIN-2026-SS-A31-A32"},
                created_at=datetime(2026, 12, 1, 8, 30),
            )
        )
    db.commit()
    db.refresh(communication)
    return communication


def prepare_social_security_training_data_2026(db: Session) -> None:
    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    if company is None:
        return
    _ensure_contribution_groups(db)
    ensure_training_fie_a31_2026(db, reset=True)
