import unittest
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.db import Base
from app.models.agreement_extra_pay import AgreementExtraPay, AgreementExtraPayConcept
from app.models.collective_agreement import CollectiveAgreement, ProfessionalCategory, SalaryTable, SalaryTableRow
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept, PayrollItem
from app.schemas.contract_extra_pay import ContractExtraPayPayrollCreateRequest
from app.services.contract_extra_pay_generation import create_contract_extra_payroll
from app.services.contract_extra_pay_preview import preview_contract_extra_pay


class ContractExtraPayTest(unittest.TestCase):
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
        self.company = Company(name="Empresa prueba", cif="B00000001", is_active=True)
        self.db.add(self.company)
        self.db.flush()

        self.employee = Employee(
            employee_code="EMP-EXTRA-1",
            company_id=self.company.id,
            dni="00000001R",
            first_name="Ana",
            last_name="Devengo",
            birth_date=date(1990, 1, 1),
            is_active=True,
            status="active",
        )
        self.db.add(self.employee)
        self.db.flush()

        self.agreement = CollectiveAgreement(name="Convenio extra", agreement_code="EXTRA-C", status="active")
        self.db.add(self.agreement)
        self.db.flush()

        self.category = ProfessionalCategory(
            collective_agreement_id=self.agreement.id,
            code="ADM",
            name="Administrativo",
            display_order=1,
        )
        self.db.add(self.category)
        self.db.flush()

        self.table = SalaryTable(
            collective_agreement_id=self.agreement.id,
            name="Tabla 2026",
            year=2026,
            status="active",
            number_of_payments=14,
            amount_type="monthly",
        )
        self.db.add(self.table)
        self.db.flush()

        self.row = SalaryTableRow(
            salary_table_id=self.table.id,
            professional_category_id=self.category.id,
            category_name=self.category.name,
            base_salary=Decimal("1200.00"),
            agreement_plus=Decimal("200.00"),
            amount_unit="monthly",
        )
        self.db.add(self.row)
        self.db.flush()

        self.contract = Contract(
            employee_id=self.employee.id,
            company_id=self.company.id,
            contract_type="100",
            contract_code="100-EXTRA",
            start_date=date(2026, 2, 1),
            status="active",
            collective_agreement_id=self.agreement.id,
            professional_category_id=self.category.id,
            salary_table_row_id=self.row.id,
            salary_base=Decimal("1200.00"),
            partiality_coefficient=50,
            pay_schedule="not_prorated_14",
        )
        self.db.add(self.contract)
        self.db.flush()

        plus = PayrollConcept(
            name="Plus convenio",
            code=f"AGR_{self.agreement.id}_AGREEMENT_PLUS",
            category="PLUS",
            concept_type="DEVENGO",
            salary_nature="SALARIAL",
            source_type="AGREEMENT",
            agreement_id=self.agreement.id,
            calculation_type="FIXED_AMOUNT",
            default_amount=0,
            default_unit_price=0,
            applies_workday_percentage=True,
            is_system=False,
            is_taxable=True,
            is_contribution_base=True,
            is_active=True,
        )
        self.db.add(plus)
        self.db.flush()
        self.db.add(
            ContractPayrollConcept(
                contract_id=self.contract.id,
                concept_id=plus.id,
                description="Plus convenio personalizado",
                amount=Decimal("250.00"),
                quantity=1,
                unit_price=0,
                start_date=self.contract.start_date,
                is_active=True,
            )
        )

        self.extra = AgreementExtraPay(
            collective_agreement_id=self.agreement.id,
            salary_table_id=self.table.id,
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
            proration_default=False,
            is_active=True,
        )
        self.db.add(self.extra)
        self.db.flush()
        self.db.add_all([
            AgreementExtraPayConcept(
                extra_pay_id=self.extra.id,
                concept_key=f"AGR_{self.agreement.id}_SALARY_BASE",
                concept_name="Salario base",
                calculation_mode="percentage",
                percentage=100,
                is_active=True,
                display_order=10,
            ),
            AgreementExtraPayConcept(
                extra_pay_id=self.extra.id,
                concept_key=f"AGR_{self.agreement.id}_AGREEMENT_PLUS",
                concept_name="Plus convenio",
                calculation_mode="percentage",
                percentage=100,
                is_active=True,
                display_order=20,
            ),
        ])
        self.db.add_all([
            Incident(
                employee_id=self.employee.id,
                contract_id=self.contract.id,
                company_id=self.company.id,
                incident_type="PERMISO_NO_RETRIBUIDO",
                start_date=date(2026, 3, 1),
                end_date=date(2026, 3, 10),
                status="closed",
            ),
            Incident(
                employee_id=self.employee.id,
                contract_id=self.contract.id,
                company_id=self.company.id,
                incident_type="IT",
                start_date=date(2026, 4, 1),
                end_date=date(2026, 4, 5),
                status="closed",
            ),
        ])
        self.db.commit()

    def test_preview_applies_vigency_partiality_and_unpaid_absence(self):
        result = preview_contract_extra_pay(self.db, self.extra.id, self.contract.id, 2026)

        self.assertEqual(result["total_period_days"], 181)
        self.assertEqual(result["contract_overlap_days"], 150)
        self.assertEqual(result["excluded_unpaid_absence_days"], 10)
        self.assertEqual(result["excluded_it_days"], 0)
        self.assertEqual(result["accrued_days"], 140)
        self.assertEqual(result["partiality_percentage"], Decimal("50.00"))
        self.assertEqual(result["theoretical_full_time_amount"], Decimal("1450.00"))
        self.assertEqual(result["contract_full_period_amount"], Decimal("725.00"))
        self.assertEqual(result["final_amount"], Decimal("560.79"))
        self.assertTrue(result["can_generate"])

        sources = {line["concept_name"]: line["base_source"] for line in result["lines"]}
        self.assertEqual(sources["Salario base"], "contract_salary_base")
        self.assertEqual(sources["Plus convenio"], "contract_permanent_concept")

    def test_it_deduction_is_configurable(self):
        self.extra.deduct_it_days = True
        self.db.commit()
        result = preview_contract_extra_pay(self.db, self.extra.id, self.contract.id, 2026)
        self.assertEqual(result["excluded_it_days"], 5)
        self.assertEqual(result["excluded_total_days"], 15)
        self.assertEqual(result["accrued_days"], 135)
        self.assertLess(result["final_amount"], Decimal("560.79"))

    def test_generation_creates_special_payroll_items_and_blocks_duplicate(self):
        created = create_contract_extra_payroll(
            self.db,
            self.extra.id,
            self.contract.id,
            ContractExtraPayPayrollCreateRequest(
                period_year=2026,
                irpf_percentage=Decimal("10.00"),
                status="pending",
            ),
        )

        self.assertEqual(created["period_month"], 13)
        self.assertEqual(created["gross_salary"], Decimal("560.79"))
        self.assertEqual(created["irpf"], Decimal("56.08"))
        self.assertEqual(created["net_salary"], Decimal("504.71"))
        self.assertEqual(created["created_items"], 2)

        payroll = self.db.query(Payroll).filter(Payroll.id == created["payroll_id"]).one()
        items = self.db.query(PayrollItem).filter(PayrollItem.payroll_id == payroll.id).all()
        self.assertEqual(payroll.period_month, 13)
        self.assertEqual(sum((item.amount for item in items), Decimal("0.00")), payroll.gross_salary)

        preview = preview_contract_extra_pay(self.db, self.extra.id, self.contract.id, 2026)
        self.assertFalse(preview["can_generate"])
        self.assertEqual(preview["already_generated_payroll_id"], payroll.id)
        with self.assertRaises(HTTPException):
            create_contract_extra_payroll(
                self.db,
                self.extra.id,
                self.contract.id,
                ContractExtraPayPayrollCreateRequest(period_year=2026),
            )


if __name__ == "__main__":
    unittest.main()
