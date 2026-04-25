from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.contract import Contract
from app.models.employee import Employee
from app.schemas.contract import ContractCreate, ContractUpdate


def create_contract(db: Session, contract: ContractCreate):
    employee = db.query(Employee).filter(Employee.id == contract.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    if contract.end_date and contract.end_date < contract.start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date no puede ser menor que start_date"
        )

    status = contract.status
    if contract.end_date:
        status = "ended"

    if status == "active":
        active_contract = db.query(Contract).filter(
            Contract.employee_id == contract.employee_id,
            Contract.status == "active"
        ).first()

        if active_contract:
            raise HTTPException(
                status_code=400,
                detail="El empleado ya tiene un contrato activo"
            )

    db_contract = Contract(
        employee_id=contract.employee_id,
        contract_type=contract.contract_type,
        start_date=contract.start_date,
        end_date=contract.end_date,
        status=status,
        salary_base=contract.salary_base,
    )

    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return db_contract


def get_contracts(db: Session):
    return db.query(Contract).filter(Contract.status != "deleted").all()


def get_contract(db: Session, contract_id: int):
    return db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.status != "deleted"
    ).first()


def get_contracts_by_employee(db: Session, employee_id: int):
    return db.query(Contract).filter(
        Contract.employee_id == employee_id,
        Contract.status != "deleted"
    ).all()


def update_contract(db: Session, contract_id: int, contract_data: ContractUpdate):
    db_contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.status != "deleted"
    ).first()

    if not db_contract:
        return None

    new_start_date = contract_data.start_date if contract_data.start_date is not None else db_contract.start_date
    new_end_date = contract_data.end_date if contract_data.end_date is not None else db_contract.end_date
    new_status = contract_data.status if contract_data.status is not None else db_contract.status

    if new_end_date and new_end_date < new_start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date no puede ser menor que start_date"
        )

    if new_end_date:
        new_status = "ended"

    if new_status == "active":
        active_contract = db.query(Contract).filter(
            Contract.employee_id == db_contract.employee_id,
            Contract.status == "active",
            Contract.id != contract_id
        ).first()

        if active_contract:
            raise HTTPException(
                status_code=400,
                detail="El empleado ya tiene otro contrato activo"
            )

    update_data = contract_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_contract, key, value)

    db_contract.status = new_status

    db.commit()
    db.refresh(db_contract)
    return db_contract


def soft_delete_contract(db: Session, contract_id: int):
    db_contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.status != "deleted"
    ).first()

    if not db_contract:
        return None

    db_contract.status = "deleted"
    db.commit()
    db.refresh(db_contract)
    return db_contract