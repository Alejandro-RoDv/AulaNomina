import unittest

import app.models  # noqa: F401
import app.crud.payroll as payroll_crud


class PayrollIncidentBridgeTest(unittest.TestCase):
    def test_bridge_is_installed_before_fastapi_imports_crud_functions(self):
        self.assertTrue(payroll_crud._incident_engine_bridge_installed)
        self.assertEqual(payroll_crud.create_payroll.__name__, "create_payroll_with_incidents")
        self.assertEqual(payroll_crud.update_payroll.__name__, "update_payroll_with_incidents")


if __name__ == "__main__":
    unittest.main()
