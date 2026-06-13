import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.crud.payroll import estimate_contract_annual_salary
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.services.contract_salary_summary_v2 import build_contract_salary_summary
from app.services.payroll_engine import calculate_contract_base_salary


class SalaryBaseSemanticsTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()

        company = Company(name="Empresa mensual", cif="B00000003", is_active=True)
        self.db.add(company)
        self.db.flush()
        employee = Employee(
            employee_code="EMP-MENSUAL",
            company_id=company.id,
            dni="00000003A",
            first_name="Marta",
            last_name="Mensual",
            birth_date=date(1990, 1, 1),
            is_active=True,
            status="active",
        )
        self.db.add(employee)
        self.db.flush()
        self.contract = Contract(
            employee_id=employee.id,
            company_id=company.id,
            contract_type="100",
            start_date=date(2026, 1, 1),
            status="active",
            salary_base=Decimal("1200.00"),
            partiality_coefficient=50,
            pay_schedule="prorated_12",
        )
        self.db.add(self.contract)
        self.db.commit()
        self.db.refresh(self.contract)

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_monthly_salary_is_adjusted_by_partiality(self):
        self.assertEqual(
            calculate_contract_base_salary(self.contract, 3),
            Decimal("600.00"),
        )

    def test_annual_estimate_uses_fourteen_monthly_payments(self):
        self.assertEqual(
            estimate_contract_annual_salary(self.contract),
            Decimal("8400.00"),
        )
        self.contract.gross_annual_salary = Decimal("9000.00")
        self.assertEqual(
            estimate_contract_annual_salary(self.contract),
            Decimal("9000.00"),
        )

    def test_prorated_summary_separates_ordinary_and_cash_monthly_amounts(self):
        summary = build_contract_salary_summary(self.db, self.contract.id)
        self.assertEqual(summary["ordinary_monthly_remuneration"], Decimal("600.00"))
        self.assertEqual(summary["annual_remuneration"], Decimal("8400.00"))
        self.assertEqual(summary["monthly_extra_pay_proration"], Decimal("100.00"))
        self.assertEqual(summary["monthly_remuneration"], Decimal("700.00"))


if __name__ == "__main__":
    unittest.main()
