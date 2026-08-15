from app.services.training_course_projection_2026 import (
    MASTER_ACTIVITY_CODES_2026,
    project_master_activity_course_2026,
)


def _activity(
    identifier,
    code=None,
    *,
    scenario="TRAIN-2026-TEST",
    inferred=False,
    migrated=True,
    substep=None,
    completed=False,
):
    return {
        "id": identifier,
        "assignment_id": int(identifier.split(":")[0]),
        "task_id": int(identifier.split(":")[1]),
        "scenario_code": scenario,
        "training_code": code,
        "runtime_migrated": migrated,
        "runtime_binding_inferred": inferred,
        "training_substep": substep,
        "display_number": "3.2",
        "course_order": int(identifier.split(":")[1]),
        "is_completed": completed,
    }


def _course(*activities, block_code="B03", block_order=3, block_title="Nómina y retribución"):
    return {
        "course": {"title": "Curso práctico"},
        "topics": [
            {
                "key": block_code.lower(),
                "code": block_code,
                "order": block_order,
                "title": block_title,
                "activities": list(activities),
            }
        ],
    }


def test_master_catalog_contains_exactly_60_practices():
    assert len(MASTER_ACTIVITY_CODES_2026) == 60
    assert MASTER_ACTIVITY_CODES_2026[0] == "A01"
    assert MASTER_ACTIVITY_CODES_2026[53] == "A54"
    assert MASTER_ACTIVITY_CODES_2026[54:] == (
        "C01",
        "C02",
        "C03",
        "C04",
        "C05",
        "C06",
    )


def test_projection_hides_unmigrated_and_provisional_legacy_steps():
    course = _course(
        _activity("1:1", migrated=False, code=None, scenario="NOM-LEGACY"),
        _activity("2:2", "A14", inferred=False, scenario="TRAIN-2026-PAYROLL-001"),
        _activity("3:3", "C03", inferred=True, scenario="NOM-2026-014"),
        _activity("4:4", "C03", inferred=True, scenario="TRAIN-2026-INT-C03"),
    )

    projected = project_master_activity_course_2026(course)
    visible = projected["topics"][0]["activities"]

    assert [item["id"] for item in visible] == ["2:2", "4:4"]
    assert [item["display_number"] for item in visible] == ["A14", "C03"]
    assert projected["course"]["hidden_legacy_runtime_steps"] == 2
    assert projected["course"]["migration_mode"] == "master-syllabus-only"
    assert "A14" in projected["course"]["migrated_training_codes"]
    assert "C03" in projected["course"]["migrated_training_codes"]


def test_projection_keeps_intentional_legacy_runtime_sources():
    projected_a09 = project_master_activity_course_2026(
        _course(
            _activity(
                "5:5",
                "A09",
                inferred=True,
                scenario="ALT-2026-021",
            )
        )
    )
    projected_c02 = project_master_activity_course_2026(
        _course(
            _activity(
                "6:6",
                "C02",
                inferred=True,
                scenario="LAB-2026-001",
            ),
            block_code="B10",
            block_order=10,
            block_title="Casos profesionales integrados",
        )
    )

    assert projected_a09["topics"][0]["activities"][0]["display_number"] == "A09"
    assert projected_c02["topics"][0]["activities"][0]["display_number"] == "C02"


def test_projection_uses_master_code_plus_substep_for_multistep_practices():
    projected = project_master_activity_course_2026(
        _course(
            _activity("7:7", "A23", substep=1),
            _activity("7:8", "A23", substep=2),
            block_code="B04",
            block_order=4,
            block_title="Incidencias laborales",
        )
    )

    assert [
        item["display_number"] for item in projected["topics"][0]["activities"]
    ] == ["A23.1", "A23.2"]
    assert projected["topics"][0]["total"] == 5
    assert projected["course"]["total"] == 60
    assert projected["course"]["visible_runtime_steps"] == 2


def test_multistep_practice_counts_as_one_completed_master_activity():
    projected = project_master_activity_course_2026(
        _course(
            _activity("8:8", "A23", substep=1, completed=True),
            _activity("8:9", "A23", substep=2, completed=True),
            block_code="B04",
            block_order=4,
            block_title="Incidencias laborales",
        )
    )

    assert projected["topics"][0]["completed"] == 1
    assert projected["topics"][0]["total"] == 5
    assert projected["course"]["completed"] == 1
    assert projected["course"]["total"] == 60


def test_runtime_audit_reports_complete_when_all_60_master_codes_are_present():
    activities = [
        _activity(
            f"{index}:{index}",
            code,
            scenario=f"TRAIN-2026-{code}",
            inferred=False,
        )
        for index, code in enumerate(MASTER_ACTIVITY_CODES_2026, start=1)
    ]

    projected = project_master_activity_course_2026(_course(*activities))

    assert projected["course"]["runtime_audit_status"] == "complete"
    assert projected["course"]["missing_training_codes"] == []
    assert projected["course"]["migrated_training_practices"] == 60
    assert projected["course"]["catalog_total_practices"] == 60
    assert projected["course"]["total"] == 60
    assert all(
        not item["display_number"][0].isdigit()
        for item in projected["topics"][0]["activities"]
    )
