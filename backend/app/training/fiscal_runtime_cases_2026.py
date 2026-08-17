"""Casos runtime del bloque B06 · IRPF y fiscalidad laboral."""

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
MODEL145_DOCUMENT_TYPE = "MODEL_145"
FISCAL_PROFESSIONAL_NIF = "30456789R"
FISCAL_PROFESSIONAL_NAME = "Marta León Pérez"
FISCAL_INVOICE_NUMBER = "PRO-2026-001"
FISCAL_MODEL111_YEAR = 2026
FISCAL_MODEL111_PERIOD = "2T"
FISCAL_MODEL190_YEAR = 2026
FISCAL_SCENARIO_CODES = {
    "TRAIN-2026-TAX-A36",
    "TRAIN-2026-TAX-A37",
    "TRAIN-2026-TAX-A38",
    "TRAIN-2026-TAX-A39",
    "TRAIN-2026-TAX-A40",
    "TRAIN-2026-TAX-A41",
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
) -> CaseTaskCreate:
    condition = {
        "course_code": COURSE_CODE,
        "course_version": COURSE_VERSION,
        "validation_interaction": "explicit_review",
    }
    if training_code:
        condition["training_code"] = training_code
    return CaseTaskCreate(
        title=title,
        description=description,
        module=module,
        expected_result=expected_result,
        expected_action=expected_action,
        trigger_type="system",
        trigger_condition=condition,
        validation_rules=[],
        task_order=task_order,
        is_required=True,
        blocking=True,
        status="pending",
    )


def build_fiscal_runtime_cases_2026() -> list[CaseStudyCreate]:
    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TAX-A36",
            title="Modelo 145 y perfil fiscal",
            description="Práctica A36: trasladar al expediente únicamente los datos comunicados mediante Modelo 145 y dejar la evidencia documental asociada.",
            difficulty="basic",
            category="tax",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A36"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "tax_profile_data": {
                    "birth_year": 1989,
                    "autonomous_community": "andalucia",
                    "family_situation": "situation_3",
                    "children_count": 0,
                    "ascendants_in_care": 0,
                    "employee_disability": False,
                    "contract_category": "general",
                    "employment_situation": "active",
                    "expected_annual_salary": 23520.0,
                    "contract_type": "Indefinido",
                    "contract_start_date": "2025-09-01",
                },
                "model145_data": {
                    "document_type": MODEL145_DOCUMENT_TYPE,
                    "required_status": "received",
                    "issue_date": "2026-06-01",
                },
            },
            completion_message="El Modelo 145 está recibido y el perfil fiscal contiene únicamente las circunstancias comunicadas.",
            tasks=[
                _task(
                    title="Registrar la recepción del Modelo 145",
                    description="En el expediente documental de Laura, actualiza Modelo 145 a recibido con fecha 01/06/2026.",
                    module="documents",
                    expected_result="Modelo 145 recibido y trazable en el expediente",
                    expected_action="review_model145_document",
                    task_order=1,
                ),
                _task(
                    title="Trasladar los datos al perfil fiscal",
                    description="Configura situación 3, sin descendientes ni ascendientes, Andalucía, relación general y retribución anual prevista de 23.520,00 €.",
                    module="irpf",
                    expected_result="Perfil fiscal coincidente con el Modelo 145 y listo para cálculo",
                    expected_action="review_model145_profile",
                    task_order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TAX-A37",
            title="Cálculo de retención IRPF 2026",
            description="Práctica A37: ejecutar el cálculo 2026 con el perfil guardado, revisar el resultado y aplicar exactamente el porcentaje sugerido.",
            difficulty="intermediate",
            category="tax",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A37"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "irpf_data": {
                    "calculation_year": 2026,
                    "rate_tolerance": 0.01,
                    "source": "TaxProfile + motor IRPF 2026",
                },
            },
            completion_message="El tipo aplicado coincide con el resultado reproducible del motor IRPF 2026.",
            tasks=[
                _task(
                    title="Calcular y aplicar el tipo sugerido",
                    description="Recalcula el IRPF desde el perfil fiscal de Laura, revisa el desglose y aplica el porcentaje sugerido para las próximas nóminas.",
                    module="irpf",
                    expected_result="Tipo IRPF persistido e igual al calculado con parámetros 2026",
                    expected_action="review_irpf_calculation",
                    task_order=1,
                    training_code="A37",
                )
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TAX-A38",
            title="Regularización del tipo de IRPF",
            description="Práctica A38: incorporar una nueva circunstancia familiar, recalcular el tipo y dejar activada la regularización para las nóminas posteriores.",
            difficulty="intermediate",
            category="tax",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A38"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "irpf_regularization_data": {
                    "reason": "Nacimiento de descendiente comunicado el 01/07/2026",
                    "effective_date": "2026-07-01",
                    "children_count": 1,
                    "manual_regularization": True,
                    "rate_tolerance": 0.01,
                },
            },
            completion_message="La nueva circunstancia está registrada y el tipo regularizado coincide con el cálculo actualizado.",
            tasks=[
                _task(
                    title="Actualizar la circunstancia familiar",
                    description="Actualiza el perfil fiscal de Laura para reflejar un descendiente desde el 01/07/2026, sin modificar circunstancias no comunicadas.",
                    module="irpf",
                    expected_result="Perfil fiscal actualizado con un descendiente",
                    expected_action="review_irpf_regularization_profile",
                    task_order=1,
                ),
                _task(
                    title="Recalcular y aplicar el nuevo tipo",
                    description="Recalcula con el perfil actualizado y aplica el nuevo tipo sugerido activando la regularización manual para periodos posteriores.",
                    module="irpf",
                    expected_result="Tipo regularizado aplicado y preparado para nóminas posteriores",
                    expected_action="review_irpf_regularization",
                    task_order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TAX-A39",
            title="Profesional sujeto a retención",
            description="Práctica A39: registrar un profesional como perceptor distinto del trabajador y contabilizar una factura pagada con retención.",
            difficulty="intermediate",
            category="tax",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A39"],
                "company_name": "Fundación AulaNomina",
                "professional_data": {
                    "nif": FISCAL_PROFESSIONAL_NIF,
                    "name": "Marta",
                    "surname": "León Pérez",
                    "activity_type": "professional",
                    "withholding_rate": 15.0,
                    "province_code": "14",
                    "invoice_number": FISCAL_INVOICE_NUMBER,
                    "invoice_date": "2026-04-20",
                    "payment_date": "2026-04-30",
                    "tax_base": 1200.0,
                    "withholding_amount": 180.0,
                    "total_amount": 1020.0,
                    "status": "paid",
                },
            },
            completion_message="El profesional y su factura quedan disponibles como fuente real para Modelos 111 y 190.",
            tasks=[
                _task(
                    title="Registrar al profesional",
                    description=f"Crea a {FISCAL_PROFESSIONAL_NAME} con NIF {FISCAL_PROFESSIONAL_NIF}, actividad profesional, provincia 14 y retención del 15 %.",
                    module="tax",
                    expected_result="Profesional activo e identificado fuera de la plantilla laboral",
                    expected_action="review_professional_recipient",
                    task_order=1,
                ),
                _task(
                    title="Registrar la factura con retención",
                    description="Registra PRO-2026-001, base 1.200,00 €, retención 15 % (180,00 €), pagada el 30/04/2026.",
                    module="tax",
                    expected_result="Factura pagada con base y retención correctas y disponible para obligaciones fiscales",
                    expected_action="review_professional_withholding",
                    task_order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TAX-A40",
            title="Modelo 111 del segundo trimestre",
            description="Práctica A40: cuadrar las fuentes del 2T, generar el Modelo 111, revisar sus cajas y completar la presentación simulada.",
            difficulty="intermediate",
            category="tax",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A40"],
                "company_name": "Fundación AulaNomina",
                "model111_data": {
                    "year": FISCAL_MODEL111_YEAR,
                    "period": FISCAL_MODEL111_PERIOD,
                    "declaration_type": "ordinary",
                    "professional_nif": FISCAL_PROFESSIONAL_NIF,
                },
            },
            completion_message="El Modelo 111 del 2T cuadra con sus fuentes y consta presentado en la simulación AEAT.",
            tasks=[
                _task(
                    title="Preparar y cuadrar las fuentes del 2T",
                    description="Revisa que las nóminas del trimestre estén revisadas o cerradas y que la factura profesional pagada figure entre las fuentes declarables.",
                    module="model111",
                    expected_result="Fuentes del 2T sin errores bloqueantes y totales conciliables",
                    expected_action="review_model_111_sources",
                    task_order=1,
                ),
                _task(
                    title="Generar y revisar el Modelo 111",
                    description="Genera la declaración ordinaria 2T/2026 y comprueba perceptores, bases, retenciones y resultado antes de presentar.",
                    module="model111",
                    expected_result="Modelo 111 generado con cajas coherentes con las líneas origen",
                    expected_action="review_model_111_generated",
                    task_order=2,
                ),
                _task(
                    title="Presentar el Modelo 111 simulado",
                    description="Completa la presentación AEAT simulada y comprueba que quedan justificante, CSV y bloqueo de la declaración.",
                    module="model111",
                    expected_result="Modelo 111 presentado y bloqueado con justificante simulado",
                    expected_action="review_model_111",
                    task_order=3,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-TAX-A41",
            title="Modelo 190 y conciliación anual",
            description="Práctica A41: generar el resumen anual 2026, revisar perceptores y contrastar los importes con las declaraciones periódicas disponibles.",
            difficulty="intermediate",
            category="tax",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A41"],
                "company_name": "Fundación AulaNomina",
                "model190_data": {
                    "year": FISCAL_MODEL190_YEAR,
                    "declaration_type": "ordinary",
                    "reference_model111_period": FISCAL_MODEL111_PERIOD,
                    "professional_nif": FISCAL_PROFESSIONAL_NIF,
                },
            },
            completion_message="El Modelo 190 contiene los perceptores esperados y su conciliación explica la relación con el Modelo 111 presentado.",
            tasks=[
                _task(
                    title="Generar el Modelo 190 anual",
                    description="Genera la declaración ordinaria del ejercicio 2026 y revisa el censo de perceptores, claves y acumulados antes de continuar.",
                    module="model190",
                    expected_result="Modelo 190 generado, congelado y sin errores bloqueantes",
                    expected_action="review_model_190_generated",
                    task_order=1,
                ),
                _task(
                    title="Conciliar 190 con las declaraciones periódicas",
                    description="Abre la conciliación anual y comprueba que el 2T presentado queda relacionado con las operaciones que alimentan el Modelo 190.",
                    module="model190",
                    expected_result="Totales anuales coherentes y conciliación 111/190 explicable",
                    expected_action="review_model_190",
                    task_order=2,
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


def seed_fiscal_runtime_cases_2026(db: Session) -> None:
    for definition in build_fiscal_runtime_cases_2026():
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


def seed_fiscal_runtime_assignments_2026(db: Session) -> None:
    student = db.query(Student).order_by(Student.id.asc()).first()
    if student is None:
        return
    cases = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code.in_(sorted(FISCAL_SCENARIO_CODES)))
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
                notes="Práctica guiada del bloque de IRPF y fiscalidad laboral del Temario Maestro 2026.",
            )
            db.add(assignment)
            db.commit()
        ensure_assignment_progress(db, assignment.id)
