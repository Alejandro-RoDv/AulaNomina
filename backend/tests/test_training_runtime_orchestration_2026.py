import inspect

from app.crud.case_assignment import seed_demo_case_assignments
from app.schemas.case_study import CaseStudyCreate, CaseStudyUpdate


def test_case_category_aliases_are_normalized_to_existing_domain_categories():
    assert CaseStudyCreate(title="SS", category="social-security").category == "social_security"
    assert CaseStudyCreate(title="Retroactivo", category="regularizations").category == "payroll"
    assert CaseStudyCreate(title="Extinción", category="terminations").category == "contract"
    assert CaseStudyUpdate(category="terminations").category == "contract"


def test_demo_training_seeder_keeps_non_destructive_mode_as_keyword_argument():
    signature = inspect.signature(seed_demo_case_assignments)
    parameter = signature.parameters["reset_training_data"]

    assert parameter.default is True
    assert parameter.kind is inspect.Parameter.KEYWORD_ONLY


def test_demo_training_seeder_is_marked_as_canonical_for_all_late_blocks():
    assert seed_demo_case_assignments._termination_training_wrapped is True
    assert seed_demo_case_assignments._document_training_wrapped is True
    assert seed_demo_case_assignments._integrated_training_wrapped is True
