from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

import app.services.employment_termination_service as service
from app.schemas.employment_termination import EmploymentTerminationPreviewRequest


def _contract(**overrides):
    values = {
        "id": 10,
        "employee_id": 20,
        "company_id": 30,
        "center_id": 40,
        "start_date": date(2024, 1, 1),
        "contract_type": "Indefinido",
        "contract_family": "indefinite",
        "salary_base": Decimal("3000.00"),
        "gross_annual_salary": Decimal("43800.00"),
        "pay_schedule": "not_prorated_14",
        "employee": SimpleNamespace(first_name="Lucía", last_name="Prieto", second_last_name="Solís"),
        "company": SimpleNamespace(id=30),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _preview(monkeypatch, contract, **overrides):
    monkeypatch.setattr(service, "get_contract_or_404", lambda db, contract_id: contract)
    payload = {
        "contract_id": contract.id,
        "reason_code": "objective_dismissal",
        "effective_date": date(2026, 12, 31),
        "communication_date": date(2026, 12, 1),
        "document_reference": "CARTA-OBJ-A49-2026",
        "annual_salary_reference": Decimal("43800.00"),
        "monthly_salary_reference": Decimal("3000.00"),
        "pending_salary_days": Decimal("0"),
        "unused_vacation_days": Decimal("0"),
        "extra_pay_amount": Decimal("0"),
        "other_amount": Decimal("0"),
    }
    payload.update(overrides)
    return service.build_termination_preview(None, EmploymentTerminationPreviewRequest(**payload))


def test_objective_dismissal_a49_is_7200(monkeypatch):
    preview = _preview(monkeypatch, _contract())

    assert preview["ss_situation_code"] == "91"
    assert preview["service_months"] == 36
    assert preview["indemnity_days_per_year"] == Decimal("20.00")
    assert preview["indemnity_days"] == Decimal("60.0000")
    assert preview["indemnity_daily_salary"] == Decimal("120.0000")
    assert preview["indemnity_amount"] == Decimal("7200.00")
    assert preview["total_settlement"] == Decimal("7200.00")


def test_a50_separates_settlement_concepts(monkeypatch):
    preview = _preview(
        monkeypatch,
        _contract(),
        pending_salary_days=Decimal("10"),
        unused_vacation_days=Decimal("5"),
        extra_pay_amount=Decimal("1500"),
    )

    assert preview["pending_salary_amount"] == Decimal("1000.00")
    assert preview["vacation_amount"] == Decimal("500.00")
    assert preview["extra_pay_amount"] == Decimal("1500.00")
    assert preview["indemnity_amount"] == Decimal("7200.00")
    assert preview["total_settlement"] == Decimal("10200.00")


def test_temporary_expiry_uses_12_days_per_year(monkeypatch):
    contract = _contract(
        id=11,
        start_date=date(2025, 11, 1),
        contract_type="Temporal",
        contract_family="temporary",
        salary_base=Decimal("1600.00"),
        gross_annual_salary=Decimal("22400.00"),
    )
    preview = _preview(
        monkeypatch,
        contract,
        reason_code="temporary_expiry",
        effective_date=date(2026, 10, 31),
        communication_date=None,
        document_reference=None,
        annual_salary_reference=Decimal("22400"),
        monthly_salary_reference=Decimal("1600"),
    )

    assert preview["ss_situation_code"] == "93"
    assert preview["service_months"] == 12
    assert preview["indemnity_days_per_year"] == Decimal("12.00")
    assert preview["indemnity_days"] == Decimal("12.0000")
    assert preview["indemnity_amount"] == Decimal("736.44")


def test_substitution_contract_has_no_general_temporary_expiry_indemnity(monkeypatch):
    contract = _contract(
        id=12,
        start_date=date(2026, 1, 1),
        contract_type="Sustitución",
        contract_family="replacement",
    )
    preview = _preview(
        monkeypatch,
        contract,
        reason_code="temporary_expiry",
        effective_date=date(2026, 12, 31),
    )

    assert preview["indemnity_days_per_year"] == Decimal("0.00")
    assert preview["indemnity_amount"] == Decimal("0.00")
    assert any("sustitución" in warning for warning in preview["warnings"])


def test_pre_2012_unfair_dismissal_is_not_automated(monkeypatch):
    contract = _contract(start_date=date(2010, 1, 1))
    with pytest.raises(service.EmploymentTerminationDomainError, match="45/33"):
        _preview(
            monkeypatch,
            contract,
            reason_code="unfair_dismissal",
            effective_date=date(2026, 12, 31),
        )
