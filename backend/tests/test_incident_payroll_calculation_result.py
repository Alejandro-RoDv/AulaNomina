import unittest
from dataclasses import FrozenInstanceError
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
from app.models.incident_calculation import IncidentCalculationRule, PayrollSegment
from app.models.incident_detail import IncidentDetail
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.services.incident_payroll_orchestrator import (
    calculate_payroll_incidents,
    process_payroll_incidents,
)


class IncidentPayrollCalculationResultTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        Base.metadata.create_all(self.engine)
        company = Company(name="Empresa resultado", cif="B36000001", is_active=True)
        self.db.add(company)
        self.db.flush()
        employee = Employee(
            employee_code="RESULT-001",
            company_id=company.id,
            dni="36000001D",
            first_name="Laura",
            last_name="Resultado",
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
        self.db.flush()
        self.payroll = Payroll(
            employee_id=employee.id,
            contract_id=self.contract.id,
            company_id=company.id,
            period_month=6,
            period_year=2026,
            base_salary=Decimal("3000"),
            salary_supplements=Decimal("300"),
            seniority_amount=Decimal("120"),
            variable_incentives=Decimal("90"),
            extra_pay_proration=Decimal("210"),
            status="draft",
        )
        self.db.add(self.payroll)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def incident(self, incident_type, start, end, details=None):
        row = Incident(
            employee_id=self.payroll.employee_id,
            contract_id=self.contract.id,
            company_id=self.payroll.company_id,
            incident_type=incident_type,
            start_date=start,
            end_date=end,
            status="open",
        )
        self.db.add(row)
        self.db.flush()
        row.detail = IncidentDetail(incident_id=row.id, details=details or {})
        self.db.commit()
        self.db.refresh(row)
        return row

    def test_calculation_is_immutable_and_has_no_persistence_side_effects(self):
        self.incident("AUSENCIA", date(2026, 6, 1), date(2026, 6, 15))
        rules_before = self.db.query(IncidentCalculationRule).count()
        gross_before = self.payroll.gross_salary

        calculation = calculate_payroll_incidents(self.db, self.payroll)

        self.assertEqual(self.db.query(IncidentCalculationRule).count(), rules_before)
        self.assertEqual(self.db.query(PayrollSegment).count(), 0)
        self.assertEqual(self.db.query(PayrollItem).count(), 0)
        self.assertEqual(self.payroll.gross_salary, gross_before)
        with self.assertRaises(TypeError):
            calculation.payroll_amounts["gross_salary"] = Decimal("1")
        with self.assertRaises(FrozenInstanceError):
            calculation.payroll_id = 999

    def test_unpaid_absence_reduces_components_without_compounding(self):
        self.incident("AUSENCIA", date(2026, 6, 1), date(2026, 6, 15))
        calculation = calculate_payroll_incidents(self.db, self.payroll)
        adjusted = calculation.adjusted_component_map()

        self.assertEqual(adjusted["salary_supplements"], Decimal("150.00"))
        self.assertEqual(adjusted["seniority_amount"], Decimal("60.00"))
        self.assertEqual(adjusted["variable_incentives"], Decimal("45.00"))
        self.assertEqual(adjusted["extra_pay_proration"], Decimal("105.00"))
        self.assertEqual(calculation.payroll_amounts["gross_salary"], Decimal("1860.00"))

        process_payroll_incidents(self.db, self.payroll.id, actor="test")
        self.db.refresh(self.payroll)
        self.assertEqual(self.payroll.gross_salary, Decimal("1860.00"))
        self.assertEqual(self.payroll.salary_supplements, Decimal("300.00"))
        self.assertEqual(self.payroll.seniority_amount, Decimal("120.00"))
        self.assertEqual(self.payroll.variable_incentives, Decimal("90.00"))
        self.assertEqual(self.payroll.extra_pay_proration, Decimal("210.00"))

        reduction_items = self.db.query(PayrollItem).filter(
            PayrollItem.payroll_id == self.payroll.id,
            PayrollItem.segment_id.is_(None),
            PayrollItem.source_key.like("payroll:%:component:%:reduction"),
        ).all()
        self.assertEqual(len(reduction_items), 4)
        self.assertTrue(all(item.calculation_trace.get("factor") == "0.5000" for item in reduction_items))

        process_payroll_incidents(self.db, self.payroll.id, actor="test")
        self.db.refresh(self.payroll)
        self.assertEqual(self.payroll.gross_salary, Decimal("1860.00"))
        self.assertEqual(
            self.db.query(PayrollItem).filter(
                PayrollItem.payroll_id == self.payroll.id,
                PayrollItem.segment_id.is_(None),
                PayrollItem.source_key.like("payroll:%:component:%:reduction"),
            ).count(),
            4,
        )

    def test_rule_can_override_component_sensitivity(self):
        self.db.add(IncidentCalculationRule(
            code="TEST_IT_COMPONENTS",
            name="IT con sensibilidad de conceptos",
            incident_type="IT",
            process_type="common_disease",
            valid_from=date(2026, 1, 1),
            priority=999,
            is_active=True,
            configuration={
                "kind": "medical",
                "contribution_treatment": "maintain",
                "concept_sensitivity": {
                    "salary_supplements": "salary_percentage",
                    "seniority_amount": "maintain",
                    "variable_incentives": "worked",
                    "extra_pay_proration": {"mode": "percentage", "value": 50},
                },
                "bands": [
                    {"from": 1, "to": None, "segment_type": "it_test", "benefit_percentage": 60}
                ],
            },
        ))
        self.db.commit()
        self.incident(
            "IT",
            date(2026, 6, 1),
            date(2026, 6, 15),
            {"process_type": "common_disease"},
        )

        calculation = calculate_payroll_incidents(self.db, self.payroll)
        factors = calculation.segment_result["component_factors"]
        adjusted = calculation.adjusted_component_map()

        self.assertEqual(factors["salary_supplements"], Decimal("0.5000"))
        self.assertEqual(factors["seniority_amount"], Decimal("1.0000"))
        self.assertEqual(factors["variable_incentives"], Decimal("0.5000"))
        self.assertEqual(factors["extra_pay_proration"], Decimal("0.7500"))
        self.assertEqual(adjusted["salary_supplements"], Decimal("150.00"))
        self.assertEqual(adjusted["seniority_amount"], Decimal("120.00"))
        self.assertEqual(adjusted["variable_incentives"], Decimal("45.00"))
        self.assertEqual(adjusted["extra_pay_proration"], Decimal("157.50"))


if __name__ == "__main__":
    unittest.main()
