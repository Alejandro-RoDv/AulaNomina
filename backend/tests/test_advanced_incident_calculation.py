import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.db import Base
from app.models.agreement_parameterization import AgreementRuleDetail, AgreementRuleHeader
from app.models.collective_agreement import CollectiveAgreement
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.incident_detail import IncidentDetail
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.advanced_incident_calculation import advanced_regulatory_daily_base
from app.services.incident_segmenter import build_incident_segments


class AdvancedIncidentCalculationTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()

        self.company = Company(name="Empresa avanzada", cif="B35000001", is_active=True)
        self.db.add(self.company)
        self.db.flush()
        self.employee = Employee(
            employee_code="ADV-001",
            company_id=self.company.id,
            dni="35000001C",
            first_name="Marta",
            last_name="Avanzada",
            birth_date=date(1990, 1, 1),
            is_active=True,
            status="active",
        )
        self.db.add(self.employee)
        self.db.flush()
        self.agreement = CollectiveAgreement(name="Convenio avanzado", status="active", is_active=True)
        self.db.add(self.agreement)
        self.db.flush()
        self.contract = Contract(
            employee_id=self.employee.id,
            company_id=self.company.id,
            collective_agreement_id=self.agreement.id,
            contract_type="200",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="active",
            salary_base=Decimal("1500.00"),
            partiality_coefficient=50,
            monthly_hours=75,
            working_day_type="tiempo parcial",
            monthly_or_daily_contribution="monthly",
        )
        self.db.add(self.contract)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def add_payroll(self, month, common, professional, days=30):
        payroll = Payroll(
            employee_id=self.employee.id,
            contract_id=self.contract.id,
            company_id=self.company.id,
            period_month=month,
            period_year=2026,
            common_contingencies_base=Decimal(common),
            professional_contingencies_base=Decimal(professional),
            contribution_days=days,
            status="closed",
        )
        self.db.add(payroll)
        self.db.commit()
        return payroll

    def add_incident(self, start, end, process_type="common_disease"):
        incident = Incident(
            employee_id=self.employee.id,
            contract_id=self.contract.id,
            company_id=self.company.id,
            incident_type="IT",
            start_date=start,
            end_date=end,
            status="open",
        )
        self.db.add(incident)
        self.db.flush()
        incident.detail = IncidentDetail(
            incident_id=incident.id,
            details={"process_type": process_type},
        )
        self.db.commit()
        self.db.refresh(incident)
        return incident

    def test_part_time_base_uses_three_month_average(self):
        self.add_payroll(3, "1200", "1250", 30)
        self.add_payroll(4, "1350", "1400", 30)
        self.add_payroll(5, "1450", "1500", 30)
        incident = self.add_incident(date(2026, 6, 1), date(2026, 6, 10))

        daily, source, warnings, trace = advanced_regulatory_daily_base(
            self.db,
            self.contract,
            incident,
            {"regulatory_base": "common"},
            Decimal("25"),
        )

        self.assertEqual(source, "part_time_three_month_average")
        self.assertEqual(daily, Decimal("44.4444"))
        self.assertEqual(warnings, [])
        self.assertEqual(len(trace["payroll_ids"]), 3)

    def test_professional_base_adds_annual_overtime_average(self):
        self.contract.partiality_coefficient = 100
        self.contract.working_day_type = "completa"
        concept = PayrollConcept(
            name="Horas extraordinarias",
            code="INC_OVERTIME",
            category="HORAS_EXTRA",
            concept_type="DEVENGO",
            salary_nature="SALARIAL",
            source_type="SYSTEM",
            calculation_type="INCIDENT_ENGINE",
            default_amount=0,
            default_unit_price=0,
            applies_workday_percentage=False,
            is_system=True,
            is_taxable=True,
            is_contribution_base=False,
            is_active=True,
        )
        self.db.add(concept)
        self.db.flush()
        previous = self.add_payroll(5, "3000", "3300", 30)
        self.db.add(
            PayrollItem(
                payroll_id=previous.id,
                concept_id=concept.id,
                description="Horas extra mayo",
                quantity=10,
                unit_price=30,
                amount=300,
            )
        )
        self.db.commit()
        incident = self.add_incident(date(2026, 6, 1), date(2026, 6, 5), "work_accident")

        daily, source, warnings, trace = advanced_regulatory_daily_base(
            self.db,
            self.contract,
            incident,
            {"regulatory_base": "professional"},
            Decimal("100"),
        )

        self.assertEqual(source, "professional_previous_month_plus_annual_overtime")
        self.assertEqual(daily, Decimal("100.8219"))
        self.assertEqual(warnings, [])
        self.assertEqual(trace["previous_month_overtime"], "300.00")

    def test_agreement_rule_complements_it_to_full_salary(self):
        self.contract.partiality_coefficient = 100
        self.contract.salary_base = Decimal("3000")
        header = AgreementRuleHeader(
            collective_agreement_id=self.agreement.id,
            rule_type="it_complement",
            code="IT-100",
            name="Complemento IT al 100 por cien",
            scope="global",
            effective_from=date(2026, 1, 1),
            is_default=True,
            is_active=True,
            options={"process_types": ["common_disease"]},
        )
        self.db.add(header)
        self.db.flush()
        self.db.add(
            AgreementRuleDetail(
                rule_header_id=header.id,
                detail_type="band",
                code="IT-4-20",
                name="Días 4 a 20",
                display_order=1,
                minimum_value=4,
                maximum_value=20,
                percentage=Decimal("100"),
                options={},
                is_active=True,
            )
        )
        payroll = Payroll(
            employee_id=self.employee.id,
            contract_id=self.contract.id,
            company_id=self.company.id,
            period_month=6,
            period_year=2026,
            base_salary=Decimal("3000"),
            status="draft",
        )
        self.db.add(payroll)
        self.db.commit()
        incident = self.add_incident(date(2026, 6, 1), date(2026, 6, 10))

        result = build_incident_segments(
            self.db,
            payroll.id,
            self.contract,
            6,
            2026,
            [incident],
        )
        complemented = next(
            segment
            for segment in result["segments"]
            if segment["segment_type"] == "it_common_60_company"
        )

        self.assertEqual(complemented["complement_percentage"], Decimal("0.4"))
        self.assertEqual(complemented["complement_amount"], Decimal("480.00"))
        self.assertEqual(
            complemented["trace"]["agreement_rule_code"],
            "IT-100",
        )


if __name__ == "__main__":
    unittest.main()
