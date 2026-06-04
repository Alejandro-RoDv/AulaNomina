import re
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.employee import Employee
from app.models.employee_assignment_history import EmployeeAssignmentHistory
from app.schemas.employee import EmployeeCreate, EmployeeUpdate


def get_employee_by_code(db: Session, employee_code: str):
    return db.query(Employee).filter(Employee.employee_code == employee_code).first()


def get_employee_by_dni(db: Session, dni: str):
    return db.query(Employee).filter(Employee.dni == dni).first()


def get_employees_by_dni(db: Session, dni: str):
    return db.query(Employee).filter(Employee.dni == dni).order_by(Employee.id.desc()).all()


def get_employee_by_email(db: Session, email: str):
    return db.query(Employee).filter(Employee.email == email).first()


def get_employee_by_naf(db: Session, naf: str):
    return db.query(Employee).filter(Employee.naf == naf).first()


def get_employee_identity_conflict(db: Session, employee: EmployeeCreate, exclude_employee_id: int | None = None):
    query = db.query(Employee)

    if exclude_employee_id is not None:
        query = query.filter(Employee.id != exclude_employee_id)

    if employee.company_id is not None:
        query = query.filter(Employee.company_id == employee.company_id)

    identity_filters = []
    if employee.dni:
        identity_filters.append(Employee.dni == employee.dni)
    if employee.naf:
        identity_filters.append(Employee.naf == employee.naf)
    if employee.email:
        identity_filters.append(Employee.email == employee.email)

    if not identity_filters:
        return None

    combined_filter = identity_filters[0]
    for identity_filter in identity_filters[1:]:
        combined_filter = combined_filter | identity_filter

    return query.filter(combined_filter).first()


def parse_employee_code(value: str | None):
    if not value:
        return None

    cleaned_value = value.strip().upper()

    if cleaned_value.isdigit():
        return int(cleaned_value)

    match = re.fullmatch(r"EMP0*(\d+)", cleaned_value)
    if match:
        return int(match.group(1))

    return None


def get_next_employee_code(db: Session):
    employees = db.query(Employee.employee_code).all()
    used_numbers = set()

    for (employee_code,) in employees:
        parsed_code = parse_employee_code(employee_code)
        if parsed_code is not None:
            used_numbers.add(parsed_code)

    next_number = 1
    while next_number in used_numbers:
        next_number += 1

    return str(next_number)


def close_current_assignment(db: Session, employee_id: int, movement_date: date):
    current_assignment = (
        db.query(EmployeeAssignmentHistory)
        .filter(
            EmployeeAssignmentHistory.employee_id == employee_id,
            EmployeeAssignmentHistory.end_date.is_(None),
        )
        .order_by(EmployeeAssignmentHistory.start_date.desc())
        .first()
    )

    if current_assignment:
        current_assignment.end_date = movement_date - timedelta(days=1)


def create_assignment_history(db: Session, employee: Employee, movement_date: date, notes: str):
    if employee.company_id is None:
        return

    assignment = EmployeeAssignmentHistory(
        employee_id=employee.id,
        company_id=employee.company_id,
        center_id=employee.center_id,
        start_date=movement_date,
        notes=notes,
    )
    db.add(assignment)


def create_employee(db: Session, employee: EmployeeCreate):
    employee_data = employee.model_dump()
    employee_data["employee_code"] = get_next_employee_code(db)

    db_employee = Employee(**employee_data)
    db.add(db_employee)
    db.flush()

    if db_employee.company_id is not None:
        create_assignment_history(
            db,
            db_employee,
            date.today(),
            "Alta inicial del trabajador en empresa/centro.",
        )

    db.commit()
    db.refresh(db_employee)
    return db_employee


def get_employees_all(db: Session):
    return db.query(Employee).order_by(Employee.id.desc()).all()


def get_employees(db: Session):
    return db.query(Employee).order_by(Employee.id.desc()).all()


def get_employee(db: Session, employee_id: int):
    return db.query(Employee).filter(Employee.id == employee_id).first()


def get_employee_assignment_history(db: Session, employee_id: int):
    return (
        db.query(EmployeeAssignmentHistory)
        .filter(EmployeeAssignmentHistory.employee_id == employee_id)
        .order_by(EmployeeAssignmentHistory.start_date.desc(), EmployeeAssignmentHistory.id.desc())
        .all()
    )


def update_employee(db: Session, employee_id: int, employee_data: EmployeeUpdate):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        return None

    old_company_id = employee.company_id
    old_center_id = employee.center_id

    update_data = employee_data.model_dump(exclude_unset=True)
    update_data.pop("employee_code", None)

    for field, value in update_data.items():
        setattr(employee, field, value)

    company_changed = "company_id" in update_data and employee.company_id != old_company_id
    center_changed = "center_id" in update_data and employee.center_id != old_center_id

    if company_changed or center_changed:
        movement_date = date.today()
        close_current_assignment(db, employee.id, movement_date)
        create_assignment_history(
            db,
            employee,
            movement_date,
            "Cambio de empresa/centro registrado desde edición del trabajador.",
        )

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
