from types import SimpleNamespace

import app.services.training_integrated_c02_review_service as review_service


def assignment_with_event(*, order=1, action_code=None, status="success", domain_status=None):
    task = SimpleNamespace(id=100 + order, task_order=order)
    event = None
    if action_code:
        event = {
            "operation_status": status,
            "action_code": action_code,
            "metadata": {"domain_status": domain_status} if domain_status else {},
        }
    progress = SimpleNamespace(
        task_id=task.id,
        validation_result={"events": [event] if event else []},
    )
    return SimpleNamespace(
        case_study=SimpleNamespace(
            scenario_code="LAB-2026-001",
            tasks=[task],
            initial_state={},
        ),
        progress_entries=[progress],
    )


def passed_check(rule_type="domain"):
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": True,
        "message": "ok",
        "evidence": {},
    }


def failed_check(rule_type="operation"):
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": False,
        "message": "pending",
        "evidence": {},
    }


def test_c02_is_recognized_as_specialized_integrated_scenario():
    assignment = assignment_with_event(order=1)
    task = assignment.case_study.tasks[0]

    assert review_service.handles_training_integrated_c02_review(assignment, task) is True


def test_c02_incident_step_does_not_pass_from_preexisting_domain_state(monkeypatch):
    assignment = assignment_with_event(order=2)
    monkeypatch.setattr(review_service, "_generic", lambda *_args, **_kwargs: passed_check("incident_exists"))
    monkeypatch.setattr(review_service, "_task_operation_check", lambda *_args, **_kwargs: failed_check())

    review = review_service._review_c02(None, assignment, 2)

    assert review["passed"] is False


def test_c02_incident_step_passes_only_when_domain_and_step_operation_exist(monkeypatch):
    assignment = assignment_with_event(order=2, action_code="create_incident")
    monkeypatch.setattr(review_service, "_generic", lambda *_args, **_kwargs: passed_check("incident_exists"))
    monkeypatch.setattr(review_service, "_task_operation_check", lambda *_args, **_kwargs: passed_check("operation"))

    review = review_service._review_c02(None, assignment, 2)

    assert review["passed"] is True


def test_terminal_submission_requires_accepted_simulator_status():
    sent_only = assignment_with_event(
        order=7,
        action_code="submit_affiliation",
        domain_status="SENT",
    )
    accepted = assignment_with_event(
        order=7,
        action_code="submit_affiliation",
        domain_status="ACCEPTED",
    )

    assert review_service._terminal_operation_check(sent_only, 7, "submit_affiliation")["passed"] is False
    assert review_service._terminal_operation_check(accepted, 7, "submit_affiliation")["passed"] is True


def test_terminal_submission_accepts_warnings_but_not_rejection():
    warnings = assignment_with_event(
        order=9,
        action_code="submit_siltra",
        domain_status="ACCEPTED_WITH_WARNINGS",
    )
    rejected = assignment_with_event(
        order=9,
        action_code="submit_siltra",
        domain_status="REJECTED",
    )

    assert review_service._terminal_operation_check(warnings, 9, "submit_siltra")["passed"] is True
    assert review_service._terminal_operation_check(rejected, 9, "submit_siltra")["passed"] is False
