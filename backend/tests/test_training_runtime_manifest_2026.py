from app.crud.case_study import _demo_cases
from app.services.training_course_projection_2026 import (
    ALLOWED_LEGACY_RUNTIME_SOURCES_2026,
    MASTER_ACTIVITY_CODES_2026,
)
from app.training.document_runtime_cases_2026 import build_document_runtime_cases_2026
from app.training.fiscal_runtime_cases_2026 import build_fiscal_runtime_cases_2026
from app.training.foundation_runtime_cases_2026 import build_foundation_runtime_cases_2026
from app.training.hiring_runtime_cases_2026 import build_hiring_runtime_cases_2026
from app.training.incident_runtime_cases_2026 import build_incident_runtime_cases_2026
from app.training.integrated_runtime_cases_2026 import build_integrated_runtime_cases_2026
from app.training.regularization_runtime_cases_2026 import build_regularization_runtime_cases_2026
from app.training.social_security_runtime_cases_2026 import build_social_security_runtime_cases_2026
from app.training.termination_runtime_cases_2026 import build_termination_runtime_cases_2026


RUNTIME_CASE_BUILDERS = (
    build_foundation_runtime_cases_2026,
    build_hiring_runtime_cases_2026,
    build_incident_runtime_cases_2026,
    build_social_security_runtime_cases_2026,
    build_fiscal_runtime_cases_2026,
    build_regularization_runtime_cases_2026,
    build_termination_runtime_cases_2026,
    build_document_runtime_cases_2026,
    build_integrated_runtime_cases_2026,
)


def _training_sequence(case_study) -> set[str]:
    state = case_study.initial_state or {}
    return {
        str(code).strip().upper()
        for code in state.get("training_sequence") or []
        if str(code).strip()
    }


def test_runtime_manifest_has_a_canonical_source_for_every_master_practice():
    represented: set[str] = set()

    for builder in RUNTIME_CASE_BUILDERS:
        for case_study in builder():
            represented.update(_training_sequence(case_study))

    # El onboarding y los dos casos de nómina viven todavía en el seeder demo
    # principal porque son anteriores a los módulos runtime específicos.
    for case_study in _demo_cases():
        represented.update(_training_sequence(case_study))

    # A09 y C02 son reutilizaciones intencionadas de escenarios previos.
    represented.update(code for code, _scenario in ALLOWED_LEGACY_RUNTIME_SOURCES_2026)

    expected = set(MASTER_ACTIVITY_CODES_2026)
    assert represented == expected, {
        "missing": sorted(expected - represented),
        "unexpected": sorted(represented - expected),
    }
