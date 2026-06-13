import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 - registra todos los modelos en Base.metadata
from app.db import Base
from app.models.agreement_parameterization import AgreementSalaryConcept
from app.models.collective_agreement import (
    CollectiveAgreement,
    ProfessionalCategory,
    SalaryTable,
    SalaryTableRow,
)
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept
from app.schemas.salary_table_activation import (
    SalaryTableContractConceptAction,
    SalaryTableContractMigrationRequest,
)
from app.services.salary_table_activation import migrate_contracts_to_salary_table
from app.services.salary_table_concept_migration import (
    apply_contract_concept_actions,
    build_contract_concept_comparison,
)


class SalaryTableConceptMigrationTest(unittest.TestCase):
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

    def _create_payroll_concept(self, code, name, source_type="AGREEMENT"):
        concept = PayrollConcept(
            code=code,
            name=name,
            category="COMPLEMENTO",
            concept_type="DEVENGO",
            salary_nature="SALARIAL",
            source_type=source_type,
            agreement_id=self.agreement.id if source_type == "AGREEMENT" else None,
            calculation_type="FIXED_AMOUNT",
            default_amount=Decimal("0.00"),
            default_unit_price=Decimal("0.00"),
            applies_workday_percentage=True,
            is_system=source_type == "SYSTEM",
            is_taxable=True,
            is_contribution_base=True,
            is_active=True,
        )
        self.db.add(concept)
        self.db.flush()
        return concept

    def _create_contract_line(self, concept, amount, active=True):
        line = ContractPayrollConcept(
            contract_id=self.contract.id,
            concept_id=concept.id,
            description=concept.name,
            quantity=Decimal("1.00"),
            unit_price=Decimal("0.00"),
            amount=Decimal(amount),
            start_date=self.contract.start_date,
            is_active=active,
        )
        self.db.add(line)
        self.db.flush()
        return line

    def _create_scenario(self):
        self.agreement = CollectiveAgreement(
            name="Convenio de prueba",
            agreement_code="TEST-001",
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

        self.source_table = SalaryTable(
            collective_agreement_id=self.agreement.id,
            name="Tabla 2026",
            year=2026,
            status="historical",
            number_of_payments=14,
            amount_type="monthly",
        )
        self.target_table = SalaryTable(
            collective_agreement_id=self.agreement.id,
            name="Tabla 2027",
            year=2027,
            status="active",
            number_of_payments=14,
            amount_type="monthly",
        )
        self.db.add_all([self.source_table, self.target_table])
        self.db.flush()

        self.source_row = SalaryTableRow(
            salary_table_id=self.source_table.id,
            professional_category_id=self.category.id,
            category_name=self.category.name,
            base_salary=Decimal("1000.00"),
            agreement_plus=Decimal("100.00"),
            specific_complement=Decimal("40.00"),
            amount_unit="monthly",
        )
        self.target_row = SalaryTableRow(
            salary_table_id=self.target_table.id,
            professional_category_id=self.category.id,
            category_name=self.category.name,
            base_salary=Decimal("1100.00"),
            agreement_plus=Decimal("120.00"),
            specific_complement=Decimal("40.00"),
            amount_unit="monthly",
        )
        self.db.add_all([self.source_row, self.target_row])
        self.db.flush()

        self.employee = Employee(
            employee_code="EMP-TEST-001",
            dni="00000000T",
            first_name="Ana",
            last_name="Prueba",
            status="active",
            is_active=True,
        )
        self.db.add(self.employee)
        self.db.flush()

        self.contract = Contract(
            employee_id=self.employee.id,
            contract_type="100",
            contract_code="100",
            start_date=date(2026, 1, 1),
            status="active",
            collective_agreement_id=self.agreement.id,
            professional_category_id=self.category.id,
            salary_table_row_id=self.source_row.id,
            salary_base=Decimal("1000.00"),
        )
        self.db.add(self.contract)
        self.db.flush()

        self.db.add_all(
            [
                AgreementSalaryConcept(
                    collective_agreement_id=self.agreement.id,
                    salary_table_id=self.target_table.id,
                    professional_category_id=self.category.id,
                    character="salarial",
                    name="Plus convenio",
                    scope="specific",
                    amount=Decimal("120.00"),
                    payment_type="mensual",
                    calculation_type="importe_fijo",
                    contributes=True,
                    taxable=True,
                    is_active=True,
                ),
                AgreementSalaryConcept(
                    collective_agreement_id=self.agreement.id,
                    salary_table_id=self.target_table.id,
                    professional_category_id=self.category.id,
                    character="salarial",
                    name="Plus disponibilidad",
                    scope="specific",
                    amount=Decimal("50.00"),
                    payment_type="mensual",
                    calculation_type="importe_fijo",
                    contributes=True,
                    taxable=True,
                    is_active=True,
                ),
            ]
        )
        self.db.flush()

        self.plus_line = self._create_contract_line(
            self._create_payroll_concept(
                f"AGR_{self.agreement.id}_AGREEMENT_PLUS",
                "Plus convenio",
            ),
            "100.00",
        )
        self.specific_line = self._create_contract_line(
            self._create_payroll_concept(
                f"AGR_{self.agreement.id}_SPECIFIC_COMPLEMENT",
                "Complemento específico",
            ),
            "40.00",
            active=False,
        )
        self.old_line = self._create_contract_line(
            self._create_payroll_concept(
                f"AGR_{self.agreement.id}_OLD_PLUS",
                "Plus antiguo",
            ),
            "20.00",
        )
        self.custom_line = self._create_contract_line(
            self._create_payroll_concept(
                "CUSTOM_TEST",
                "Mejora voluntaria personal",
                source_type="CUSTOM",
            ),
            "75.00",
        )
        self.db.commit()

    def _actions_from_comparison(self, comparison):
        return [
            SalaryTableContractConceptAction(
                contract_id=self.contract.id,
                concept_key=item["concept_key"],
                action=item["proposed_action"],
            )
            for item in comparison["concept_changes"]
            if item["status"] in {"new", "changed", "reactivate", "obsolete"}
        ]

    def test_comparison_classifies_agreement_and_custom_concepts(self):
        comparison = build_contract_concept_comparison(
            self.db,
            self.contract,
            self.target_row,
        )

        self.assertEqual(comparison["new_concepts"], 1)
        self.assertEqual(comparison["changed_concepts"], 1)
        self.assertEqual(comparison["reactivated_concepts"], 1)
        self.assertEqual(comparison["obsolete_concepts"], 1)
        self.assertEqual(comparison["preserved_concepts"], 1)

        statuses = {item["name"]: item["status"] for item in comparison["concept_changes"]}
        self.assertEqual(statuses["Plus disponibilidad"], "new")
        self.assertEqual(statuses["Plus convenio"], "changed")
        self.assertEqual(statuses["Complemento específico"], "reactivate")
        self.assertEqual(statuses["Plus antiguo"], "obsolete")
        self.assertEqual(statuses["Mejora voluntaria personal"], "preserved")

    def test_selected_actions_update_only_agreement_concepts(self):
        comparison = build_contract_concept_comparison(self.db, self.contract, self.target_row)
        actions = self._actions_from_comparison(comparison)

        result = apply_contract_concept_actions(
            self.db,
            self.contract,
            self.target_row,
            actions,
        )
        self.db.commit()

        self.assertEqual(result["created"], 1)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["reactivated"], 1)
        self.assertEqual(result["deactivated"], 1)
        self.assertEqual(result["skipped"], [])

        self.db.refresh(self.plus_line)
        self.db.refresh(self.specific_line)
        self.db.refresh(self.old_line)
        self.db.refresh(self.custom_line)
        self.assertEqual(self.plus_line.amount, Decimal("120.00"))
        self.assertTrue(self.specific_line.is_active)
        self.assertFalse(self.old_line.is_active)
        self.assertTrue(self.custom_line.is_active)
        self.assertEqual(self.custom_line.amount, Decimal("75.00"))

    def test_migration_updates_row_salary_and_selected_concepts_atomically(self):
        comparison = build_contract_concept_comparison(self.db, self.contract, self.target_row)
        payload = SalaryTableContractMigrationRequest(
            contract_ids=[self.contract.id],
            update_salary_base=True,
            concept_actions=self._actions_from_comparison(comparison),
        )

        result = migrate_contracts_to_salary_table(
            self.db,
            self.target_table.id,
            payload,
        )

        self.db.refresh(self.contract)
        self.assertEqual(self.contract.salary_table_row_id, self.target_row.id)
        self.assertEqual(self.contract.salary_base, Decimal("1100.00"))
        self.assertEqual(result["migrated_contracts"], 1)
        self.assertEqual(result["salary_base_updated"], 1)
        self.assertEqual(result["concepts_created"], 1)
        self.assertEqual(result["concepts_updated"], 1)
        self.assertEqual(result["concepts_reactivated"], 1)
        self.assertEqual(result["concepts_deactivated"], 1)


if __name__ == "__main__":
    unittest.main()
