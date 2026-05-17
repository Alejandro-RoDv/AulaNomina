from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
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
EXTRA_JULY = 13
EXTRA_DECEMBER = 14
EXTRA_TO_MONTH = {EXTRA_JULY: 7, EXTRA_DECEMBER: 12}
EXTRA_BY_MONTH = {7: EXTRA_JULY, 12: EXTRA_DECEMBER}
CANCELLED_STATUSES = {"cancelled"}


class IrpfAnnualIncentive(BaseModel):
    period_month: int = Field(..., ge=1, le=12)
    amount: Decimal = Field(default=Decimal("0.00"))
    description: str = "Variable futura"


class IrpfAnnualSummaryRequest(BaseModel):
    year: int = Field(..., ge=2000, le=2100)
    incentives: list[IrpfAnnualIncentive] = []
    salary_increase: Decimal = Decimal("0.00")


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


def build_totals_from_snapshots(snapshots):
    return {
        "gross": round(sum(decimal_to_float(item.get("gross_salary")) for item in snapshots if item), 2),
        "net": round(sum(decimal_to_float(item.get("net_salary")) for item in snapshots if item), 2),
        "irpf": round(sum(decimal_to_float(item.get("irpf")) for item in snapshots if item), 2),
        "employee_social_security": round(sum(decimal_to_float(item.get("employee_social_security")) for item in snapshots if item), 2),
        "salary_supplements": round(sum(decimal_to_float(item.get("salary_supplements")) for item in snapshots if item), 2),
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


def build_incentive_map(incentives: list[IrpfAnnualIncentive]):
    result = {}
    details = {}
    for incentive in incentives:
        month = int(incentive.period_month)
        amount = money(incentive.amount)
        result[month] = result.get(month, Decimal("0.00")) + amount
        details.setdefault(month, []).append({
            "amount": decimal_to_float(amount),
            "description": incentive.description or "Variable futura",
        })
    return result, details


def build_empty_snapshot(irpf_percentage: Decimal):
    return {
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


def build_snapshot_from_amounts(
    base_salary: Decimal,
    salary_supplements: Decimal,
    extra_pay_proration: Decimal,
    irpf_percentage: Decimal,
):
    calculated = calculate_payroll_amounts(
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        extra_pay_proration=extra_pay_proration,
        irpf_percentage=irpf_percentage,
    )

    return {
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


def merge_snapshots(primary: dict | None, extra: dict | None):
    if not primary and not extra:
        return None
    if not primary:
        return extra
    if not extra:
        return primary

    return {
        "base_salary": decimal_to_float(primary.get("base_salary")) + decimal_to_float(extra.get("base_salary")),
        "salary_supplements": decimal_to_float(primary.get("salary_supplements")) + decimal_to_float(extra.get("salary_supplements")),
        "extra_pay_proration": decimal_to_float(primary.get("extra_pay_proration")) + decimal_to_float(extra.get("extra_pay_proration")),
        "gross_salary": decimal_to_float(primary.get("gross_salary")) + decimal_to_float(extra.get("gross_salary")),
        "employee_social_security": decimal_to_float(primary.get("employee_social_security")) + decimal_to_float(extra.get("employee_social_security")),
        "irpf_percentage": decimal_to_float(primary.get("irpf_percentage")),
        "suggested_irpf_percentage": decimal_to_float(primary.get("suggested_irpf_percentage")),
        "irpf": decimal_to_float(primary.get("irpf")) + decimal_to_float(extra.get("irpf")),
        "total_deductions": decimal_to_float(primary.get("total_deductions")) + decimal_to_float(extra.get("total_deductions")),
        "net_salary": decimal_to_float(primary.get("net_salary")) + decimal_to_float(extra.get("net_salary")),
    }


def build_forecast_snapshot(
    contract: Contract | None,
    month: int,
    year: int,
    irpf_percentage: Decimal,
    salary_increase: Decimal = Decimal("0.00"),
    incentive_amount: Decimal = Decimal("0.00"),
):
    if not contract:
        return build_empty_snapshot(irpf_percentage)

    skip_reason = get_contract_period_skip_reason(contract, month, year)
    if skip_reason:
        return build_empty_snapshot(irpf_percentage)

    base_salary = calculate_contract_base_salary(contract, month)
    salary_supplements = money(salary_increase) + money(incentive_amount)
    extra_pay_proration = calculate_extra_pay_proration(contract, month)

    snapshot = build_snapshot_from_amounts(
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        extra_pay_proration=extra_pay_proration,
        irpf_percentage=irpf_percentage,
    )

    # For 14-pay contracts, the annual forecast shown in the IRPF screen must include
    # the two extra pays. They are merged into July and December so the annual total
    # matches the agreed gross annual salary without requiring separate visible rows.
    if (contract.pay_schedule or "not_prorated_14") != "prorated_12" and month in EXTRA_BY_MONTH:
        extra_month = EXTRA_BY_MONTH[month]
        if not get_contract_period_skip_reason(contract, extra_month, year):
            extra_snapshot = build_snapshot_from_amounts(
                base_salary=calculate_contract_base_salary(contract, extra_month),
                salary_supplements=Decimal("0.00"),
                extra_pay_proration=Decimal("0.00"),
                irpf_percentage=irpf_percentage,
            )
            snapshot = merge_snapshots(snapshot, extra_snapshot)

    return snapshot


def build_real_snapshot(payroll: Payroll, contract: Contract | None = None):
    # Existing payrolls generated before a formula correction may contain stale stored
    # amounts. Rebuild the displayed snapshot from the current contract rules so IRPF
    # annual views remain coherent with the current payroll engine.
    if contract:
        base_salary = calculate_contract_base_salary(contract, payroll.period_month)
        extra_pay_proration = calculate_extra_pay_proration(contract, payroll.period_month)
        return build_snapshot_from_amounts(
            base_salary=base_salary,
            salary_supplements=money(payroll.salary_supplements),
            extra_pay_proration=extra_pay_proration,
            irpf_percentage=money(payroll.irpf_percentage),
        )

    return {
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


def build_month_row(
    month: int,
    year: int,
    real_payroll: Payroll | None,
    real_extra_payroll: Payroll | None,
    contract: Contract | None,
    forecast_snapshot: dict,
    forecast_status: str,
    incentive_details: list[dict],
):
    real_snapshot = build_real_snapshot(real_payroll, contract) if real_payroll else None
    extra_snapshot = build_real_snapshot(real_extra_payroll, contract) if real_extra_payroll else None
    real_snapshot = merge_snapshots(real_snapshot, extra_snapshot)
    projected_snapshot = real_snapshot if real_snapshot else forecast_snapshot
    status = "Cobrado" if real_snapshot else forecast_status
    source = "real" if real_snapshot else "forecast"

    return {
        "month": month,
        "year": year,
        "source": source,
        "status": status,
        "payroll_id": real_payroll.id if real_payroll else None,
        "extra_payroll_id": real_extra_payroll.id if real_extra_payroll else None,
        "real": real_snapshot,
        "projected": projected_snapshot,
        "future_incentives": [] if real_snapshot else incentive_details,
        "base_salary": projected_snapshot["base_salary"],
        "salary_supplements": projected_snapshot["salary_supplements"],
        "extra_pay_proration": projected_snapshot["extra_pay_proration"],
        "gross_salary": projected_snapshot["gross_salary"],
        "employee_social_security": projected_snapshot["employee_social_security"],
        "irpf_percentage": projected_snapshot["irpf_percentage"],
        "suggested_irpf_percentage": projected_snapshot["suggested_irpf_percentage"],
        "irpf": projected_snapshot["irpf"],
        "total_deductions": projected_snapshot["total_deductions"],
        "net_salary": projected_snapshot["net_salary"],
    }


def get_forecast_status(contract: Contract | None, month: int, year: int, salary_supplements: Decimal):
    if not contract:
        return "Sin contrato"
    if get_contract_period_skip_reason(contract, month, year):
        return "Fuera de contrato"
    return "Previsto + variable" if salary_supplements != Decimal("0.00") else "Previsto"


def build_fallback_payload(employee: Employee, tax_profile: TaxProfile | None, expected_annual_salary):
    return {
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
        "expected_annual_salary": expected_annual_salary,
        "manual_regularization": getattr(tax_profile, "manual_regularization", False) if tax_profile else False,
        "voluntary_irpf": getattr(tax_profile, "voluntary_irpf", None) if tax_profile else None,
        "notes": getattr(tax_profile, "notes", None) if tax_profile else None,
    }


def build_irpf_annual_summary(db: Session, employee_id: int, year: int, incentives=None, salary_increase=Decimal("0.00")):
    incentives = incentives or []
    salary_increase = money(salary_increase)

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    contract = get_employee_active_contract(db, employee_id)
    tax_profile = db.query(TaxProfile).filter(TaxProfile.employee_id == employee_id).first()
    incentive_map, incentive_details = build_incentive_map(incentives)

    expected_annual_salary = money(contract.salary_base if contract else 0)
    forecast_variables_total = sum(incentive_map.values(), Decimal("0.00")) + (salary_increase * Decimal("12"))
    expected_annual_salary_with_variables = expected_annual_salary + forecast_variables_total

    if contract:
        payload = tax_profile_to_calculation_payload(tax_profile, employee, contract, expected_annual_salary_with_variables)
        payload["expected_annual_salary"] = expected_annual_salary_with_variables
    else:
        payload = build_fallback_payload(employee, tax_profile, expected_annual_salary_with_variables)

    calculation = calculate_irpf_2026(payload)
    suggested_irpf = Decimal(str(calculation.get("suggested_irpf", 0))).quantize(Decimal("0.01"))
    voluntary_irpf = Decimal(str(tax_profile.voluntary_irpf)).quantize(Decimal("0.01")) if tax_profile and tax_profile.voluntary_irpf is not None else None
    applied_irpf = voluntary_irpf if voluntary_irpf is not None else suggested_irpf

    real_payrolls = db.query(Payroll).filter(
        Payroll.employee_id == employee_id,
        Payroll.period_year == year,
        Payroll.period_month.in_(MONTHS + [EXTRA_JULY, EXTRA_DECEMBER]),
        ~Payroll.status.in_(CANCELLED_STATUSES),
    ).order_by(Payroll.period_month.asc(), Payroll.id.desc()).all()

    real_by_month = {}
    real_extra_by_month = {}
    for payroll in real_payrolls:
        if payroll.period_month in EXTRA_TO_MONTH:
            display_month = EXTRA_TO_MONTH[payroll.period_month]
            if display_month not in real_extra_by_month:
                real_extra_by_month[display_month] = payroll
        elif payroll.period_month not in real_by_month:
            real_by_month[payroll.period_month] = payroll

    rows = []
    for month in MONTHS:
        incentive_amount = incentive_map.get(month, Decimal("0.00"))
        monthly_supplements = money(salary_increase) + money(incentive_amount)
        forecast_snapshot = build_forecast_snapshot(
            contract=contract,
            month=month,
            year=year,
            irpf_percentage=applied_irpf,
            salary_increase=salary_increase,
            incentive_amount=incentive_amount,
        )
        rows.append(build_month_row(
            month=month,
            year=year,
            real_payroll=real_by_month.get(month),
            real_extra_payroll=real_extra_by_month.get(month),
            contract=contract,
            forecast_snapshot=forecast_snapshot,
            forecast_status=get_forecast_status(contract, month, year, monthly_supplements),
            incentive_details=incentive_details.get(month, []),
        ))

    real_snapshots = [row["real"] for row in rows if row["real"]]
    pending_projected_snapshots = [row["projected"] for row in rows if row["source"] == "forecast"]
    annual_projected_snapshots = [row["projected"] for row in rows]

    return {
        "employee_id": employee.id,
        "employee_name": f"{employee.first_name} {employee.last_name}".strip(),
        "year": year,
        "contract_id": contract.id if contract else None,
        "contract_type": contract.contract_type if contract else None,
        "pay_schedule": contract.pay_schedule if contract else None,
        "expected_annual_salary": decimal_to_float(expected_annual_salary),
        "expected_annual_salary_with_variables": decimal_to_float(expected_annual_salary_with_variables),
        "future_variables_total": decimal_to_float(forecast_variables_total),
        "salary_increase": decimal_to_float(salary_increase),
        "current_irpf": decimal_to_float(applied_irpf),
        "suggested_irpf": decimal_to_float(suggested_irpf),
        "voluntary_irpf": decimal_to_float(voluntary_irpf) if voluntary_irpf is not None else None,
        "irpf_mode": "voluntary" if voluntary_irpf is not None else "auto",
        "calculation": calculation,
        "totals": {
            "real": build_totals_from_snapshots(real_snapshots),
            "forecast": build_totals_from_snapshots(pending_projected_snapshots),
            "annual": build_totals_from_snapshots(annual_projected_snapshots),
        },
        "future_incentives": [
            {
                "period_month": incentive.period_month,
                "amount": decimal_to_float(incentive.amount),
                "description": incentive.description,
            }
            for incentive in incentives
        ],
        "months": rows,
    }


@router.get("/employees/{employee_id}/irpf-annual-summary")
def get_employee_irpf_annual_summary(
    employee_id: int,
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    return build_irpf_annual_summary(db=db, employee_id=employee_id, year=year)


@router.post("/employees/{employee_id}/irpf-annual-summary/simulate")
def simulate_employee_irpf_annual_summary(
    employee_id: int,
    request: IrpfAnnualSummaryRequest,
    db: Session = Depends(get_db),
):
    return build_irpf_annual_summary(
        db=db,
        employee_id=employee_id,
        year=request.year,
        incentives=request.incentives,
        salary_increase=request.salary_increase,
    )
