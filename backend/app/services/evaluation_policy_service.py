from __future__ import annotations

from typing import Any


EVALUATION_CODES = frozenset({"C01", "C02", "C03", "C04", "C05", "C06"})

SCENARIO_EVALUATION_CODES = {
    "TRAIN-2026-INT-C01": "C01",
    "LAB-2026-001": "C02",
    "IT-2026-008": "C02",
    "TRAIN-2026-INT-C03": "C03",
    "NOM-2026-014": "C03",
    "TRAIN-2026-INT-C04": "C04",
    "TRAIN-2026-INT-C05": "C05",
    "TRAIN-2026-INT-C06": "C06",
}


def _normalized_code(value: Any) -> str | None:
    code = str(value or "").strip().upper()
    return code if code in EVALUATION_CODES else None


def evaluation_code_for_case(case_study) -> str | None:
    if case_study is None:
        return None

    scenario_code = str(getattr(case_study, "scenario_code", None) or "").strip().upper()
    mapped = SCENARIO_EVALUATION_CODES.get(scenario_code)
    if mapped:
        return mapped

    state = getattr(case_study, "initial_state", None) or {}
    for value in state.get("training_sequence") or []:
        code = _normalized_code(value)
        if code:
            return code
    return _normalized_code(state.get("training_code"))


def evaluation_code_for_task(task) -> str | None:
    if task is None:
        return None

    trigger = getattr(task, "trigger_condition", None) or {}
    explicit = _normalized_code(trigger.get("training_code"))
    if explicit:
        return explicit

    if trigger.get("capstone") is True:
        return evaluation_code_for_case(getattr(task, "case_study", None))

    return evaluation_code_for_case(getattr(task, "case_study", None))


def is_evaluation_task(task) -> bool:
    return evaluation_code_for_task(task) is not None


def is_evaluation_assignment(assignment) -> bool:
    return evaluation_code_for_case(getattr(assignment, "case_study", None)) is not None
