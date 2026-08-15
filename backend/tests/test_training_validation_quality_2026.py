from app.services.training_validation_quality_2026 import (
    GENERIC_RULE_CODES_2026,
    SPECIALIZED_REVIEW_CODES_2026,
    build_training_validation_quality_audit_2026,
)
from app.services.training_course_projection_2026 import MASTER_ACTIVITY_CODES_2026


def test_every_master_practice_has_an_automatic_or_specialized_validation_path():
    audit = build_training_validation_quality_audit_2026()

    assert audit["master_practices"] == 60
    assert audit["represented_practices"] == 60
    assert audit["missing_codes"] == []
    assert audit["manual_or_unsupported_codes"] == []


def test_validation_architecture_partitions_all_60_master_practices():
    all_codes = set(MASTER_ACTIVITY_CODES_2026)
    specialized = set(SPECIALIZED_REVIEW_CODES_2026)
    generic = set(GENERIC_RULE_CODES_2026)

    assert specialized.isdisjoint(generic)
    assert specialized | generic == all_codes
    assert len(specialized) == 53
    assert len(generic) == 7


def test_validation_audit_surfaces_semantic_hardening_instead_of_hiding_it():
    audit = build_training_validation_quality_audit_2026()
    findings = {item["code"]: item for item in audit["hardening_findings"]}

    # Estos hallazgos son deliberadamente visibles hasta que sus validadores
    # comprueben el valor económico, no solo que exista la configuración.
    assert set(findings) == {"A14", "A15"}
    assert findings["A14"]["severity"] == "high"
    assert findings["A15"]["severity"] == "high"
    assert audit["status"] == "hardening_required"


def test_a18_scope_is_explicit_and_not_misreported_as_full_legal_certification():
    audit = build_training_validation_quality_audit_2026()
    notes = {item["code"]: item["scope"] for item in audit["scope_notes"]}

    assert "A18" in notes
    assert "mínimos/máximos" in notes["A18"]
