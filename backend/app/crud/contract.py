from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.contract import Contract
from app.models.employee import Employee
from app.models.company import Company
from app.models.work_center import WorkCenter
from app.schemas.contract import ContractCreate, ContractUpdate


CONTRACT_RESPONSE_FIELDS = [
    "id",
    "employee_id",
    "company_id",
    "center_id",
    "contract_type",
    "contract_code",
    "contract_code_description",
    "contract_family",
    "start_date",
    "end_date",
    "status",
    "contribution_group",
    "professional_category",
    "job_position",
    "collective_agreement_code",
    "working_day_type",
    "weekly_hours",
    "full_time_weekly_hours",
    "partiality_coefficient",
    "monthly_or_daily_contribution",
    "red_occupation_code",
    "red_reduction_code",
    "salary_base",
    "gross_annual_salary",
    "pay_schedule",
    "created_at",
]


CONTRACT_CREATE_FIELDS = [
    "employee_id",
    "contract_type",
    "contract_code",
    "contract_code_description",
    "contract_family",
    "start_date",
    "end_date",
    "contribution_group",
    "professional_category",
    "job_position",
    "collective_agreement_code",
    "working_day_type",
    "weekly_hours",
    "full_time_weekly_hours",
    "partiality_coefficient",
    "monthly_or_daily_contribution",
    "red_occupation_code",
    "red_reduction_code",
    "salary_base",
    "gross_annual_salary",
    "pay_schedule",
]


def contract_to_response(contract: Contract):
    data = {field: getattr(contract, field) for field in CONTRACT_RESPONSE_FIELDS}
    data["employee_name"] = contract.employee_name
    data["company_name"] = contract.company_name
    return data


def _resolve_company_and_center(db: Session, employee: Employee, company_id: int | None, center_id: int | None):
    resolved_company_id = company_id if company_id is not None else employee.company_id
    resolved_center_id = center_id if center_id is not None else employee.center_id

    if resolved_company_id is None:
        raise HTTPException(
            status_code=400,
            detail="El trabajador no tiene empresa asociada. Asigna una empresa antes de crear el contrato.",
        )

    company = db.query(Company).filter(
        Company.id == resolved_company_id,
        Company.is_active == True,
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if resolved_center_id is not None:
        center = db.query(WorkCenter).filter(
            WorkCenter.id == resolved_center_id,
            WorkCenter.is_active == True,
        ).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != resolved_company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa indicada")

    return resolved_company_id, resolved_center_id


def _validate_contract_red_coherence(contract_data):
    contract_code = getattr(contract_data, "contract_code", None)
    working_day_type = getattr(contract_data, "working_day_type", None)

    if contract_code and contract_code.startswith("5") and working_day_type and working_day_type != "part_time":
        raise HTTPException(status_code=400, detail="Los contratos con código 5xx deben ser de jornada parcial")

    if contract_code and contract_code.startswith("4") and working_day_type and working_day_type != "full_time":
        raise HTTPException(status_code=400, detail="Los contratos con código 4xx deben ser de jornada completa")

    if contract_code == "300" and working_day_type and working_day_type != "fixed_discontinuous":
        raise HTTPException(status_code=400, detail="El contrato 300 debe ser fijo discontinuo")


def create_contract(db: Session, contract: ContractCreate):
    employee = db.query(Employee).filter(Employee.id == contract.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    company_id, center_id = _resolve_company_and_center(
        db,
        employee,
        contract.company_id,
        contract.center_id,
    )

    if contract.end_date and contract.end_date < contract.start_date:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")

    _validate_contract_red_coherence(contract)

    status = contract.status or "active"

    if status == "active":
        active_contract = db.query(Contract).filter(
            Contract.employee_id == contract.employee_id,
            Contract.status == "active"
        ).first()
        if active_contract:
            raise HTTPException(status_code=400, detail="El empleado ya tiene un contrato activo")

    payload = {field: getattr(contract, field) for field in CONTRACT_CREATE_FIELDS}
    db_contract = Contract(
        **payload,
        company_id=company_id,
        center_id=center_id,
        status=status,
    )

    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return get_contract(db, db_contract.id)


def get_contracts(db: Session):
    return db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
        joinedload(Contract.work_center),
        joinedload(Contract.ss_registration),
    ).all()


def get_contract(db: Session, contract_id: int):
    return db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
        joinedload(Contract.work_center),
        joinedload(Contract.ss_registration),
    ).filter(Contract.id == contract_id).first()


def get_contracts_by_employee(db: Session, employee_id: int):
    return db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
        joinedload(Contract.work_center),
        joinedload(Contract.ss_registration),
    ).filter(Contract.employee_id == employee_id).all()


def update_contract(db: Session, contract_id: int, contract_data: ContractUpdate):
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract:
        return None

    employee = db.query(Employee).filter(Employee.id == db_contract.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    company_id = contract_data.company_id if contract_data.company_id is not None else db_contract.company_id
    center_id = contract_data.center_id if contract_data.center_id is not None else db_contract.center_id
    _resolve_company_and_center(db, employee, company_id, center_id)

    new_start_date = contract_data.start_date if contract_data.start_date is not None else db_contract.start_date
    new_end_date = contract_data.end_date if contract_data.end_date is not None else db_contract.end_date
    new_status = contract_data.status if contract_data.status is not None else db_contract.status

    if new_end_date and new_end_date < new_start_date:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")

    merged_contract_code = contract_data.contract_code if contract_data.contract_code is not None else db_contract.contract_code
    merged_working_day_type = contract_data.working_day_type if contract_data.working_day_type is not None else db_contract.working_day_type
    if merged_contract_code and merged_contract_code.startswith("5") and merged_working_day_type and merged_working_day_type != "part_time":
        raise HTTPException(status_code=400, detail="Los contratos con código 5xx deben ser de jornada parcial")
    if merged_contract_code and merged_contract_code.startswith("4") and merged_working_day_type and merged_working_day_type != "full_time":
        raise HTTPException(status_code=400, detail="Los contratos con código 4xx deben ser de jornada completa")
    if merged_contract_code == "300" and merged_working_day_type and merged_working_day_type != "fixed_discontinuous":
        raise HTTPException(status_code=400, detail="El contrato 300 debe ser fijo discontinuo")

    if new_status == "active":
        active_contract = db.query(Contract).filter(
            Contract.employee_id == db_contract.employee_id,
            Contract.status == "active",
            Contract.id != contract_id
        ).first()
        if active_contract:
            raise HTTPException(status_code=400, detail="El empleado ya tiene otro contrato activo")

    update_data = contract_data.model_dump(exclude_unset=True)
    update_data.pop("employee_id", None)

    for key, value in update_data.items():
        setattr(db_contract, key, value)

    db_contract.status = new_status
    db.commit()
    db.refresh(db_contract)
    return get_contract(db, db_contract.id)


def soft_delete_contract(db: Session, contract_id: int):
    db_contract = db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
        joinedload(Contract.work_center),
    ).filter(Contract.id == contract_id).first()

    if not db_contract:
        return None

    deleted_contract_response = contract_to_response(db_contract)
    db.delete(db_contract)
    db.commit()
    return deleted_contract_response
