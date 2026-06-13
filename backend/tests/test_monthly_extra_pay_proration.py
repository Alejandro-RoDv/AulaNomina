import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.crud.payroll import create_payroll, update_payroll
from app.db import Base
from app.models.agreement_extra_pay import AgreementExtraPay, AgreementExtraPayConcept
from app.models.collective_agreement import CollectiveAgreement, ProfessionalCategory, SalaryTable, SalaryTableRow
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.schemas.payroll import PayrollCreate, PayrollUpdate
from app.services.monthly_extra_pay_proration import PRORATION_CONCEPT_PREFIX, resolve_monthly_extra_pay_proration
from app.services.payroll_engine import calculate_payroll_engine_result


class MonthlyExtraPayProrationTest(unittest.TestCase):
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
        company = Company(name="Empresa prorrata", cif="B00000002", is_active=True)
        self.db.add(company)
        self.db.flush()
        employee = Employee(
            employee_code="EMP-PRORRATA",
            company_id=company.id,
            dni="00000002W",
            first_name="Luis",
            last_name="Prorrata",
            birth_date=date(1990, 1, 1),
            is_active=True,
            status="active",
        )
        self.db.add(employee)
        self.db.flush()
        agreement = CollectiveAgreement(name="Convenio prorrata", agreement_code="PRORRATA-C", status="active")
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
            amount_unit="monthly",
        )
        self.db.add(row)
        self.db.flush()
        contract = Contract(
            employee_id=employee.id,
            company_id=company.id,
            contract_type="100",
            contract_code="100-PRORRATA",
            start_date=date(2026, 2, 1),
            status="active",
            collective_agreement_id=agreement.id,
            professional_category_id=category.id,
            salary_table_row_id=row.id,
            salary_base=Decimal("1200.00"),
            partiality_coefficient=50,
            pay_schedule="prorated_12",
        )
        self.db.add(contract)
        self.db.flush()
        extra = AgreementExtraPay(
            collective_agreement_id=agreement.id,
            salary_table_id=table.id,
            code="PAGA_VERANO",
            name="Paga de verano",
            payroll_period=13,
            payment_month=7,
            accrual_start_month=1,
            accrual_end_month=6,
            accrual_months=6,
            apply_partiality=True,
            deduct_it_days=False,
            deduct_unpaid_absence_days=True,
            deduct_inactivity_days=True,
            proration_allowed=True,
            proration_default=True,
            is_active=True,
        )
        self.db.add(extra)
        self.db.flush()
        self.db.add(
            AgreementExtraPayConcept(
                extra_pay_id=extra.id,
                concept_key=f"AGR_{agreement.id}_SALARY_BASE",
                concept_name="Salario base",
                calculation_mode="percentage",
                percentage=100,
                is_active=True,
                display_order=10,
            )
        )
        self.db.add_all([
            Incident(
                employee_id=employee.id,
                contract_id=contract.id,
                company_id=company.id,
                incident_type="PERMISO_NO_RETRIBUIDO",
                start_date=date(2026, 3, 1),
                end_date=date(2026, 3, 10),
                status="closed",
            ),
            Incident(
                employee_id=employee.id,
                contract_id=contract.id,
                company_id=company.id,
                incident_type="IT",
                start_date=date(2026, 4, 1),
                end_date=date(2026, 4, 5),
                status="closed",
            ),
        ])
        self.db.commit()
        self.company = company
        self.employee = employee
        self.contract = contract
        self.extra = extra

    def automatic_items(self, payroll_id):
        return self.db.query(PayrollItem).join(PayrollConcept).filter(
            PayrollItem.payroll_id == payroll_id,
            PayrollConcept.code.like(f"{PRORATION_CONCEPT_PREFIX}%"),
        ).all()

    def test_configured_proration_applies_partiality_and_unpaid_days(self):
        result = resolve_monthly_extra_pay_proration(self.db, self.contract, 3, 2026)
        self.assertEqual(result["source"], "configured")
        self.assertEqual(result["total_amount"], Decimal("67.74"))
        self.assertEqual(result["lines"][0]["eligible_days"], 21)
        self.assertEqual(result["lines"][0]["period_days"], 31)
        self.assertEqual(result["lines"][0]["base_source"], "contract_salary_base")

    def test_it_reduction_is_configurable(self):
        self.assertEqual(
            resolve_monthly_extra_pay_proration(self.db, self.contract, 4, 2026)["total_amount"],
            Decimal("100.00"),
        )
        self.extra.deduct_it_days = True
        self.db.commit()
        self.assertEqual(
            resolve_monthly_extra_pay_proration(self.db, self.contract, 4, 2026)["total_amount"],
            Decimal("83.33"),
        )

    def test_engine_does_not_reduce_proration_twice(self):
        result = calculate_payroll_engine_result(
            self.db,
            self.employee,
            self.contract,
            3,
            2026,
            irpf_percentage=Decimal("10.00"),
        )
        self.assertEqual(result["extra_pay_proration"], Decimal("67.74"))
        self.assertEqual(result["gross_salary"], Decimal("124.85"))
        self.assertEqual(result["common_contingencies_base"], Decimal("124.88"))

    def test_create_and_update_keep_one_automatic_line(self):
        payroll = create_payroll(self.db, PayrollCreate(
            employee_id=self.employee.id,
            contract_id=self.contract.id,
            company_id=self.company.id,
            period_month=3,
            period_year=2026,
            irpf_mode="manual",
            irpf_percentage=Decimal("10.00"),
            status="pending",
        ))
        self.assertEqual(len(self.automatic_items(payroll.id)), 1)
        updated = update_payroll(self.db, payroll.id, PayrollUpdate(status="calculated"))
        items = self.automatic_items(payroll.id)
        self.assertEqual(updated.status, "calculated")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].amount, updated.extra_pay_proration)

    def test_special_period_and_legacy_fallback(self):
        special = calculate_payroll_engine_result(
            self.db, self.employee, self.contract, 13, 2026, irpf_percentage=Decimal("10.00")
        )
        self.assertEqual(special["extra_pay_proration"], Decimal("0.00"))
        legacy = Contract(
            employee_id=self.employee.id,
            company_id=self.company.id,
            contract_type="100",
            start_date=date(2026, 1, 1),
            status="active",
            salary_base=Decimal("16800.00"),
            pay_schedule="prorated_12",
        )
        self.db.add(legacy)
        self.db.commit()
        result = resolve_monthly_extra_pay_proration(self.db, legacy, 5, 2026)
        self.assertEqual(result["source"], "legacy")
        self.assertEqual(result["total_amount"], Decimal("200.00"))


if __name__ == "__main__":
    unittest.main()
