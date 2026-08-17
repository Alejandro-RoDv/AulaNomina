from app.training.activity_specs_2026 import ACTIVITY_SPECS_2026
from app.training.catalog_2026 import (
    build_training_catalog_2026,
    get_training_activity_2026,
    list_training_activities_2026,
    training_dependency_graph_2026,
)
from app.training.course_blueprint_2026 import COURSE_BLUEPRINT_2026, blueprint_summary, iter_activities
from app.training.official_sources_2026 import OFFICIAL_SOURCES_2026


REQUIRED_SPEC_FIELDS = {
    "learning_objective",
    "prerequisites",
    "professional_situation",
    "student_inputs",
    "expected_actions",
    "evaluation_criteria",
    "theory_topics",
    "feedback_if_failed",
}


def test_blueprint_has_expected_commercial_scope():
    summary = blueprint_summary()

    assert summary["blocks"] == 10
    assert summary["units"] == 36
    assert summary["activities"] == 60
    assert summary["guided_activities"] == 54
    assert summary["integral_cases"] == 6
    assert summary["product_fit"] == {
        "content_assisted": 2,
        "ready": 33,
        "partial": 17,
        "new_flow": 8,
    }
    assert summary["validation"] == {
        "manual": 2,
        "automatic": 41,
        "semi_automatic": 17,
    }


def test_activity_codes_are_unique_and_sources_are_registered():
    activities = iter_activities()
    codes = [activity["code"] for activity in activities]

    assert len(codes) == len(set(codes))
    assert all(activity["sources"] for activity in activities)

    unknown_sources = {
        source
        for activity in activities
        for source in activity["sources"]
        if source not in OFFICIAL_SOURCES_2026
    }
    assert unknown_sources == set()


def test_every_activity_has_a_complete_pedagogical_specification():
    activity_codes = {activity["code"] for activity in iter_activities()}

    assert set(ACTIVITY_SPECS_2026) == activity_codes

    for code, spec in ACTIVITY_SPECS_2026.items():
        assert set(spec) == REQUIRED_SPEC_FIELDS, code
        assert spec["learning_objective"].strip(), code
        assert spec["professional_situation"].strip(), code
        assert spec["student_inputs"], code
        assert spec["expected_actions"], code
        assert spec["evaluation_criteria"], code
        assert spec["theory_topics"], code
        assert spec["feedback_if_failed"], code


def test_prerequisites_reference_known_activities_and_do_not_point_forward():
    activities = iter_activities()
    order = {activity["code"]: position for position, activity in enumerate(activities)}

    for code, spec in ACTIVITY_SPECS_2026.items():
        for prerequisite in spec["prerequisites"]:
            assert prerequisite in order, (code, prerequisite)
            assert order[prerequisite] < order[code], (code, prerequisite)


def test_functional_gaps_are_explicit_for_new_flows():
    new_flows = [activity for activity in iter_activities() if activity["product_fit"] == "new_flow"]

    assert new_flows
    assert all(activity["development_gap"] for activity in new_flows)


def test_fp_reference_is_traceable_to_registered_source():
    fp_reference = COURSE_BLUEPRINT_2026["fp_reference"]

    assert fp_reference["module"] == "0652 Gestión de recursos humanos"
    assert fp_reference["source"] in OFFICIAL_SOURCES_2026
    assert set(fp_reference["learning_results"]) == {"RA1", "RA2", "RA3", "RA4"}


def test_annual_and_frequent_sources_have_current_review_date():
    volatile = {
        code: source
        for code, source in OFFICIAL_SOURCES_2026.items()
        if source["update_policy"] in {"annual", "frequent"}
    }

    assert volatile
    assert all(source["checked_on"] == "2026-08-14" for source in volatile.values())


def test_enriched_catalog_is_serializable_shape_and_does_not_mutate_blueprint():
    catalog = build_training_catalog_2026()
    activities = list_training_activities_2026(include_source_metadata=True)

    assert catalog is not COURSE_BLUEPRINT_2026
    assert len(activities) == 60
    assert all(activity["block_code"] for activity in activities)
    assert all(activity["unit_code"] for activity in activities)
    assert all(activity["official_sources"] for activity in activities)
    assert "learning_objective" not in iter_activities()[0]


def test_activity_lookup_and_dependency_graph_are_ready_for_phase_b():
    activity = get_training_activity_2026("a35")
    graph = training_dependency_graph_2026()

    assert activity is not None
    assert activity["code"] == "A35"
    assert activity["professional_situation"]
    assert graph["A35"] == ["A34", "A33"]
    assert set(graph) == {activity["code"] for activity in iter_activities()}
