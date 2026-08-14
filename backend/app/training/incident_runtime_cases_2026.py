"""Casos runtime del bloque B04 · Incidencias laborales.

Cada práctica maestra puede necesitar varios pasos de ERP. Los casos mantienen
el código pedagógico A23-A27 en el adaptador del curso y usan CaseTask solo como
unidad de ejecución y progreso.
"""

from __future__ import annotations

from typing import Any

from app.schemas.case_study import CaseStudyCreate, CaseTaskCreate


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"


def _task(
    *,
    title: str,
    description: str,
    module: str,
    expected_result: str,
    expected_action: str,
    task_order: int,
    validation_rules: list[dict[str, Any]],
    validation_interaction: str = "operation",
) -> CaseTaskCreate:
    return CaseTaskCreate(
        title=title,
        description=description,
        module=module,
        expected_result=expected_result,
        expected_action=expected_action,
        trigger_type="system" if validation_interaction == "explicit_review" else "module_event",
        trigger_condition={
            "course_code": COURSE_CODE,
            "course_version": COURSE_VERSION,
            "validation_interaction": validation_interaction,
        },
        validation_rules=validation_rules,
        task_order=task_order,
        is_required=True,
        blocking=True,
        status="pending",
    )


def build_incident_runtime_cases_2026() -> list[CaseStudyCreate]:
    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-INCIDENT-A23",
            title="IT por enfermedad común",
            description="Práctica guiada A23: registrar una IT común, conciliar la comunicación FIE y comprobar el efecto económico en nómina.",
            difficulty="intermediate",
            category="absence",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A23"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "payroll_period": "2026-09",
                "leave_start": "2026-09-07",
                "incident_data": {
                    "incident_type": "IT",
                    "start_date": "2026-09-07",
                    "end_date": "2026-09-12",
                    "benefit_type": "temporary_disability",
                    "process_type": "common_disease",
                    "expected_days": 6,
                    "fie_process_reference": "IT-TRAIN-A23-2026",
                },
            },
            completion_message="La IT común está registrada, conciliada con FIE y reflejada en la nómina de septiembre.",
            tasks=[
                _task(
                    title="Registrar la IT por enfermedad común",
                    description="Crea una incidencia IT del 07/09/2026 al 12/09/2026 e indica enfermedad común como tipo de proceso.",
                    module="incidents",
                    expected_result="IT registrada para Laura con fecha inicial correcta",
                    expected_action="create_incident",
                    task_order=1,
                    validation_rules=[{"type": "incident_exists", "incident_type": "IT", "start_date": "2026-09-07"}],
                ),
                _task(
                    title="Conciliar la comunicación FIE",
                    description="Abre la comunicación FIE del proceso IT-TRAIN-A23-2026 y relaciónala con la incidencia registrada.",
                    module="fie",
                    expected_result="FIE conciliado con la IT de Laura",
                    expected_action="reconcile_fie",
                    task_order=2,
                    validation_rules=[{"type": "reconcile_fie"}],
                ),
                _task(
                    title="Comprobar el efecto de la IT en nómina",
                    description="Recalcula septiembre y comprueba que la nómina refleja los seis días de IT por contingencia común.",
                    module="payrolls",
                    expected_result="Nómina recalculada con tratamiento de IT común",
                    expected_action="review_incident_payroll",
                    task_order=3,
                    validation_rules=[{"type": "payroll_recalculated", "period": "2026-09"}],
                    validation_interaction="explicit_review",
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-INCIDENT-A24",
            title="IT por accidente de trabajo",
            description="Práctica guiada A24: registrar una IT de contingencia profesional y comprobar que su tratamiento económico difiere de enfermedad común.",
            difficulty="intermediate",
            category="absence",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A24"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "payroll_period": "2026-10",
                "leave_start": "2026-10-05",
                "incident_data": {
                    "incident_type": "IT",
                    "start_date": "2026-10-05",
                    "end_date": "2026-10-09",
                    "benefit_type": "temporary_disability",
                    "process_type": "work_accident",
                    "expected_days": 5,
                },
            },
            completion_message="La IT profesional está registrada y el cálculo de octubre refleja su tratamiento específico.",
            tasks=[
                _task(
                    title="Registrar la IT por accidente de trabajo",
                    description="Crea una incidencia IT del 05/10/2026 al 09/10/2026 y selecciona accidente de trabajo como tipo de proceso.",
                    module="incidents",
                    expected_result="IT profesional registrada con fecha correcta",
                    expected_action="create_incident",
                    task_order=1,
                    validation_rules=[{"type": "incident_exists", "incident_type": "IT", "start_date": "2026-10-05"}],
                ),
                _task(
                    title="Comprobar el tratamiento profesional en nómina",
                    description="Recalcula octubre y verifica que el proceso se trata como accidente de trabajo y no como enfermedad común.",
                    module="payrolls",
                    expected_result="Nómina recalculada con contingencia profesional",
                    expected_action="review_incident_payroll",
                    task_order=2,
                    validation_rules=[{"type": "payroll_recalculated", "period": "2026-10"}],
                    validation_interaction="explicit_review",
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-INCIDENT-A25",
            title="Vacaciones aprobadas",
            description="Práctica guiada A25: registrar vacaciones aprobadas y comprobar que el intervalo queda libre de solapamientos incompatibles.",
            difficulty="basic",
            category="absence",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A25"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "incident_data": {
                    "incident_type": "VACACIONES",
                    "start_date": "2026-07-13",
                    "end_date": "2026-07-17",
                    "vacation_day_type": "calendar",
                    "expected_days": 5,
                },
            },
            completion_message="Las vacaciones han quedado registradas con el intervalo correcto y sin solapamientos incompatibles.",
            tasks=[
                _task(
                    title="Registrar el periodo de vacaciones",
                    description="Registra vacaciones de Laura del 13/07/2026 al 17/07/2026.",
                    module="incidents",
                    expected_result="Vacaciones registradas desde el 13 al 17 de julio",
                    expected_action="create_incident",
                    task_order=1,
                    validation_rules=[{"type": "incident_exists", "incident_type": "VACACIONES", "start_date": "2026-07-13"}],
                ),
                _task(
                    title="Comprobar intervalo y solapamientos",
                    description="Comprueba que el periodo registrado termina el 17/07/2026 y no tiene incidencias incompatibles solapadas.",
                    module="incidents",
                    expected_result="Intervalo completo y sin conflictos",
                    expected_action="review_incident",
                    task_order=2,
                    validation_rules=[{"type": "incident_exists", "incident_type": "VACACIONES", "start_date": "2026-07-13"}],
                    validation_interaction="explicit_review",
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-INCIDENT-A26",
            title="Ausencia no retribuida",
            description="Práctica guiada A26: clasificar una ausencia como no retribuida, registrarla y comprobar su impacto en salario y cotización.",
            difficulty="intermediate",
            category="absence",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A26"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "payroll_period": "2026-08",
                "incident_data": {
                    "incident_type": "PERMISO_NO_RETRIBUIDO",
                    "start_date": "2026-08-10",
                    "end_date": "2026-08-11",
                    "paid": False,
                    "expected_days": 2,
                    "expected_non_contribution_days": 2,
                },
            },
            completion_message="La ausencia no retribuida está clasificada y su efecto se refleja en la nómina de agosto.",
            tasks=[
                _task(
                    title="Registrar la ausencia no retribuida",
                    description="Registra un permiso no retribuido de Laura los días 10 y 11 de agosto de 2026.",
                    module="incidents",
                    expected_result="Ausencia no retribuida registrada para dos días",
                    expected_action="create_incident",
                    task_order=1,
                    validation_rules=[{"type": "incident_exists", "incident_type": "PERMISO_NO_RETRIBUIDO", "start_date": "2026-08-10"}],
                ),
                _task(
                    title="Comprobar el efecto económico de la ausencia",
                    description="Recalcula agosto y comprueba que los dos días reducen días cotizados y retribución del periodo.",
                    module="payrolls",
                    expected_result="Nómina de agosto recalculada con dos días no retribuidos",
                    expected_action="review_incident_payroll",
                    task_order=2,
                    validation_rules=[{"type": "payroll_recalculated", "period": "2026-08"}],
                    validation_interaction="explicit_review",
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-INCIDENT-A27",
            title="Cambio de jornada con efecto en nómina",
            description="Práctica guiada A27: reducir la jornada contractual, conservar el dato de efectos y comprobar la proporcionalidad en la nómina posterior.",
            difficulty="intermediate",
            category="absence",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A27"],
                "employee": "Laura Martín Ruiz",
                "company_name": "Fundación AulaNomina",
                "center_name": "Colegio San Rafael",
                "payroll_period": "2026-11",
                "workday_change": {
                    "effective_date": "2026-11-01",
                    "previous_weekly_hours": 40,
                    "target_weekly_hours": 30,
                    "full_time_weekly_hours": 40,
                    "target_partiality_coefficient": 75,
                    "target_working_day_type": "part_time",
                },
            },
            completion_message="La jornada de 30 horas está aplicada y la nómina de noviembre refleja la parcialidad del 75 %.",
            tasks=[
                _task(
                    title="Aplicar la nueva jornada contractual",
                    description="Edita el contrato de Laura para dejar 30 horas semanales, jornada parcial y coeficiente de parcialidad del 75 %.",
                    module="contracts",
                    expected_result="Contrato vigente con 30 horas y parcialidad del 75 %",
                    expected_action="review_workday_change",
                    task_order=1,
                    validation_rules=[{"type": "active_contract"}],
                    validation_interaction="explicit_review",
                ),
                _task(
                    title="Comprobar el efecto de la jornada en nómina",
                    description="Recalcula noviembre y comprueba que el salario base aplicado responde a la nueva parcialidad.",
                    module="payrolls",
                    expected_result="Nómina de noviembre recalculada al 75 % de jornada",
                    expected_action="review_workday_payroll",
                    task_order=2,
                    validation_rules=[{"type": "payroll_recalculated", "period": "2026-11"}],
                    validation_interaction="explicit_review",
                ),
            ],
        ),
    ]
