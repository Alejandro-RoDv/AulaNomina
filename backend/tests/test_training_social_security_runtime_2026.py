from types import SimpleNamespace

from app.services.training_activity_runtime_service import _runtime_descriptor
from app.services.training_social_security_review_service import (
    _cra_xml_counts,
    handles_training_social_security_review,
)
from app.training.runtime_bindings_2026 import (
    SOCIAL_SECURITY_ACTIVITY_CODES_2026,
    get_runtime_binding_2026,
)
from app.training.social_security_runtime_cases_2026 import (
    DEMO_CCC_SAN_RAFAEL,
    FIE_A31_MESSAGE_ID,
    FIE_A31_PROCESS_REFERENCE,
    build_social_security_runtime_cases_2026,
)


def _case(scenario_code):
    return next(
        case
        for case in build_social_security_runtime_cases_2026()
        if case.scenario_code == scenario_code
    )


def test_social_security_block_exposes_a28_to_a35_bindings():
    assert SOCIAL_SECURITY_ACTIVITY_CODES_2026 == (
        "A28",
        "A29",
        "A30",
        "A31",
        "A32",
        "A33",
        "A34",
        "A35",
    )
    assert get_runtime_binding_2026("A28")["validation_interaction"] == "explicit_review"
    assert get_runtime_binding_2026("A29")["expected_action"] == "prepare_affiliation"
    assert get_runtime_binding_2026("A30")["expected_action"] == "review_affiliation_movement"
    assert get_runtime_binding_2026("A33")["module"] == "cra"
    assert get_runtime_binding_2026("A34")["module"] == "social-security"
    assert get_runtime_binding_2026("A35")["module"] == "siltra"


def test_social_security_runtime_cases_cover_every_new_guided_practice_except_existing_a29():
    cases = build_social_security_runtime_cases_2026()
    sequences = [case.initial_state["training_sequence"] for case in cases]

    assert sequences == [
        ["A28"],
        ["A30"],
        ["A31"],
        ["A32"],
        ["A33"],
        ["A34"],
        ["A35"],
    ]


def test_a30_is_a_real_baja_candidate_for_javier():
    case = _case("TRAIN-2026-SS-A30")
    data = case.initial_state["affiliation_data"]

    assert case.initial_state["employee"] == "Javier Romero Sánchez"
    assert data["movement_type"] == "BAJA"
    assert data["effective_date"] == "2026-06-30"
    assert data["expected_ccc"] == DEMO_CCC_SAN_RAFAEL


def test_a31_and_a32_share_the_same_dedicated_fie_process():
    a31 = _case("TRAIN-2026-SS-A31")
    a32 = _case("TRAIN-2026-SS-A32")

    assert a31.initial_state["fie_data"]["external_message_id"] == FIE_A31_MESSAGE_ID
    assert a31.initial_state["fie_data"]["process_reference"] == FIE_A31_PROCESS_REFERENCE
    assert a32.initial_state["fie_data"]["external_message_id"] == FIE_A31_MESSAGE_ID
    assert a32.initial_state["fie_data"]["process_reference"] == FIE_A31_PROCESS_REFERENCE
    assert a32.initial_state["fie_data"]["expected_status"] == "MATCHED"


def test_a33_and_a34_use_the_same_period_and_ccc():
    a33 = _case("TRAIN-2026-SS-A33")
    a34 = _case("TRAIN-2026-SS-A34")

    assert a33.initial_state["cra_data"]["period"] == "2026-05"
    assert a34.initial_state["settlement_data"]["period"] == "2026-05"
    assert a33.initial_state["cra_data"]["ccc"] == DEMO_CCC_SAN_RAFAEL
    assert a34.initial_state["settlement_data"]["ccc"] == DEMO_CCC_SAN_RAFAEL


def test_a35_is_one_master_practice_with_three_runtime_steps():
    case = _case("TRAIN-2026-SS-A35")

    assert [task.expected_action for task in case.tasks] == [
        "review_siltra_rejection",
        "review_siltra_correction",
        "review_siltra_acceptance",
    ]
    assert all(not (task.trigger_condition or {}).get("training_code") for task in case.tasks)

    case_study = SimpleNamespace(
        scenario_code=case.scenario_code,
        title=case.title,
        tasks=[1, 2, 3],
    )
    task = SimpleNamespace(
        trigger_condition={},
        expected_action="review_siltra_correction",
        task_order=2,
        case_study=case_study,
    )
    assert _runtime_descriptor(task) == {
        "code": "A35",
        "kind": "guided_multistep",
        "substep": 2,
        "substep_total": 3,
        "inferred": True,
    }


def test_social_security_review_router_recognizes_a34_and_a35_steps():
    a34_assignment = SimpleNamespace(
        case_study=SimpleNamespace(scenario_code="TRAIN-2026-SS-A34")
    )
    a35_assignment = SimpleNamespace(
        case_study=SimpleNamespace(scenario_code="TRAIN-2026-SS-A35")
    )

    assert handles_training_social_security_review(a34_assignment, SimpleNamespace(task_order=1)) is True
    assert handles_training_social_security_review(a35_assignment, SimpleNamespace(task_order=3)) is True


def test_cra_structure_counter_requires_cra_root_and_counts_trb_cre_records():
    source = SimpleNamespace(
        content="""<?xml version='1.0' encoding='utf-8'?>
        <CRA><TRB><CRE /><CRE /></TRB><TRB><CRE /></TRB></CRA>"""
    )
    invalid = SimpleNamespace(content="<OTHER><TRB><CRE /></TRB></OTHER>")

    assert _cra_xml_counts(source) == (2, 3, True)
    assert _cra_xml_counts(invalid) == (1, 1, False)
