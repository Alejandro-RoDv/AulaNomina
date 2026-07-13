import test from "node:test";
import assert from "node:assert/strict";

import { buildQuery } from "../services/socialSecurityApi.js";
import {
  canConfirmSettlement,
  canGenerateSettlement,
  countSettlementIssues,
  formatPeriod,
  settlementStatusLabel,
} from "../utils/socialSecuritySettlement.js";

function settlement(overrides = {}) {
  return {
    status: "READY",
    validation_errors: [],
    communication_file_id: null,
    lines: [],
    ...overrides,
  };
}

test("buildQuery omite filtros vacíos y conserva los válidos", () => {
  assert.equal(
    buildQuery({ company_id: 4, ccc_id: "", period: null, file_type: "SOCIAL_SECURITY_SETTLEMENT" }),
    "?company_id=4&file_type=SOCIAL_SECURITY_SETTLEMENT"
  );
});

test("recuenta errores generales y advertencias de líneas", () => {
  const result = countSettlementIssues(settlement({
    validation_errors: [{ severity: "WARNING", code: "GENERAL_WARNING" }],
    lines: [
      {
        id: 1,
        payroll_id: 10,
        employee_id: 2,
        employee_name: "Ana Ejemplo",
        validation_errors: [
          { severity: "ERROR", code: "NAF_REQUIRED" },
          { severity: "WARNING", code: "PAYROLL_NOT_REVIEWED" },
        ],
      },
    ],
  }));

  assert.deepEqual(result, { errors: 1, warnings: 2 });
});

test("solo permite confirmar READY sin errores bloqueantes", () => {
  assert.equal(canConfirmSettlement(settlement()), true);
  assert.equal(canConfirmSettlement(settlement({ status: "VALIDATION_ERROR" })), false);
  assert.equal(canConfirmSettlement(settlement({
    lines: [{ validation_errors: [{ severity: "ERROR", code: "NAF_REQUIRED" }] }],
  })), false);
});

test("solo permite generar desde CONFIRMED sin fichero previo", () => {
  assert.equal(canGenerateSettlement(settlement({ status: "CONFIRMED" })), true);
  assert.equal(canGenerateSettlement(settlement({ status: "READY" })), false);
  assert.equal(canGenerateSettlement(settlement({ status: "CONFIRMED", communication_file_id: 8 })), false);
});

test("formatea periodo y etiqueta de estado", () => {
  assert.equal(formatPeriod(2026, 8), "08/2026");
  assert.equal(settlementStatusLabel("GENERATED"), "Fichero generado");
});
