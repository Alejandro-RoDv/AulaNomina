import unittest
from datetime import date
from decimal import Decimal

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
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.incident_regulatory_base import resolve_advanced_regulatory_daily_base


class AdvancedRegulatoryBaseTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        Base.metadata.create_all(self.engine)
        company = Company(name="Empresa bases", cif="B35000001", is_active=True)
        self.db.add(company)
        self.db.flush()
        employee = Employee(
            employee_code="BR-001",
            company_id=company.id,
            dni="35000001C",
            first_name="Eva",
            last_name="Bases",
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
            end_date=date(2026, 12, 31),
            status="active",
            salary_base=Decimal("3000"),
            partiality_coefficient=100,
            monthly_hours=150,
            monthly_or_daily_contribution="monthly",
        )
        self.db.add(self.contract)
        self.db.commit()
        self.company_id = company.id
        self.employee_id = employee.id

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def payroll(self, month, common="3000", professional="3000"):
        row = Payroll(
            employee_id=self.employee_id,
            contract_id=self.contract.id,
            company_id=self.company_id,
            period_month=month,
            period_year=2026,
            base_salary=Decimal("3000"),
            common_contingencies_base=Decimal(common),
            professional_contingencies_base=Decimal(professional),
            unemployment_training_fogasa_base=Decimal(professional),
            contribution_days=30,
            status="closed",
        )
        self.db.add(row)
        self.db.flush()
        return row

    def incident(self, start, process_type):
        row = Incident(
            employee_id=self.employee_id,
            contract_id=self.contract.id,
            company_id=self.company_id,
            incident_type="IT",
            start_date=start,
            end_date=start,
            status="open",
        )
        self.db.add(row)
        self.db.flush()
        row.detail = IncidentDetail(
            incident_id=row.id,
            details={"process_type": process_type},
        )
        self.db.flush()
        return row

    def test_part_time_uses_up_to_three_previous_months(self):
        self.contract.partiality_coefficient = 50
        self.contract.working_day_type = "part_time"
        self.payroll(1, common="1550")
        self.payroll(2, common="1400")
        self.payroll(3, common="1550")
        incident = self.incident(date(2026, 4, 10), "common_disease")
        self.db.commit()

        value, source, warnings = resolve_advanced_regulatory_daily_base(
            self.db,
            self.contract,
            incident,
            {"regulatory_base": "common"},
            Decimal("50"),
        )

        self.assertEqual(value, Decimal("50.0000"))
        self.assertEqual(source, "part_time_three_month_average")
        self.assertTrue(warnings)

    def test_professional_base_adds_overtime_average(self):
        payroll = self.payroll(5, professional="3000")
        concept = PayrollConcept(
            code="TEST_OVERTIME_ADV",
            name="Horas extra test",
            category="HORAS_EXTRA",
            concept_type="DEVENGO",
            salary_nature="SALARIAL",
            source_type="SYSTEM",
            calculation_type="FIXED_AMOUNT",
            is_system=True,
            is_taxable=True,
            is_contribution_base=False,
            is_active=True,
        )
        self.db.add(concept)
        self.db.flush()
        self.db.add(PayrollItem(
            payroll_id=payroll.id,
            concept_id=concept.id,
            quantity=1,
            unit_price=Decimal("365"),
            amount=Decimal("365"),
        ))
        incident = self.incident(date(2026, 6, 10), "work_accident")
        self.db.commit()

        value, source, warnings = resolve_advanced_regulatory_daily_base(
            self.db,
            self.contract,
            incident,
            {"regulatory_base": "professional"},
            Decimal("100"),
        )

        self.assertEqual(value, Decimal("101.0000"))
        self.assertIn("overtime_12m", source)
        self.assertTrue(warnings)


if __name__ == "__main__":
    unittest.main()
