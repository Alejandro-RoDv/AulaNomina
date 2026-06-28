import unittest
from datetime import date

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.crud.incident import create_incident, delete_incident, update_incident
from app.db import Base
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.schemas.incident import IncidentCreate, IncidentUpdate


class IncidentLifecycleTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()

        self.company = Company(name="Empresa demo incidencias", cif="B32000001", is_active=True)
        self.db.add(self.company)
        self.db.flush()
        self.employee = Employee(
            employee_code="INC-001",
            company_id=self.company.id,
            dni="32000001A",
            first_name="Ana",
            last_name="Incidencias",
            birth_date=date(1992, 5, 4),
            is_active=True,
            status="active",
        )
        self.db.add(self.employee)
        self.db.flush()
        self.contract = Contract(
            employee_id=self.employee.id,
            company_id=self.company.id,
            contract_type="100",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            status="active",
        )
        self.db.add(self.contract)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def payload(self, **overrides):
        values = {
            "employee_id": self.employee.id,
            "contract_id": self.contract.id,
            "company_id": self.company.id,
            "incident_type": "IT",
            "start_date": date(2026, 6, 1),
            "end_date": date(2026, 6, 5),
            "status": "open",
            "details": {"benefit_type": "temporary_disability"},
        }
        values.update(overrides)
        return IncidentCreate(**values)

    def test_create_inside_employment_period_and_register_audit(self):
        incident = create_incident(self.db, self.payload())
        self.assertEqual(incident.version, 1)
        self.assertEqual(incident.details["benefit_type"], "temporary_disability")
        self.assertEqual(len(incident.audit_entries), 1)
        self.assertEqual(incident.audit_entries[0].action, "created")

    def test_incident_outside_employment_period_is_rejected(self):
        with self.assertRaises(HTTPException) as error:
            create_incident(
                self.db,
                self.payload(start_date=date(2027, 1, 1), end_date=date(2027, 1, 2)),
            )
        self.assertEqual(error.exception.status_code, 400)

    def test_incompatible_overlap_requires_explicit_authorization(self):
        create_incident(self.db, self.payload())
        with self.assertRaises(HTTPException) as error:
            create_incident(
                self.db,
                self.payload(
                    incident_type="VACACIONES",
                    start_date=date(2026, 6, 3),
                    end_date=date(2026, 6, 8),
                ),
            )
        self.assertEqual(error.exception.status_code, 409)

        authorized = create_incident(
            self.db,
            self.payload(
                incident_type="VACACIONES",
                start_date=date(2026, 6, 3),
                end_date=date(2026, 6, 8),
                overlap_override=True,
                overlap_reason="Caso práctico autorizado para analizar el conflicto",
            ),
        )
        self.assertTrue(authorized.overlap_override)

    def test_optimistic_lock_prevents_stale_update(self):
        incident = create_incident(self.db, self.payload())
        with self.assertRaises(HTTPException) as error:
            update_incident(
                self.db,
                incident.id,
                IncidentUpdate(description="Cambio desde pestaña antigua", expected_version=99),
            )
        self.assertEqual(error.exception.status_code, 409)

    def test_change_affecting_closed_payroll_requires_regularization(self):
        incident = create_incident(self.db, self.payload())
        self.db.add(
            Payroll(
                employee_id=self.employee.id,
                contract_id=self.contract.id,
                company_id=self.company.id,
                period_month=6,
                period_year=2026,
                status="closed",
            )
        )
        self.db.commit()

        updated = update_incident(
            self.db,
            incident.id,
            IncidentUpdate(
                description="Parte recibido después del cierre",
                expected_version=incident.version,
                change_reason="Regularización del mes siguiente",
            ),
        )
        self.assertTrue(updated.requires_recalculation)
        self.assertTrue(updated.requires_regularization)
        self.assertEqual(updated.version, 2)
        self.assertEqual(updated.audit_entries[0].action, "updated")

    def test_delete_is_logical_and_preserves_history(self):
        incident = create_incident(self.db, self.payload())
        delete_incident(self.db, incident.id)
        cancelled = update_incident(
            self.db,
            incident.id,
            IncidentUpdate(description="Consulta posterior", expected_version=2),
        )
        self.assertTrue(cancelled.is_cancelled)
        self.assertEqual(cancelled.status, "cancelled")
        self.assertGreaterEqual(len(cancelled.audit_entries), 3)


if __name__ == "__main__":
    unittest.main()
