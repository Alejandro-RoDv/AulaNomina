from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate


def get_employee_by_code(db: Session, employee_code: str):
    return db.query(Employee).filter(Employee.employee_code == employee_code).first()


def get_employee_by_dni(db: Session, dni: str):
    return db.query(Employee).filter(Employee.dni == dni).first()


def get_employee_by_email(db: Session, email: str):
    return db.query(Employee).filter(Employee.email == email).first()


def create_employee(db: Session, employee: EmployeeCreate):
    db_employee = Employee(**employee.model_dump())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


def get_employees_all(db: Session):
    return db.query(Employee).order_by(Employee.id.desc()).all()


def get_employees(db: Session):
    return (
        db.query(Employee)
        .filter(Employee.is_active.is_(True))
        .order_by(Employee.id.desc())
        .all()
    )


def get_employee(db: Session, employee_id: int):
    return db.query(Employee).filter(Employee.id == employee_id).first()


def update_employee(db: Session, employee_id: int, employee_data: EmployeeUpdate):
    employee = get_employee(db, employee_id)
    if not employee:
        return None

    update_data = employee_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return employee


def soft_delete_employee(db: Session, employee_id: int):
    employee = get_employee(db, employee_id)
    if not employee:
        return None

    employee.is_active = False
    db.commit()
    db.refresh(employee)
    return employee
