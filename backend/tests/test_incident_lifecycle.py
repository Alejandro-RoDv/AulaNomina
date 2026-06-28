import unittest
from datetime import date
from decimal import Decimal

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
from app.schemas.incident_actions import (
    IncidentCancelRequest,
    IncidentConfirmationCancelRequest,
    IncidentConfirmationCreate,
    IncidentProcessRequest,
    IncidentRecalculationRequest,
)
from app.services.incident_actions import (
    build_monthly_incident_summary,
    cancel_confirmation,
    cancel_incident,
    create_confirmation,
    process_incident,
    request_incident_recalculation,
)


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

    def payroll(self, status="draft"):
        payroll = Payroll(
            employee_id=self.employee.id,
            contract_id=self.contract.id,
            company_id=self.company.id,
            period_month=6,
            period_year=2026,
            status=status,
        )
        self.db.add(payroll)
        self.db.commit()
        self.db.refresh(payroll)
        return payroll

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
        self.payroll(status="closed")

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

    def test_process_is_idempotent_and_prevents_double_payroll(self):
        incident = create_incident(self.db, self.payload())
        payroll = self.payroll()
        processed = process_incident(
            self.db,
            incident.id,
            IncidentProcessRequest(
                payroll_id=payroll.id,
                generated_amount=Decimal("125.50"),
                expected_version=incident.version,
                actor="docente-demo",
            ),
        )
        self.assertEqual(processed.status, "processed")
        self.assertEqual(processed.processed_payroll_id, payroll.id)
        self.assertEqual(processed.generated_amount, Decimal("125.50"))

        same_result = process_incident(
            self.db,
            incident.id,
            IncidentProcessRequest(
                payroll_id=payroll.id,
                generated_amount=Decimal("125.50"),
                expected_version=processed.version,
                actor="docente-demo",
            ),
        )
        self.assertEqual(same_result.version, processed.version)

    def test_confirmation_lifecycle_is_audited(self):
        incident = create_incident(self.db, self.payload())
        with_confirmation = create_confirmation(
            self.db,
            incident.id,
            IncidentConfirmationCreate(
                number="PC-001",
                confirmation_date=date(2026, 6, 3),
                confirmation_type="confirmation",
                observations="Parte demostrativo",
                actor="tecnico-demo",
                expected_incident_version=incident.version,
            ),
        )
        self.assertEqual(len(with_confirmation.confirmations), 1)
        confirmation = with_confirmation.confirmations[0]

        cancelled = cancel_confirmation(
            self.db,
            incident.id,
            confirmation.id,
            IncidentConfirmationCancelRequest(
                reason="Documento sustituido por otro parte",
                actor="tecnico-demo",
                expected_version=confirmation.version,
                expected_incident_version=with_confirmation.version,
            ),
        )
        self.assertTrue(cancelled.confirmations[0].is_cancelled)
        self.assertEqual(cancelled.audit_entries[0].action, "confirmation_cancelled")

    def test_cancel_processed_incident_requires_regularization(self):
        incident = create_incident(self.db, self.payload())
        payroll = self.payroll(status="closed")
        processed = process_incident(
            self.db,
            incident.id,
            IncidentProcessRequest(
                payroll_id=payroll.id,
                generated_amount=Decimal("80.00"),
                expected_version=incident.version,
            ),
        )
        cancelled = cancel_incident(
            self.db,
            incident.id,
            IncidentCancelRequest(
                reason="Parte médico anulado por resolución posterior",
                expected_version=processed.version,
            ),
        )
        self.assertTrue(cancelled.is_cancelled)
        self.assertTrue(cancelled.requires_recalculation)
        self.assertTrue(cancelled.requires_regularization)

    def test_recalculation_request_and_monthly_summary(self):
        incident = create_incident(self.db, self.payload())
        requested = request_incident_recalculation(
            self.db,
            incident.id,
            IncidentRecalculationRequest(
                reason="Revisión del cálculo didáctico",
                expected_version=incident.version,
            ),
        )
        self.assertTrue(requested.requires_recalculation)

        summary = build_monthly_incident_summary(
            self.db,
            self.employee.id,
            2026,
            6,
            contract_id=self.contract.id,
        )
        self.assertEqual(summary["total"], 1)
        self.assertEqual(summary["requires_recalculation"], 1)
        self.assertEqual(summary["by_type"], {"IT": 1})


if __name__ == "__main__":
    unittest.main()
