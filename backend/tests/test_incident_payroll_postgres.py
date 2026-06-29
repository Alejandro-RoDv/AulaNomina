import os
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.incident_detail import IncidentDetail
from app.models.payroll import Payroll
from app.models.payroll_calculation_snapshot import PayrollCalculationSnapshot
from app.services.incident_payroll_orchestrator import process_payroll_incidents


DATABASE_URL = os.getenv("DATABASE_URL", "")


@unittest.skipUnless(DATABASE_URL.startswith("postgresql"), "Requiere PostgreSQL")
class IncidentPayrollPostgresIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        cls.Session = sessionmaker(bind=cls.engine, autoflush=False, expire_on_commit=False)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        db = self.Session()
        company = Company(name="Empresa PostgreSQL", cif="B38000001", is_active=True)
        db.add(company)
        db.flush()
        employee = Employee(
            employee_code="PG-001", company_id=company.id, dni="38000001F",
            first_name="Paula", last_name="Postgres", birth_date=date(1990, 1, 1),
            is_active=True, status="active",
        )
        db.add(employee)
        db.flush()
        contract = Contract(
            employee_id=employee.id, company_id=company.id, contract_type="100",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), status="active",
            salary_base=Decimal("3000"), partiality_coefficient=100,
            monthly_hours=150, monthly_or_daily_contribution="monthly",
        )
        db.add(contract)
        db.flush()
        payroll = Payroll(
            employee_id=employee.id, contract_id=contract.id, company_id=company.id,
            period_month=6, period_year=2026, base_salary=Decimal("3000"),
            salary_supplements=Decimal("300"), seniority_amount=Decimal("120"),
            variable_incentives=Decimal("90"), extra_pay_proration=Decimal("210"),
            status="draft",
        )
        db.add(payroll)
        db.commit()
        self.payroll_id = payroll.id
        self.contract_id = contract.id
        self.employee_id = employee.id
        self.company_id = company.id
        db.close()

    def test_concurrent_processing_allows_only_one_expected_version(self):
        barrier = threading.Barrier(2)

        def process(actor):
            db = self.Session()
            try:
                barrier.wait(timeout=10)
                return process_payroll_incidents(
                    db,
                    self.payroll_id,
                    actor=actor,
                    expected_version=0,
                )
            except HTTPException as error:
                return error.status_code, error.detail
            finally:
                db.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(process, ["one", "two"]))

        successes = [item for item in results if isinstance(item, dict)]
        conflicts = [item for item in results if isinstance(item, tuple)]
        self.assertEqual(len(successes), 1)
        self.assertEqual(successes[0]["calculation_version"], 1)
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0][0], 409)
        self.assertEqual(conflicts[0][1]["code"], "payroll_calculation_version_conflict")

        db = self.Session()
        self.assertEqual(
            db.query(PayrollCalculationSnapshot).filter(
                PayrollCalculationSnapshot.payroll_id == self.payroll_id
            ).count(),
            1,
        )
        db.close()

    def test_overlap_failure_rolls_back_all_persistence(self):
        db = self.Session()
        for incident_type, start, end in (
            ("AUSENCIA", date(2026, 6, 1), date(2026, 6, 10)),
            ("VACACIONES", date(2026, 6, 5), date(2026, 6, 8)),
        ):
            incident = Incident(
                employee_id=self.employee_id, contract_id=self.contract_id,
                company_id=self.company_id, incident_type=incident_type,
                start_date=start, end_date=end, status="open",
            )
            db.add(incident)
            db.flush()
            incident.detail = IncidentDetail(incident_id=incident.id, details={})
        db.commit()

        with self.assertRaises(HTTPException):
            process_payroll_incidents(db, self.payroll_id, expected_version=0)
        payroll = db.query(Payroll).filter(Payroll.id == self.payroll_id).first()
        self.assertEqual(payroll.calculation_version, 0)
        self.assertEqual(db.query(PayrollCalculationSnapshot).count(), 0)
        db.close()


if __name__ == "__main__":
    unittest.main()
