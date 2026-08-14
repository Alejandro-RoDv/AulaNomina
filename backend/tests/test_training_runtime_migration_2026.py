from types import SimpleNamespace

from app.crud.case_study import _demo_cases
from app.services.training_activity_runtime_service import (
    _enrich_activity,
    _regroup_course_topics,
    _runtime_descriptor,
)
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


def test_demo_onboarding_case_is_backed_by_master_training_codes():
    case = next(item for item in _demo_cases() if item.scenario_code == "TRAIN-2026-001")

    assert case.title == "Alta completa de trabajador"
    assert case.initial_state["training_sequence"] == ["A04", "A07", "A29"]
    assert len(case.tasks) == 3
    assert [task.trigger_condition["training_code"] for task in case.tasks] == ["A04", "A07", "A29"]
    assert [task.expected_action for task in case.tasks] == [
        "create_employee",
        "create_contract",
        "prepare_affiliation",
    ]


def test_runtime_enrichment_uses_master_catalog_content_without_losing_execution_state():
    case_study = SimpleNamespace(
        scenario_code="TRAIN-2026-001",
        tasks=[],
        initial_state={
            "start_date": "2026-09-01",
            "contract_data": {
                "working_day": "Jornada completa",
                "weekly_hours": 40,
                "job_position": "Administrativo/a de RRHH",
            },
        },
    )
    task = SimpleNamespace(
        trigger_condition={"training_code": "A07"},
        expected_action="create_contract",
        task_order=2,
        case_study=case_study,
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
    assert enriched["block_code"] == "B02"
    assert enriched["context"]["trainingCode"] == "A07"
    assert enriched["status"] == "pending"
    assert enriched["result_criteria"] == legacy["result_criteria"]
    assert any(row["label"] == "Jornada" for row in enriched["case_data"])
    assert any(row["label"] == "Puesto" for row in enriched["case_data"])


def test_existing_it_and_regularization_cases_are_integral_master_practices():
    it_case = SimpleNamespace(scenario_code="IT-2026-008", tasks=[1, 2, 3, 4])
    it_task = SimpleNamespace(
        trigger_condition={},
        expected_action="review_fie",
        task_order=1,
        case_study=it_case,
    )
    regularization_case = SimpleNamespace(scenario_code="NOM-2026-014", tasks=[1, 2, 3, 4])
    regularization_task = SimpleNamespace(
        trigger_condition={},
        expected_action="review_contract",
        task_order=1,
        case_study=regularization_case,
    )

    assert _runtime_descriptor(it_task) == {
        "code": "C02",
        "kind": "integral_case",
        "substep": 1,
        "substep_total": 4,
        "inferred": True,
    }
    assert _runtime_descriptor(regularization_task)["code"] == "C03"


def test_existing_substitution_contract_maps_to_a09():
    case_study = SimpleNamespace(scenario_code="ALT-2026-021", tasks=[1, 2, 3])
    task = SimpleNamespace(
        trigger_condition={},
        expected_action="create_contract",
        task_order=2,
        case_study=case_study,
    )

    descriptor = _runtime_descriptor(task)
    assert descriptor["code"] == "A09"
    assert descriptor["kind"] == "guided"
    assert descriptor["inferred"] is True


def test_regrouping_exposes_ten_master_blocks_and_prioritizes_migrated_work():
    course = {
        "course": {},
        "topics": [
            {
                "key": "environment",
                "activities": [
                    {
                        "id": "1:1",
                        "task_id": 1,
                        "topic_key": "environment",
                        "course_order": 1,
                        "is_completed": False,
                        "runtime_migrated": True,
                        "training_code": "A04",
                        "block_code": "B01",
                    },
                    {
                        "id": "2:2",
                        "task_id": 2,
                        "topic_key": "environment",
                        "course_order": 2,
                        "is_completed": False,
                        "runtime_migrated": False,
                    },
                ],
            }
        ],
    }

    rebuilt = _regroup_course_topics(course)

    assert len(rebuilt["topics"]) == 10
    assert rebuilt["topics"][0]["code"] == "B01"
    assert rebuilt["topics"][0]["title"] == "Fundamentos y organización laboral"
    assert rebuilt["course"]["current_activity_id"] == "1:1"
    assert rebuilt["topics"][0]["activities"][0]["display_number"] == "A04"
