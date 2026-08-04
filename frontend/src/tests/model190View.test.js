import test from "node:test";
import assert from "node:assert/strict";

import {
  buildModel190Validations,
  filterModel190Recipients,
  recipientDisplayName,
  reconciliationDifferenceTotal,
} from "../utils/model190View.js";

const recipients = [
  {
    recipient_key: "30000001A|A|-|2026",
    recipient_type: "employee",
    nif: "30000001A",
    name: "Ana",
    surname: "Demo Fiscal",
    key: "A",
    subkey: null,
    accrual_year: 2026,
    classification_source: "automatic",
    classification_confirmed: false,
  },
  {
    recipient_key: "B00000001|G|03|2026",
    recipient_type: "professional",
    nif: "B00000001",
    name: "Consultoría",
    surname: "Inicio",
    key: "G",
    subkey: "03",
    accrual_year: 2026,
    classification_source: "override",
    classification_confirmed: true,
  },
];

test("filtra perceptores por texto, tipo, clave y devengo", () => {
  assert.equal(filterModel190Recipients(recipients, { search: "ana" }).length, 1);
  assert.equal(filterModel190Recipients(recipients, { recipientType: "professional" }).length, 1);
  assert.equal(filterModel190Recipients(recipients, { key: "g", subkey: "03" }).length, 1);
  assert.equal(filterModel190Recipients(recipients, { accrualYear: "2025" }).length, 0);
});

test("forma el nombre fiscal con apellidos delante", () => {
  assert.equal(recipientDisplayName(recipients[0]), "Demo Fiscal, Ana");
});

test("las clasificaciones automáticas son informativas y no bloquean", () => {
  const result = buildModel190Validations(
    {
      has_operations: true,
      recipients,
      capabilities: { in_kind_income: true, reductions: true, exempt_income: true },
    },
    { alerts: [] }
  );

  assert.equal(result.isValid, true);
  assert.equal(result.counts.error, 0);
  assert.equal(result.items.some((item) => item.code === "AUTOMATIC_CLASSIFICATION"), true);
});

test("detecta NIF, clave y subclave profesional obligatorios", () => {
  const result = buildModel190Validations(
    {
      has_operations: true,
      recipients: [{ recipient_key: "invalid", recipient_type: "professional", name: "Sin datos", key: "G", accrual_year: 2026 }],
      capabilities: {},
    },
    { alerts: [] }
  );

  assert.equal(result.isValid, false);
  assert.equal(result.counts.error, 2);
  assert.deepEqual(
    result.items.filter((item) => item.level === "error").map((item) => item.code).sort(),
    ["PROFESSIONAL_SUBKEY_REQUIRED", "RECIPIENT_NIF_REQUIRED"]
  );
});

test("incorpora avisos de conciliación y calcula diferencia anual absoluta", () => {
  const validation = buildModel190Validations(
    { has_operations: true, recipients: [], capabilities: {} },
    { alerts: [{ level: "warning", code: "MODEL111_MISSING", quarter: "1T", message: "Falta el 111" }] }
  );
  assert.equal(validation.counts.warning, 1);

  const difference = reconciliationDifferenceTotal({
    annual: {
      differences: {
        work: { income: "100.00", withholding: "-20.00" },
        economic_activity: { income: "0.00", withholding: "5.00" },
      },
    },
  });
  assert.equal(difference, 125);
});
