import argparse
from datetime import date
from decimal import Decimal

from app.db import Base, SessionLocal, engine
from app.models import Company, Contract, Employee, Incident, Payroll, WorkCenter
from app.seed_demo_payroll_salary_structure import seed_demo_payroll_items


DEMO_COMPANY_CIF = "G14999999"
DEMO_PERIOD_MONTH = 5
DEMO_PERIOD_YEAR = 2026


def update_fields(instance, **fields):
    for field, value in fields.items():
        setattr(instance, field, value)
    return instance


def get_or_create_company(db):
    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    if company:
        return update_fields(
            company,
            name="Fundación AulaNomina",
            ccc="14000000001",
            address="Avenida de la Formación, 10",
            city="Córdoba",
            province="Córdoba",
            is_active=True,
        )

    company = Company(
        name="Fundación AulaNomina",
        cif=DEMO_COMPANY_CIF,
        ccc="14000000001",
        address="Avenida de la Formación, 10",
        city="Córdoba",
        province="Córdoba",
        is_active=True,
    )
    db.add(company)
    db.flush()
    return company


def get_or_create_center(db, company, center_code, **fields):
    center = db.query(WorkCenter).filter(WorkCenter.center_code == center_code).first()
    if center:
        return update_fields(center, company_id=company.id, **fields)

    center = WorkCenter(company_id=company.id, center_code=center_code, **fields)
    db.add(center)
    db.flush()
    return center


def get_or_create_employee(db, employee_code, dni, **fields):
    employee = db.query(Employee).filter(Employee.dni == dni).first()
    if not employee:
        employee = db.query(Employee).filter(Employee.employee_code == employee_code).first()

    if employee:
        return update_fields(employee, employee_code=employee_code, dni=dni, **fields)

    employee = Employee(employee_code=employee_code, dni=dni, **fields)
    db.add(employee)
    db.flush()
    return employee


def get_or_create_contract(db, employee, contract_type, start_date, **fields):
    contract = (
        db.query(Contract)
        .filter(
            Contract.employee_id == employee.id,
            Contract.contract_type == contract_type,
            Contract.start_date == start_date,
        )
        .first()
    )

    if contract:
        return update_fields(contract, contract_type=contract_type, start_date=start_date, **fields)

    contract = Contract(
        employee_id=employee.id,
        contract_type=contract_type,
        start_date=start_date,
        **fields,
    )
    db.add(contract)
    db.flush()
    return contract


def get_or_create_incident(db, employee, contract, incident_type, start_date, **fields):
    incident = (
        db.query(Incident)
        .filter(
            Incident.employee_id == employee.id,
            Incident.contract_id == contract.id,
            Incident.incident_type == incident_type,
            Incident.start_date == start_date,
        )
        .first()
    )

    if incident:
        return update_fields(
            incident,
            employee_id=employee.id,
            contract_id=contract.id,
            incident_type=incident_type,
            start_date=start_date,
            **fields,
        )

    incident = Incident(
        employee_id=employee.id,
        contract_id=contract.id,
        incident_type=incident_type,
        start_date=start_date,
        **fields,
    )
    db.add(incident)
    db.flush()
    return incident


def calculate_payroll_values(contract, supplement=Decimal("0.00"), irpf_rate=Decimal("0.12")):
    base_salary = Decimal(contract.salary_base or 0).quantize(Decimal("0.01"))
    salary_supplements = Decimal(supplement).quantize(Decimal("0.01"))
    extra_pay_proration = Decimal("0.00")
    gross_salary = base_salary + salary_supplements + extra_pay_proration
    employee_social_security = (gross_salary * Decimal("0.0647")).quantize(Decimal("0.01"))
    irpf = (gross_salary * irpf_rate).quantize(Decimal("0.01"))
    total_deductions = employee_social_security + irpf
    net_salary = gross_salary - total_deductions

    return {
        "base_salary": base_salary,
        "salary_supplements": salary_supplements,
        "extra_pay_proration": extra_pay_proration,
        "gross_salary": gross_salary,
        "employee_social_security": employee_social_security,
        "irpf": irpf,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "status": "draft",
    }


def get_or_create_payroll(db, employee, contract, company, center, supplement=Decimal("0.00"), irpf_rate=Decimal("0.12")):
    values = calculate_payroll_values(contract, supplement, irpf_rate)
    payroll = (
        db.query(Payroll)
        .filter(
            Payroll.employee_id == employee.id,
            Payroll.contract_id == contract.id,
            Payroll.period_month == DEMO_PERIOD_MONTH,
            Payroll.period_year == DEMO_PERIOD_YEAR,
        )
        .first()
    )

    fields = {
        "employee_id": employee.id,
        "contract_id": contract.id,
        "company_id": company.id,
        "center_id": center.id if center else None,
        "period_month": DEMO_PERIOD_MONTH,
        "period_year": DEMO_PERIOD_YEAR,
        **values,
    }

    if payroll:
        return update_fields(payroll, **fields)

    payroll = Payroll(**fields)
    db.add(payroll)
    db.flush()
    return payroll


def reset_only_demo_data(db):
    """Delete only the controlled demo dataset, never the full business tables."""

    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    demo_employee_ids = [
        row[0]
        for row in db.query(Employee.id)
        .filter(Employee.dni.in_(["10000001A", "10000002B", "10000003C", "10000004D", "10000005E"]))
        .all()
    ]

    if company:
        db.query(Payroll).filter(Payroll.company_id == company.id).delete(synchronize_session=False)
        db.query(Incident).filter(Incident.company_id == company.id).delete(synchronize_session=False)
        db.query(Contract).filter(Contract.company_id == company.id).delete(synchronize_session=False)
        db.query(Employee).filter(Employee.company_id == company.id).delete(synchronize_session=False)
        db.query(WorkCenter).filter(WorkCenter.company_id == company.id).delete(synchronize_session=False)
        db.delete(company)
    elif demo_employee_ids:
        db.query(Payroll).filter(Payroll.employee_id.in_(demo_employee_ids)).delete(synchronize_session=False)
        db.query(Incident).filter(Incident.employee_id.in_(demo_employee_ids)).delete(synchronize_session=False)
        db.query(Contract).filter(Contract.employee_id.in_(demo_employee_ids)).delete(synchronize_session=False)
        db.query(Employee).filter(Employee.id.in_(demo_employee_ids)).delete(synchronize_session=False)

    db.commit()


def seed_demo_data(reset=False):
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if reset:
            reset_only_demo_data(db)

        company = get_or_create_company(db)
        db.flush()

        san_rafael = get_or_create_center(
            db,
            company,
            "1.1",
            name="Colegio San Rafael",
            general_ccc="14000000001",
            main_ccc="14000000011",
            address="Calle San Rafael, 4",
            city="Córdoba",
            province="Córdoba",
            is_active=True,
        )
        trinidad = get_or_create_center(
            db,
            company,
            "1.2",
            name="Colegio Trinidad",
            general_ccc="14000000001",
            main_ccc="14000000012",
            address="Calle Trinidad, 8",
            city="Córdoba",
            province="Córdoba",
            is_active=True,
        )
        db.flush()

        employees = {
            "laura": get_or_create_employee(
                db,
                "1.1",
                "10000001A",
                company_id=company.id,
                center_id=san_rafael.id,
                naf="141000000001",
                first_name="Laura",
                last_name="Martín Ruiz",
                email="laura.martin@aulanomina.demo",
                phone="600100001",
                birth_date=date(1989, 3, 14),
                address="Calle Demo, 1",
                city="Córdoba",
                province="Córdoba",
                postal_code="14001",
                is_active=True,
                status="active",
            ),
            "javier": get_or_create_employee(
                db,
                "1.2",
                "10000002B",
                company_id=company.id,
                center_id=san_rafael.id,
                naf="141000000002",
                first_name="Javier",
                last_name="Romero Sánchez",
                email="javier.romero@aulanomina.demo",
                phone="600100002",
                birth_date=date(1992, 7, 9),
                address="Calle Demo, 2",
                city="Córdoba",
                province="Córdoba",
                postal_code="14002",
                is_active=True,
                status="active",
            ),
            "carmen": get_or_create_employee(
                db,
                "1.3",
                "10000003C",
                company_id=company.id,
                center_id=trinidad.id,
                naf="141000000003",
                first_name="Carmen",
                last_name="López Torres",
                email="carmen.lopez@aulanomina.demo",
                phone="600100003",
                birth_date=date(1985, 11, 22),
                address="Calle Demo, 3",
                city="Córdoba",
                province="Córdoba",
                postal_code="14003",
                is_active=True,
                status="active",
            ),
            "manuel": get_or_create_employee(
                db,
                "1.4",
                "10000004D",
                company_id=company.id,
                center_id=trinidad.id,
                naf="141000000004",
                first_name="Manuel",
                last_name="García Molina",
                email="manuel.garcia@aulanomina.demo",
                phone="600100004",
                birth_date=date(1996, 1, 18),
                address="Calle Demo, 4",
                city="Córdoba",
                province="Córdoba",
                postal_code="14004",
                is_active=False,
                status="inactive",
            ),
            "ana": get_or_create_employee(
                db,
                "1.5",
                "10000005E",
                company_id=company.id,
                center_id=trinidad.id,
                naf="141000000005",
                first_name="Ana",
                last_name="Pérez Navarro",
                email="ana.perez@aulanomina.demo",
                phone="600100005",
                birth_date=date(1994, 5, 30),
                address="Calle Demo, 5",
                city="Córdoba",
                province="Córdoba",
                postal_code="14005",
                is_active=True,
                status="active",
            ),
        }
        db.flush()

        contracts = {
            "laura_old": get_or_create_contract(
                db,
                employees["laura"],
                "Temporal",
                date(2024, 9, 1),
                company_id=company.id,
                center_id=san_rafael.id,
                end_date=date(2025, 8, 31),
                status="ended",
                salary_base=Decimal("1550.00"),
                pay_schedule="not_prorated_14",
            ),
            "laura": get_or_create_contract(
                db,
                employees["laura"],
                "Indefinido",
                date(2025, 9, 1),
                company_id=company.id,
                center_id=san_rafael.id,
                end_date=None,
                status="active",
                salary_base=Decimal("1680.00"),
                pay_schedule="not_prorated_14",
            ),
            "javier": get_or_create_contract(
                db,
                employees["javier"],
                "Temporal",
                date(2026, 1, 8),
                company_id=company.id,
                center_id=san_rafael.id,
                end_date=date(2026, 6, 30),
                status="active",
                salary_base=Decimal("1450.00"),
                pay_schedule="not_prorated_14",
            ),
            "carmen": get_or_create_contract(
                db,
                employees["carmen"],
                "Indefinido",
                date(2023, 9, 1),
                company_id=company.id,
                center_id=trinidad.id,
                end_date=None,
                status="active",
                salary_base=Decimal("1825.00"),
                pay_schedule="not_prorated_14",
            ),
            "manuel": get_or_create_contract(
                db,
                employees["manuel"],
                "Temporal",
                date(2025, 9, 15),
                company_id=company.id,
                center_id=trinidad.id,
                end_date=date(2026, 4, 30),
                status="ended",
                salary_base=Decimal("1320.00"),
                pay_schedule="not_prorated_14",
            ),
            "ana": get_or_create_contract(
                db,
                employees["ana"],
                "Sustitución",
                date(2026, 3, 10),
                company_id=company.id,
                center_id=trinidad.id,
                end_date=None,
                status="active",
                salary_base=Decimal("1510.00"),
                pay_schedule="not_prorated_14",
            ),
        }
        db.flush()

        get_or_create_incident(
            db,
            employees["javier"],
            contracts["javier"],
            "IT común",
            date(2026, 5, 6),
            company_id=company.id,
            center_id=san_rafael.id,
            end_date=date(2026, 5, 13),
            description="Baja médica por contingencia común. Caso demo para cálculo de nómina.",
            status="closed",
        )
        get_or_create_incident(
            db,
            employees["carmen"],
            contracts["carmen"],
            "Vacaciones",
            date(2026, 5, 20),
            company_id=company.id,
            center_id=trinidad.id,
            end_date=date(2026, 5, 24),
            description="Vacaciones comunicadas y aprobadas por el centro.",
            status="closed",
        )
        get_or_create_incident(
            db,
            employees["ana"],
            contracts["ana"],
            "Ausencia justificada",
            date(2026, 5, 27),
            company_id=company.id,
            center_id=trinidad.id,
            end_date=date(2026, 5, 27),
            description="Ausencia justificada por cita médica.",
            status="open",
        )

        get_or_create_payroll(db, employees["laura"], contracts["laura"], company, san_rafael, Decimal("85.00"), Decimal("0.13"))
        get_or_create_payroll(db, employees["javier"], contracts["javier"], company, san_rafael, Decimal("0.00"), Decimal("0.10"))
        get_or_create_payroll(db, employees["carmen"], contracts["carmen"], company, trinidad, Decimal("120.00"), Decimal("0.14"))
        get_or_create_payroll(db, employees["ana"], contracts["ana"], company, trinidad, Decimal("40.00"), Decimal("0.11"))

        payroll_seed_result = seed_demo_payroll_items(db)

        db.commit()

        action = "reiniciada" if reset else "insertada/actualizada"
        print(f"Demo AulaNomina {action} correctamente.")
        print("Modo seguro: por defecto no se borran datos existentes.")
        print("Empresa: Fundación AulaNomina")
        print("Centros: Colegio San Rafael, Colegio Trinidad")
        print("Trabajadores demo: 5")
        print("Contratos demo: 6")
        print("Incidencias demo: 3")
        print("Nóminas demo mayo 2026: 4")
        print(f"Conceptos salariales demo: {payroll_seed_result['concepts']}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Carga datos demo controlados de AulaNomina.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Borra solo los datos demo de Fundación AulaNomina antes de volver a cargarlos.",
    )
    args = parser.parse_args()

    seed_demo_data(reset=args.reset)
