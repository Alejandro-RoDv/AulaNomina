"""Casos capstone C01-C06 del Temario Maestro AulaNomina 2026.

B10 reutiliza los motores y datasets de los bloques anteriores, pero mantiene
progreso propio. C02 promueve el caso integral LAB-2026-001 ya existente.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.student import Student
from app.schemas.case_study import CaseStudyCreate, CaseTaskCreate
from app.services.case_scenario_service import ensure_assignment_progress


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"
DEMO_COMPANY_CIF = "G14999999"
DEMO_CCC_SAN_RAFAEL = "14000000011"

INTEGRATED_SCENARIO_CODES = {
    "C01": "TRAIN-2026-INT-C01",
    "C02": "LAB-2026-001",
    "C03": "TRAIN-2026-INT-C03",
    "C04": "TRAIN-2026-INT-C04",
    "C05": "TRAIN-2026-INT-C05",
    "C06": "TRAIN-2026-INT-C06",
}
NEW_INTEGRATED_SCENARIOS = {
    code for key, code in INTEGRATED_SCENARIO_CODES.items() if key != "C02"
}

C01_EMPLOYEE = {
    "first_name": "Clara",
    "last_name": "Benítez",
    "second_last_name": "Mora",
    "dni": "31000001H",
    "naf": "143100000001",
    "birth_date": "1997-02-18",
    "nationality": "Española",
    "email": "clara.benitez@aulanomina.demo",
}
C01_REQUIRED_DOCUMENTS = [
    "DNI_NIE",
    "NAF",
    "SIGNED_CONTRACT",
    "MODEL_145",
    "SEXUAL_OFFENCES_CERTIFICATE",
]


def _task(
    *,
    title: str,
    description: str,
    module: str,
    expected_result: str,
    expected_action: str,
    order: int,
    trigger_type: str = "system",
) -> CaseTaskCreate:
    return CaseTaskCreate(
        title=title,
        description=description,
        module=module,
        expected_result=expected_result,
        expected_action=expected_action,
        trigger_type=trigger_type,
        trigger_condition={
            "course_code": COURSE_CODE,
            "course_version": COURSE_VERSION,
            "validation_interaction": "explicit_review",
            "capstone": True,
        },
        validation_rules=[],
        task_order=order,
        is_required=True,
        blocking=True,
        status="pending",
    )


def build_integrated_runtime_cases_2026() -> list[CaseStudyCreate]:
    return [
        CaseStudyCreate(
            scenario_code=INTEGRATED_SCENARIO_CODES["C01"],
            title="C01 · Nueva incorporación completa",
            description=(
                "Dirección comunica una incorporación. El alumno debe transformar la información recibida "
                "en un expediente laboral coherente hasta obtener la primera nómina."
            ),
            difficulty="advanced",
            category="general",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["C01"],
                "employee": "Clara Benítez Mora",
                "employee_data": C01_EMPLOYEE,
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "start_date": "2026-09-15",
                "payroll_period": "2026-09",
                "contract_data": {
                    "contract_family": "indefinite",
                    "working_day": "Tiempo completo",
                    "weekly_hours": 40,
                    "job_position": "Administrativa",
                },
                "document_data": {"required_types": C01_REQUIRED_DOCUMENTS},
            },
            validation_rules=[],
            completion_message=(
                "La incorporación está conectada de extremo a extremo: expediente, contrato, alta, "
                "documentación y primera nómina proceden de la misma relación laboral."
            ),
            tasks=[
                _task(
                    title="Construir el expediente de incorporación",
                    description=(
                        "Interpreta la comunicación de dirección y deja a Clara correctamente identificada y "
                        "adscrita a la estructura organizativa indicada."
                    ),
                    module="employees",
                    expected_result="Expediente activo y coherente con empresa, centro e identidad recibida",
                    expected_action="review_integrated_c01_employee",
                    order=1,
                ),
                _task(
                    title="Formalizar la relación laboral",
                    description=(
                        "Con la información profesional del caso, deja formalizada la relación que permitirá "
                        "continuar el alta y el cálculo posterior."
                    ),
                    module="contracts",
                    expected_result="Contrato indefinido activo para la incorporación del 15/09/2026",
                    expected_action="review_integrated_c01_contract",
                    order=2,
                ),
                _task(
                    title="Coordinar el alta de Seguridad Social",
                    description=(
                        "Prepara el movimiento de afiliación desde la relación creada y comprueba que la fecha "
                        "de alta no rompe la secuencia del expediente."
                    ),
                    module="affiliations",
                    expected_result="Alta preparada para la misma persona, contrato y fecha de incorporación",
                    expected_action="review_integrated_c01_affiliation",
                    order=3,
                ),
                _task(
                    title="Cerrar el expediente documental inicial",
                    description=(
                        "Revisa la documentación aportada y deja el expediente inicial sin documentos críticos "
                        "del supuesto pendientes."
                    ),
                    module="documents",
                    expected_result="DNI, NAF, contrato, Modelo 145 y certificado requeridos constan recibidos",
                    expected_action="review_integrated_c01_documents",
                    order=4,
                ),
                _task(
                    title="Obtener la primera nómina",
                    description=(
                        "Procesa septiembre con la relación creada y comprueba que la primera nómina refleja "
                        "una incorporación producida a mitad de mes."
                    ),
                    module="payrolls",
                    expected_result="Primera nómina de septiembre calculada para Clara",
                    expected_action="review_integrated_c01_payroll",
                    order=5,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code=INTEGRATED_SCENARIO_CODES["C03"],
            title="C03 · Reclamación salarial y retroactivo",
            description=(
                "Una trabajadora reclama la ausencia del complemento de antigüedad. Hay que localizar la causa, "
                "corregirla, regularizar y contestar únicamente cuando la solución sea demostrable."
            ),
            difficulty="advanced",
            category="payroll",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["C03"],
                "employee": "Ana Martín García",
                "company_name": "Fundación AulaNomina",
                "payroll_period": "2026-07",
                "expected_seniority_date": "2026-07-01",
                "regularization_data": {
                    "concept": "antigüedad",
                    "origin_period": "2026-07",
                    "target_period": "2026-07",
                },
                "mail_data": {
                    "legacy_reference": "NOM-2026-014",
                    "subject": "Revisión de antigüedad en la nómina de Ana Martín",
                },
            },
            validation_rules=[],
            completion_message="La reclamación queda explicada por la evidencia del contrato, nómina, regularización y respuesta enviada.",
            tasks=[
                _task(
                    title="Investigar antes de corregir",
                    description="Contrasta contrato, antigüedad y nómina de julio hasta poder explicar la causa de la diferencia.",
                    module="contracts",
                    expected_result="La fecha de antigüedad relevante queda identificada y documentada",
                    expected_action="review_integrated_c03_cause",
                    order=1,
                ),
                _task(
                    title="Corregir el origen salarial",
                    description="Corrige la causa en la relación laboral; no compenses la diferencia con un importe aislado sin origen.",
                    module="payrolls",
                    expected_result="El complemento de antigüedad queda activo en el contrato",
                    expected_action="review_integrated_c03_concept",
                    order=2,
                ),
                _task(
                    title="Regularizar la diferencia",
                    description="Reconstruye la nómina afectada y deja una regularización trazable para el periodo reclamado.",
                    module="regularizations",
                    expected_result="Nómina recalculada y diferencia retroactiva registrada",
                    expected_action="review_integrated_c03_regularization",
                    order=3,
                ),
                _task(
                    title="Cerrar la reclamación con evidencia",
                    description="Responde en el hilo cuando el resultado comunicado pueda justificarse con los registros anteriores.",
                    module="mail",
                    expected_result="Respuesta profesional enviada y coherente con la regularización aplicada",
                    expected_action="review_integrated_c03_reply",
                    order=4,
                    trigger_type="mail_response",
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code=INTEGRATED_SCENARIO_CODES["C04"],
            title="C04 · Cierre fiscal trimestral",
            description=(
                "Contabilidad solicita el cierre del segundo trimestre. El alumno debe detectar qué perceptores "
                "alimentan la declaración, cuadrar el origen y completar la presentación simulada."
            ),
            difficulty="advanced",
            category="tax",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["C04"],
                "company_name": "Fundación AulaNomina",
                "model111_data": {
                    "year": 2026,
                    "period": "2T",
                    "declaration_type": "ordinary",
                    "professional_nif": "30456789R",
                },
            },
            validation_rules=[],
            completion_message="El Modelo 111 del 2T queda trazado desde sus perceptores hasta el justificante simulado de presentación.",
            tasks=[
                _task(
                    title="Cuadrar las fuentes del trimestre",
                    description="Determina qué rendimientos de trabajo y actividades económicas deben entrar en el 2T y elimina inconsistencias bloqueantes.",
                    module="model111",
                    expected_result="Vista previa válida con trabajadores y profesional del supuesto",
                    expected_action="review_integrated_c04_sources",
                    order=1,
                ),
                _task(
                    title="Cerrar la declaración",
                    description="Genera el Modelo 111 y contrasta sus cajas con las líneas que lo originan antes de presentar.",
                    module="model111",
                    expected_result="Declaración generada con bases y retenciones conciliadas",
                    expected_action="review_integrated_c04_declaration",
                    order=2,
                ),
                _task(
                    title="Presentar y conservar la evidencia",
                    description="Completa la presentación AEAT simulada y verifica que el resultado queda bloqueado y justificable.",
                    module="model111",
                    expected_result="Modelo 111 presentado con justificante y CSV simulado",
                    expected_action="review_integrated_c04_presentation",
                    order=3,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code=INTEGRATED_SCENARIO_CODES["C05"],
            title="C05 · Liquidación de Seguridad Social con error",
            description=(
                "El cierre de mayo contiene una remesa que no termina aceptada. El alumno debe cuadrar el origen, "
                "interpretar la respuesta, corregir y completar un nuevo ciclo de envío."
            ),
            difficulty="advanced",
            category="social_security",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["C05"],
                "company_name": "Fundación AulaNomina",
                "cra_data": {"period": "2026-05", "ccc": DEMO_CCC_SAN_RAFAEL},
                "settlement_data": {
                    "period": "2026-05",
                    "period_year": 2026,
                    "period_month": 5,
                    "ccc": DEMO_CCC_SAN_RAFAEL,
                },
                "siltra_data": {
                    "source_file_type": "CRA",
                    "period": "2026-05",
                    "ccc": DEMO_CCC_SAN_RAFAEL,
                    "first_scenario": "REJECTED",
                    "accepted_statuses": ["ACCEPTED", "ACCEPTED_WITH_WARNINGS"],
                },
            },
            validation_rules=[],
            completion_message="El cierre queda cuadrado y el segundo ciclo de SILTRA termina aceptado con trazabilidad sobre el rechazo anterior.",
            tasks=[
                _task(
                    title="Reconstruir el cierre desde el origen",
                    description="Cuadra CRA, detalle nominal y liquidación antes de interpretar cualquier respuesta de envío.",
                    module="social-security",
                    expected_result="CRA y RNT/RLC coherentes para mayo de 2026 y el CCC del supuesto",
                    expected_action="review_integrated_c05_origin",
                    order=1,
                ),
                _task(
                    title="Resolver el rechazo",
                    description="Obtén el rechazo de práctica, identifica su causa y genera una comunicación correctora vinculada al primer envío.",
                    module="siltra",
                    expected_result="Rechazo identificable y fichero corrector trazado contra el original",
                    expected_action="review_integrated_c05_correction",
                    order=2,
                ),
                _task(
                    title="Completar el segundo ciclo",
                    description="Reenvía la corrección y comprueba que la respuesta final ya permite cerrar la remesa.",
                    module="siltra",
                    expected_result="Segundo envío aceptado y respuesta asociada",
                    expected_action="review_integrated_c05_acceptance",
                    order=3,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code=INTEGRATED_SCENARIO_CODES["C06"],
            title="C06 · Extinción y liquidación final",
            description=(
                "Dirección comunica una extinción objetiva. RRHH debe coordinar el cese contractual, la baja, "
                "la liquidación final y la comunicación de cierre sin perder trazabilidad."
            ),
            difficulty="advanced",
            category="general",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["C06"],
                "employee": "Lucía Prieto Solís",
                "company_name": "Fundación AulaNomina",
                "effective_date": "2026-12-31",
                "termination_data": {
                    "reason_code": "objective_dismissal",
                    "ss_situation_code": "91",
                    "document_reference": "CARTA-OBJ-A49-2026",
                    "expected_indemnity": 7200,
                },
                "settlement_data": {
                    "pending_salary_amount": 1000,
                    "vacation_amount": 500,
                    "extra_pay_amount": 1500,
                    "indemnity_amount": 7200,
                    "expected_total": 10200,
                },
            },
            validation_rules=[],
            completion_message="El expediente de salida queda cerrado y puede reconstruirse desde la causa hasta la comunicación final.",
            tasks=[
                _task(
                    title="Resolver la extinción",
                    description="Determina el tratamiento del cese y deja registrada la extinción con su cálculo indemnizatorio trazable.",
                    module="terminations",
                    expected_result="Extinción objetiva registrada con 7.200,00 € de indemnización",
                    expected_action="review_integrated_c06_termination",
                    order=1,
                ),
                _task(
                    title="Cerrar la liquidación final",
                    description="Liquida los conceptos pendientes sin mezclar salario, vacaciones, pagas e indemnización.",
                    module="terminations",
                    expected_result="Finiquito cerrado por 10.200,00 € con desglose trazable",
                    expected_action="review_integrated_c06_settlement",
                    order=2,
                ),
                _task(
                    title="Coordinar la baja de afiliación",
                    description="Prepara la baja a partir del mismo contrato y fecha de efectos del expediente de extinción.",
                    module="affiliations",
                    expected_result="Movimiento BAJA preparado para el contrato extinguido el 31/12/2026",
                    expected_action="review_integrated_c06_affiliation",
                    order=3,
                ),
                _task(
                    title="Cerrar documentación y comunicación",
                    description="Comprueba que la causa tiene soporte documental y comunica el cierre únicamente cuando contrato, baja y liquidación estén coordinados.",
                    module="mail",
                    expected_result="Documento de extinción identificable y respuesta de cierre enviada",
                    expected_action="review_integrated_c06_close",
                    order=4,
                    trigger_type="mail_response",
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


def seed_integrated_runtime_cases_2026(db: Session) -> None:
    for definition in build_integrated_runtime_cases_2026():
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


def seed_integrated_runtime_assignments_2026(db: Session) -> None:
    student = db.query(Student).order_by(Student.id.asc()).first()
    if student is None:
        return
    cases = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code.in_(sorted(NEW_INTEGRATED_SCENARIOS)))
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
                notes="Caso integral B10: resolver el expediente reutilizando competencias de los bloques anteriores.",
            )
            db.add(assignment)
            db.commit()
        ensure_assignment_progress(db, assignment.id)
