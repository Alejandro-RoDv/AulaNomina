import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.crud.payroll import create_payroll, update_payroll
from app.db import Base
from app.models.agreement_seniority import AgreementSeniorityRule
from app.models.collective_agreement import CollectiveAgreement, ProfessionalCategory, SalaryTable, SalaryTableRow
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.schemas.payroll import PayrollCreate, PayrollUpdate
from app.services.agreement_seniority import (
    build_contract_seniority_preview,
    calculate_monthly_seniority,
    safe_anniversary,
)
from app.services.payroll_engine import calculate_payroll_engine_result
from app.services.seniority_payroll_items import SENIORITY_CONCEPT_PREFIX


class AgreementSeniorityTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self._seed()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _seed(self):
        company = Company(name="Empresa antigüedad", cif="B00000005", is_active=True)
        self.db.add(company)
        self.db.flush()
        employee = Employee(
            employee_code="EMP-ANT",
            company_id=company.id,
            dni="00000005M",
            first_name="Rosa",
            last_name="Antigüedad",
            birth_date=date(1985, 1, 1),
            is_active=True,
            status="active",
        )
        self.db.add(employee)
        self.db.flush()
        agreement = CollectiveAgreement(name="Convenio antigüedad", agreement_code="ANT-1", status="active")
        self.db.add(agreement)
        self.db.flush()
        category = ProfessionalCategory(
            collective_agreement_id=agreement.id,
            code="ADM",
            name="Administrativo",
            display_order=1,
        )
        self.db.add(category)
        self.db.flush()
        table = SalaryTable(
            collective_agreement_id=agreement.id,
            name="Tabla 2026",
            year=2026,
            status="active",
            number_of_payments=14,
            amount_type="monthly",
        )
        self.db.add(table)
        self.db.flush()
        row = SalaryTableRow(
            salary_table_id=table.id,
            professional_category_id=category.id,
            category_name=category.name,
            base_salary=Decimal("1200.00"),
            seniority_amount=Decimal("90.00"),
            amount_unit="monthly",
        )
        self.db.add(row)
        self.db.flush()
        contract = Contract(
            employee_id=employee.id,
            company_id=company.id,
            contract_type="100",
            contract_code="100-ANT",
            start_date=date(2020, 1, 1),
            recognized_seniority_date=date(2017, 3, 15),
            status="active",
            collective_agreement_id=agreement.id,
            professional_category_id=category.id,
            salary_table_row_id=row.id,
            salary_base=Decimal("1200.00"),
            partiality_coefficient=50,
            pay_schedule="not_prorated_14",
        )
        self.db.add(contract)
        self.db.flush()
        rule = AgreementSeniorityRule(
            collective_agreement_id=agreement.id,
            salary_table_id=table.id,
            code="TRI",
            name="Trienios",
            module_years=3,
            calculation_mode="table_amount",
            max_modules=4,
            applies_partiality=True,
            daily_proration_on_maturity=True,
            contributes=True,
            taxable=True,
            affects_extra_payments=True,
            is_active=True,
        )
        self.db.add(rule)
        self.db.commit()
        self.company = company
        self.employee = employee
        self.contract = contract
        self.rule = rule

    def automatic_items(self, payroll_id):
        return self.db.query(PayrollItem).join(PayrollConcept).filter(
            PayrollItem.payroll_id == payroll_id,
            PayrollConcept.code.like(f"{SENIORITY_CONCEPT_PREFIX}%"),
        ).all()

    def test_preview_uses_recognized_date_partiality_and_next_maturity(self):
        preview = build_contract_seniority_preview(self.db, self.contract, date(2026, 3, 31))
        self.assertEqual(preview["seniority_date_source"], "recognized_seniority_date")
        self.assertEqual(preview["completed_modules"], 3)
        self.assertEqual(preview["amount_per_module"], Decimal("45.00"))
        self.assertEqual(preview["monthly_amount"], Decimal("135.00"))
        self.assertEqual(preview["next_maturity_date"], date(2029, 3, 15))

    def test_mid_month_maturity_is_prorated(self):
        result = calculate_monthly_seniority(self.db, self.contract, 3, 2026, contribution_days=30)
        self.assertEqual(result["completed_modules"], 3)
        self.assertEqual(result["amount"], Decimal("114.68"))
        self.assertEqual(len(result["lines"]), 2)
        self.assertEqual(result["lines"][0]["amount"], Decimal("90.00"))
        self.assertEqual(result["lines"][1]["amount"], Decimal("24.68"))

    def test_contribution_days_reduce_the_calculated_amount_once(self):
        result = calculate_monthly_seniority(self.db, self.contract, 3, 2026, contribution_days=15)
        self.assertEqual(result["amount"], Decimal("57.34"))
        self.assertEqual(sum((line["amount"] for line in result["lines"]), Decimal("0.00")), Decimal("57.34"))

    def test_payroll_engine_includes_seniority_in_gross_and_bases(self):
        result = calculate_payroll_engine_result(
            self.db,
            self.employee,
            self.contract,
            3,
            2026,
            irpf_percentage=Decimal("0.00"),
        )
        self.assertEqual(result["base_salary"], Decimal("600.00"))
        self.assertEqual(result["seniority_amount"], Decimal("114.68"))
        self.assertEqual(result["gross_salary"], Decimal("714.68"))
        self.assertEqual(result["common_contingencies_base"], Decimal("714.68"))
        self.assertEqual(result["professional_contingencies_base"], Decimal("714.68"))

    def test_create_and_update_keep_seniority_lines_idempotent(self):
        payroll = create_payroll(
            self.db,
            PayrollCreate(
                employee_id=self.employee.id,
                contract_id=self.contract.id,
                company_id=self.company.id,
                period_month=3,
                period_year=2026,
                irpf_mode="manual",
                irpf_percentage=Decimal("0.00"),
                status="pending",
            ),
        )
        items = self.automatic_items(payroll.id)
        self.assertEqual(payroll.seniority_amount, Decimal("114.68"))
        self.assertEqual(len(items), 2)
        self.assertEqual(sum((item.amount for item in items), Decimal("0.00")), Decimal("114.68"))

        update_payroll(self.db, payroll.id, PayrollUpdate(status="calculated"))
        updated_items = self.automatic_items(payroll.id)
        self.assertEqual(len(updated_items), 2)
        self.assertEqual(sum((item.amount for item in updated_items), Decimal("0.00")), Decimal("114.68"))

    def test_module_limit_and_leap_anniversary(self):
        self.rule.max_modules = 2
        self.db.commit()
        preview = build_contract_seniority_preview(self.db, self.contract, date(2035, 3, 31))
        self.assertEqual(preview["completed_modules"], 2)
        self.assertTrue(preview["capped"])
        self.assertIsNone(preview["next_maturity_date"])
        self.assertEqual(safe_anniversary(date(2024, 2, 29), 1), date(2025, 2, 28))


if __name__ == "__main__":
    unittest.main()
