from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.payroll import Payroll
from app.models.work_center import WorkCenter
from app.schemas.payroll import PayrollCreate, PayrollPrepareRequest, PayrollUpdate

SOCIAL_SECURITY_PERCENTAGE = Decimal("6.47")
DEFAULT_IRPF_PERCENTAGE = Decimal("10.00")

MONTHLY_PERIODS = set(range(1, 13))
EXTRA_JULY = 13
EXTRA_DECEMBER = 14
EXTRA_COMPLEMENTARY = 15


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_contract_base_salary(contract: Contract, period_month: int) -> Decimal:
    annual_salary = money(contract.salary_base or Decimal("0.00"))
    pay_schedule = contract.pay_schedule or "not_prorated_14"

    if period_month == EXTRA_COMPLEMENTARY:
        return Decimal("0.00")

    if period_month in {EXTRA_JULY, EXTRA_DECEMBER}:
        return money(annual_salary / Decimal("14"))

    if pay_schedule == "prorated_12":
        return money(annual_salary / Decimal("12"))

    return money(annual_salary / Decimal("14"))


def calculate_extra_pay_proration(contract: Contract, period_month: int) -> Decimal:
    annual_salary = money(contract.salary_base or Decimal("0.00"))
    pay_schedule = contract.pay_schedule or "not_prorated_14"

    if period_month not in MONTHLY_PERIODS:
        return Decimal("0.00")

    if pay_schedule != "prorated_12":
        return Decimal("0.00")

    return money(((annual_salary / Decimal("14")) * Decimal("2")) / Decimal("12"))


def calculate_payroll_amounts(
    base_salary: Decimal,
    salary_supplements: Decimal,
    extra_pay_proration: Decimal,
    irpf_percentage: Decimal,
):
    gross_salary = money(base_salary + salary_supplements + extra_pay_proration)
    employee_social_security = money(gross_salary * SOCIAL_SECURITY_PERCENTAGE / Decimal("100"))
    irpf = money(gross_salary * irpf_percentage / Decimal("100"))
    total_deductions = money(employee_social_security + irpf)
    net_salary = money(gross_salary - total_deductions)

    return {
        "gross_salary": gross_salary,
        "employee_social_security": employee_social_security,
        "irpf": irpf,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
    }


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

    return employee, contract, company


def create_payroll(db: Session, payroll: PayrollCreate):
    _, contract, company = validate_payroll_relations(db, payroll)

    base_salary = calculate_contract_base_salary(contract, payroll.period_month)
    salary_supplements = money(payroll.salary_supplements or Decimal("0.00"))
    extra_pay_proration = calculate_extra_pay_proration(contract, payroll.period_month)
    irpf_percentage = payroll.irpf_percentage or DEFAULT_IRPF_PERCENTAGE

    calculated_amounts = calculate_payroll_amounts(
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        extra_pay_proration=extra_pay_proration,
        irpf_percentage=irpf_percentage,
    )

    db_payroll = Payroll(
        employee_id=payroll.employee_id,
        contract_id=payroll.contract_id,
        company_id=company.id,
        center_id=payroll.center_id or contract.center_id,
        period_month=payroll.period_month,
        period_year=payroll.period_year,
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        extra_pay_proration=extra_pay_proration,
        status=payroll.status or "pending",
        **calculated_amounts,
    )

    db.add(db_payroll)
    db.commit()
    db.refresh(db_payroll)
    return get_payroll(db, db_payroll.id)


def get_period_dates(period_month: int, period_year: int):
    if period_month not in MONTHLY_PERIODS:
        return None, None

    last_day = monthrange(period_year, period_month)[1]
    return date(period_year, period_month, 1), date(period_year, period_month, last_day)


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
        Contract.start_date <= date(request.period_year, min(request.period_month, 12), 28),
        (Contract.end_date == None) | (Contract.end_date >= date(request.period_year, min(request.period_month, 12), 1)),
    )

    if request.center_id:
        contracts_query = contracts_query.filter(Contract.center_id == request.center_id)

    contracts = contracts_query.order_by(Contract.company_id.asc(), Contract.center_id.asc(), Contract.employee_id.asc()).all()

    result_items = []
    created_count = 0
    existing_count = 0
    skipped_count = 0

    for contract in contracts:
        if not contract.employee or not contract.employee.is_active:
            skipped_count += 1
            continue

        existing_payroll = get_payroll_query(db).filter(
            Payroll.contract_id == contract.id,
            Payroll.period_month == request.period_month,
            Payroll.period_year == request.period_year,
        ).first()

        incident_summary = get_incident_summary(db, contract, request.period_month, request.period_year)

        if existing_payroll:
            existing_count += 1
            result_items.append({
                "payroll_id": existing_payroll.id,
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
                "status": existing_payroll.status,
                "gross_salary": money(existing_payroll.gross_salary or Decimal("0.00")),
                "already_existing": True,
            })
            continue

        payroll_create = PayrollCreate(
            employee_id=contract.employee_id,
            contract_id=contract.id,
            company_id=contract.company_id,
            center_id=contract.center_id,
            period_month=request.period_month,
            period_year=request.period_year,
            salary_supplements=Decimal("0.00"),
            irpf_percentage=DEFAULT_IRPF_PERCENTAGE,
            status=request.status,
        )

        created_payroll = create_payroll(db, payroll_create)
        created_count += 1

        result_items.append({
            "payroll_id": created_payroll.id,
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
            "status": created_payroll.status,
            "gross_salary": money(created_payroll.gross_salary or Decimal("0.00")),
            "already_existing": False,
        })

    return {
        "period_month": request.period_month,
        "period_year": request.period_year,
        "created_count": created_count,
        "existing_count": existing_count,
        "skipped_count": skipped_count,
        "payrolls": result_items,
    }


def update_payroll(db: Session, payroll_id: int, payroll_data: PayrollUpdate):
    db_payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not db_payroll:
        return None

    update_data = payroll_data.model_dump(exclude_unset=True)
    irpf_percentage = update_data.pop("irpf_percentage", DEFAULT_IRPF_PERCENTAGE)

    for key, value in update_data.items():
        setattr(db_payroll, key, value)

    contract = db.query(Contract).filter(Contract.id == db_payroll.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    base_salary = calculate_contract_base_salary(contract, db_payroll.period_month)
    salary_supplements = money(db_payroll.salary_supplements or Decimal("0.00"))
    extra_pay_proration = calculate_extra_pay_proration(contract, db_payroll.period_month)

    db_payroll.base_salary = base_salary
    db_payroll.extra_pay_proration = extra_pay_proration

    calculated_amounts = calculate_payroll_amounts(
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        extra_pay_proration=extra_pay_proration,
        irpf_percentage=irpf_percentage,
    )

    for key, value in calculated_amounts.items():
        setattr(db_payroll, key, value)

    db.commit()
    db.refresh(db_payroll)
    return get_payroll(db, db_payroll.id)


def delete_payroll(db: Session, payroll_id: int):
    db_payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not db_payroll:
        return None

    deleted_payroll_id = db_payroll.id
    db.delete(db_payroll)
    db.commit()
    return {"id": deleted_payroll_id}
