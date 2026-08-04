import assert from "node:assert/strict";
import test from "node:test";

import {
  canSignModel190,
  MODEL190_PRESENTATION_STEPS,
  model190ImportSummary,
  model190ImportTone,
  model190PresentationStartStep,
} from "../utils/model190Presentation.js";

test("presentation workflow exposes the six educational steps", () => {
  assert.deepEqual(MODEL190_PRESENTATION_STEPS, [
    "Acceso",
    "Importación",
    "Validación",
    "Revisión",
    "Firma y envío",
    "Justificante",
  ]);
});

test("import summary normalizes API counters", () => {
  assert.deepEqual(
    model190ImportSummary({
      records_read: "42",
      correct_records: "39",
      error_records: "3",
      can_present: false,
    }),
    {
      recordsRead: 42,
      correctRecords: 39,
      errorRecords: 3,
      canPresent: false,
    }
  );
});

test("presented declarations open directly on the receipt step", () => {
  assert.equal(model190PresentationStartStep({ status: "presented" }), 5);
  assert.equal(model190PresentationStartStep({ status: "generated" }), 0);
});

test("signature requires a clean import hash signer and confirmation", () => {
  const report = { can_present: true, sha256: "a".repeat(64) };
  assert.equal(canSignModel190(report, { signerName: "Ana Demo", confirmed: true }), true);
  assert.equal(canSignModel190(report, { signerName: "", confirmed: true }), false);
  assert.equal(canSignModel190(report, { signerName: "Ana Demo", confirmed: false }), false);
  assert.equal(canSignModel190({ ...report, can_present: false }, { signerName: "Ana Demo", confirmed: true }), false);
});

test("import tone distinguishes errors successful and pending reports", () => {
  assert.equal(model190ImportTone(null), "pending");
  assert.equal(model190ImportTone({ error_records: 2, can_present: false }), "error");
  assert.equal(model190ImportTone({ error_records: 0, can_present: true }), "success");
  assert.equal(model190ImportTone({ error_records: 0, already_presented: true }), "success");
});
