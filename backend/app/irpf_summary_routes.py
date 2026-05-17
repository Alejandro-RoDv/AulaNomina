from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.crud.payroll import (
    calculate_contract_base_salary,
    calculate_extra_pay_proration,
    calculate_payroll_amounts,
    get_contract_period_skip_reason,
    money,
    tax_profile_to_calculation_payload,
)
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.models.tax_profile import TaxProfile
from app.services.irpf_calculator import calculate_irpf_2026

router = APIRouter(tags=["irpf"])

MONTHS = list(range(1, 13))
CANCELLED_STATUSES = {"cancelled"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def decimal_to_float(value):
    if value is None:
        return 0.0
    return float(value)


def build_totals(rows):
    return {
        "gross": round(sum(decimal_to_float(row.get("gross_salary")) for row in rows), 2),
        "net": round(sum(decimal_to_float(row.get("net_salary")) for row in rows), 2),
        "irpf": round(sum(decimal_to_float(row.get("irpf")) for row in rows), 2),
        "employee_social_security": round(sum(decimal_to_float(row.get("employee_social_security")) for row in rows), 2),
    }


def get_employee_active_contract(db: Session, employee_id: int):
    active_contract = db.query(Contract).filter(
        Contract.employee_id == employee_id,
        Contract.status == "active",
    ).order_by(Contract.start_date.desc(), Contract.id.desc()).first()

    if active_contract:
        return active_contract

    return db.query(Contract).filter(
        Contract.employee_id == employee_id,
    ).order_by(Contract.start_date.desc(), Contract.id.desc()).first()


def build_forecast_row(contract: Contract | None, month: int, year: int, irpf_percentage: Decimal):
    if not contract:
        return {
            "month": month,
            "year": year,
            "source": "forecast",
            "status": "Sin contrato",
            "payroll_id": None,
            "base_salary": 0,
            "salary_supplements": 0,
            "extra_pay_proration": 0,
            "gross_salary": 0,
            "employee_social_security": 0,
            "irpf_percentage": decimal_to_float(irpf_percentage),
            "suggested_irpf_percentage": decimal_to_float(irpf_percentage),
            "irpf": 0,
            "total_deductions": 0,
            "net_salary": 0,
        }

    skip_reason = get_contract_period_skip_reason(contract, month, year)
    if skip_reason:
        return {
            "month": month,
            "year": year,
            "source": "forecast",
            "status": "Fuera de contrato",
            "payroll_id": None,
            "base_salary": 0,
            "salary_supplements": 0,
            "extra_pay_proration": 0,
            "gross_salary": 0,
            "employee_social_security": 0,
            "irpf_percentage": decimal_to_float(irpf_percentage),
            "suggested_irpf_percentage": decimal_to_float(irpf_percentage),
            "irpf": 0,
            "total_deductions": 0,
            "net_salary": 0,
        }

    base_salary = calculate_contract_base_salary(contract, month)
    salary_supplements = Decimal("0.00")
    extra_pay_proration = calculate_extra_pay_proration(contract, month)
    calculated = calculate_payroll_amounts(
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        extra_pay_proration=extra_pay_proration,
        irpf_percentage=irpf_percentage,
    )

    return {
        "month": month,
        "year": year,
        "source": "forecast",
        "status": "Previsto",
        "payroll_id": None,
        "base_salary": decimal_to_float(base_salary),
        "salary_supplements": decimal_to_float(salary_supplements),
        "extra_pay_proration": decimal_to_float(extra_pay_proration),
        "gross_salary": decimal_to_float(calculated["gross_salary"]),
        "employee_social_security": decimal_to_float(calculated["employee_social_security"]),
        "irpf_percentage": decimal_to_float(irpf_percentage),
        "suggested_irpf_percentage": decimal_to_float(irpf_percentage),
        "irpf": decimal_to_float(calculated["irpf"]),
        "total_deductions": decimal_to_float(calculated["total_deductions"]),
        "net_salary": decimal_to_float(calculated["net_salary"]),
    }


def build_real_row(payroll: Payroll):
    return {
        "month": payroll.period_month,
        "year": payroll.period_year,
        "source": "real",
        "status": payroll.status,
        "payroll_id": payroll.id,
        "base_salary": decimal_to_float(payroll.base_salary),
        "salary_supplements": decimal_to_float(payroll.salary_supplements),
        "extra_pay_proration": decimal_to_float(payroll.extra_pay_proration),
        "gross_salary": decimal_to_float(payroll.gross_salary),
        "employee_social_security": decimal_to_float(payroll.employee_social_security),
        "irpf_percentage": decimal_to_float(payroll.irpf_percentage),
        "suggested_irpf_percentage": decimal_to_float(payroll.suggested_irpf_percentage),
        "irpf": decimal_to_float(payroll.irpf),
        "total_deductions": decimal_to_float(payroll.total_deductions),
        "net_salary": decimal_to_float(payroll.net_salary),
    }


@router.get("/employees/{employee_id}/irpf-annual-summary")
def get_employee_irpf_annual_summary(
    employee_id: int,
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    contract = get_employee_active_contract(db, employee_id)
    tax_profile = db.query(TaxProfile).filter(TaxProfile.employee_id == employee_id).first()

    expected_annual_salary = money(contract.salary_base if contract else 0)
    if contract:
        payload = tax_profile_to_calculation_payload(tax_profile, employee, contract, expected_annual_salary)
    else:
        payload = {
            "birth_year": employee.birth_date.year if employee.birth_date else None,
            "autonomous_community": getattr(tax_profile, "autonomous_community", "andalucia") if tax_profile else "andalucia",
            "family_situation": getattr(tax_profile, "family_situation", "situation_3") if tax_profile else "situation_3",
            "employment_situation": getattr(tax_profile, "employment_situation", "active") if tax_profile else "active",
            "contract_category": getattr(tax_profile, "contract_category", "general") if tax_profile else "general",
            "children_count": getattr(tax_profile, "children_count", 0) if tax_profile else 0,
            "descendants": getattr(tax_profile, "descendants", []) if tax_profile else [],
            "ascendants_in_care": getattr(tax_profile, "ascendants_in_care", 0) if tax_profile else 0,
            "ascendants": getattr(tax_profile, "ascendants", []) if tax_profile else [],
            "employee_disability": getattr(tax_profile, "employee_disability", False) if tax_profile else False,
            "disability_degree": getattr(tax_profile, "disability_degree", "none") if tax_profile else "none",
            "reduced_mobility": getattr(tax_profile, "reduced_mobility", False) if tax_profile else False,
            "descendants_disability": getattr(tax_profile, "descendants_disability", False) if tax_profile else False,
            "geographic_mobility": getattr(tax_profile, "geographic_mobility", False) if tax_profile else False,
            "ceuta_melilla_residence": getattr(tax_profile, "ceuta_melilla_residence", False) if tax_profile else False,
            "ceuta_melilla_income": getattr(tax_profile, "ceuta_melilla_income", False) if tax_profile else False,
            "home_loan": getattr(tax_profile, "home_loan", False) if tax_profile else False,
            "compensatory_pension": getattr(tax_profile, "compensatory_pension", 0) if tax_profile else 0,
            "child_support_annuity": getattr(tax_profile, "child_support_annuity", 0) if tax_profile else 0,
            "irregular_income_18_2": getattr(tax_profile, "irregular_income_18_2", 0) if tax_profile else 0,
            "irregular_income_18_3": getattr(tax_profile, "irregular_income_18_3", 0) if tax_profile else 0,
            "social_security_contributions": getattr(tax_profile, "social_security_contributions", 0) if tax_profile else 0,
            "contract_type": getattr(tax_profile, "contract_type", None) if tax_profile else None,
            "contract_start_date": getattr(tax_profile, "contract_start_date", None) if tax_profile else None,
            "expected_annual_salary": getattr(tax_profile, "expected_annual_salary", 0) if tax_profile else 0,
            "manual_regularization": getattr(tax_profile, "manual_regularization", False) if tax_profile else False,
            "voluntary_irpf": getattr(tax_profile, "voluntary_irpf", None) if tax_profile else None,
            "notes": getattr(tax_profile, "notes", None) if tax_profile else None,
        }

    calculation = calculate_irpf_2026(payload)
    suggested_irpf = Decimal(str(calculation.get("suggested_irpf", 0))).quantize(Decimal("0.01"))
    voluntary_irpf = Decimal(str(tax_profile.voluntary_irpf)).quantize(Decimal("0.01")) if tax_profile and tax_profile.voluntary_irpf is not None else None
    applied_irpf = voluntary_irpf if voluntary_irpf is not None else suggested_irpf

    real_payrolls = db.query(Payroll).filter(
        Payroll.employee_id == employee_id,
        Payroll.period_year == year,
        Payroll.period_month.in_(MONTHS),
        ~Payroll.status.in_(CANCELLED_STATUSES),
    ).order_by(Payroll.period_month.asc(), Payroll.id.desc()).all()

    real_by_month = {}
    for payroll in real_payrolls:
        if payroll.period_month not in real_by_month:
            real_by_month[payroll.period_month] = payroll

    rows = []
    for month in MONTHS:
        if month in real_by_month:
            rows.append(build_real_row(real_by_month[month]))
        else:
            rows.append(build_forecast_row(contract, month, year, applied_irpf))

    real_rows = [row for row in rows if row["source"] == "real"]
    forecast_rows = [row for row in rows if row["source"] == "forecast"]

    return {
        "employee_id": employee.id,
        "employee_name": f"{employee.first_name} {employee.last_name}".strip(),
        "year": year,
        "contract_id": contract.id if contract else None,
        "contract_type": contract.contract_type if contract else None,
        "expected_annual_salary": decimal_to_float(expected_annual_salary),
        "current_irpf": decimal_to_float(applied_irpf),
        "suggested_irpf": decimal_to_float(suggested_irpf),
        "voluntary_irpf": decimal_to_float(voluntary_irpf) if voluntary_irpf is not None else None,
        "irpf_mode": "voluntary" if voluntary_irpf is not None else "auto",
        "calculation": calculation,
        "totals": {
            "real": build_totals(real_rows),
            "forecast": build_totals(forecast_rows),
            "annual": build_totals(rows),
        },
        "months": rows,
    }
