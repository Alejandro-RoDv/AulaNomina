from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.payroll import Payroll
from app.models.tax_profile import TaxProfile
from app.models.work_center import WorkCenter
from app.schemas.payroll import PayrollCreate, PayrollFutureSimulationRequest, PayrollPrepareRequest, PayrollUpdate
from app.services.irpf_calculator import calculate_irpf_2026
from app.services.payroll_amounts import money
from app.services.payroll_engine import (
    calculate_payroll_engine_result,
    get_effective_period_dates,
    get_period_dates,
)

DEFAULT_IRPF_PERCENTAGE = Decimal("10.00")

MONTHLY_PERIODS = set(range(1, 12 + 1))
EXTRA_JULY = 13
EXTRA_DECEMBER = 14
EXTRA_COMPLEMENTARY = 15

ACTIVE_PAYROLL_STATUSES = {"draft", "pending", "calculated", "reviewed", "closed"}

PERSISTED_PAYROLL_AMOUNT_KEYS = {
    "gross_salary",
    "worked_base_salary",
    "temporary_disability_benefit",
    "company_disability_complement",
    "contribution_days",
    "worked_days",
    "incident_days",
    "it_days",
    "non_contribution_days",
    "common_contingencies_base",
    "professional_contingencies_base",
    "unemployment_training_fogasa_base",
    "irpf_base",
    "daily_common_base",
    "daily_professional_base",
    "employee_common_contingencies",
    "employee_unemployment",
    "employee_training",
    "employee_mei",
    "employee_social_security",
    "irpf",
    "total_deductions",
    "net_salary",
    "company_common_contingencies",
    "company_unemployment",
    "company_fogasa",
    "company_training",
    "company_at_ep",
    "company_mei",
    "company_total_social_security",
    "company_total_cost",
}


def percent(value) -> Decimal:
    return money(value)


def persisted_payroll_amounts(calculated_amounts: dict) -> dict:
    return {
        key: value
        for key, value in calculated_amounts.items()
        if key in PERSISTED_PAYROLL_AMOUNT_KEYS
    }


def tax_profile_to_calculation_payload(tax_profile: TaxProfile | None, employee: Employee, contract: Contract, expected_annual_salary: Decimal):
    if tax_profile:
        payload = {
            "birth_year": tax_profile.birth_year,
            "autonomous_community": getattr(tax_profile, "autonomous_community", "andalucia"),
            "family_situation": tax_profile.family_situation,
            "spouse_nif": tax_profile.spouse_nif,
            "employment_situation": tax_profile.employment_situation,
            "contract_category": tax_profile.contract_category,
            "children_count": tax_profile.children_count,
            "descendants": tax_profile.descendants or [],
            "ascendants_in_care": tax_profile.ascendants_in_care,
            "ascendants": tax_profile.ascendants or [],
            "employee_disability": tax_profile.employee_disability,
            "disability_degree": tax_profile.disability_degree,
            "reduced_mobility": tax_profile.reduced_mobility,
            "descendants_disability": tax_profile.descendants_disability,
            "geographic_mobility": tax_profile.geographic_mobility,
            "ceuta_melilla_residence": tax_profile.ceuta_melilla_residence,
            "ceuta_melilla_income": tax_profile.ceuta_melilla_income,
            "home_loan": tax_profile.home_loan,
            "compensatory_pension": tax_profile.compensatory_pension,
            "child_support_annuity": tax_profile.child_support_annuity,
            "irregular_income_18_2": tax_profile.irregular_income_18_2,
            "irregular_income_18_3": tax_profile.irregular_income_18_3,
            "social_security_contributions": tax_profile.social_security_contributions,
            "contract_type": tax_profile.contract_type or contract.contract_type,
            "contract_start_date": tax_profile.contract_start_date or contract.start_date,
            "expected_annual_salary": tax_profile.expected_annual_salary or expected_annual_salary,
            "manual_regularization": tax_profile.manual_regularization,
            "voluntary_irpf": tax_profile.voluntary_irpf,
            "notes": tax_profile.notes,
        }
    else:
        payload = {
            "birth_year": employee.birth_date.year if employee.birth_date else None,
            "autonomous_community": "andalucia",
            "family_situation": "situation_3",
            "employment_situation": "active",
            "contract_category": "general",
            "children_count": 0,
            "descendants": [],
            "ascendants_in_care": 0,
            "ascendants": [],
            "employee_disability": False,
            "disability_degree": "none",
            "reduced_mobility": False,
            "descendants_disability": False,
            "geographic_mobility": False,
            "ceuta_melilla_residence": False,
            "ceuta_melilla_income": False,
            "home_loan": False,
            "compensatory_pension": 0,
            "child_support_annuity": 0,
            "irregular_income_18_2": 0,
            "irregular_income_18_3": 0,
            "social_security_contributions": 0,
            "contract_type": contract.contract_type,
            "contract_start_date": contract.start_date,
            "expected_annual_salary": expected_annual_salary,
            "manual_regularization": False,
            "voluntary_irpf": None,
            "notes": None,
        }

    if not payload.get("birth_year") and employee.birth_date:
        payload["birth_year"] = employee.birth_date.year
    if not payload.get("expected_annual_salary"):
        payload["expected_annual_salary"] = expected_annual_salary

    return payload


def resolve_irpf_percentage(db: Session, employee: Employee, contract: Contract, irpf_mode: str, manual_percentage: Decimal | None):
    expected_annual_salary = money(contract.salary_base or Decimal("0.00"))
    tax_profile = db.query(TaxProfile).filter(TaxProfile.employee_id == employee.id).first()
    payload = tax_profile_to_calculation_payload(tax_profile, employee, contract, expected_annual_salary)
    calculation = calculate_irpf_2026(payload)
    suggested = percent(calculation.get("suggested_irpf", 0))

    voluntary = None
    if tax_profile and tax_profile.voluntary_irpf is not None:
        voluntary = percent(tax_profile.voluntary_irpf)

    if irpf_mode == "manual" and manual_percentage is not None:
        applied = percent(manual_percentage)
    elif voluntary is not None:
        applied = voluntary
    elif irpf_mode == "voluntary" and manual_percentage is not None:
        applied = percent(manual_percentage)
    elif irpf_mode == "manual":
        applied = DEFAULT_IRPF_PERCENTAGE
    else:
        applied = suggested

    return applied, suggested


def get_payroll_query(db: Session):
    return db.query(Payroll).options(
        joinedload(Payroll.employee),
        joinedload(Payroll.contract),
        joinedload(Payroll.company),
        joinedload(Payroll.work_center),
    )


def get_payrolls(db: Session):
    return get_payroll_query(db).order_by(
        Payroll.period_year.desc(),
        Payroll.period_month.desc(),
        Payroll.id.desc(),
    ).all()


def get_payroll(db: Session, payroll_id: int):
    return get_payroll_query(db).filter(Payroll.id == payroll_id).first()


def contract_is_valid_for_period(contract: Contract, period_month: int, period_year: int) -> bool:
    period_start, period_end = get_effective_period_dates(period_month, period_year)
    if not period_start or not period_end:
        return False

    if contract.start_date > period_end:
        return False

    if contract.end_date and contract.end_date < period_start:
        return False

    return True


def get_contract_period_skip_reason(contract: Contract, period_month: int, period_year: int):
    period_start, period_end = get_effective_period_dates(period_month, period_year)
    if not period_start or not period_end:
        return "Periodo no válido para generar nómina"

    if contract.start_date > period_end:
        return f"Contrato inicia el {contract.start_date.isoformat()}, fuera del periodo seleccionado"

    if contract.end_date and contract.end_date < period_start:
        return f"Contrato finalizado el {contract.end_date.isoformat()}, fuera del periodo seleccionado"

    return None


def validate_payroll_relations(db: Session, payroll: PayrollCreate):
    employee = db.query(Employee).filter(
        Employee.id == payroll.employee_id,
        Employee.is_active == True,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    contract = db.query(Contract).filter(Contract.id == payroll.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    if contract.employee_id != payroll.employee_id:
        raise HTTPException(
            status_code=400,
            detail="El contrato seleccionado no pertenece al trabajador indicado",
        )

    if contract.status != "active":
        raise HTTPException(status_code=400, detail="Solo se pueden generar nóminas sobre contratos activos")

    skip_reason = get_contract_period_skip_reason(contract, payroll.period_month, payroll.period_year)
    if skip_reason:
        raise HTTPException(status_code=400, detail=skip_reason)

    existing_payroll = db.query(Payroll).filter(
        Payroll.contract_id == contract.id,
        Payroll.period_month == payroll.period_month,
        Payroll.period_year == payroll.period_year,
        Payroll.status.in_(ACTIVE_PAYROLL_STATUSES),
    ).first()
    if existing_payroll:
        raise HTTPException(status_code=400, detail="Ya existe una nómina activa para este contrato y periodo")

    company_id = payroll.company_id or contract.company_id
    if company_id is None:
        raise HTTPException(
            status_code=400,
            detail="La nómina necesita una empresa. Indícala o vincula el contrato a una empresa",
        )

    company = db.query(Company).filter(
        Company.id == company_id,
        Company.is_active == True,
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if contract.company_id and contract.company_id != company_id:
        raise HTTPException(
            status_code=400,
            detail="La empresa indicada no coincide con la empresa del contrato",
        )

    center_id = payroll.center_id or contract.center_id
    if center_id is not None:
        center = db.query(WorkCenter).filter(
            WorkCenter.id == center_id,
            WorkCenter.is_active == True,
        ).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != company.id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa indicada")

    return employee, contract, company


def calculate_persistable_payroll_result(
    db: Session,
    employee: Employee,
    contract: Contract,
    period_month: int,
    period_year: int,
    salary_supplements: Decimal,
    variable_incentives: Decimal,
    irpf_mode: str,
    manual_irpf_percentage: Decimal | None,
):
    irpf_percentage, suggested_irpf_percentage = resolve_irpf_percentage(
        db=db,
        employee=employee,
        contract=contract,
        irpf_mode=irpf_mode,
        manual_percentage=manual_irpf_percentage,
    )

    calculated = calculate_payroll_engine_result(
        db=db,
        employee=employee,
        contract=contract,
        period_month=period_month,
        period_year=period_year,
        salary_supplements=salary_supplements,
        variable_incentives=variable_incentives,
        irpf_percentage=irpf_percentage,
        suggested_irpf_percentage=suggested_irpf_percentage,
    )

    return calculated


def create_payroll(db: Session, payroll: PayrollCreate):
    employee, contract, company = validate_payroll_relations(db, payroll)

    salary_supplements = money(payroll.salary_supplements or Decimal("0.00"))
    variable_incentives = money(payroll.variable_incentives or Decimal("0.00"))
    irpf_mode = payroll.irpf_mode or "auto"

    calculated = calculate_persistable_payroll_result(
        db=db,
        employee=employee,
        contract=contract,
        period_month=payroll.period_month,
        period_year=payroll.period_year,
        salary_supplements=salary_supplements,
        variable_incentives=variable_incentives,
        irpf_mode=irpf_mode,
        manual_irpf_percentage=payroll.irpf_percentage,
    )

    db_payroll = Payroll(
        employee_id=payroll.employee_id,
        contract_id=payroll.contract_id,
        company_id=company.id,
        center_id=payroll.center_id or contract.center_id,
        period_month=payroll.period_month,
        period_year=payroll.period_year,
        base_salary=calculated["base_salary"],
        salary_supplements=calculated["salary_supplements"],
        variable_incentives=calculated["variable_incentives"],
        extra_pay_proration=calculated["extra_pay_proration"],
        irpf_mode=irpf_mode,
        irpf_percentage=calculated["irpf_percentage"],
        suggested_irpf_percentage=calculated["suggested_irpf_percentage"],
        status=payroll.status or "pending",
        **persisted_payroll_amounts(calculated),
    )

    db.add(db_payroll)
    db.commit()
    db.refresh(db_payroll)
    return get_payroll(db, db_payroll.id)


def get_incident_summary(db: Session, contract: Contract, period_month: int, period_year: int):
    period_start, period_end = get_period_dates(period_month, period_year)
    if not period_start or not period_end:
        return []

    incidents = db.query(Incident).filter(
        Incident.contract_id == contract.id,
        Incident.start_date <= period_end,
        (Incident.end_date == None) | (Incident.end_date >= period_start),
    ).order_by(Incident.start_date.asc()).all()

    summaries = []
    for incident in incidents:
        end_label = incident.end_date.isoformat() if incident.end_date else "abierta"
        summaries.append(f"{incident.incident_type} {incident.start_date.isoformat()} - {end_label}")

    return summaries


def build_contract_code(contract: Contract):
    if getattr(contract, "contract_code", None):
        return contract.contract_code
    if contract.employee and contract.employee.employee_code:
        return f"{contract.employee.employee_code}.{contract.id}"
    return str(contract.id)


def build_skipped_item(contract: Contract, reason: str):
    return {
        "employee_id": contract.employee_id,
        "employee_code": contract.employee.employee_code if contract.employee else None,
        "employee_name": contract.employee_name or None,
        "contract_id": contract.id,
        "contract_code": build_contract_code(contract),
        "reason": reason,
    }


def build_prepare_item_from_payroll(contract: Contract, payroll: Payroll, incident_summary: list[str], already_existing: bool):
    return {
        "payroll_id": payroll.id,
        "employee_id": contract.employee_id,
        "employee_code": contract.employee.employee_code,
        "employee_name": contract.employee_name or "",
        "contract_id": contract.id,
        "contract_code": build_contract_code(contract),
        "company_id": contract.company_id,
        "company_name": contract.company_name,
        "center_id": contract.center_id,
        "center_name": contract.work_center.name if contract.work_center else None,
        "incident_summary": incident_summary,
        "status": payroll.status,
        "gross_salary": money(payroll.gross_salary or Decimal("0.00")),
        "contribution_days": payroll.contribution_days or 30,
        "incident_days": payroll.incident_days or 0,
        "has_payroll_affecting_incidents": bool((payroll.incident_days or 0) > 0),
        "irpf_mode": payroll.irpf_mode or "auto",
        "irpf_percentage": percent(payroll.irpf_percentage),
        "suggested_irpf_percentage": percent(payroll.suggested_irpf_percentage),
        "already_existing": already_existing,
    }


def prepare_monthly_payrolls(db: Session, request: PayrollPrepareRequest):
    companies_count = db.query(Company).filter(
        Company.id.in_(request.company_ids),
        Company.is_active == True,
    ).count()

    if companies_count != len(set(request.company_ids)):
        raise HTTPException(status_code=404, detail="Alguna empresa seleccionada no existe")

    contracts_query = db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
        joinedload(Contract.work_center),
    ).filter(
        Contract.company_id.in_(request.company_ids),
        Contract.status == "active",
    )

    if request.center_id:
        center = db.query(WorkCenter).filter(
            WorkCenter.id == request.center_id,
            WorkCenter.is_active == True,
        ).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id not in request.company_ids:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa seleccionada")
        contracts_query = contracts_query.filter(Contract.center_id == request.center_id)

    contracts = contracts_query.order_by(Contract.company_id.asc(), Contract.center_id.asc(), Contract.employee_id.asc()).all()

    result_items = []
    skipped_items = []
    created_count = 0
    existing_count = 0
    skipped_count = 0

    for contract in contracts:
        if not contract.employee:
            skipped_count += 1
            skipped_items.append(build_skipped_item(contract, "Contrato sin trabajador vinculado"))
            continue

        if not contract.employee.is_active:
            skipped_count += 1
            skipped_items.append(build_skipped_item(contract, "Trabajador inactivo"))
            continue

        skip_reason = get_contract_period_skip_reason(contract, request.period_month, request.period_year)
        if skip_reason:
            skipped_count += 1
            skipped_items.append(build_skipped_item(contract, skip_reason))
            continue

        existing_payroll = get_payroll_query(db).filter(
            Payroll.contract_id == contract.id,
            Payroll.period_month == request.period_month,
            Payroll.period_year == request.period_year,
            Payroll.status.in_(ACTIVE_PAYROLL_STATUSES),
        ).first()

        incident_summary = get_incident_summary(db, contract, request.period_month, request.period_year)

        if existing_payroll:
            existing_count += 1
            result_items.append(build_prepare_item_from_payroll(contract, existing_payroll, incident_summary, True))
            continue

        payroll_create = PayrollCreate(
            employee_id=contract.employee_id,
            contract_id=contract.id,
            company_id=contract.company_id,
            center_id=contract.center_id,
            period_month=request.period_month,
            period_year=request.period_year,
            salary_supplements=Decimal("0.00"),
            variable_incentives=Decimal("0.00"),
            irpf_mode=request.irpf_mode,
            status=request.status,
        )

        created_payroll = create_payroll(db, payroll_create)
        created_count += 1
        result_items.append(build_prepare_item_from_payroll(contract, created_payroll, incident_summary, False))

    return {
        "period_month": request.period_month,
        "period_year": request.period_year,
        "created_count": created_count,
        "existing_count": existing_count,
        "skipped_count": skipped_count,
        "payrolls": result_items,
        "skipped": skipped_items,
    }


def update_payroll(db: Session, payroll_id: int, payroll_data: PayrollUpdate):
    db_payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not db_payroll:
        return None

    update_data = payroll_data.model_dump(exclude_unset=True)
    manual_irpf_percentage = update_data.pop("irpf_percentage", None)
    irpf_mode = update_data.pop("irpf_mode", db_payroll.irpf_mode or "auto")

    new_period_month = update_data.get("period_month", db_payroll.period_month)
    new_period_year = update_data.get("period_year", db_payroll.period_year)

    contract = db.query(Contract).filter(Contract.id == db_payroll.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    employee = db.query(Employee).filter(Employee.id == db_payroll.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    skip_reason = get_contract_period_skip_reason(contract, new_period_month, new_period_year)
    if skip_reason:
        raise HTTPException(status_code=400, detail=skip_reason)

    if "center_id" in update_data and update_data["center_id"] is not None:
        center = db.query(WorkCenter).filter(
            WorkCenter.id == update_data["center_id"],
            WorkCenter.is_active == True,
        ).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != db_payroll.company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa de la nómina")

    for key, value in update_data.items():
        setattr(db_payroll, key, value)

    calculated = calculate_persistable_payroll_result(
        db=db,
        employee=employee,
        contract=contract,
        period_month=db_payroll.period_month,
        period_year=db_payroll.period_year,
        salary_supplements=money(db_payroll.salary_supplements or Decimal("0.00")),
        variable_incentives=money(db_payroll.variable_incentives or Decimal("0.00")),
        irpf_mode=irpf_mode,
        manual_irpf_percentage=manual_irpf_percentage if manual_irpf_percentage is not None else db_payroll.irpf_percentage,
    )

    db_payroll.base_salary = calculated["base_salary"]
    db_payroll.salary_supplements = calculated["salary_supplements"]
    db_payroll.variable_incentives = calculated["variable_incentives"]
    db_payroll.extra_pay_proration = calculated["extra_pay_proration"]
    db_payroll.irpf_mode = irpf_mode
    db_payroll.irpf_percentage = calculated["irpf_percentage"]
    db_payroll.suggested_irpf_percentage = calculated["suggested_irpf_percentage"]

    for key, value in persisted_payroll_amounts(calculated).items():
        setattr(db_payroll, key, value)

    db.commit()
    db.refresh(db_payroll)
    return get_payroll(db, db_payroll.id)


def simulate_future_payrolls(db: Session, request: PayrollFutureSimulationRequest):
    employee = db.query(Employee).filter(Employee.id == request.employee_id, Employee.is_active == True).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")

    contract = db.query(Contract).filter(Contract.id == request.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    if contract.employee_id != employee.id:
        raise HTTPException(status_code=400, detail="El contrato no pertenece al trabajador")

    incentive_map = {}
    for incentive in request.incentives:
        key = (incentive.period_year, incentive.period_month)
        incentive_map[key] = incentive_map.get(key, Decimal("0.00")) + money(incentive.amount)

    items = []
    for period_month in request.periods:
        skip_reason = get_contract_period_skip_reason(contract, period_month, request.period_year)
        if skip_reason:
            continue

        salary_supplements = money(request.salary_increase or Decimal("0.00"))
        variable_incentives = incentive_map.get((request.period_year, period_month), Decimal("0.00"))

        calculated = calculate_persistable_payroll_result(
            db=db,
            employee=employee,
            contract=contract,
            period_month=period_month,
            period_year=request.period_year,
            salary_supplements=salary_supplements,
            variable_incentives=variable_incentives,
            irpf_mode=request.irpf_mode,
            manual_irpf_percentage=None,
        )

        items.append({
            "period_month": period_month,
            "period_year": request.period_year,
            "base_salary": calculated["base_salary"],
            "salary_supplements": calculated["salary_supplements"],
            "variable_incentives": calculated["variable_incentives"],
            **persisted_payroll_amounts(calculated),
            "irpf_percentage": calculated["irpf_percentage"],
            "suggested_irpf_percentage": calculated["suggested_irpf_percentage"],
        })

    return {
        "employee_id": employee.id,
        "contract_id": contract.id,
        "items": items,
    }


def delete_payroll(db: Session, payroll_id: int):
    db_payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not db_payroll:
        return None

    db_payroll.status = "cancelled"
    db.commit()
    db.refresh(db_payroll)
    return {"id": db_payroll.id, "status": db_payroll.status}
