from types import SimpleNamespace

from app.services.training_activity_runtime_service import _runtime_descriptor
from app.services.training_fiscal_review_service import handles_training_fiscal_review
from app.training.fiscal_runtime_cases_2026 import (
    FISCAL_INVOICE_NUMBER,
    FISCAL_MODEL111_PERIOD,
    FISCAL_PROFESSIONAL_NIF,
    MODEL145_DOCUMENT_TYPE,
    build_fiscal_runtime_cases_2026,
)
from app.training.runtime_bindings_2026 import (
    FISCAL_ACTIVITY_CODES_2026,
    get_runtime_binding_2026,
)


def _case(scenario_code):
    return next(
        case
        for case in build_fiscal_runtime_cases_2026()
        if case.scenario_code == scenario_code
    )


def test_fiscal_block_exposes_a36_to_a41_bindings():
    assert FISCAL_ACTIVITY_CODES_2026 == (
        "A36",
        "A37",
        "A38",
        "A39",
        "A40",
        "A41",
    )
    assert get_runtime_binding_2026("A36")["validation_interaction"] == "explicit_review"
    assert get_runtime_binding_2026("A37")["expected_action"] == "review_irpf_calculation"
    assert get_runtime_binding_2026("A38")["expected_action"] == "review_irpf_regularization"
    assert get_runtime_binding_2026("A39")["module"] == "tax"
    assert get_runtime_binding_2026("A40")["module"] == "model111"
    assert get_runtime_binding_2026("A41")["module"] == "model190"


def test_fiscal_runtime_cases_cover_a36_to_a41_in_order():
    cases = build_fiscal_runtime_cases_2026()
    assert [case.initial_state["training_sequence"] for case in cases] == [
        ["A36"],
        ["A37"],
        ["A38"],
        ["A39"],
        ["A40"],
        ["A41"],
    ]
    assert [len(case.tasks) for case in cases] == [2, 1, 2, 2, 3, 2]


def test_a36_starts_from_pending_model145_and_explicit_fiscal_profile_target():
    case = _case("TRAIN-2026-TAX-A36")
    model145 = case.initial_state["model145_data"]
    profile = case.initial_state["tax_profile_data"]

    assert case.initial_state["employee"] == "Laura Martín Ruiz"
    assert model145["document_type"] == MODEL145_DOCUMENT_TYPE
    assert model145["required_status"] == "received"
    assert model145["issue_date"] == "2026-06-01"
    assert profile["family_situation"] == "situation_3"
    assert profile["children_count"] == 0
    assert profile["expected_annual_salary"] == 23520.0


def test_a38_changes_one_family_circumstance_before_recalculating():
    case = _case("TRAIN-2026-TAX-A38")
    data = case.initial_state["irpf_regularization_data"]

    assert data["children_count"] == 1
    assert data["effective_date"] == "2026-07-01"
    assert data["manual_regularization"] is True
    assert [task.expected_action for task in case.tasks] == [
        "review_irpf_regularization_profile",
        "review_irpf_regularization",
    ]


def test_a39_professional_invoice_is_real_source_for_111_and_190():
    case = _case("TRAIN-2026-TAX-A39")
    data = case.initial_state["professional_data"]

    assert data["nif"] == FISCAL_PROFESSIONAL_NIF
    assert data["invoice_number"] == FISCAL_INVOICE_NUMBER
    assert data["activity_type"] == "professional"
    assert data["withholding_rate"] == 15.0
    assert data["tax_base"] == 1200.0
    assert data["withholding_amount"] == 180.0
    assert data["total_amount"] == 1020.0
    assert data["status"] == "paid"


def test_a40_and_a41_share_the_same_fiscal_chain():
    a40 = _case("TRAIN-2026-TAX-A40")
    a41 = _case("TRAIN-2026-TAX-A41")

    assert a40.initial_state["model111_data"]["period"] == FISCAL_MODEL111_PERIOD == "2T"
    assert a40.initial_state["model111_data"]["professional_nif"] == FISCAL_PROFESSIONAL_NIF
    assert a41.initial_state["model190_data"]["reference_model111_period"] == FISCAL_MODEL111_PERIOD
    assert a41.initial_state["model190_data"]["professional_nif"] == FISCAL_PROFESSIONAL_NIF
    assert [task.expected_action for task in a40.tasks] == [
        "review_model_111_sources",
        "review_model_111_generated",
        "review_model_111",
    ]
    assert [task.expected_action for task in a41.tasks] == [
        "review_model_190_generated",
        "review_model_190",
    ]


def test_multistep_fiscal_cases_render_as_one_master_activity_with_substeps():
    case = _case("TRAIN-2026-TAX-A40")
    case_study = SimpleNamespace(
        scenario_code=case.scenario_code,
        title=case.title,
        tasks=[1, 2, 3],
    )
    task = SimpleNamespace(
        trigger_condition={},
        expected_action="review_model_111_generated",
        task_order=2,
        case_study=case_study,
    )

    assert _runtime_descriptor(task) == {
        "code": "A40",
        "kind": "guided_multistep",
        "substep": 2,
        "substep_total": 3,
        "inferred": True,
    }


def test_fiscal_review_router_recognizes_all_guided_scenarios():
    for code in ("A36", "A37", "A38", "A39", "A40", "A41"):
        assignment = SimpleNamespace(
            case_study=SimpleNamespace(scenario_code=f"TRAIN-2026-TAX-{code}")
        )
        assert handles_training_fiscal_review(assignment, SimpleNamespace(task_order=1)) is True
