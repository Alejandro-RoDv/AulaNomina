import re

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate

EMPLOYEE_CODE_PREFIX = "EMP"
EMPLOYEE_CODE_DIGITS = 3


def get_employee_by_code(db: Session, employee_code: str):
    return db.query(Employee).filter(Employee.employee_code == employee_code).first()


def get_employee_by_dni(db: Session, dni: str):
    return db.query(Employee).filter(Employee.dni == dni).first()


def get_employee_by_email(db: Session, email: str):
    return db.query(Employee).filter(Employee.email == email).first()


def get_employee_by_naf(db: Session, naf: str):
    return db.query(Employee).filter(Employee.naf == naf).first()


def get_next_employee_code(db: Session):
    employees = db.query(Employee.employee_code).all()
    used_numbers = set()

    for (employee_code,) in employees:
        if not employee_code:
            continue

        match = re.fullmatch(rf"{EMPLOYEE_CODE_PREFIX}(\d+)", employee_code.strip().upper())
        if match:
            used_numbers.add(int(match.group(1)))

    next_number = 1
    while next_number in used_numbers:
        next_number += 1

    return f"{EMPLOYEE_CODE_PREFIX}{next_number:0{EMPLOYEE_CODE_DIGITS}d}"


def create_employee(db: Session, employee: EmployeeCreate):
    employee_data = employee.model_dump()
    employee_data["employee_code"] = get_next_employee_code(db)

    db_employee = Employee(**employee_data)
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


def get_employees_all(db: Session):
    return db.query(Employee).order_by(Employee.id.desc()).all()


def get_employees(db: Session):
    return db.query(Employee).order_by(Employee.id.desc()).all()


def get_employee(db: Session, employee_id: int):
    return db.query(Employee).filter(Employee.id == employee_id).first()


def update_employee(db: Session, employee_id: int, employee_data: EmployeeUpdate):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return None

    update_data = employee_data.model_dump(exclude_unset=True)
    update_data.pop("employee_code", None)

    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return employee


def soft_delete_employee(db: Session, employee_id: int):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return None

    db.query(Contract).filter(Contract.employee_id == employee_id).delete(synchronize_session=False)
    db.delete(employee)
    db.commit()
    return employee
