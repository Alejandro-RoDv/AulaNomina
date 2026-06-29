import ast
import unittest
from datetime import date
from pathlib import Path

from pydantic import ValidationError

from app.schemas.incident import IncidentCreate, IncidentUpdate


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def imports_from(path: Path, module: str) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == module:
            imported.update(alias.name for alias in node.names)
    return imported


class IncidentStructuralContractsTests(unittest.TestCase):
    def valid_create_payload(self, **overrides):
        payload = {
            "employee_id": 1,
            "contract_id": 1,
            "company_id": 1,
            "incident_type": "AUSENCIA",
            "start_date": date(2026, 6, 1),
            "status": "open",
        }
        payload.update(overrides)
        return payload

    def test_new_incident_only_accepts_initial_states(self):
        for status in ("draft", "open"):
            incident = IncidentCreate(**self.valid_create_payload(status=status))
            self.assertEqual(incident.status, status)

        for status in ("pending", "validated", "processed", "closed", "regularized", "cancelled"):
            with self.subTest(status=status):
                with self.assertRaises(ValidationError):
                    IncidentCreate(**self.valid_create_payload(status=status))

    def test_new_incident_cannot_inject_payroll_processing_result(self):
        with self.assertRaises(ValidationError):
            IncidentCreate(
                **self.valid_create_payload(
                    processed_payroll_id=10,
                    generated_amount="125.50",
                )
            )

    def test_general_update_rejects_action_only_states(self):
        for status in ("draft", "open", "pending", "validated"):
            update = IncidentUpdate(status=status)
            self.assertEqual(update.status, status)

        for status in ("processed", "closed", "regularized", "cancelled"):
            with self.subTest(status=status):
                with self.assertRaises(ValidationError):
                    IncidentUpdate(status=status)

    def test_general_update_cannot_overwrite_processing_result(self):
        with self.assertRaises(ValidationError):
            IncidentUpdate(processed_payroll_id=20)
        with self.assertRaises(ValidationError):
            IncidentUpdate(generated_amount="80.00")

    def test_routes_and_bridge_use_canonical_payroll_service(self):
        route_file = BACKEND_ROOT / "app" / "incident_routes.py"
        bridge_file = BACKEND_ROOT / "app" / "services" / "payroll_incident_bridge.py"

        route_imports = imports_from(
            route_file,
            "app.services.incident_payroll_service",
        )
        bridge_imports = imports_from(
            bridge_file,
            "app.services.incident_payroll_service",
        )

        self.assertIn("process_payroll_incidents", route_imports)
        self.assertIn("period_incidents", route_imports)
        self.assertIn("process_payroll_incidents", bridge_imports)

        legacy_route_imports = imports_from(
            route_file,
            "app.services.incident_payroll_processor",
        )
        legacy_bridge_imports = imports_from(
            bridge_file,
            "app.services.incident_payroll_processor",
        )
        self.assertNotIn("process_payroll_incidents", legacy_route_imports)
        self.assertNotIn("process_payroll_incidents", legacy_bridge_imports)


if __name__ == "__main__":
    unittest.main()
