from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.schemas.payroll import PayrollCreate, PayrollUpdate

SOCIAL_SECURITY_PERCENTAGE = Decimal("6.47")
DEFAULT_IRPF_PERCENTAGE = Decimal("10.00")


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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

    base_salary = money(payroll.base_salary if payroll.base_salary is not None else contract.salary_base or Decimal("0.00"))
    salary_supplements = money(payroll.salary_supplements or Decimal("0.00"))
    extra_pay_proration = money(payroll.extra_pay_proration or Decimal("0.00"))
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
        period_month=payroll.period_month,
        period_year=payroll.period_year,
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        extra_pay_proration=extra_pay_proration,
        status=payroll.status or "draft",
        **calculated_amounts,
    )

    db.add(db_payroll)
    db.commit()
    db.refresh(db_payroll)
    return get_payroll(db, db_payroll.id)


def update_payroll(db: Session, payroll_id: int, payroll_data: PayrollUpdate):
    db_payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not db_payroll:
        return None

    update_data = payroll_data.model_dump(exclude_unset=True)
    irpf_percentage = update_data.pop("irpf_percentage", DEFAULT_IRPF_PERCENTAGE)

    for key, value in update_data.items():
        setattr(db_payroll, key, value)

    base_salary = money(db_payroll.base_salary or Decimal("0.00"))
    salary_supplements = money(db_payroll.salary_supplements or Decimal("0.00"))
    extra_pay_proration = money(db_payroll.extra_pay_proration or Decimal("0.00"))

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
