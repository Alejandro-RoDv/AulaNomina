from types import SimpleNamespace

from app.services.training_document_review_service import handles_training_document_review
from app.training.document_runtime_cases_2026 import (
    DOCUMENT_SCENARIO_CODES,
    REQUIRED_ONBOARDING_DOCUMENTS,
    build_document_runtime_cases_2026,
)


def _case(scenario_code):
    return next(case for case in build_document_runtime_cases_2026() if case.scenario_code == scenario_code)


def test_document_block_exposes_a51_to_a54():
    cases = build_document_runtime_cases_2026()
    assert {case.scenario_code for case in cases} == DOCUMENT_SCENARIO_CODES
    assert [case.initial_state["training_sequence"] for case in cases] == [
        ["A51"],
        ["A52"],
        ["A53"],
        ["A54"],
    ]


def test_a51_uses_seven_document_onboarding_checklist():
    case = _case("TRAIN-2026-DOC-A51")
    data = case.initial_state["document_data"]
    assert data["required_types"] == REQUIRED_ONBOARDING_DOCUMENTS
    assert set(data["received_types"]) == {"DNI_NIE", "NAF"}
    assert len(data["pending_types"]) == 5
    assert case.tasks[0].expected_action == "review_onboarding_document_checklist"


def test_a52_requires_all_four_document_states_to_be_meaningful():
    case = _case("TRAIN-2026-DOC-A52")
    data = case.initial_state["document_data"]
    statuses = set(data["expected_statuses"].values())
    assert {"received", "expired", "not_applicable"}.issubset(statuses)
    assert data["expired_type"] == "SEXUAL_OFFENCES_CERTIFICATE"
    assert data["not_applicable_type"] == "DATA_CONSENT"
    assert data["not_applicable_note_keywords"]


def test_a53_is_a_mail_response_grounded_in_expired_document():
    case = _case("TRAIN-2026-DOC-A53")
    assert case.tasks[0].trigger_type == "mail_response"
    assert case.tasks[0].expected_action == "review_document_mail_response"
    assert case.initial_state["document_data"]["status"] == "expired"
    assert "actualiz" in case.initial_state["mail_data"]["required_concepts"]
    assert case.initial_state["mail_data"]["forbidden_claims"]


def test_a54_uses_existing_attachment_to_document_relation_as_evidence():
    case = _case("TRAIN-2026-DOC-A54")
    assert case.tasks[0].expected_action == "review_process_document_evidence"
    assert case.initial_state["evidence_data"]["required_link"] == "mail_attachment_to_document"
    assert case.initial_state["document_data"]["status"] == "received"
    assert case.initial_state["evidence_data"]["attachment_filename"].endswith(".pdf")


def test_all_b09_tasks_keep_explicit_master_training_code():
    for case in build_document_runtime_cases_2026():
        task = case.tasks[0]
        expected_code = case.initial_state["training_sequence"][0]
        assert task.trigger_condition["training_code"] == expected_code
        assert task.trigger_condition["validation_interaction"] == "explicit_review"


def test_document_review_router_recognizes_all_b09_cases():
    for scenario_code in sorted(DOCUMENT_SCENARIO_CODES):
        assignment = SimpleNamespace(case_study=SimpleNamespace(scenario_code=scenario_code))
        assert handles_training_document_review(assignment, SimpleNamespace(task_order=1)) is True
