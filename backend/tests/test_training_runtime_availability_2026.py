import app.services.training_course_projection_2026 as projection
from app.training.student_course_2026 import STUDENT_ACTIVITY_CODES_2026, STUDENT_BLOCKS_2026


def test_build_master_course_ensures_runtime_before_reading_visible_activities(monkeypatch):
    calls = []
    db = object()

    monkeypatch.setattr(
        projection,
        "_ensure_master_runtime_availability_2026",
        lambda received_db: calls.append(("ensure", received_db)),
    )
    monkeypatch.setattr(
        projection,
        "build_runtime_activity_course",
        lambda received_db: calls.append(("build", received_db)) or {"course": {}, "topics": []},
    )

    result = projection.build_master_activity_course_2026(db)

    assert calls == [("ensure", db), ("build", db)]
    assert result["course"]["total"] == len(STUDENT_ACTIVITY_CODES_2026)
    assert result["course"]["total"] == 58


def test_student_blocks_keep_expected_practice_counts_even_when_projection_is_empty():
    empty_course = {"course": {}, "topics": []}

    projected = projection.project_master_activity_course_2026(empty_course)

    totals = {topic["code"]: topic["total"] for topic in projected["topics"]}
    assert totals == {
        block["code"]: len(block["activity_codes"])
        for block in STUDENT_BLOCKS_2026
    }
    assert totals["B01"] == 4
    assert totals["B04"] == 5
    assert totals["B06"] == 6
    assert totals["B10"] == 6
