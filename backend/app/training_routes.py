from fastapi import APIRouter, HTTPException, Query

import app.crud.case_assignment as case_assignment_crud
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
from app.training.document_runtime_bootstrap_2026 import bootstrap_document_training_2026
from app.training.termination_runtime_bootstrap_2026 import bootstrap_termination_training_2026


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

# El endpoint /seed-demo importa seed_demo_case_assignments después de este módulo.
# Envolvemos una sola vez el seeder existente para restaurar los datasets
# formativos aislados cada vez que se reinicia la demo.
if not getattr(case_assignment_crud.seed_demo_case_assignments, "_termination_training_wrapped", False):
    _base_seed_demo_case_assignments = case_assignment_crud.seed_demo_case_assignments

    def _seed_demo_case_assignments_with_terminations(db):
        result = _base_seed_demo_case_assignments(db)
        bootstrap_termination_training_2026(db)
        return result

    _seed_demo_case_assignments_with_terminations._termination_training_wrapped = True
    case_assignment_crud.seed_demo_case_assignments = _seed_demo_case_assignments_with_terminations

if not getattr(case_assignment_crud.seed_demo_case_assignments, "_document_training_wrapped", False):
    _base_seed_demo_case_assignments_b09 = case_assignment_crud.seed_demo_case_assignments

    def _seed_demo_case_assignments_with_documents(db):
        result = _base_seed_demo_case_assignments_b09(db)
        bootstrap_document_training_2026(db)
        return result

    _seed_demo_case_assignments_with_documents._document_training_wrapped = True
    case_assignment_crud.seed_demo_case_assignments = _seed_demo_case_assignments_with_documents


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
