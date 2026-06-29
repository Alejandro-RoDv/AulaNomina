import unittest
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
from app.services.incident_payroll_orchestrator import (
    calculate_payroll_incidents,
    process_payroll_incidents,
    update_contribution_base_overrides,
)


class IncidentPayrollStabilityTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        Base.metadata.create_all(self.engine)
        company = Company(name="Empresa estable", cif="B37000001", is_active=True)
        self.db.add(company)
        self.db.flush()
        employee = Employee(
            employee_code="STABLE-001", company_id=company.id, dni="37000001E",
            first_name="Nora", last_name="Estable", birth_date=date(1990, 1, 1),
            is_active=True, status="active",
        )
        self.db.add(employee)
        self.db.flush()
        self.contract = Contract(
            employee_id=employee.id, company_id=company.id, contract_type="100",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), status="active",
            salary_base=Decimal("3000"), partiality_coefficient=100,
            monthly_hours=150, monthly_or_daily_contribution="monthly",
        )
        self.db.add(self.contract)
        self.db.flush()
        self.payroll = Payroll(
            employee_id=employee.id, contract_id=self.contract.id, company_id=company.id,
            period_month=6, period_year=2026, base_salary=Decimal("3000"),
            salary_supplements=Decimal("300"), seniority_amount=Decimal("120"),
            variable_incentives=Decimal("90"), extra_pay_proration=Decimal("210"),
            common_contingencies_base=Decimal("9999"),
            professional_contingencies_base=Decimal("9999"),
            unemployment_training_fogasa_base=Decimal("9999"), status="draft",
        )
        self.db.add(self.payroll)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def incident(self, incident_type, start, end, details=None):
        row = Incident(
            employee_id=self.payroll.employee_id, contract_id=self.contract.id,
            company_id=self.payroll.company_id, incident_type=incident_type,
            start_date=start, end_date=end, status="open",
        )
        self.db.add(row)
        self.db.flush()
        row.detail = IncidentDetail(incident_id=row.id, details=details or {})
        self.db.commit()
        self.db.refresh(row)
        return row

    def test_recalculation_rebuilds_bases_instead_of_reusing_stale_values(self):
        absence = self.incident("AUSENCIA", date(2026, 6, 1), date(2026, 6, 15))
        calculation = calculate_payroll_incidents(self.db, self.payroll)
        self.assertEqual(calculation.payroll_amounts["common_contingencies_base"], Decimal("1860.00"))
        process_payroll_incidents(self.db, self.payroll.id, actor="test")
        self.db.refresh(self.payroll)
        self.assertEqual(self.payroll.common_contingencies_base, Decimal("1860.00"))
        absence.end_date = date(2026, 6, 10)
        self.db.commit()
        process_payroll_incidents(self.db, self.payroll.id, actor="test", expected_version=1)
        self.db.refresh(self.payroll)
        self.assertEqual(self.payroll.common_contingencies_base, Decimal("2480.02"))

    def test_explicit_overrides_are_the_only_persisted_base_source(self):
        response = update_contribution_base_overrides(
            self.db, self.payroll.id,
            {
                "common_contingencies_base_override": Decimal("2000"),
                "professional_contingencies_base_override": Decimal("2100"),
                "unemployment_training_fogasa_base_override": Decimal("2200"),
            },
            actor="test", expected_version=0,
        )
        self.assertEqual(response["contribution_base_resolution"]["sources"]["common_contingencies_base"], "manual_override")
        self.db.refresh(self.payroll)
        self.assertEqual(self.payroll.common_contingencies_base, Decimal("2000.00"))

    def test_incompatible_overlap_blocks_calculation(self):
        first = self.incident("AUSENCIA", date(2026, 6, 1), date(2026, 6, 10))
        second = self.incident("VACACIONES", date(2026, 6, 5), date(2026, 6, 8))
        with self.assertRaises(HTTPException) as context:
            calculate_payroll_incidents(self.db, self.payroll)
        self.assertEqual(context.exception.status_code, 409)
        detail = context.exception.detail
        self.assertEqual(detail["code"], "incident_overlap_conflict")
        self.assertEqual(detail["conflicts"][0]["start_date"], "2026-06-05")
        self.assertEqual(detail["conflicts"][0]["end_date"], "2026-06-08")
        self.assertEqual(set(detail["conflicts"][0]["incident_ids"]), {first.id, second.id})

    def test_version_conflict_and_snapshots_are_reproducible(self):
        first = process_payroll_incidents(self.db, self.payroll.id, actor="first", expected_version=0)
        self.assertEqual(first["calculation_version"], 1)
        with self.assertRaises(HTTPException) as context:
            process_payroll_incidents(self.db, self.payroll.id, actor="stale", expected_version=0)
        self.assertEqual(context.exception.detail["code"], "payroll_calculation_version_conflict")
        second = process_payroll_incidents(self.db, self.payroll.id, actor="second", expected_version=1)
        self.assertEqual(second["calculation_version"], 2)
        self.assertEqual(first["calculation_fingerprint"], second["calculation_fingerprint"])
        snapshots = self.db.query(PayrollCalculationSnapshot).filter(
            PayrollCalculationSnapshot.payroll_id == self.payroll.id
        ).order_by(PayrollCalculationSnapshot.calculation_version).all()
        self.assertEqual([snapshot.calculation_version for snapshot in snapshots], [1, 2])
        self.assertEqual(snapshots[0].fingerprint, snapshots[1].fingerprint)
        self.assertIn("payroll_amounts", snapshots[0].result_snapshot)


if __name__ == "__main__":
    unittest.main()
