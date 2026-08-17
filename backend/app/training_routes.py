from fastapi import APIRouter, HTTPException, Query

import app.services.training_activity_runtime_service as training_activity_runtime_service
from app.employment_termination_routes import router as employment_termination_router
from app.payroll_salary_structure_routes import router as application_aggregate_router
from app.training import (
    OFFICIAL_SOURCES_2026,
    blueprint_summary,
    build_training_catalog_2026,
    get_training_activity_2026,
    list_training_activities_2026,
    training_dependency_graph_2026,
)
from app.training.integrated_runtime_cases_2026 import INTEGRATED_SCENARIO_CODES


# `main.py` ya incluye application_aggregate_router sin prefijo. Extendemos ese
# agregador aquí para mantener /employment-terminations como ruta de primer nivel
# sin ampliar el monolito principal durante Split 43.
application_aggregate_router.include_router(employment_termination_router)

# Los casos A46/A47/A48/A50 representan prácticas maestras con varios pasos.
# Registrarlos en el adaptador permite mostrarlos como A46.1, A46.2, etc.
training_activity_runtime_service.GUIDED_MULTISTEP_SCENARIOS.update(
    {
        "TRAIN-2026-TERM-A46": "A46",
        "TRAIN-2026-TERM-A47": "A47",
        "TRAIN-2026-TERM-A48": "A48",
        "TRAIN-2026-TERM-A50": "A50",
    }
)

# B10 sustituye los mapeos provisionales IT-2026-008/NOM-2026-014 por seis
# expedientes capstone explícitos. C02 reutiliza LAB-2026-001.
training_activity_runtime_service.INTEGRAL_CASE_CODES.clear()
training_activity_runtime_service.INTEGRAL_CASE_CODES.update(
    {scenario: code for code, scenario in INTEGRATED_SCENARIO_CODES.items()}
)

# El antiguo caso demo documental ya no representa A52: B09 dispone ahora de
# casos deterministas propios A51-A54.
training_activity_runtime_service.MULTISTEP_CASE_TITLES.pop("Expediente documental incompleto", None)

# Añadimos los datos operativos de B08 sin duplicar el adaptador maestro.
if not getattr(training_activity_runtime_service._training_case_data, "_termination_data_wrapped", False):
    _base_training_case_data = training_activity_runtime_service._training_case_data

    def _training_case_data_with_terminations(task, code, current_rows):
        rows = list(_base_training_case_data(task, code, current_rows) or [])
        if code not in {"A46", "A47", "A48", "A49", "A50"}:
            return rows
        state = task.case_study.initial_state or {}
        termination = state.get("termination_data") or {}
        settlement = state.get("settlement_data") or {}

        def add(label, value):
            if value in {None, ""} or any(item.get("label") == label for item in rows):
                return
            rows.append({"label": label, "value": str(value)})

        add("Causa", termination.get("reason_code"))
        add("Código RED", termination.get("ss_situation_code"))
        add("Fecha de efectos", state.get("effective_date"))
        add("Fecha comunicación", termination.get("communication_date"))
        add("Documento", termination.get("document_reference"))
        add("Días/año", termination.get("days_per_year"))
        add("Salario anual", termination.get("annual_salary_reference"))
        add("Indemnización esperada", termination.get("expected_indemnity"))
        if code == "A50":
            add("Salario pendiente", settlement.get("pending_salary_amount"))
            add("Vacaciones", settlement.get("vacation_amount"))
            add("Pagas", settlement.get("extra_pay_amount"))
            add("Indemnización", settlement.get("indemnity_amount"))
            add("Total finiquito", settlement.get("expected_total"))
        return rows[:8]

    _training_case_data_with_terminations._termination_data_wrapped = True
    training_activity_runtime_service._training_case_data = _training_case_data_with_terminations

# B09 reutiliza Documentos y Correo, pero exponemos en el centro de actividades
# sólo los datos que el alumno necesita para resolver cada encargo.
if not getattr(training_activity_runtime_service._training_case_data, "_document_data_wrapped", False):
    _base_training_case_data_b09 = training_activity_runtime_service._training_case_data

    def _training_case_data_with_documents(task, code, current_rows):
        rows = list(_base_training_case_data_b09(task, code, current_rows) or [])
        if code not in {"A51", "A52", "A53", "A54"}:
            return rows
        state = task.case_study.initial_state or {}
        document_data = state.get("document_data") or {}
        mail_data = state.get("mail_data") or {}
        evidence_data = state.get("evidence_data") or {}

        def add(label, value):
            if value in {None, ""} or any(item.get("label") == label for item in rows):
                return
            rows.append({"label": label, "value": str(value)})

        add("Trabajador", state.get("employee"))
        if code == "A51":
            add("Documentos requeridos", len(document_data.get("required_types") or []))
            add("Ya recibidos", len(document_data.get("received_types") or []))
            add("Deben quedar pendientes", len(document_data.get("pending_types") or []))
        elif code == "A52":
            add("Certificado caducado", document_data.get("expired_on"))
            add("Documento no aplicable", document_data.get("not_applicable_type"))
            add("Estados objetivo", "recibido · caducado · no aplicable")
        elif code == "A53":
            add("Documento", document_data.get("document_type"))
            add("Estado", document_data.get("status"))
            add("Caducidad", document_data.get("expiry_date"))
            add("Correo", mail_data.get("subject"))
        elif code == "A54":
            add("Documento", document_data.get("document_type"))
            add("Estado", document_data.get("status"))
            add("Emisión", document_data.get("issue_date"))
            add("Adjunto", evidence_data.get("attachment_filename"))
        return rows[:8]

    _training_case_data_with_documents._document_data_wrapped = True
    training_activity_runtime_service._training_case_data = _training_case_data_with_documents

# Los capstones muestran contexto suficiente para decidir, pero no replican las
# instrucciones detalladas de las actividades guiadas previas.
if not getattr(training_activity_runtime_service._training_case_data, "_integrated_data_wrapped", False):
    _base_training_case_data_b10 = training_activity_runtime_service._training_case_data

    def _training_case_data_with_integrated(task, code, current_rows):
        rows = list(_base_training_case_data_b10(task, code, current_rows) or [])
        if code not in {"C01", "C02", "C03", "C04", "C05", "C06"}:
            return rows
        state = task.case_study.initial_state or {}
        model111 = state.get("model111_data") or {}
        cra = state.get("cra_data") or {}
        termination = state.get("termination_data") or {}
        settlement = state.get("settlement_data") or {}

        def add(label, value):
            if value in {None, ""} or any(item.get("label") == label for item in rows):
                return
            rows.append({"label": label, "value": str(value)})

        add("Trabajador", state.get("employee"))
        add("Persona sustituta", state.get("substitute"))
        add("Empresa", state.get("company_name"))
        add("Fecha de inicio", state.get("start_date"))
        add("Fecha de efectos", state.get("effective_date"))
        add("Periodo nómina", state.get("payroll_period"))
        if code == "C04":
            add("Ejercicio", model111.get("year"))
            add("Periodo", model111.get("period"))
            add("Profesional", model111.get("professional_nif"))
        elif code == "C05":
            add("Periodo", cra.get("period"))
            add("CCC", cra.get("ccc"))
            add("Primer escenario", (state.get("siltra_data") or {}).get("first_scenario"))
        elif code == "C06":
            add("Causa", termination.get("reason_code"))
            add("Código RED", termination.get("ss_situation_code"))
            add("Documento", termination.get("document_reference"))
            add("Total finiquito", settlement.get("expected_total"))
        return rows[:8]

    _training_case_data_with_integrated._integrated_data_wrapped = True
    training_activity_runtime_service._training_case_data = _training_case_data_with_integrated


router = APIRouter(prefix="/training", tags=["training"])


@router.get("/summary")
def training_summary():
    return {
        "course": "AN-GL-2026",
        "version": "2026.1-phase-a",
        **blueprint_summary(),
    }


@router.get("/catalog")
def training_catalog(
    include_source_metadata: bool = Query(default=False),
):
    return build_training_catalog_2026(include_source_metadata=include_source_metadata)


@router.get("/activities")
def training_activities(
    include_source_metadata: bool = Query(default=False),
):
    return list_training_activities_2026(include_source_metadata=include_source_metadata)


@router.get("/activities/{activity_code}")
def training_activity(
    activity_code: str,
    include_source_metadata: bool = Query(default=True),
):
    activity = get_training_activity_2026(
        activity_code,
        include_source_metadata=include_source_metadata,
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad formativa no encontrada")
    return activity


@router.get("/dependencies")
def training_dependencies():
    return training_dependency_graph_2026()


@router.get("/sources")
def training_sources():
    return [
        {"code": code, **source}
        for code, source in OFFICIAL_SOURCES_2026.items()
    ]
