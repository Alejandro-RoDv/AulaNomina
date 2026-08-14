from types import SimpleNamespace

from app.services.training_activity_runtime_service import _enrich_activity
from app.training.runtime_bindings_2026 import (
    PILOT_ACTIVITY_CODES_2026,
    build_pilot_task_definitions_2026,
    get_runtime_binding_2026,
)


def test_pilot_sequence_is_a04_a07_a29_and_uses_automatic_runtime_actions():
    assert PILOT_ACTIVITY_CODES_2026 == ("A04", "A07", "A29")

    a04 = get_runtime_binding_2026("A04")
    a07 = get_runtime_binding_2026("A07")
    a29 = get_runtime_binding_2026("A29")

    assert a04["expected_action"] == "create_employee"
    assert a04["runtime_prerequisites"] == []
    assert a07["expected_action"] == "create_contract"
    assert a07["runtime_prerequisites"] == ["A04"]
    assert a29["expected_action"] == "prepare_affiliation"
    assert a29["runtime_prerequisites"] == ["A07"]


def test_pilot_task_definitions_keep_training_code_inside_trigger_condition():
    definitions = build_pilot_task_definitions_2026()

    assert [item["task_order"] for item in definitions] == [1, 2, 3]
    assert [item["trigger_condition"]["training_code"] for item in definitions] == ["A04", "A07", "A29"]
    assert all(item["trigger_type"] == "module_event" for item in definitions)
    assert all(item["blocking"] is True for item in definitions)


def test_runtime_enrichment_uses_master_catalog_content_without_losing_execution_state():
    task = SimpleNamespace(
        trigger_condition={"training_code": "A07"},
        case_study=SimpleNamespace(
            initial_state={
                "start_date": "2026-09-01",
                "contract_data": {
                    "working_day": "Jornada completa",
                    "weekly_hours": 40,
                    "job_position": "Administrativo/a de RRHH",
                },
            }
        ),
    )
    legacy = {
        "id": "10:20",
        "task_id": 20,
        "display_number": "2.1",
        "title": "Texto antiguo",
        "case_data": [{"label": "Trabajador", "value": "Fulanito Pérez"}],
        "context": {"assignmentId": 10, "taskId": 20},
        "status": "pending",
        "is_completed": False,
        "result_criteria": [{"label": "Contrato activo registrado", "status": "pending"}],
    }

    enriched = _enrich_activity(legacy, task)

    assert enriched["training_code"] == "A07"
    assert enriched["display_number"] == "A07"
    assert enriched["runtime_migrated"] is True
    assert enriched["context"]["trainingCode"] == "A07"
    assert enriched["status"] == "pending"
    assert enriched["result_criteria"] == legacy["result_criteria"]
    assert any(row["label"] == "Jornada" for row in enriched["case_data"])
    assert any(row["label"] == "Puesto" for row in enriched["case_data"])
