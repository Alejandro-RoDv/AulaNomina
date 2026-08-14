from types import SimpleNamespace

from app.services.training_activity_runtime_service import _runtime_descriptor
from app.services.training_regularization_review_service import (
    _arrears_trace,
    handles_training_regularization_review,
)
from app.training.regularization_runtime_cases_2026 import (
    BASELINE_SALARY,
    CORRECTED_SALARY,
    RECOGNIZED_SENIORITY_DATE,
    REGULARIZATION_AGREEMENT_CODE,
    REGULARIZATION_EMPLOYEE_NAME,
    REGULARIZATION_SOURCE_TABLE_NAME,
    REGULARIZATION_TARGET_TABLE_NAME,
    SALARY_CORRECTION_DELTA,
    SALARY_TABLE_ARREARS_TOTAL,
    SENIORITY_MONTHLY_AMOUNT,
    SENIORITY_RETROACTIVE_TOTAL,
    build_regularization_runtime_cases_2026,
)


def _case(scenario_code):
    return next(
        case
        for case in build_regularization_runtime_cases_2026()
        if case.scenario_code == scenario_code
    )


def test_regularization_block_exposes_a42_to_a45_cases():
    cases = build_regularization_runtime_cases_2026()
    assert [case.initial_state["training_sequence"] for case in cases] == [
        ["A42"],
        ["A43"],
        ["A44"],
        ["A45"],
    ]
    assert all(case.initial_state["employee"] == REGULARIZATION_EMPLOYEE_NAME for case in cases)


def test_a42_separates_origin_correction_from_regularization():
    case = _case("TRAIN-2026-REG-A42")
    data = case.initial_state["regularization_data"]

    assert [task.expected_action for task in case.tasks] == [
        "review_salary_correction_origin",
        "review_salary_correction_regularization",
    ]
    assert data["original_amount"] == float(BASELINE_SALARY)
    assert data["correct_amount"] == float(CORRECTED_SALARY)
    assert data["expected_gross_delta"] == float(SALARY_CORRECTION_DELTA)
    assert data["origin_period"] == "2026-06"
    assert data["target_period"] == "2026-07"


def test_a43_uses_one_triennium_and_six_retroactive_months():
    case = _case("TRAIN-2026-REG-A43")
    data = case.initial_state["seniority_regularization_data"]

    assert data["recognized_seniority_date"] == RECOGNIZED_SENIORITY_DATE.isoformat()
    assert data["monthly_amount"] == float(SENIORITY_MONTHLY_AMOUNT)
    assert data["affected_months"] == 6
    assert data["expected_gross_delta"] == float(SENIORITY_RETROACTIVE_TOTAL)


def test_a44_uses_isolated_agreement_and_expected_arrears():
    case = _case("TRAIN-2026-REG-A44")
    data = case.initial_state["salary_revision_data"]

    assert data["agreement_code"] == REGULARIZATION_AGREEMENT_CODE
    assert data["source_table"] == REGULARIZATION_SOURCE_TABLE_NAME
    assert data["target_table"] == REGULARIZATION_TARGET_TABLE_NAME
    assert data["effective_from"] == "2026-01-01"
    assert data["period_to"] == "2026-06-30"
    assert data["expected_total"] == float(SALARY_TABLE_ARREARS_TOTAL)


def test_a42_a43_a44_are_master_practices_with_runtime_substeps():
    for scenario_code, code, total in [
        ("TRAIN-2026-REG-A42", "A42", 2),
        ("TRAIN-2026-REG-A43", "A43", 2),
        ("TRAIN-2026-REG-A44", "A44", 2),
    ]:
        case = _case(scenario_code)
        case_study = SimpleNamespace(
            scenario_code=case.scenario_code,
            title=case.title,
            tasks=list(range(total)),
        )
        for index, task_definition in enumerate(case.tasks, start=1):
            task = SimpleNamespace(
                trigger_condition={},
                expected_action=task_definition.expected_action,
                task_order=index,
                case_study=case_study,
            )
            descriptor = _runtime_descriptor(task)
            assert descriptor["code"] == code
            assert descriptor["kind"] == "guided_multistep"
            assert descriptor["substep"] == index
            assert descriptor["substep_total"] == total


def test_a45_keeps_its_explicit_master_training_code():
    case = _case("TRAIN-2026-REG-A45")
    task = case.tasks[0]
    assert task.trigger_condition["training_code"] == "A45"
    assert task.expected_action == "review_regularization_trace"


def test_regularization_review_router_recognizes_all_b07_cases():
    for scenario_code in (
        "TRAIN-2026-REG-A42",
        "TRAIN-2026-REG-A43",
        "TRAIN-2026-REG-A44",
        "TRAIN-2026-REG-A45",
    ):
        assignment = SimpleNamespace(case_study=SimpleNamespace(scenario_code=scenario_code))
        assert handles_training_regularization_review(assignment, SimpleNamespace(task_order=1)) is True


def test_arrears_trace_reads_months_and_amounts_from_complementary_lines():
    concept = SimpleNamespace(category="ATRASOS")
    items = [
        SimpleNamespace(id=month, concept=concept, description=f"Salario base · {month:02d}/2026", amount="50.00")
        for month in range(1, 7)
    ]
    payroll = SimpleNamespace(items=items)

    trace = _arrears_trace(payroll)
    assert trace["months"] == [1, 2, 3, 4, 5, 6]
    assert trace["total"] == SALARY_TABLE_ARREARS_TOTAL
    assert len(trace["items"]) == 6
