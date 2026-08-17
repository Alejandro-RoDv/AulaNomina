import json
from types import SimpleNamespace

from app.services.training_activity_runtime_service import _public_response_schema, _runtime_descriptor
from app.services.training_foundation_review_service import _review_decision
from app.training.foundation_runtime_cases_2026 import (
    FOUNDATION_CENTER_EXPECTED_CCC,
    FOUNDATION_SCENARIO_CODES,
    build_foundation_runtime_cases_2026,
)


def _definitions():
    return {case.scenario_code: case for case in build_foundation_runtime_cases_2026()}


def test_b01_defines_missing_foundation_practices_with_valid_case_schema():
    definitions = _definitions()
    assert set(definitions) == FOUNDATION_SCENARIO_CODES
    assert {case.category for case in definitions.values()} == {"general"}
    assert [len(definitions[code].tasks) for code in sorted(definitions)] == [3, 1, 2, 1]

    a02 = definitions["TRAIN-2026-FOUND-A02"]
    assert a02.initial_state["center_data"]["expected_main_ccc"] == FOUNDATION_CENTER_EXPECTED_CCC
    assert a02.tasks[0].trigger_condition["training_code"] == "A02"

    a05 = definitions["TRAIN-2026-FOUND-A05"]
    assert a05.tasks[0].trigger_condition["training_code"] == "A05"


def test_a01_and_a03_are_mapped_as_master_syllabus_multistep_practices():
    definitions = _definitions()

    for scenario_code, training_code in (
        ("TRAIN-2026-FOUND-A01", "A01"),
        ("TRAIN-2026-FOUND-A03", "A03"),
    ):
        case = definitions[scenario_code]
        total = len(case.tasks)
        for task in case.tasks:
            runtime_task = SimpleNamespace(
                trigger_condition=task.trigger_condition,
                case_study=SimpleNamespace(
                    scenario_code=scenario_code,
                    title=case.title,
                    tasks=case.tasks,
                ),
                task_order=task.task_order,
                expected_action=task.expected_action,
            )
            descriptor = _runtime_descriptor(runtime_task)
            assert descriptor["code"] == training_code
            assert descriptor["kind"] == "guided_multistep"
            assert descriptor["substep"] == task.task_order
            assert descriptor["substep_total"] == total


def test_public_response_schema_does_not_expose_answer_key_or_validator_keywords():
    task = _definitions()["TRAIN-2026-FOUND-A01"].tasks[0]
    stored = task.trigger_condition["response_schema"]
    public = _public_response_schema(task)

    assert stored["validation_key"] == "A01-1"
    assert "expected_decision" not in stored
    assert "evidence_keywords" not in stored
    assert "minimum_keyword_matches" not in stored

    assert public["type"] == "decision"
    assert len(public["options"]) == 3
    assert "validation_key" not in public
    assert "expected_decision" not in public
    assert "evidence_keywords" not in public
    assert "minimum_keyword_matches" not in public


def test_foundation_decision_grades_choice_but_not_written_rationale():
    task = _definitions()["TRAIN-2026-FOUND-A01"].tasks[0]

    correct_with_detailed_rationale = _review_decision(
        task,
        SimpleNamespace(
            student_notes=json.dumps(
                {
                    "decision": "ordinary_labor",
                    "explanation": "Existe dependencia por el horario y ajenidad porque la empresa organiza el trabajo y asume el resultado.",
                }
            )
        ),
    )
    assert correct_with_detailed_rationale["passed"] is True
    assert correct_with_detailed_rationale["evidence"]["written_response_graded"] is False

    correct_with_natural_rationale = _review_decision(
        task,
        SimpleNamespace(
            student_notes=json.dumps(
                {
                    "decision": "ordinary_labor",
                    "explanation": "Es una trabajadora por cuenta ajena porque realiza su actividad bajo la dirección de otra persona de manera retribuida.",
                }
            )
        ),
    )
    assert correct_with_natural_rationale["passed"] is True

    correct_without_rationale = _review_decision(
        task,
        SimpleNamespace(student_notes=json.dumps({"decision": "ordinary_labor", "explanation": ""})),
    )
    assert correct_without_rationale["passed"] is True

    wrong = _review_decision(
        task,
        SimpleNamespace(
            student_notes=json.dumps(
                {
                    "decision": "non_labor",
                    "explanation": "Hay horario fijado, dependencia y retribución mensual.",
                }
            )
        ),
    )
    assert wrong["passed"] is False
