import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import app.models  # noqa: F401
from app.services import payroll_application_service


class PayrollIncidentApplicationServiceTest(unittest.TestCase):
    def test_create_processes_incidents_and_returns_reloaded_payroll(self):
        db = Mock()
        payload = Mock()
        created = SimpleNamespace(id=10, period_month=6, status="pending")
        reloaded = SimpleNamespace(id=10, period_month=6, status="calculated")

        with patch.object(payroll_application_service.payroll_crud, "create_payroll", return_value=created) as create:
            with patch.object(payroll_application_service.payroll_crud, "get_payroll", return_value=reloaded) as reload_payroll:
                with patch.object(payroll_application_service, "process_payroll_incidents") as process:
                    with patch.object(payroll_application_service, "sync_engine_concept_items", return_value={"created_items": 1, "deleted_items": 0}) as sync:
                        result = payroll_application_service.create_payroll(db, payload)

        create.assert_called_once_with(db, payload)
        process.assert_called_once_with(db, 10, actor="payroll_create")
        self.assertEqual(reload_payroll.call_count, 2)
        sync.assert_called_once()
        self.assertIs(result, reloaded)

    def test_closed_or_extra_payroll_is_not_sent_to_incident_engine(self):
        db = Mock()
        closed = SimpleNamespace(id=20, period_month=6, status="closed")
        extra = SimpleNamespace(id=21, period_month=13, status="pending")

        with patch.object(payroll_application_service, "process_payroll_incidents") as process:
            with patch.object(payroll_application_service, "sync_engine_concept_items") as sync:
                closed_result = payroll_application_service._process_and_reload(db, closed, actor="test")
                extra_result = payroll_application_service._process_and_reload(db, extra, actor="test")

        self.assertIs(closed_result, closed)
        self.assertIs(extra_result, extra)
        process.assert_not_called()
        sync.assert_not_called()

    def test_monthly_preparation_processes_only_new_payrolls(self):
        db = Mock()
        request = Mock()
        contract = SimpleNamespace(id=30)
        payroll = SimpleNamespace(
            id=40,
            period_month=6,
            period_year=2026,
            status="pending",
            contract=contract,
        )
        prepared = {
            "payrolls": [
                {"payroll_id": 40, "already_existing": False},
                {"payroll_id": 41, "already_existing": True},
            ]
        }
        rebuilt = {"payroll_id": 40, "already_existing": False, "status": "calculated"}

        with patch.object(payroll_application_service.payroll_crud, "prepare_monthly_payrolls", return_value=prepared):
            with patch.object(payroll_application_service.payroll_crud, "get_payroll", return_value=payroll):
                with patch.object(payroll_application_service.payroll_crud, "get_incident_summary", return_value=["IT"]):
                    with patch.object(payroll_application_service.payroll_crud, "build_prepare_item_from_payroll", return_value=rebuilt):
                        with patch.object(payroll_application_service, "process_payroll_incidents") as process:
                            with patch.object(payroll_application_service, "sync_engine_concept_items", return_value={"created_items": 1, "deleted_items": 0}) as sync:
                                result = payroll_application_service.prepare_monthly_payrolls(db, request)

        process.assert_called_once_with(db, 40, actor="payroll_prepare")
        sync.assert_called_once()
        self.assertEqual(result["payrolls"][0], rebuilt)
        self.assertEqual(result["payrolls"][1], {"payroll_id": 41, "already_existing": True})


if __name__ == "__main__":
    unittest.main()
