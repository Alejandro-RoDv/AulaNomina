from datetime import date
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.models
from app.db import Base
from app.models.company import Company
from app.models.employee import Employee
from app.models.contract import Contract
from app.models.contract_lifecycle_event import ContractLifecycleEvent
from app.schemas.contract import ContractUpdate
from app.schemas.incident import IncidentCreate
from app.crud.contract import update_contract

class ContractEditHistoryTest(unittest.TestCase):
    def test_edit_keeps_previous_version_and_skips_unchanged_save(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        with sessionmaker(bind=engine)() as db:
            company = Company(name="Empresa historial", cif="B12345678")
            db.add(company)
            db.flush()
            employee = Employee(company_id=company.id, first_name="Ana", last_name="Prueba", dni="12345678Z", employee_code="HIS-1")
            db.add(employee)
            db.flush()
            contract = Contract(employee_id=employee.id, company_id=company.id, contract_type="indefinido", start_date=date(2026,1,1), salary_base=2000, status="active")
            db.add(contract)
            db.commit()
            update_contract(db, contract.id, ContractUpdate(salary_base=2200))
            event = db.query(ContractLifecycleEvent).one()
            self.assertEqual(event.event_type, "contract_edit")
            self.assertEqual(event.previous_state["salary_base"], 2000)
            self.assertEqual(event.new_state["salary_base"], 2200)
            self.assertEqual(event.previous_state["start_date"], "2026-01-01")
            update_contract(db, contract.id, ContractUpdate(salary_base=2200))
            self.assertEqual(db.query(ContractLifecycleEvent).count(), 1)
            update_contract(db, contract.id, ContractUpdate(salary_base=2300))
            events = db.query(ContractLifecycleEvent).order_by(ContractLifecycleEvent.id).all()
            self.assertEqual(events[1].previous_state["salary_base"], 2200)
            self.assertEqual(events[1].new_state["salary_base"], 2300)
        engine.dispose()

    def test_overtime_accepts_total_hours_but_not_multiple_months(self):
        payload = dict(employee_id=1, company_id=1, contract_id=1, incident_type="HORAS_EXTRA", start_date="2026-10-01", end_date="2026-10-05", hours=40, details={"hour_value":12.5})
        self.assertEqual(IncidentCreate(**payload).hours, 40)
        with self.assertRaisesRegex(ValueError, "por separado"):
            IncidentCreate(**{**payload, "end_date":"2026-11-01"})
        with self.assertRaisesRegex(ValueError, "mayor que cero"):
            IncidentCreate(**{**payload, "hours":0})
