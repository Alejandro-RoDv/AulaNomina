from decimal import Decimal
from types import SimpleNamespace

import app.services.training_payroll_structure_review_service as review_service


class FakePayrollConceptQuery:
    def __init__(self, rows):
        self.rows = rows

    def join(self, *_args, **_kwargs):
        return self

    def filter(self, *_args, **_kwargs):
        return self

    def all(self):
        return self.rows


class FakeDb:
    def __init__(self, rows):
        self.rows = rows

    def query(self, *_args, **_kwargs):
        return FakePayrollConceptQuery(self.rows)


def payroll_assignment(*, target_schedule="prorated_12"):
    return SimpleNamespace(
        case_study=SimpleNamespace(
            initial_state={
                "employee": "Laura Martín Ruiz",
                "payroll_period": "2026-06",
                "salary_structure": {
                    "base_salary": "1.680,00 €",
                    "complement_code": "COMPLEMENTO_CONVENIO",
                    "complement_amount": "85,00 €",
                    "target_pay_schedule": target_schedule,
                },
            }
        )
    )


def test_money_parser_accepts_spanish_currency_format():
    assert review_service._money("1.680,00 €") == Decimal("1680.00")
    assert review_service._money("85,00 €") == Decimal("85.00")


def test_a14_requires_exact_base_and_complement_amount(monkeypatch):
    contract = SimpleNamespace(id=9, salary_base=Decimal("1680.00"))
    concept = SimpleNamespace(id=7, code="COMPLEMENTO_CONVENIO")
    line = SimpleNamespace(id=30, amount=Decimal("85.00"))
    monkeypatch.setattr(review_service, "_active_contract", lambda _db, _assignment: contract)

    review = review_service._review_a14(FakeDb([(line, concept)]), payroll_assignment())

    assert review["passed"] is True
    assert review["evidence"]["base_salary_matches"] is True
    assert review["evidence"]["concept_amount_matches"] is True
    assert review["evidence"]["actual_concept_amount"] == "85.00"


def test_a14_rejects_named_concept_with_wrong_amount(monkeypatch):
    contract = SimpleNamespace(id=9, salary_base=Decimal("1680.00"))
    concept = SimpleNamespace(id=7, code="COMPLEMENTO_CONVENIO")
    line = SimpleNamespace(id=30, amount=Decimal("84.00"))
    monkeypatch.setattr(review_service, "_active_contract", lambda _db, _assignment: contract)

    review = review_service._review_a14(FakeDb([(line, concept)]), payroll_assignment())

    assert review["passed"] is False
    assert review["evidence"]["concept_amount_matches"] is False
    assert review["evidence"]["expected_concept_amount"] == "85.00"
    assert review["evidence"]["actual_concept_amount"] == "84.00"


def test_a15_requires_positive_calculable_proration(monkeypatch):
    contract = SimpleNamespace(id=9, pay_schedule="prorated_12")
    monkeypatch.setattr(review_service, "_active_contract", lambda _db, _assignment: contract)
    monkeypatch.setattr(
        review_service,
        "resolve_monthly_extra_pay_proration",
        lambda *_args, **_kwargs: {
            "total_amount": Decimal("280.00"),
            "source": "legacy",
            "lines": [{"amount": Decimal("280.00")}],
            "warnings": [],
        },
    )

    review = review_service._review_a15(None, payroll_assignment())

    assert review["passed"] is True
    assert review["evidence"]["pay_schedule_matches"] is True
    assert review["evidence"]["proration_is_real"] is True
    assert review["evidence"]["proration_total_amount"] == "280.00"


def test_a15_rejects_schedule_without_economic_proration(monkeypatch):
    contract = SimpleNamespace(id=9, pay_schedule="prorated_12")
    monkeypatch.setattr(review_service, "_active_contract", lambda _db, _assignment: contract)
    monkeypatch.setattr(
        review_service,
        "resolve_monthly_extra_pay_proration",
        lambda *_args, **_kwargs: {
            "total_amount": Decimal("0.00"),
            "source": "legacy",
            "lines": [],
            "warnings": ["Configuración incompleta"],
        },
    )

    review = review_service._review_a15(None, payroll_assignment())

    assert review["passed"] is False
    assert review["evidence"]["pay_schedule_matches"] is True
    assert review["evidence"]["proration_is_real"] is False
