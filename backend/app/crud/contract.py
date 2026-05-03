from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.contract import Contract
from app.models.employee import Employee
from app.models.company import Company
from app.schemas.contract import ContractCreate, ContractUpdate


def contract_to_response(contract: Contract):
    return {
        "id": contract.id,
        "employee_id": contract.employee_id,
        "company_id": contract.company_id,
        "employee_name": contract.employee_name,
        "company_name": contract.company_name,
        "contract_type": contract.contract_type,
        "start_date": contract.start_date,
        "end_date": contract.end_date,
        "status": contract.status,
        "salary_base": contract.salary_base,
        "created_at": contract.created_at,
    }


def create_contract(db: Session, contract: ContractCreate):
    employee = db.query(Employee).filter(Employee.id == contract.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    if contract.company_id is not None:
        company = db.query(Company).filter(
            Company.id == contract.company_id,
            Company.is_active == True,
        ).first()
        if not company:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if contract.end_date and contract.end_date < contract.start_date:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")

    status = contract.status
    if contract.end_date:
        status = "ended"

    if status == "active":
        active_contract = db.query(Contract).filter(
            Contract.employee_id == contract.employee_id,
            Contract.status == "active"
        ).first()
        if active_contract:
            raise HTTPException(status_code=400, detail="El empleado ya tiene un contrato activo")

    db_contract = Contract(
        employee_id=contract.employee_id,
        company_id=contract.company_id,
        contract_type=contract.contract_type,
        start_date=contract.start_date,
        end_date=contract.end_date,
        status=status,
        salary_base=contract.salary_base,
    )

    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return get_contract(db, db_contract.id)


def get_contracts(db: Session):
    return db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
    ).all()


def get_contract(db: Session, contract_id: int):
    return db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
    ).filter(Contract.id == contract_id).first()


def get_contracts_by_employee(db: Session, employee_id: int):
    return db.query(Contract).options(
        joinedload(Contract.employee),
        joinedload(Contract.company),
    ).filter(Contract.employee_id == employee_id).all()


def update_contract(db: Session, contract_id: int, contract_data: ContractUpdate):
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract:
        return None

    if contract_data.company_id is not None:
        company = db.query(Company).filter(Company.id == contract_data.company_id, Company.is_active == True).first()
        if not company:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")

    new_start_date = contract_data.start_date if contract_data.start_date is not None else db_contract.start_date
    new_end_date = contract_data.end_date if contract_data.end_date is not None else db_contract.end_date
    new_status = contract_data.status if contract_data.status is not None else db_contract.status

    if new_end_date and new_end_date < new_start_date:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")

    if new_end_date:
        new_status = "ended"

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
    ).filter(Contract.id == contract_id).first()

    if not db_contract:
        return None

    deleted_contract_response = contract_to_response(db_contract)
    db.delete(db_contract)
    db.commit()
    return deleted_contract_response
