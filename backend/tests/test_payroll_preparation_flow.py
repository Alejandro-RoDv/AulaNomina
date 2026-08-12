import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.crud.payroll import get_payroll
from app.crud.payroll_salary_structure import create_payroll_item, update_payroll_item
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept
from app.schemas.payroll_preparation import PayrollGenerationRequest, PayrollPreparationEnsureRequest
from app.schemas.payroll_salary_structure import PayrollItemCreate, PayrollItemUpdate
from app.services.payroll_preparation_service import (
    PREPARATION_OVERRIDE_MARKER,
    ensure_preparation,
    generate_payrolls,
    get_preparation,
)


class PayrollPreparationFlowTest(unittest.TestCase):
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
        company = Company(name="Empresa preparación", cif="B00000999", is_active=True)
        self.db.add(company)
        self.db.flush()
        self.company = company

        employee = Employee(
            employee_code="EMP-PREP",
            company_id=company.id,
            dni="00000999R",
            first_name="Laura",
            last_name="Preparación",
            birth_date=date(1990, 1, 1),
            is_active=True,
            status="active",
        )
        self.db.add(employee)
        self.db.flush()
        self.employee = employee

        contract = Contract(
            employee_id=employee.id,
            company_id=company.id,
            contract_type="100",
            contract_code="100-PREP",
            start_date=date(2025, 1, 1),
            status="active",
            salary_base=Decimal("1800.00"),
            partiality_coefficient=100,
            pay_schedule="not_prorated_14",
        )
        self.db.add(contract)
        self.db.flush()
        self.contract = contract

        permanent = PayrollConcept(
            name="Plus convenio",
            code="PLUS_PREP",
            category="COMPLEMENTO",
            concept_type="DEVENGO",
            salary_nature="SALARIAL",
            source_type="CONTRACT",
            calculation_type="FIXED_AMOUNT",
            default_amount=Decimal("0.00"),
            default_unit_price=Decimal("0.00"),
            applies_workday_percentage=True,
            is_system=False,
            is_taxable=True,
            is_contribution_base=True,
            affects_gross=True,
            affects_net=True,
            is_active=True,
            display_order=50,
        )
        diet = PayrollConcept(
            name="Dieta",
            code="DIETA_PREP",
            category="DIETA",
            concept_type="DEVENGO",
            salary_nature="EXTRASALARIAL",
            source_type="CUSTOM",
            calculation_type="FIXED_AMOUNT",
            default_amount=Decimal("0.00"),
            default_unit_price=Decimal("0.00"),
            applies_workday_percentage=False,
            is_system=False,
            is_taxable=False,
            is_contribution_base=False,
            affects_gross=True,
            affects_net=True,
            is_active=True,
            display_order=80,
        )
        self.db.add_all([permanent, diet])
        self.db.flush()
        self.diet = diet

        self.db.add(ContractPayrollConcept(
            contract_id=contract.id,
            concept_id=permanent.id,
            description="Concepto permanente del contrato",
            quantity=Decimal("1.00"),
            unit_price=Decimal("100.00"),
            amount=Decimal("100.00"),
            is_active=True,
            display_order=50,
        ))
        self.db.commit()

    def test_draft_exposes_full_matrix_can_override_and_generate(self):
        preparation = ensure_preparation(
            self.db,
            PayrollPreparationEnsureRequest(
                employee_id=self.employee.id,
                contract_id=self.contract.id,
                period_month=8,
                period_year=2026,
            ),
        )

        self.assertEqual(preparation["status"], "draft")
        self.assertFalse(preparation["generated"])
        codes = {line["code"] for line in preparation["lines"]}
        self.assertIn("SALARIO_BASE", codes)
        self.assertIn("PLUS_PREP", codes)
        self.assertIn("SS_CONTINGENCIAS_COMUNES", codes)
        self.assertIn("BASE_CC", codes)

        # El catálogo de preparación incluye conceptos seleccionables aunque no
        # sean aplicables en ese mes concreto.
        self.assertIsNotNone(
            self.db.query(PayrollConcept).filter(PayrollConcept.code == "PRESTACION_IT").first()
        )
        self.assertIsNotNone(
            self.db.query(PayrollConcept).filter(PayrollConcept.code == "PLUS_NOCTURNIDAD").first()
        )

        create_payroll_item(
            self.db,
            preparation["payroll_id"],
            PayrollItemCreate(
                concept_id=self.diet.id,
                description="Dieta del mes",
                quantity=Decimal("1.00"),
                unit_price=Decimal("60.00"),
                amount=Decimal("60.00"),
                display_order=80,
            ),
        )

        refreshed = get_preparation(self.db, preparation["payroll_id"])
        self.assertEqual(refreshed["preview"]["gross_salary"], Decimal("1960.00"))
        self.assertEqual(get_payroll(self.db, preparation["payroll_id"]).status, "draft")

        # Una cotización automática puede sobrescribirse expresamente desde la
        # matriz sin tener que tocar el motor global ni el histórico.
        ss_line = next(line for line in refreshed["lines"] if line["code"] == "SS_CONTINGENCIAS_COMUNES")
        update_payroll_item(
            self.db,
            ss_line["id"],
            PayrollItemUpdate(
                quantity=Decimal("1.00"),
                unit_price=Decimal("1.00"),
                amount=Decimal("1.00"),
                notes=PREPARATION_OVERRIDE_MARKER,
            ),
        )

        overridden = get_preparation(self.db, preparation["payroll_id"])
        overridden_ss = next(line for line in overridden["lines"] if line["code"] == "SS_CONTINGENCIAS_COMUNES")
        self.assertEqual(overridden_ss["amount"], Decimal("1.00"))
        self.assertEqual(overridden["preview"]["gross_salary"], Decimal("1960.00"))

        generated = generate_payrolls(
            self.db,
            PayrollGenerationRequest(
                period_month=8,
                period_year=2026,
                contract_ids=[self.contract.id],
            ),
        )

        self.assertEqual(generated["generated_count"], 1)
        self.assertEqual(generated["items"][0]["source"], "prepared")
        payroll = get_payroll(self.db, preparation["payroll_id"])
        self.assertEqual(payroll.status, "calculated")
        self.assertEqual(payroll.gross_salary, Decimal("1960.00"))
        self.assertEqual(payroll.employee_common_contingencies, Decimal("1.00"))
        self.assertGreater(payroll.net_salary, Decimal("0.00"))


if __name__ == "__main__":
    unittest.main()
