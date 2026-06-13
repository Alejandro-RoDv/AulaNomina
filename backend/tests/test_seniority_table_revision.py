import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.db import Base
from app.models.agreement_seniority import AgreementSeniorityRule
from app.models.collective_agreement import CollectiveAgreement, ProfessionalCategory, SalaryTable, SalaryTableRow
from app.schemas.salary_table_revision import SalaryTableRevisionRequest
from app.services.salary_table_revision import duplicate_salary_table_revision


class SeniorityTableRevisionTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()

        agreement = CollectiveAgreement(
            name="Convenio revisión antigüedad",
            agreement_code="REV-ANT",
            status="active",
        )
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
            effective_from=date(2026, 1, 1),
            effective_to=date(2026, 12, 31),
            status="active",
            number_of_payments=14,
            amount_type="monthly",
        )
        self.db.add(table)
        self.db.flush()
        self.db.add(
            SalaryTableRow(
                salary_table_id=table.id,
                professional_category_id=category.id,
                category_name=category.name,
                base_salary=Decimal("1200.00"),
                seniority_amount=Decimal("90.00"),
                amount_unit="monthly",
            )
        )
        self.db.add(
            AgreementSeniorityRule(
                collective_agreement_id=agreement.id,
                salary_table_id=table.id,
                professional_category_id=category.id,
                code="TRI",
                name="Trienios",
                module_years=3,
                calculation_mode="fixed_amount",
                fixed_amount=Decimal("100.00"),
                max_modules=5,
                applies_partiality=True,
                daily_proration_on_maturity=True,
                contributes=True,
                taxable=True,
                affects_extra_payments=True,
                effective_from=date(2026, 1, 1),
                effective_to=date(2026, 12, 31),
                is_active=True,
            )
        )
        self.db.commit()
        self.table = table
        self.category = category

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_revision_copies_and_increases_fixed_seniority_rule(self):
        result = duplicate_salary_table_revision(
            self.db,
            self.table.id,
            SalaryTableRevisionRequest(
                name="Tabla 2027",
                year=2027,
                effective_from=date(2027, 1, 1),
                effective_to=date(2027, 12, 31),
                status="draft",
                increment_percentage=Decimal("10.00"),
                copy_rows=True,
                copy_concepts=False,
                copy_extra_pays=False,
                copy_seniority_rules=True,
            ),
        )

        self.assertEqual(result["copied_seniority_rules"], 1)
        copied = (
            self.db.query(AgreementSeniorityRule)
            .filter(AgreementSeniorityRule.salary_table_id == result["salary_table"].id)
            .one()
        )
        self.assertEqual(copied.professional_category_id, self.category.id)
        self.assertEqual(copied.fixed_amount, Decimal("110.00"))
        self.assertEqual(copied.effective_from, date(2027, 1, 1))
        self.assertEqual(copied.effective_to, date(2027, 12, 31))
        self.assertEqual(copied.module_years, 3)
        self.assertEqual(copied.max_modules, 5)


if __name__ == "__main__":
    unittest.main()
