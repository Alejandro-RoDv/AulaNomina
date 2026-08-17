from decimal import Decimal
from types import SimpleNamespace

from app.services.payroll_engine import calculate_it_days, calculate_simulated_earning_lines
from app.services.training_activity_runtime_service import _runtime_descriptor
from app.services.training_incident_review_service import handles_training_incident_review
from app.training.incident_runtime_cases_2026 import (
    TRAINING_FIE_PROCESS_REFERENCE,
    build_incident_runtime_cases_2026,
)
from app.training.runtime_bindings_2026 import INCIDENT_ACTIVITY_CODES_2026, get_runtime_binding_2026


def _case(scenario_code):
    return next(
        case
        for case in build_incident_runtime_cases_2026()
        if case.scenario_code == scenario_code
    )


def test_incident_block_exposes_a23_to_a27_bindings():
    assert INCIDENT_ACTIVITY_CODES_2026 == ("A23", "A24", "A25", "A26", "A27")
    assert get_runtime_binding_2026("A23")["expected_action"] == "create_incident"
    assert get_runtime_binding_2026("A24")["runtime_prerequisites"] == ["A23"]
    assert get_runtime_binding_2026("A25")["validation_rules"][0]["incident_type"] == "VACACIONES"
    assert get_runtime_binding_2026("A26")["validation_rules"][0]["incident_type"] == "PERMISO_NO_RETRIBUIDO"
    assert get_runtime_binding_2026("A27")["runtime_prerequisites"] == ["A12", "A16"]


def test_a23_is_common_it_with_fie_and_explicit_payroll_review():
    case = _case("TRAIN-2026-INCIDENT-A23")

    assert case.initial_state["incident_data"]["process_type"] == "common_disease"
    assert case.initial_state["incident_data"]["expected_days"] == 6
    assert case.initial_state["incident_data"]["fie_process_reference"] == TRAINING_FIE_PROCESS_REFERENCE
    assert [task.expected_action for task in case.tasks] == [
        "create_incident",
        "reconcile_fie",
        "review_incident_payroll",
    ]
    assert case.tasks[-1].trigger_condition["validation_interaction"] == "explicit_review"


def test_a24_uses_it_plus_professional_process_type_instead_of_fake_incident_type():
    case = _case("TRAIN-2026-INCIDENT-A24")

    assert case.initial_state["incident_data"]["incident_type"] == "IT"
    assert case.initial_state["incident_data"]["process_type"] == "work_accident"
    assert case.initial_state["incident_data"]["expected_days"] == 5


def test_a25_and_a26_use_supported_incident_types_and_deterministic_intervals():
    vacation = _case("TRAIN-2026-INCIDENT-A25")
    absence = _case("TRAIN-2026-INCIDENT-A26")

    assert vacation.initial_state["incident_data"] == {
        "incident_type": "VACACIONES",
        "start_date": "2026-07-13",
        "end_date": "2026-07-17",
        "vacation_day_type": "calendar",
        "expected_days": 5,
    }
    assert absence.initial_state["incident_data"]["incident_type"] == "PERMISO_NO_RETRIBUIDO"
    assert absence.initial_state["incident_data"]["paid"] is False
    assert absence.initial_state["incident_data"]["expected_non_contribution_days"] == 2


def test_a27_targets_thirty_hours_and_seventy_five_percent_partiality():
    case = _case("TRAIN-2026-INCIDENT-A27")
    change = case.initial_state["workday_change"]

    assert change["previous_weekly_hours"] == 40
    assert change["target_weekly_hours"] == 30
    assert change["target_partiality_coefficient"] == 75
    assert change["target_working_day_type"] == "part_time"
    assert all(task.trigger_condition["validation_interaction"] == "explicit_review" for task in case.tasks)


def test_runtime_descriptor_groups_training_incident_tasks_as_guided_multistep():
    case_study = SimpleNamespace(
        scenario_code="TRAIN-2026-INCIDENT-A23",
        title="IT por enfermedad común",
        tasks=[1, 2, 3],
    )
    task = SimpleNamespace(
        trigger_condition={},
        expected_action="reconcile_fie",
        task_order=2,
        case_study=case_study,
    )

    assert _runtime_descriptor(task) == {
        "code": "A23",
        "kind": "guided_multistep",
        "substep": 2,
        "substep_total": 3,
        "inferred": True,
    }


def test_explicit_review_router_only_handles_review_steps():
    assignment = SimpleNamespace(
        case_study=SimpleNamespace(scenario_code="TRAIN-2026-INCIDENT-A24")
    )
    operation_task = SimpleNamespace(task_order=1)
    review_task = SimpleNamespace(task_order=2)

    assert handles_training_incident_review(assignment, operation_task) is False
    assert handles_training_incident_review(assignment, review_task) is True


def test_payroll_engine_distinguishes_common_it_from_work_accident_by_process_type():
    common = {
        "incident_breakdown": [
            {"incident_type": "IT", "process_type": "common_disease", "days": 6}
        ]
    }
    professional = {
        "incident_breakdown": [
            {"incident_type": "IT", "process_type": "work_accident", "days": 5}
        ]
    }

    assert calculate_it_days(common) == (6, 0)
    assert calculate_it_days(professional) == (5, 5)


def test_simulated_it_amounts_use_different_rates_for_common_and_professional_processes():
    common = calculate_simulated_earning_lines(
        base_salary=Decimal("1680.00"),
        salary_supplements=Decimal("0.00"),
        variable_incentives=Decimal("0.00"),
        extra_pay_proration=Decimal("0.00"),
        day_result={
            "incident_breakdown": [
                {"incident_type": "IT", "process_type": "common_disease", "days": 5}
            ],
            "non_contribution_days": 0,
            "inactive_contract_days": 0,
        },
    )
    professional = calculate_simulated_earning_lines(
        base_salary=Decimal("1680.00"),
        salary_supplements=Decimal("0.00"),
        variable_incentives=Decimal("0.00"),
        extra_pay_proration=Decimal("0.00"),
        day_result={
            "incident_breakdown": [
                {"incident_type": "IT", "process_type": "work_accident", "days": 5}
            ],
            "non_contribution_days": 0,
            "inactive_contract_days": 0,
        },
    )

    assert common["temporary_disability_benefit"] == Decimal("168.00")
    assert common["company_disability_complement"] == Decimal("112.00")
    assert professional["temporary_disability_benefit"] == Decimal("210.00")
    assert professional["company_disability_complement"] == Decimal("70.00")
