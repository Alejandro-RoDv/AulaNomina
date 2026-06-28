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
from app.models.incident_calculation import PayrollSegment
from app.models.incident_detail import IncidentDetail
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.services.incident_payroll_processor import process_payroll_incidents
from app.services.incident_segmenter import build_incident_segments


class IncidentPayrollEngineTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()

        self.company = Company(name="Empresa motor", cif="B33000001", is_active=True)
        self.db.add(self.company)
        self.db.flush()
        self.employee = Employee(
            employee_code="MOTOR-001",
            company_id=self.company.id,
            dni="33000001A",
            first_name="Ana",
            last_name="Motor",
            birth_date=date(1990, 1, 1),
            is_active=True,
            status="active",
        )
        self.db.add(self.employee)
        self.db.flush()
        self.contract = Contract(
            employee_id=self.employee.id,
            company_id=self.company.id,
            contract_type="100",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="active",
            salary_base=Decimal("3000.00"),
            partiality_coefficient=100,
            monthly_hours=150,
            monthly_or_daily_contribution="monthly",
        )
        self.db.add(self.contract)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def payroll(self, month=6, status="draft"):
        payroll = Payroll(
            employee_id=self.employee.id,
            contract_id=self.contract.id,
            company_id=self.company.id,
            period_month=month,
            period_year=2026,
            base_salary=Decimal("3000.00"),
            salary_supplements=0,
            seniority_amount=0,
            variable_incentives=0,
            extra_pay_proration=0,
            status=status,
        )
        self.db.add(payroll)
        self.db.commit()
        self.db.refresh(payroll)
        return payroll

    def incident(self, incident_type, start, end=None, details=None, hours=None):
        incident = Incident(
            employee_id=self.employee.id,
            contract_id=self.contract.id,
            company_id=self.company.id,
            incident_type=incident_type,
            start_date=start,
            end_date=end,
            status="open",
        )
        self.db.add(incident)
        self.db.flush()
        incident.detail = IncidentDetail(
            incident_id=incident.id,
            hours=hours,
            details=details or {},
        )
        self.db.commit()
        self.db.refresh(incident)
        return incident

    def test_common_it_is_split_at_legal_thresholds(self):
        payroll = self.payroll()
        incident = self.incident(
            "IT",
            date(2026, 6, 1),
            date(2026, 6, 25),
            {"process_type": "common_disease"},
        )
        result = build_incident_segments(
            self.db,
            payroll.id,
            self.contract,
            6,
            2026,
            [incident],
        )
        types = [segment["segment_type"] for segment in result["segments"]]
        self.assertEqual(
            types,
            [
                "it_waiting",
                "it_common_60_company",
                "it_common_60_delegated",
                "it_common_75",
                "normal_work",
            ],
        )
        self.assertEqual(result["worked_base_salary"], Decimal("500.00"))
        self.assertEqual(result["temporary_disability_benefit"], Decimal("1395.00"))
        self.assertEqual(result["it_days"], 25)

    def test_previous_payroll_base_is_used_for_it(self):
        previous = Payroll(
            employee_id=self.employee.id,
            contract_id=self.contract.id,
            company_id=self.company.id,
            period_month=5,
            period_year=2026,
            common_contingencies_base=Decimal("3300.00"),
            professional_contingencies_base=Decimal("3600.00"),
            contribution_days=30,
            status="closed",
        )
        self.db.add(previous)
        self.db.commit()
        payroll = self.payroll()
        incident = self.incident(
            "IT",
            date(2026, 6, 4),
            date(2026, 6, 6),
            {"process_type": "common_disease", "original_process_start_date": "2026-06-01"},
        )
        result = build_incident_segments(self.db, payroll.id, self.contract, 6, 2026, [incident])
        benefit_segment = next(item for item in result["segments"] if item["benefit_amount"] > 0)
        self.assertEqual(benefit_segment["daily_regulatory_base"], Decimal("110.0000"))
        self.assertEqual(benefit_segment["benefit_amount"], Decimal("198.00"))

    def test_unpaid_absence_reduces_salary_and_contribution_days(self):
        payroll = self.payroll()
        incident = self.incident("PERMISO_NO_RETRIBUIDO", date(2026, 6, 10), date(2026, 6, 14))
        result = build_incident_segments(self.db, payroll.id, self.contract, 6, 2026, [incident])
        self.assertEqual(result["worked_base_salary"], Decimal("2500.00"))
        self.assertEqual(result["salary_deductions"], Decimal("500.00"))
        self.assertEqual(result["contribution_days"], 25)

    def test_vacation_keeps_salary_and_contribution(self):
        payroll = self.payroll(month=2)
        incident = self.incident("VACACIONES", date(2026, 2, 1), date(2026, 2, 28))
        result = build_incident_segments(self.db, payroll.id, self.contract, 2, 2026, [incident])
        self.assertEqual(sum(item["payroll_days"] for item in result["segments"]), Decimal("30.0000"))
        self.assertEqual(result["worked_base_salary"], Decimal("3000.00"))
        self.assertEqual(result["salary_deductions"], Decimal("0.00"))
        self.assertEqual(result["contribution_days"], 30)

    def test_overtime_uses_at_least_ordinary_hour_value(self):
        payroll = self.payroll()
        incident = self.incident(
            "HORAS_EXTRA",
            date(2026, 6, 20),
            details={"hour_value": "10", "inclusion_destination": "payroll"},
            hours=Decimal("5"),
        )
        result = build_incident_segments(self.db, payroll.id, self.contract, 6, 2026, [incident])
        self.assertEqual(result["overtime_amount"], Decimal("100.00"))
        self.assertTrue(any("inferior al ordinario" in warning for warning in result["warnings"]))

    def test_processing_is_idempotent_and_creates_origin_lines(self):
        payroll = self.payroll()
        self.incident(
            "IT",
            date(2026, 6, 1),
            date(2026, 6, 10),
            {"process_type": "common_disease"},
        )
        first = process_payroll_incidents(self.db, payroll.id, actor="test")
        first_items = self.db.query(PayrollItem).filter(PayrollItem.payroll_id == payroll.id).count()
        first_segments = self.db.query(PayrollSegment).filter(PayrollSegment.payroll_id == payroll.id).count()
        second = process_payroll_incidents(self.db, payroll.id, actor="test")
        second_items = self.db.query(PayrollItem).filter(PayrollItem.payroll_id == payroll.id).count()
        second_segments = self.db.query(PayrollSegment).filter(PayrollSegment.payroll_id == payroll.id).count()

        self.assertGreater(first["created_items"], 0)
        self.assertEqual(first_items, second_items)
        self.assertEqual(first_segments, second_segments)
        self.assertEqual(second["created_items"], 0)
        self.assertTrue(
            all(item.source_key and item.is_automatic for item in self.db.query(PayrollItem).all())
        )

    def test_closed_payroll_cannot_be_rewritten(self):
        payroll = self.payroll(status="closed")
        self.incident("VACACIONES", date(2026, 6, 1), date(2026, 6, 5))
        with self.assertRaises(HTTPException) as error:
            process_payroll_incidents(self.db, payroll.id)
        self.assertEqual(error.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
