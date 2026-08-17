from types import SimpleNamespace

import app.training_routes  # noqa: F401 - registra los bindings multistep de B08
from app.services.training_activity_runtime_service import _runtime_descriptor
from app.services.training_termination_review_service import handles_training_termination_review
from app.training.termination_runtime_cases_2026 import (
    TERMINATION_EMPLOYEES,
    build_termination_runtime_cases_2026,
)


def _case(scenario_code):
    return next(
        case
        for case in build_termination_runtime_cases_2026()
        if case.scenario_code == scenario_code
    )


def test_b08_exposes_a46_to_a50_in_order():
    cases = build_termination_runtime_cases_2026()
    assert [case.initial_state["training_sequence"] for case in cases] == [
        ["A46"],
        ["A47"],
        ["A48"],
        ["A49"],
        ["A50"],
    ]


def test_a46_distinguishes_termination_from_affiliation_baja():
    case = _case("TRAIN-2026-TERM-A46")
    assert [task.expected_action for task in case.tasks] == [
        "review_voluntary_termination",
        "review_termination_afi_baja",
    ]
    assert case.initial_state["termination_data"]["ss_situation_code"] == "51"
    assert case.initial_state["termination_data"]["indemnity_expected"] == 0


def test_a47_uses_temporary_expiry_rule():
    case = _case("TRAIN-2026-TERM-A47")
    data = case.initial_state["termination_data"]
    assert data["reason_code"] == "temporary_expiry"
    assert data["ss_situation_code"] == "93"
    assert data["days_per_year"] == 12


def test_a48_requires_document_reference():
    case = _case("TRAIN-2026-TERM-A48")
    data = case.initial_state["termination_data"]
    assert data["document_reference"] == "CARTA-DISC-A48-2026"
    assert data["ss_situation_code"] == "53"
    assert data["indemnity_expected"] == 0


def test_a49_has_deterministic_objective_indemnity():
    case = _case("TRAIN-2026-TERM-A49")
    data = case.initial_state["termination_data"]
    assert data["annual_salary_reference"] == 43800.0
    assert data["service_months"] == 36
    assert data["days_per_year"] == 20
    assert data["expected_indemnity_days"] == 60
    assert data["expected_indemnity"] == 7200
    assert case.tasks[0].trigger_condition["training_code"] == "A49"


def test_a50_breakdown_totals_10200():
    case = _case("TRAIN-2026-TERM-A50")
    data = case.initial_state["settlement_data"]
    assert data["pending_salary_amount"] == 1000
    assert data["vacation_amount"] == 500
    assert data["extra_pay_amount"] == 1500
    assert data["indemnity_amount"] == 7200
    assert data["expected_total"] == 10200
    assert sum([
        data["pending_salary_amount"],
        data["vacation_amount"],
        data["extra_pay_amount"],
        data["indemnity_amount"],
        data["other_amount"],
    ]) == data["expected_total"]


def test_multistep_termination_cases_render_as_master_practice_substeps():
    for scenario_code, code, total in [
        ("TRAIN-2026-TERM-A46", "A46", 2),
        ("TRAIN-2026-TERM-A47", "A47", 2),
        ("TRAIN-2026-TERM-A48", "A48", 2),
        ("TRAIN-2026-TERM-A50", "A50", 2),
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


def test_termination_review_router_recognizes_a46_to_a50():
    for scenario_code in (
        "TRAIN-2026-TERM-A46",
        "TRAIN-2026-TERM-A47",
        "TRAIN-2026-TERM-A48",
        "TRAIN-2026-TERM-A49",
        "TRAIN-2026-TERM-A50",
    ):
        assignment = SimpleNamespace(case_study=SimpleNamespace(scenario_code=scenario_code))
        assert handles_training_termination_review(assignment, SimpleNamespace(task_order=1)) is True


def test_training_dataset_uses_unique_valid_looking_identifiers():
    dnis = [data["dni"] for data in TERMINATION_EMPLOYEES.values()]
    nafs = [data["naf"] for data in TERMINATION_EMPLOYEES.values()]
    assert len(dnis) == len(set(dnis)) == 4
    assert len(nafs) == len(set(nafs)) == 4
    assert all(len(naf) == 12 and naf.isdigit() for naf in nafs)
