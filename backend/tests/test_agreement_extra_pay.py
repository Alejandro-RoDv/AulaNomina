import unittest
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.db import Base
from app.models.agreement_extra_pay import AgreementExtraPay, AgreementExtraPayConcept
from app.models.agreement_parameterization import AgreementSalaryConcept
from app.models.collective_agreement import (
    CollectiveAgreement,
    ProfessionalCategory,
    SalaryTable,
    SalaryTableRow,
)
from app.schemas.salary_table_revision import SalaryTableRevisionRequest
from app.services.agreement_extra_pay import preview_extra_pay, resolve_extra_pay_candidates
from app.services.salary_table_revision import duplicate_salary_table_revision


class AgreementExtraPayTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self._create_scenario()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _create_scenario(self):
        self.agreement = CollectiveAgreement(
            name="Convenio pagas extra",
            agreement_code="EXTRA-001",
            status="active",
        )
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

        self.db.add_all(
            [
                AgreementSalaryConcept(
                    collective_agreement_id=self.agreement.id,
                    salary_table_id=self.table.id,
                    professional_category_id=self.category.id,
                    character="salarial",
                    name="Plus disponibilidad",
                    scope="specific",
                    amount=Decimal("100.00"),
                    payment_type="mensual",
                    calculation_type="importe_fijo",
                    contributes=True,
                    taxable=True,
                    is_active=True,
                ),
                AgreementSalaryConcept(
                    collective_agreement_id=self.agreement.id,
                    salary_table_id=self.table.id,
                    professional_category_id=self.category.id,
                    character="deduccion",
                    name="Embargo",
                    scope="specific",
                    amount=Decimal("50.00"),
                    payment_type="mensual",
                    calculation_type="importe_fijo",
                    contributes=False,
                    taxable=False,
                    is_active=True,
                ),
            ]
        )
        self.db.flush()

        candidates = resolve_extra_pay_candidates(
            self.db,
            self.agreement.id,
            self.table.id,
            self.category.id,
        )
        self.candidate_by_name = {item["name"]: item for item in candidates}

        self.extra_pay = AgreementExtraPay(
            collective_agreement_id=self.agreement.id,
            salary_table_id=self.table.id,
            code="PAGA_VERANO",
            name="Paga de verano",
            payment_month=7,
            accrual_start_month=1,
            accrual_end_month=6,
            accrual_months=6,
            proration_allowed=True,
            proration_default=False,
            is_active=True,
        )
        self.db.add(self.extra_pay)
        self.db.flush()

        self.db.add_all(
            [
                AgreementExtraPayConcept(
                    extra_pay_id=self.extra_pay.id,
                    professional_category_id=None,
                    concept_key=self.candidate_by_name["Salario base"]["concept_key"],
                    concept_name="Salario base",
                    calculation_mode="percentage",
                    percentage=Decimal("100.00"),
                    is_active=True,
                    display_order=10,
                ),
                AgreementExtraPayConcept(
                    extra_pay_id=self.extra_pay.id,
                    professional_category_id=None,
                    concept_key=self.candidate_by_name["Plus convenio"]["concept_key"],
                    concept_name="Plus convenio",
                    calculation_mode="percentage",
                    percentage=Decimal("50.00"),
                    is_active=True,
                    display_order=20,
                ),
                AgreementExtraPayConcept(
                    extra_pay_id=self.extra_pay.id,
                    professional_category_id=self.category.id,
                    concept_key=self.candidate_by_name["Plus convenio"]["concept_key"],
                    concept_name="Plus convenio",
                    calculation_mode="percentage",
                    percentage=Decimal("100.00"),
                    is_active=True,
                    display_order=20,
                ),
                AgreementExtraPayConcept(
                    extra_pay_id=self.extra_pay.id,
                    professional_category_id=self.category.id,
                    concept_key=self.candidate_by_name["Plus disponibilidad"]["concept_key"],
                    concept_name="Plus disponibilidad",
                    calculation_mode="fixed",
                    fixed_amount=Decimal("25.00"),
                    is_active=True,
                    display_order=30,
                ),
            ]
        )
        self.db.commit()

    def test_candidates_exclude_deductions(self):
        names = set(self.candidate_by_name)
        self.assertIn("Salario base", names)
        self.assertIn("Plus convenio", names)
        self.assertIn("Plus disponibilidad", names)
        self.assertNotIn("Embargo", names)

    def test_preview_applies_category_override_and_proration(self):
        preview = preview_extra_pay(
            self.db,
            self.extra_pay.id,
            self.category.id,
            salary_table_id=self.table.id,
        )

        self.assertEqual(preview["included_lines"], 3)
        self.assertEqual(preview["unresolved_lines"], 0)
        self.assertEqual(preview["total_amount"], Decimal("1425.00"))
        self.assertEqual(preview["monthly_proration_amount"], Decimal("237.50"))

        amounts = {item["concept_name"]: item["computed_amount"] for item in preview["lines"]}
        self.assertEqual(amounts["Salario base"], Decimal("1200.00"))
        self.assertEqual(amounts["Plus convenio"], Decimal("200.00"))
        self.assertEqual(amounts["Plus disponibilidad"], Decimal("25.00"))

    def test_salary_table_revision_copies_extra_pay_configuration(self):
        result = duplicate_salary_table_revision(
            self.db,
            self.table.id,
            SalaryTableRevisionRequest(
                name="Tabla 2027",
                year=2027,
                status="draft",
                increment_percentage=Decimal("3.00"),
                copy_rows=True,
                copy_concepts=True,
                copy_extra_pays=True,
            ),
        )

        self.assertEqual(result["copied_extra_pays"], 1)
        self.assertEqual(result["copied_extra_pay_lines"], 4)

        copied = (
            self.db.query(AgreementExtraPay)
            .filter(AgreementExtraPay.salary_table_id == result["salary_table"].id)
            .one()
        )
        self.assertEqual(copied.name, "Paga de verano")
        self.assertEqual(copied.payment_month, 7)
        self.assertEqual(len(copied.concept_lines), 4)


if __name__ == "__main__":
    unittest.main()
