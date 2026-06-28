import unittest
from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.incident import Incident
from app.models.incident_detail import IncidentDetail
from app.services.vacation_balance import vacation_balance


class VacationBalanceTest(unittest.TestCase):
    def test_balance(self):
        engine = create_engine("sqlite+pysqlite:///:memory:")
        db = sessionmaker(bind=engine)()
        Base.metadata.create_all(engine)
        company = Company(name="Empresa", cif="B37000001", is_active=True)
        db.add(company)
        db.flush()
        employee = Employee(employee_code="VAC-1", company_id=company.id, dni="37000001E", first_name="Ana", last_name="Vacaciones", birth_date=date(1990, 1, 1), is_active=True, status="active")
        db.add(employee)
        db.flush()
        contract = Contract(employee_id=employee.id, company_id=company.id, contract_type="100", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), status="active", salary_base=Decimal("3000"), partiality_coefficient=100)
        db.add(contract)
        db.flush()
        incident = Incident(employee_id=employee.id, contract_id=contract.id, company_id=company.id, incident_type="VACACIONES", start_date=date(2026, 7, 1), end_date=date(2026, 7, 5), status="open")
        db.add(incident)
        db.flush()
        incident.detail = IncidentDetail(incident_id=incident.id, details={})
        db.commit()
        result = vacation_balance(db, employee.id, 2026, contract.id)
        self.assertEqual(result["accrued"], Decimal("30.0000"))
        self.assertEqual(result["taken"], Decimal("5.0000"))
        self.assertEqual(result["balance"], Decimal("25.0000"))
        db.close()
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
