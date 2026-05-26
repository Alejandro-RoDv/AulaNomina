from datetime import date
from decimal import Decimal
from types import SimpleNamespace
import unittest

from app.services.contribution_base_calculator import calculate_contribution_bases
from app.services.payroll_days_calculator import calculate_payroll_days
from app.services.payroll_engine import calculate_simulated_earning_lines


class PayrollDaysAndBasesTestCase(unittest.TestCase):
    def build_incident(self, incident_type, start_day, end_day=None):
        return SimpleNamespace(
            id=1,
            incident_type=incident_type,
            start_date=date(2026, 1, start_day),
            end_date=date(2026, 1, end_day) if end_day else None,
        )

    def calculate_days(self, incidents):
        return calculate_payroll_days(
            incidents=incidents,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 1, 31),
        )

    def test_normal_month_uses_full_contribution_days_and_full_bases(self):
        days = self.calculate_days([])
        bases = calculate_contribution_bases(
            base_salary=Decimal("2142.86"),
            extra_pay_proration=Decimal("357.14"),
            contribution_days=days["contribution_days"],
            non_contribution_days=days["non_contribution_days"],
        )

        self.assertEqual(days["contribution_days"], 30)
        self.assertEqual(days["worked_days"], 30)
        self.assertEqual(days["incident_days"], 0)
        self.assertEqual(bases["common_contingencies_base"], Decimal("2500.00"))
        self.assertEqual(bases["professional_contingencies_base"], Decimal("2500.00"))
        self.assertEqual(bases["daily_common_base"], Decimal("83.33"))

    def test_vacation_is_informative_and_does_not_reduce_contribution_days_or_bases(self):
        days = self.calculate_days([self.build_incident("VACACIONES", 1, 8)])
        bases = calculate_contribution_bases(
            base_salary=Decimal("2142.86"),
            extra_pay_proration=Decimal("357.14"),
            contribution_days=days["contribution_days"],
            non_contribution_days=days["non_contribution_days"],
        )

        self.assertEqual(days["contribution_days"], 30)
        self.assertEqual(days["worked_days"], 22)
        self.assertEqual(days["incident_days"], 8)
        self.assertFalse(days["has_payroll_affecting_incidents"])
        self.assertEqual(bases["common_contingencies_base"], Decimal("2500.00"))

    def test_unpaid_absence_reduces_contribution_days_and_bases(self):
        days = self.calculate_days([self.build_incident("PERMISO_NO_RETRIBUIDO", 1, 3)])
        bases = calculate_contribution_bases(
            base_salary=Decimal("2142.86"),
            extra_pay_proration=Decimal("357.14"),
            contribution_days=days["contribution_days"],
            non_contribution_days=days["non_contribution_days"],
        )

        self.assertEqual(days["contribution_days"], 27)
        self.assertEqual(days["worked_days"], 27)
        self.assertEqual(days["non_contribution_days"], 3)
        self.assertTrue(days["has_payroll_affecting_incidents"])
        self.assertEqual(bases["common_contingencies_base"], Decimal("2250.00"))
        self.assertEqual(bases["daily_common_base"], Decimal("83.33"))

    def test_common_sick_leave_keeps_contribution_days_and_creates_it_earning_lines(self):
        days = self.calculate_days([self.build_incident("IT", 1, 8)])
        earnings = calculate_simulated_earning_lines(
            base_salary=Decimal("2142.86"),
            salary_supplements=Decimal("0.00"),
            variable_incentives=Decimal("0.00"),
            extra_pay_proration=Decimal("357.14"),
            day_result=days,
        )

        self.assertEqual(days["contribution_days"], 30)
        self.assertEqual(days["worked_days"], 22)
        self.assertEqual(days["incident_days"], 8)
        self.assertEqual(earnings["it_days"], 8)
        self.assertGreater(earnings["temporary_disability_benefit"], Decimal("0.00"))
        self.assertGreater(earnings["company_disability_complement"], Decimal("0.00"))
        self.assertEqual(earnings["gross_salary"], Decimal("2500.00"))


if __name__ == "__main__":
    unittest.main()
