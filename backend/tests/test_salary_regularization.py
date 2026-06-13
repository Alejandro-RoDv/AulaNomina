import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.db import Base
from app.models.collective_agreement import CollectiveAgreement, ProfessionalCategory, SalaryTable, SalaryTableRow
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.schemas.salary_regularization import SalaryRegularizationGenerateRequest, SalaryRegularizationPreviewRequest
from app.services.salary_regularization import build_salary_regularization_preview, generate_salary_regularizations


class SalaryRegularizationTest(unittest.TestCase):
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
        company = Company(name="Empresa atrasos", cif="B00000004", is_active=True)
        self.db.add(company)
        self.db.flush()
        employee = Employee(
            employee_code="EMP-ATRASOS",
            company_id=company.id,
            dni="00000004G",
            first_name="Ana",
            last_name="Atrasos",
            birth_date=date(1990, 1, 1),
            is_active=True,
            status="active",
        )
        self.db.add(employee)
        self.db.flush()
        agreement = CollectiveAgreement(name="Convenio atrasos", agreement_code="ATR-1", status="active")
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
        source = SalaryTable(
            collective_agreement_id=agreement.id,
            name="Tabla 2025",
            year=2025,
            status="historical",
            number_of_payments=14,
            amount_type="monthly",
        )
        target = SalaryTable(
            collective_agreement_id=agreement.id,
            name="Tabla 2026",
            year=2026,
            effective_from=date(2026, 1, 1),
            status="active",
            number_of_payments=14,
            amount_type="monthly",
        )
        self.db.add_all([source, target])
        self.db.flush()
        source_row = SalaryTableRow(
            salary_table_id=source.id,
            professional_category_id=category.id,
            category_name=category.name,
            base_salary=Decimal("1000.00"),
            amount_unit="monthly",
        )
        target_row = SalaryTableRow(
            salary_table_id=target.id,
            professional_category_id=category.id,
            category_name=category.name,
            base_salary=Decimal("1100.00"),
            amount_unit="monthly",
        )
        self.db.add_all([source_row, target_row])
        self.db.flush()
        contract = Contract(
            employee_id=employee.id,
            company_id=company.id,
            contract_type="100",
            contract_code="100-ATRASOS",
            start_date=date(2025, 1, 1),
            status="active",
            collective_agreement_id=agreement.id,
            professional_category_id=category.id,
            salary_table_row_id=source_row.id,
            salary_base=Decimal("1000.00"),
            partiality_coefficient=100,
            pay_schedule="not_prorated_14",
        )
        self.db.add(contract)
        self.db.flush()
        self.db.add_all([
            self._payroll(contract, employee, company, 1, Decimal("1000.00"), Decimal("1000.00"), 30),
            self._payroll(contract, employee, company, 2, Decimal("1000.00"), Decimal("500.00"), 15),
        ])
        self.db.commit()
        self.company = company
        self.employee = employee
        self.contract = contract
        self.source = source
        self.target = target

    def _payroll(self, contract, employee, company, month, base, worked, days):
        return Payroll(
            employee_id=employee.id,
            contract_id=contract.id,
            company_id=company.id,
            period_month=month,
            period_year=2026,
            base_salary=base,
            worked_base_salary=worked,
            temporary_disability_benefit=Decimal("0.00"),
            company_disability_complement=Decimal("0.00"),
            salary_supplements=Decimal("0.00"),
            variable_incentives=Decimal("0.00"),
            extra_pay_proration=Decimal("0.00"),
            gross_salary=worked,
            contribution_days=days,
            worked_days=days,
            incident_days=30 - days,
            it_days=0,
            non_contribution_days=30 - days,
            common_contingencies_base=worked,
            professional_contingencies_base=worked,
            unemployment_training_fogasa_base=worked,
            irpf_base=worked,
            daily_common_base=Decimal("0.00"),
            daily_professional_base=Decimal("0.00"),
            employee_common_contingencies=Decimal("0.00"),
            employee_unemployment=Decimal("0.00"),
            employee_training=Decimal("0.00"),
            employee_mei=Decimal("0.00"),
            employee_social_security=Decimal("0.00"),
            irpf_mode="manual",
            irpf_percentage=Decimal("0.00"),
            suggested_irpf_percentage=Decimal("0.00"),
            irpf=Decimal("0.00"),
            total_deductions=Decimal("0.00"),
            net_salary=worked,
            company_common_contingencies=Decimal("0.00"),
            company_unemployment=Decimal("0.00"),
            company_fogasa=Decimal("0.00"),
            company_training=Decimal("0.00"),
            company_at_ep=Decimal("0.00"),
            company_mei=Decimal("0.00"),
            company_total_social_security=Decimal("0.00"),
            company_total_cost=worked,
            status="closed",
        )

    def preview_payload(self):
        return SalaryRegularizationPreviewRequest(
            source_table_id=self.source.id,
            period_from=date(2026, 1, 1),
            period_to=date(2026, 2, 28),
            include_salary_concepts=False,
            include_extra_pay_proration=False,
        )

    def test_preview_applies_historical_remuneration_ratio(self):
        preview = build_salary_regularization_preview(self.db, self.target.id, self.preview_payload())
        self.assertEqual(preview["eligible_contracts"], 1)
        self.assertEqual(preview["payrolls_reviewed"], 2)
        self.assertEqual(preview["total_difference"], Decimal("150.00"))
        item = preview["contracts"][0]
        self.assertEqual(item["total_difference"], Decimal("150.00"))
        self.assertEqual([line["amount"] for line in item["lines"]], [Decimal("100.00"), Decimal("50.00")])
        self.assertEqual(item["lines"][1]["remuneration_ratio"], Decimal("0.5000"))

    def test_generate_complementary_payroll_and_block_duplicate(self):
        payload = SalaryRegularizationGenerateRequest(
            **self.preview_payload().model_dump(),
            contract_ids=[self.contract.id],
            irpf_mode="manual",
            irpf_percentage=Decimal("0.00"),
            status="pending",
        )
        result = generate_salary_regularizations(self.db, self.target.id, payload)
        self.assertEqual(result["generated_payrolls"], 1)
        self.assertEqual(result["total_gross"], Decimal("150.00"))
        payroll = self.db.query(Payroll).filter(Payroll.id == result["generated"][0]["payroll_id"]).first()
        self.assertEqual(payroll.period_month, 15)
        self.assertEqual(payroll.gross_salary, Decimal("150.00"))
        items = self.db.query(PayrollItem).filter(PayrollItem.payroll_id == payroll.id).all()
        self.assertEqual(len(items), 2)
        self.assertTrue(all(item.concept.code.startswith("RETRO_TABLE_") for item in items))
        self.assertTrue(all(item.concept.concept_type == "BASE_INFORMATIVA" for item in items))

        duplicate = generate_salary_regularizations(self.db, self.target.id, payload)
        self.assertEqual(duplicate["generated_payrolls"], 0)
        self.assertEqual(duplicate["skipped_contracts"], 1)
        self.assertIn("complementaria activa", duplicate["skipped"][0]["reason"])


if __name__ == "__main__":
    unittest.main()
