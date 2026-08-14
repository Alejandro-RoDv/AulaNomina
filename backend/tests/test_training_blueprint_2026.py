from app.training.course_blueprint_2026 import COURSE_BLUEPRINT_2026, blueprint_summary, iter_activities
from app.training.official_sources_2026 import OFFICIAL_SOURCES_2026


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


def test_functional_gaps_are_explicit_for_new_flows():
    new_flows = [activity for activity in iter_activities() if activity["product_fit"] == "new_flow"]

    assert new_flows
    assert all(activity["development_gap"] for activity in new_flows)


def test_fp_reference_is_traceable_to_registered_source():
    fp_reference = COURSE_BLUEPRINT_2026["fp_reference"]

    assert fp_reference["module"] == "0652 Gestión de recursos humanos"
    assert fp_reference["source"] in OFFICIAL_SOURCES_2026
    assert set(fp_reference["learning_results"]) == {"RA1", "RA2", "RA3", "RA4"}
