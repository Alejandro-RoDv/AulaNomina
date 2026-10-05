from app.services.training_course_projection_2026 import (
    FORCE_EXPLICIT_REVIEW_CODES_2026,
    MASTER_ACTIVITY_CODES_2026,
    project_master_activity_course_2026,
)
from app.training.student_course_2026 import STUDENT_ACTIVITY_CODES_2026


def _activity(
    identifier,
    code=None,
    *,
    scenario="TRAIN-2026-TEST",
    inferred=False,
    migrated=True,
    substep=None,
    completed=False,
    module="employees",
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
        "module": module,
        "context": {"moduleCode": module, "trainingCode": code},
        "completion_condition": {"automatic": True},
        "validation_result": {},
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


def _visible(projected):
    return [item for topic in projected["topics"] for item in topic["activities"]]


def test_master_catalog_remains_60_but_student_course_has_58_integrated_practices():
    assert len(MASTER_ACTIVITY_CODES_2026) == 60
    assert len(STUDENT_ACTIVITY_CODES_2026) == 58
    assert "A01" not in STUDENT_ACTIVITY_CODES_2026
    assert "A06" not in STUDENT_ACTIVITY_CODES_2026
    assert STUDENT_ACTIVITY_CODES_2026[:4] == ("A04", "A02", "A03", "A05")
    assert STUDENT_ACTIVITY_CODES_2026[-6:] == ("C01", "C02", "C03", "C04", "C05", "C06")


def test_first_student_activity_is_worker_by_employee_with_light_theory_and_erp_task():
    projected = project_master_activity_course_2026(
        _course(
            _activity("1:1", "A04", scenario="TRAIN-2026-001", module="employees"),
            block_code="B01",
            block_order=1,
            block_title="Fundamentos y organización laboral",
        )
    )
    visible = _visible(projected)

    assert len(visible) == 1
    activity = visible[0]
    assert activity["id"] == "practice:A04"
    assert activity["display_number"] == "1.1"
    assert activity["title"] == "Trabajador por cuenta ajena"
    assert "cuenta ajena" in activity["theory"].lower()
    assert activity["instructions"] == "Lee el correo de incorporación y crea el trabajador con los datos recibidos."


def test_projection_hides_unmigrated_legacy_and_standalone_conceptual_practices():
    course = _course(
        _activity("1:1", migrated=False, code=None, scenario="NOM-LEGACY"),
        _activity("2:2", "A01", inferred=False, scenario="TRAIN-2026-FOUND-A01", module="general"),
        _activity("3:3", "A14", inferred=False, scenario="TRAIN-2026-PAYROLL-001", module="payrolls"),
        _activity("4:4", "C03", inferred=True, scenario="NOM-2026-014", module="payrolls"),
        _activity("5:5", "C03", inferred=True, scenario="TRAIN-2026-INT-C03", module="payrolls"),
    )

    projected = project_master_activity_course_2026(course)
    visible = _visible(projected)

    assert [item["training_code"] for item in visible] == ["A14", "C03"]
    assert [item["id"] for item in visible] == ["practice:A14", "practice:C03"]
    assert projected["course"]["migration_mode"] == "student-integrated-practices"
    assert projected["course"]["hidden_standalone_training_codes"] == ["A01", "A06"]


def test_projection_keeps_intentional_legacy_runtime_sources():
    projected_a09 = project_master_activity_course_2026(
        _course(
            _activity("5:5", "A09", inferred=True, scenario="ALT-2026-021", module="contracts")
        )
    )
    projected_c02 = project_master_activity_course_2026(
        _course(
            _activity("6:6", "C02", inferred=True, scenario="LAB-2026-001", module="incidents"),
            block_code="B10",
            block_order=10,
            block_title="Casos profesionales integrados",
        )
    )

    assert _visible(projected_a09)[0]["training_code"] == "A09"
    assert _visible(projected_c02)[0]["training_code"] == "C02"


def test_multistep_runtime_is_one_student_practice_and_tracks_current_step():
    projected = project_master_activity_course_2026(
        _course(
            _activity("7:7", "A23", substep=1, completed=True, module="incidents"),
            _activity("7:8", "A23", substep=2, completed=False, module="fie"),
            _activity("7:9", "A23", substep=3, completed=False, module="payrolls"),
            block_code="B04",
            block_order=4,
            block_title="Incidencias laborales",
        )
    )

    visible = _visible(projected)
    assert len(visible) == 1
    assert visible[0]["id"] == "practice:A23"
    assert visible[0]["runtime_step_count"] == 3
    assert visible[0]["runtime_completed_steps"] == 1
    assert visible[0]["task_id"] == 8
    assert visible[0]["is_completed"] is False
    assert projected["course"]["underlying_runtime_steps"] == 3
    assert projected["course"]["visible_runtime_steps"] == 1


def test_conceptual_substep_is_hidden_when_same_practice_has_real_erp_operation():
    projected = project_master_activity_course_2026(
        _course(
            _activity("9:1", "A03", substep=1, completed=True, module="contracts"),
            _activity("9:2", "A03", substep=2, completed=False, module="general"),
            block_code="B01",
            block_order=1,
            block_title="Fundamentos y organización laboral",
        )
    )

    activity = _visible(projected)[0]
    assert activity["runtime_step_count"] == 1
    assert activity["is_completed"] is True
    assert activity["module"] == "contracts"


def test_projection_collapses_duplicate_case_instances_before_collapsing_practice():
    projected = project_master_activity_course_2026(
        _course(
            _activity("10:101", "A36", scenario="TRAIN-2026-TAX-A36", substep=1, module="irpf"),
            _activity("10:102", "A36", scenario="TRAIN-2026-TAX-A36", substep=2, module="documents"),
            _activity("20:201", "A36", scenario="TRAIN-2026-TAX-A36", substep=1, module="irpf"),
            _activity("20:202", "A36", scenario="TRAIN-2026-TAX-A36", substep=2, module="documents"),
            block_code="B06",
            block_order=6,
            block_title="IRPF y fiscalidad laboral",
        )
    )

    visible = _visible(projected)
    assert len(visible) == 1
    assert visible[0]["id"] == "practice:A36"
    assert visible[0]["runtime_step_count"] == 2
    assert projected["course"]["suppressed_duplicate_runtime_steps"] == 2


def test_multistep_practice_counts_as_one_completed_student_activity():
    projected = project_master_activity_course_2026(
        _course(
            _activity("8:8", "A23", substep=1, completed=True, module="incidents"),
            _activity("8:9", "A23", substep=2, completed=True, module="payrolls"),
            block_code="B04",
            block_order=4,
            block_title="Incidencias laborales",
        )
    )

    b04 = next(topic for topic in projected["topics"] if topic["code"] == "B04")
    assert b04["completed"] == 1
    assert b04["total"] == 5
    assert projected["course"]["completed"] == 1
    assert projected["course"]["total"] == 58


def test_strengthened_steps_remain_explicit_review_in_student_projection():
    assert FORCE_EXPLICIT_REVIEW_CODES_2026 == {"A07", "A09", "A14", "A29", "C02"}

    for index, code in enumerate(sorted(FORCE_EXPLICIT_REVIEW_CODES_2026), start=1):
        if code == "A09":
            scenario = "ALT-2026-021"
            inferred = True
        elif code == "C02":
            scenario = "LAB-2026-001"
            inferred = True
        else:
            scenario = f"TRAIN-2026-{code}"
            inferred = False
        activity = _activity(f"{20 + index}:{120 + index}", code, inferred=inferred, scenario=scenario, module="contracts")
        activity["validation_interaction"] = "operation"
        projected = project_master_activity_course_2026(_course(activity))
        visible = _visible(projected)

        assert len(visible) == 1
        assert visible[0]["validation_interaction"] == "explicit_review"


def test_runtime_audit_is_complete_when_all_student_practices_are_represented():
    activities = [
        _activity(
            f"{index}:{index}",
            code,
            scenario=f"TRAIN-2026-{code}",
            inferred=False,
            module="employees",
        )
        for index, code in enumerate(STUDENT_ACTIVITY_CODES_2026, start=1)
    ]

    projected = project_master_activity_course_2026(_course(*activities))

    assert projected["course"]["runtime_audit_status"] == "complete"
    assert projected["course"]["missing_training_codes"] == []
    assert projected["course"]["migrated_training_practices"] == 58
    assert projected["course"]["catalog_total_practices"] == 60
    assert projected["course"]["student_total_practices"] == 58
    assert projected["course"]["total"] == 58
