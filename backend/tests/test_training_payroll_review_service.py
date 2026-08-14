from types import SimpleNamespace

from app.services.training_payroll_review_service import (
    _review_common_base,
    _review_employee_social_security,
    _review_irpf,
    _review_net_and_company_cost,
)


def calculated_payroll(**overrides):
    values = {
        "id": 1,
        "calculation_version": 1,
        "last_calculated_at": None,
        "status": "calculated",
        "common_contingencies_base": "1800.00",
        "daily_common_base": "60.00",
        "contribution_days": 30,
        "employee_common_contingencies": "84.60",
        "employee_unemployment": "27.90",
        "employee_training": "1.80",
        "employee_mei": "2.70",
        "employee_social_security": "117.00",
        "irpf_mode": "auto",
        "irpf_base": "2000.00",
        "irpf_percentage": "12.00",
        "suggested_irpf_percentage": "12.00",
        "irpf": "240.00",
        "gross_salary": "2000.00",
        "total_deductions": "357.00",
        "net_salary": "1643.00",
        "company_total_social_security": "640.00",
        "company_total_cost": "2640.00",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_common_contingencies_review_checks_daily_base_times_days():
    review = _review_common_base(calculated_payroll())

    assert review["passed"] is True
    assert review["evidence"]["reconstructed_base"] == "1800.00"


def test_common_contingencies_review_rejects_incoherent_base():
    review = _review_common_base(
        calculated_payroll(common_contingencies_base="1700.00")
    )

    assert review["passed"] is False


def test_employee_social_security_review_sums_worker_components():
    review = _review_employee_social_security(calculated_payroll())

    assert review["passed"] is True
    assert review["evidence"]["expected_total"] == "117.00"


def test_employee_social_security_review_detects_difference():
    review = _review_employee_social_security(
        calculated_payroll(employee_social_security="118.00")
    )

    assert review["passed"] is False


def test_irpf_review_checks_base_percentage_amount_and_auto_suggestion():
    review = _review_irpf(calculated_payroll())

    assert review["passed"] is True
    assert review["evidence"]["expected_irpf"] == "240.00"


def test_irpf_review_rejects_wrong_amount_or_wrong_auto_percentage():
    wrong_amount = _review_irpf(calculated_payroll(irpf="220.00"))
    wrong_percentage = _review_irpf(
        calculated_payroll(irpf_percentage="11.00", suggested_irpf_percentage="12.00", irpf="220.00")
    )

    assert wrong_amount["passed"] is False
    assert wrong_percentage["passed"] is False


def test_net_and_company_cost_review_checks_both_sides_of_payroll_result():
    review = _review_net_and_company_cost(calculated_payroll())

    assert review["passed"] is True
    assert review["evidence"]["expected_net_salary"] == "1643.00"
    assert review["evidence"]["expected_company_total_cost"] == "2640.00"


def test_net_and_company_cost_review_detects_incoherent_result():
    wrong_net = _review_net_and_company_cost(calculated_payroll(net_salary="1600.00"))
    wrong_cost = _review_net_and_company_cost(calculated_payroll(company_total_cost="2500.00"))

    assert wrong_net["passed"] is False
    assert wrong_cost["passed"] is False
