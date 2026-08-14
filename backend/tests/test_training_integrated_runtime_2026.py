from app.schemas.case_study import CaseTaskCreate
from app.training.integrated_runtime_bootstrap_2026 import SUPERSEDED_SCENARIOS
from app.training.integrated_runtime_cases_2026 import (
    INTEGRATED_SCENARIO_CODES,
    build_integrated_runtime_cases_2026,
)


def test_b10_defines_six_capstones_without_duplicating_existing_c02():
    assert INTEGRATED_SCENARIO_CODES == {
        "C01": "TRAIN-2026-INT-C01",
        "C02": "LAB-2026-001",
        "C03": "TRAIN-2026-INT-C03",
        "C04": "TRAIN-2026-INT-C04",
        "C05": "TRAIN-2026-INT-C05",
        "C06": "TRAIN-2026-INT-C06",
    }

    definitions = build_integrated_runtime_cases_2026()
    assert {case.scenario_code for case in definitions} == {
        "TRAIN-2026-INT-C01",
        "TRAIN-2026-INT-C03",
        "TRAIN-2026-INT-C04",
        "TRAIN-2026-INT-C05",
        "TRAIN-2026-INT-C06",
    }
    assert "LAB-2026-001" not in {case.scenario_code for case in definitions}


def test_capstones_have_expected_professional_milestones():
    definitions = {case.scenario_code: case for case in build_integrated_runtime_cases_2026()}
    expected_task_counts = {
        "TRAIN-2026-INT-C01": 5,
        "TRAIN-2026-INT-C03": 4,
        "TRAIN-2026-INT-C04": 3,
        "TRAIN-2026-INT-C05": 3,
        "TRAIN-2026-INT-C06": 4,
    }

    for scenario_code, expected_count in expected_task_counts.items():
        case = definitions[scenario_code]
        assert case.difficulty == "advanced"
        assert len(case.tasks) == expected_count
        assert [task.task_order for task in case.tasks] == list(range(1, expected_count + 1))

        for task in case.tasks:
            assert task.trigger_condition["course_code"] == "AN-GL-2026"
            assert task.trigger_condition["course_version"] == "2026.1-phase-a"
            assert task.trigger_condition["validation_interaction"] == "explicit_review"
            assert task.trigger_condition["capstone"] is True
            assert task.expected_action.startswith("review_integrated_")
            assert task.blocking is True
            assert task.is_required is True


def test_case_task_schema_accepts_modules_used_by_training_runtime():
    for module in ("tax", "irpf", "cra", "social-security", "terminations", "mail"):
        task = CaseTaskCreate(
            title=f"Prueba {module}",
            module=module,
            expected_action="review_integrated_test",
        )
        assert task.module == module


def test_b10_supersedes_short_integral_demo_cases():
    assert SUPERSEDED_SCENARIOS == {"IT-2026-008", "NOM-2026-014"}
