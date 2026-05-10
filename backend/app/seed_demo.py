from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db import Base, SessionLocal, engine
from app.models import Company, Contract, Employee, Incident, Payroll, WorkCenter


DEMO_PERIOD_MONTH = 5
DEMO_PERIOD_YEAR = 2026


def reset_demo_data(db):
    """Clean demo business tables before loading the controlled dataset."""

    try:
        db.execute(
            text(
                """
                TRUNCATE TABLE
                    payrolls,
                    incidents,
                    contracts,
                    employees,
                    work_centers,
                    companies
                RESTART IDENTITY CASCADE
                """
            )
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()

        # Fallback for local databases that do not support PostgreSQL TRUNCATE.
        for model in (Payroll, Incident, Contract, Employee, WorkCenter, Company):
            db.query(model).delete()
        db.commit()


def build_payroll(employee, contract, company, center, supplement=Decimal("0.00"), irpf_rate=Decimal("0.12")):
    base_salary = Decimal(contract.salary_base or 0).quantize(Decimal("0.01"))
    salary_supplements = Decimal(supplement).quantize(Decimal("0.01"))
    extra_pay_proration = Decimal("0.00")
    gross_salary = base_salary + salary_supplements + extra_pay_proration
    employee_social_security = (gross_salary * Decimal("0.0647")).quantize(Decimal("0.01"))
    irpf = (gross_salary * irpf_rate).quantize(Decimal("0.01"))
    total_deductions = employee_social_security + irpf
    net_salary = gross_salary - total_deductions

    return Payroll(
        employee_id=employee.id,
        contract_id=contract.id,
        company_id=company.id,
        center_id=center.id if center else None,
        period_month=DEMO_PERIOD_MONTH,
        period_year=DEMO_PERIOD_YEAR,
        base_salary=base_salary,
        salary_supplements=salary_supplements,
        extra_pay_proration=extra_pay_proration,
        gross_salary=gross_salary,
        employee_social_security=employee_social_security,
        irpf=irpf,
        total_deductions=total_deductions,
        net_salary=net_salary,
        status="draft",
    )


def seed_demo_data():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        reset_demo_data(db)

        company = Company(
            name="Fundación AulaNomina",
            cif="G14999999",
            ccc="14000000001",
            address="Avenida de la Formación, 10",
            city="Córdoba",
            province="Córdoba",
            is_active=True,
        )
        db.add(company)
        db.flush()

        san_rafael = WorkCenter(
            company_id=company.id,
            center_code="1.1",
            name="Colegio San Rafael",
            general_ccc="14000000001",
            main_ccc="14000000011",
            address="Calle San Rafael, 4",
            city="Córdoba",
            province="Córdoba",
            is_active=True,
        )
        trinidad = WorkCenter(
            company_id=company.id,
            center_code="1.2",
            name="Colegio Trinidad",
            general_ccc="14000000001",
            main_ccc="14000000012",
            address="Calle Trinidad, 8",
            city="Córdoba",
            province="Córdoba",
            is_active=True,
        )
        db.add_all([san_rafael, trinidad])
        db.flush()

        employees = {
            "laura": Employee(
                employee_code="1.1",
                company_id=company.id,
                center_id=san_rafael.id,
                dni="10000001A",
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
            "javier": Employee(
                employee_code="1.2",
                company_id=company.id,
                center_id=san_rafael.id,
                dni="10000002B",
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
            "carmen": Employee(
                employee_code="1.3",
                company_id=company.id,
                center_id=trinidad.id,
                dni="10000003C",
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
            "manuel": Employee(
                employee_code="1.4",
                company_id=company.id,
                center_id=trinidad.id,
                dni="10000004D",
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
            "ana": Employee(
                employee_code="1.5",
                company_id=company.id,
                center_id=trinidad.id,
                dni="10000005E",
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
        db.add_all(employees.values())
        db.flush()

        contracts = {
            "laura_old": Contract(
                employee_id=employees["laura"].id,
                company_id=company.id,
                center_id=san_rafael.id,
                contract_type="Temporal",
                start_date=date(2024, 9, 1),
                end_date=date(2025, 8, 31),
                status="ended",
                salary_base=Decimal("1550.00"),
                pay_schedule="not_prorated_14",
            ),
            "laura": Contract(
                employee_id=employees["laura"].id,
                company_id=company.id,
                center_id=san_rafael.id,
                contract_type="Indefinido",
                start_date=date(2025, 9, 1),
                end_date=None,
                status="active",
                salary_base=Decimal("1680.00"),
                pay_schedule="not_prorated_14",
            ),
            "javier": Contract(
                employee_id=employees["javier"].id,
                company_id=company.id,
                center_id=san_rafael.id,
                contract_type="Temporal",
                start_date=date(2026, 1, 8),
                end_date=date(2026, 6, 30),
                status="active",
                salary_base=Decimal("1450.00"),
                pay_schedule="not_prorated_14",
            ),
            "carmen": Contract(
                employee_id=employees["carmen"].id,
                company_id=company.id,
                center_id=trinidad.id,
                contract_type="Indefinido",
                start_date=date(2023, 9, 1),
                end_date=None,
                status="active",
                salary_base=Decimal("1825.00"),
                pay_schedule="not_prorated_14",
            ),
            "manuel": Contract(
                employee_id=employees["manuel"].id,
                company_id=company.id,
                center_id=trinidad.id,
                contract_type="Temporal",
                start_date=date(2025, 9, 15),
                end_date=date(2026, 4, 30),
                status="ended",
                salary_base=Decimal("1320.00"),
                pay_schedule="not_prorated_14",
            ),
            "ana": Contract(
                employee_id=employees["ana"].id,
                company_id=company.id,
                center_id=trinidad.id,
                contract_type="Sustitución",
                start_date=date(2026, 3, 10),
                end_date=None,
                status="active",
                salary_base=Decimal("1510.00"),
                pay_schedule="not_prorated_14",
            ),
        }
        db.add_all(contracts.values())
        db.flush()

        incidents = [
            Incident(
                employee_id=employees["javier"].id,
                contract_id=contracts["javier"].id,
                company_id=company.id,
                center_id=san_rafael.id,
                incident_type="IT común",
                start_date=date(2026, 5, 6),
                end_date=date(2026, 5, 13),
                description="Baja médica por contingencia común. Caso demo para cálculo de nómina.",
                status="closed",
            ),
            Incident(
                employee_id=employees["carmen"].id,
                contract_id=contracts["carmen"].id,
                company_id=company.id,
                center_id=trinidad.id,
                incident_type="Vacaciones",
                start_date=date(2026, 5, 20),
                end_date=date(2026, 5, 24),
                description="Vacaciones comunicadas y aprobadas por el centro.",
                status="closed",
            ),
            Incident(
                employee_id=employees["ana"].id,
                contract_id=contracts["ana"].id,
                company_id=company.id,
                center_id=trinidad.id,
                incident_type="Ausencia justificada",
                start_date=date(2026, 5, 27),
                end_date=date(2026, 5, 27),
                description="Ausencia justificada por cita médica.",
                status="open",
            ),
        ]
        db.add_all(incidents)

        payrolls = [
            build_payroll(employees["laura"], contracts["laura"], company, san_rafael, Decimal("85.00"), Decimal("0.13")),
            build_payroll(employees["javier"], contracts["javier"], company, san_rafael, Decimal("0.00"), Decimal("0.10")),
            build_payroll(employees["carmen"], contracts["carmen"], company, trinidad, Decimal("120.00"), Decimal("0.14")),
            build_payroll(employees["ana"], contracts["ana"], company, trinidad, Decimal("40.00"), Decimal("0.11")),
        ]
        db.add_all(payrolls)
        db.commit()

        print("Demo AulaNomina reiniciada correctamente.")
        print("Empresa: Fundación AulaNomina")
        print("Centros: Colegio San Rafael, Colegio Trinidad")
        print("Trabajadores: 5")
        print("Contratos: 6")
        print("Incidencias: 3")
        print("Nóminas mayo 2026: 4")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
