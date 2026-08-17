from types import SimpleNamespace

from app.services.activity_service import _condition_for_task


def test_explicit_review_is_system_checkable_without_legacy_validation_rule():
    task = SimpleNamespace(
        validation_rules=[],
        expected_action="review_cra_file",
        trigger_condition={"validation_interaction": "explicit_review"},
    )

    condition = _condition_for_task(task)

    assert condition["automatic"] is True
    assert condition["action"] == "review_cra_file"


def test_unknown_operation_without_explicit_review_remains_manual():
    task = SimpleNamespace(
        validation_rules=[],
        expected_action="unknown_training_action",
        trigger_condition={},
    )

    condition = _condition_for_task(task)

    assert condition["automatic"] is False
