"""Casos ejecutables A46-A50 · Extinción y liquidación final."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.employment_termination import EmploymentTermination
from app.models.student import Student
from app.models.work_center import WorkCenter
from app.schemas.case_study import CaseStudyCreate, CaseTaskCreate
from app.services.case_scenario_service import ensure_assignment_progress


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"
DEMO_COMPANY_CIF = "G14999999"
DEMO_CENTER_CODE = "1.1"

TERMINATION_EMPLOYEES = {
    "A46": {
        "employee_code": "E.46",
        "dni": "30000001C",
        "naf": "143000000001",
        "first_name": "Marta",
        "last_name": "Serrano Vega",
        "start_date": date(2025, 3, 1),
        "contract_type": "Indefinido",
        "contract_family": "indefinite",
        "contract_code": "100",
        "salary_base": Decimal("1800.00"),
        "annual_salary": Decimal("25200.00"),
        "effective_date": date(2026, 10, 15),
    },
    "A47": {
        "employee_code": "E.47",
        "dni": "30000002K",
        "naf": "143000000002",
        "first_name": "Diego",
        "last_name": "Campos León",
        "start_date": date(2025, 11, 1),
        "contract_type": "Temporal",
        "contract_family": "temporary",
        "contract_code": "402",
        "salary_base": Decimal("1600.00"),
        "annual_salary": Decimal("22400.00"),
        "effective_date": date(2026, 10, 31),
    },
    "A48": {
        "employee_code": "E.48",
        "dni": "30000003E",
        "naf": "143000000003",
        "first_name": "Sara",
        "last_name": "Molina Rey",
        "start_date": date(2024, 6, 1),
        "contract_type": "Indefinido",
        "contract_family": "indefinite",
        "contract_code": "100",
        "salary_base": Decimal("2100.00"),
        "annual_salary": Decimal("29400.00"),
        "effective_date": date(2026, 11, 20),
    },
    "A49": {
        "employee_code": "E.49",
        "dni": "30000004T",
        "naf": "143000000004",
        "first_name": "Lucía",
        "last_name": "Prieto Solís",
        "start_date": date(2024, 1, 1),
        "contract_type": "Indefinido",
        "contract_family": "indefinite",
        "contract_code": "100",
        "salary_base": Decimal("3000.00"),
        "annual_salary": Decimal("43800.00"),
        "effective_date": date(2026, 12, 31),
    },
}

TERMINATION_SCENARIO_CODES = {
    "TRAIN-2026-TERM-A46",
    "TRAIN-2026-TERM-A47",
    "TRAIN-2026-TERM-A48",
    "TRAIN-2026-TERM-A49",
    "TRAIN-2026-TERM-A50",
}


def _name(data: dict[str, Any]) -> str:
    return f"{data['first_name']} {data['last_name']}"


def _task(*, title: str, description: str, expected_result: str, expected_action: str, order: int, training_code: str | None = None) -> CaseTaskCreate:
    trigger = {
        "course_code": COURSE_CODE,
        "course_version": COURSE_VERSION,
        "validation_interaction": "explicit_review",
    }
    if training_code:
        trigger["training_code"] = training_code
    return CaseTaskCreate(
        title=title,
        description=description,
        module="terminations",
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


def build_termination_runtime_cases_2026() -> list[CaseStudyCreate]:
    a46 = TERMINATION_EMPLOYEES["A46"]
    a47 = TERMINATION_EMPLOYEES["A47"]
    a48 = TERMINATION_EMPLOYEES["A48"]
    a49 = TERMINATION_EMPLOYEES["A49"]
    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TERM-A46",
            title="Baja voluntaria y coordinación de la baja",
            description="Práctica A46: registrar una dimisión, cerrar correctamente el contrato y preparar el movimiento de baja en afiliación.",
            difficulty="intermediate",
            category="terminations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A46"],
                "employee": _name(a46),
                "company_name": "Fundación AulaNomina",
                "effective_date": a46["effective_date"].isoformat(),
                "termination_data": {
                    "reason_code": "voluntary_resignation",
                    "ss_situation_code": "51",
                    "indemnity_expected": 0,
                    "communication_date": "2026-10-01",
                },
            },
            completion_message="La dimisión queda registrada sin indemnización y existe una baja AFI coherente con la fecha de efectos.",
            tasks=[
                _task(
                    title="Registrar la baja voluntaria",
                    description="Registra la dimisión de Marta con efectos 15/10/2026. La causa debe generar código RED 51 y no debe calcular indemnización.",
                    expected_result="Contrato finalizado el 15/10/2026 por dimisión y expediente de extinción sin indemnización",
                    expected_action="review_voluntary_termination",
                    order=1,
                ),
                _task(
                    title="Preparar la baja de afiliación",
                    description="Desde el expediente de extinción prepara un borrador AFI con el movimiento BAJA del mismo contrato y fecha 15/10/2026.",
                    expected_result="Borrador AFI con baja de Marta el 15/10/2026",
                    expected_action="review_termination_afi_baja",
                    order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TERM-A47",
            title="Fin de contrato temporal",
            description="Práctica A47: distinguir la expiración temporal de otros ceses, calcular su indemnización cuando procede y preparar la baja.",
            difficulty="intermediate",
            category="terminations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A47"],
                "employee": _name(a47),
                "company_name": "Fundación AulaNomina",
                "effective_date": a47["effective_date"].isoformat(),
                "termination_data": {
                    "reason_code": "temporary_expiry",
                    "ss_situation_code": "93",
                    "days_per_year": 12,
                    "contract_start_date": a47["start_date"].isoformat(),
                },
            },
            completion_message="El fin temporal queda diferenciado de la dimisión o el despido y la baja se prepara con código RED 93.",
            tasks=[
                _task(
                    title="Registrar la expiración temporal",
                    description="Finaliza el contrato de Diego el 31/10/2026 por expiración. Revisa que la regla use 12 días de salario por año de servicio y código RED 93.",
                    expected_result="Expiración temporal registrada con regla indemnizatoria y fecha correctas",
                    expected_action="review_temporary_expiry",
                    order=1,
                ),
                _task(
                    title="Preparar la baja por fin de contrato",
                    description="Prepara el borrador AFI de BAJA para Diego con efectos 31/10/2026 y comprueba que procede del contrato finalizado.",
                    expected_result="Borrador AFI con baja por fin temporal",
                    expected_action="review_termination_afi_baja",
                    order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TERM-A48",
            title="Despido disciplinario documentado",
            description="Práctica A48: registrar un despido disciplinario procedente con comunicación escrita simulada y coordinar la baja.",
            difficulty="intermediate",
            category="terminations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A48"],
                "employee": _name(a48),
                "company_name": "Fundación AulaNomina",
                "effective_date": a48["effective_date"].isoformat(),
                "termination_data": {
                    "reason_code": "disciplinary_dismissal",
                    "ss_situation_code": "53",
                    "indemnity_expected": 0,
                    "document_reference": "CARTA-DISC-A48-2026",
                },
            },
            completion_message="El despido disciplinario queda identificado, documentado y coordinado con la baja de afiliación.",
            tasks=[
                _task(
                    title="Registrar y documentar el despido",
                    description="Registra el despido disciplinario de Sara con efectos 20/11/2026. Debe constar la referencia CARTA-DISC-A48-2026, código RED 53 y cero indemnización en el supuesto procedente.",
                    expected_result="Despido disciplinario registrado con fecha, causa y referencia documental",
                    expected_action="review_disciplinary_dismissal",
                    order=1,
                ),
                _task(
                    title="Preparar la baja de afiliación",
                    description="Genera un borrador AFI que contenga la baja de Sara con fecha 20/11/2026.",
                    expected_result="Borrador AFI de baja disciplinaria preparado",
                    expected_action="review_termination_afi_baja",
                    order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TERM-A49",
            title="Indemnización por extinción objetiva",
            description="Práctica A49: calcular una indemnización trazable a partir de causa, salario regulador y tiempo de servicio.",
            difficulty="intermediate",
            category="terminations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A49"],
                "employee": _name(a49),
                "company_name": "Fundación AulaNomina",
                "effective_date": a49["effective_date"].isoformat(),
                "termination_data": {
                    "reason_code": "objective_dismissal",
                    "ss_situation_code": "91",
                    "contract_start_date": a49["start_date"].isoformat(),
                    "annual_salary_reference": float(a49["annual_salary"]),
                    "monthly_salary_reference": float(a49["salary_base"]),
                    "service_months": 36,
                    "days_per_year": 20,
                    "expected_indemnity_days": 60,
                    "expected_indemnity": 7200,
                    "document_reference": "CARTA-OBJ-A49-2026",
                },
            },
            completion_message="La indemnización queda explicada por 36 meses de servicio, 20 días/año, 60 días indemnizatorios y 7.200,00 €.",
            tasks=[
                _task(
                    title="Calcular y registrar la indemnización",
                    description="Registra la extinción objetiva de Lucía el 31/12/2026 usando 43.800,00 € anuales. Comprueba 36 meses de servicio, 20 días/año, 60 días y 7.200,00 € de indemnización. Informa CARTA-OBJ-A49-2026.",
                    expected_result="Indemnización objetiva de 7.200,00 € con cálculo completamente trazable",
                    expected_action="review_objective_indemnity",
                    order=1,
                    training_code="A49",
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TERM-A50",
            title="Liquidación final y finiquito",
            description="Práctica A50: completar el mismo expediente de Lucía separando salario pendiente, vacaciones, pagas e indemnización y cerrar el finiquito.",
            difficulty="intermediate",
            category="terminations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A50"],
                "employee": _name(a49),
                "company_name": "Fundación AulaNomina",
                "effective_date": a49["effective_date"].isoformat(),
                "settlement_data": {
                    "pending_salary_days": 10,
                    "pending_salary_amount": 1000,
                    "unused_vacation_days": 5,
                    "vacation_amount": 500,
                    "extra_pay_amount": 1500,
                    "indemnity_amount": 7200,
                    "other_amount": 0,
                    "expected_total": 10200,
                },
            },
            completion_message="El finiquito queda cerrado por 10.200,00 € y cada concepto puede reconstruirse por separado.",
            tasks=[
                _task(
                    title="Completar el desglose del finiquito",
                    description="Sobre la extinción objetiva ya registrada informa 10 días de salario pendiente, 5 días de vacaciones no disfrutadas y 1.500,00 € de pagas devengadas. Mantén separada la indemnización de 7.200,00 €.",
                    expected_result="Desglose: 1.000 salario + 500 vacaciones + 1.500 pagas + 7.200 indemnización = 10.200 €",
                    expected_action="review_final_settlement_breakdown",
                    order=1,
                ),
                _task(
                    title="Cerrar el finiquito",
                    description="Cierra el expediente cuando todos los conceptos estén revisados. El estado final debe ser settled y la traza conservar el total de 10.200,00 €.",
                    expected_result="Finiquito cerrado y trazable por 10.200,00 €",
                    expected_action="review_final_settlement_closed",
                    order=2,
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


def seed_termination_runtime_cases_2026(db: Session) -> None:
    for definition in build_termination_runtime_cases_2026():
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
        valid_orders = {task.task_order for task in definition.tasks}
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
        for stale in list(case_study.tasks):
            if stale.task_order not in valid_orders:
                db.delete(stale)
                changed = True
        if changed:
            _reset_case_progress(case_study)
        db.commit()


def _upsert_employee(db: Session, company: Company, center: WorkCenter, data: dict[str, Any]) -> Employee:
    employee = db.query(Employee).filter(Employee.dni == data["dni"]).first()
    values = {
        "employee_code": data["employee_code"],
        "company_id": company.id,
        "center_id": center.id,
        "dni": data["dni"],
        "naf": data["naf"],
        "first_name": data["first_name"],
        "last_name": data["last_name"],
        "birth_date": date(1990, 5, 12),
        "nationality": "Española",
        "email": f"{data['employee_code'].lower().replace('.', '')}@aulanomina.demo",
        "is_active": True,
        "status": "active",
    }
    if employee is None:
        employee = Employee(**values)
        db.add(employee)
        db.flush()
    else:
        for key, value in values.items():
            setattr(employee, key, value)
    return employee


def _upsert_contract(db: Session, employee: Employee, company: Company, center: WorkCenter, data: dict[str, Any]) -> Contract:
    contract = db.query(Contract).filter(
        Contract.employee_id == employee.id,
        Contract.start_date == data["start_date"],
    ).first()
    values = {
        "employee_id": employee.id,
        "company_id": company.id,
        "center_id": center.id,
        "contract_type": data["contract_type"],
        "contract_family": data["contract_family"],
        "contract_code": data["contract_code"],
        "start_date": data["start_date"],
        "end_date": None,
        "termination_reason": None,
        "status": "active",
        "working_day_type": "full_time",
        "weekly_hours": 40,
        "full_time_weekly_hours": 40,
        "partiality_coefficient": 100,
        "salary_base": data["salary_base"],
        "gross_annual_salary": data["annual_salary"],
        "pay_schedule": "not_prorated_14",
    }
    if contract is None:
        contract = Contract(**values)
        db.add(contract)
        db.flush()
    else:
        for key, value in values.items():
            setattr(contract, key, value)
    return contract


def prepare_termination_training_data_2026(db: Session) -> dict[str, int] | None:
    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    if company is None:
        return None
    center = db.query(WorkCenter).filter(
        WorkCenter.company_id == company.id,
        WorkCenter.center_code == DEMO_CENTER_CODE,
    ).first()
    if center is None:
        return None

    employee_ids = [
        row[0]
        for row in db.query(Employee.id)
        .filter(Employee.dni.in_([data["dni"] for data in TERMINATION_EMPLOYEES.values()]))
        .all()
    ]
    if employee_ids:
        db.query(EmploymentTermination).filter(EmploymentTermination.employee_id.in_(employee_ids)).delete(synchronize_session=False)

    result: dict[str, int] = {}
    for code, data in TERMINATION_EMPLOYEES.items():
        employee = _upsert_employee(db, company, center, data)
        contract = _upsert_contract(db, employee, company, center, data)
        result[f"{code}_employee_id"] = employee.id
        result[f"{code}_contract_id"] = contract.id
    db.commit()
    return result


def seed_termination_runtime_assignments_2026(db: Session) -> None:
    student = db.query(Student).order_by(Student.id.asc()).first()
    if student is None:
        return
    cases = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code.in_(sorted(TERMINATION_SCENARIO_CODES)))
        .order_by(CaseStudy.id.asc())
        .all()
    )
    for case_study in cases:
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
                notes="Práctica guiada de extinción y liquidación final del Temario Maestro 2026.",
            )
            db.add(assignment)
            db.commit()
        ensure_assignment_progress(db, assignment.id)
