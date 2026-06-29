import ast
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from pydantic import ValidationError

from app.crud.incident import _sanitize_general_update
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
            IncidentCreate(**self.valid_create_payload(
                processed_payroll_id=10,
                generated_amount="125.50",
            ))

    def test_update_schema_accepts_known_states_for_compatibility(self):
        for status in (
            "draft", "open", "pending", "validated",
            "processed", "closed", "regularized", "cancelled",
        ):
            self.assertEqual(IncidentUpdate(status=status).status, status)
        with self.assertRaises(ValidationError):
            IncidentUpdate(status="unknown")

    def test_general_update_allows_only_editable_status_transitions(self):
        incident = SimpleNamespace(status="open", processed_payroll_id=None, generated_amount=None)
        update_data = {"status": "validated"}
        _sanitize_general_update(incident, update_data)
        self.assertEqual(update_data, {"status": "validated"})
        with self.assertRaises(HTTPException) as context:
            _sanitize_general_update(incident, {"status": "processed"})
        self.assertEqual(context.exception.status_code, 409)

    def test_general_update_accepts_unchanged_action_fields_but_rejects_overwrite(self):
        incident = SimpleNamespace(
            status="processed",
            processed_payroll_id=20,
            generated_amount="80.00",
        )
        unchanged = {
            "status": "processed",
            "processed_payroll_id": 20,
            "generated_amount": "80.0",
        }
        _sanitize_general_update(incident, unchanged)
        self.assertEqual(unchanged, {})
        with self.assertRaises(HTTPException):
            _sanitize_general_update(incident, {"generated_amount": "81.00"})
        with self.assertRaises(HTTPException):
            _sanitize_general_update(incident, {"processed_payroll_id": 21})

    def test_routes_and_payroll_application_use_canonical_services(self):
        route_file = BACKEND_ROOT / "app" / "incident_routes.py"
        main_file = BACKEND_ROOT / "app" / "main.py"
        application_file = BACKEND_ROOT / "app" / "services" / "payroll_application_service.py"
        route_imports = imports_from(route_file, "app.services.incident_payroll_service")
        application_imports = imports_from(application_file, "app.services.incident_payroll_service")
        main_imports = imports_from(main_file, "app.services.payroll_application_service")

        self.assertEqual(
            {"preview_payroll_incidents", "process_payroll_incidents"},
            route_imports,
        )
        self.assertIn("process_payroll_incidents", application_imports)
        self.assertEqual(
            {"create_payroll", "prepare_monthly_payrolls", "update_payroll"},
            main_imports,
        )
        self.assertFalse(
            imports_from(route_file, "app.services.incident_payroll_processor")
        )
        self.assertFalse(
            imports_from(application_file, "app.services.incident_payroll_processor")
        )

    def test_segmenter_uses_explicit_policy_instead_of_runtime_patch(self):
        removed_bridge = BACKEND_ROOT / "app" / "services" / "advanced_incident_bridge.py"
        models_init = BACKEND_ROOT / "app" / "models" / "__init__.py"
        segmenter = BACKEND_ROOT / "app" / "services" / "incident_segmenter.py"
        self.assertFalse(removed_bridge.exists())
        self.assertNotIn("install_advanced_incident_calculation", models_init.read_text(encoding="utf-8"))

        tree = ast.parse(segmenter.read_text(encoding="utf-8"))
        build_function = next(
            node for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "build_incident_segments"
        )
        self.assertIn("calculation_policy", [argument.arg for argument in build_function.args.args])
        runtime_attribute_assignments = [
            node for node in ast.walk(tree)
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Attribute) for target in node.targets)
        ]
        self.assertEqual(runtime_attribute_assignments, [])

    def test_payroll_crud_is_not_replaced_at_model_import_time(self):
        removed_bridge = BACKEND_ROOT / "app" / "services" / "payroll_incident_bridge.py"
        models_init = BACKEND_ROOT / "app" / "models" / "__init__.py"
        self.assertFalse(removed_bridge.exists())
        models_source = models_init.read_text(encoding="utf-8")
        self.assertNotIn("install_payroll_incident_bridge", models_source)
        self.assertNotIn("payroll_crud.create_payroll =", models_source)
        self.assertNotIn("payroll_crud.update_payroll =", models_source)

    def test_calculation_and_transaction_are_separate_services(self):
        orchestrator = BACKEND_ROOT / "app" / "services" / "incident_payroll_orchestrator.py"
        imports = imports_from(
            orchestrator,
            "app.services.incident_payroll_calculator",
        )
        self.assertEqual({"calculate_incident_payroll"}, imports)
        source = orchestrator.read_text(encoding="utf-8")
        self.assertIn("def calculate_payroll_incidents", source)
        self.assertIn("def persist_payroll_incident_calculation", source)
        self.assertIn("db.commit()", source)
        self.assertNotIn("calculate_social_security_amounts_from_bases", source)

    def test_rule_resolution_does_not_seed_during_calculation(self):
        catalog = BACKEND_ROOT / "app" / "services" / "incident_rule_catalog.py"
        tree = ast.parse(catalog.read_text(encoding="utf-8"))
        resolver = next(
            node for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "resolve_calculation_rule"
        )
        called_names = {
            node.func.id
            for node in ast.walk(resolver)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }
        self.assertNotIn("ensure_default_incident_rules", called_names)


if __name__ == "__main__":
    unittest.main()
