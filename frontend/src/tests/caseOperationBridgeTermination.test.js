import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_CASE_CONTEXT_KEY,
  classifyCaseOperation,
  emitCaseOperationEvent,
} from "../utils/caseOperationBridge.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function contextStorage(actionCode, taskId = 301) {
  const storage = new MemoryStorage();
  storage.setItem(ACTIVE_CASE_CONTEXT_KEY, JSON.stringify({
    assignmentId: 91,
    taskId,
    actionCode,
    moduleCode: actionCode.includes("affiliation") ? "affiliations" : "terminations",
    scenarioCode: "TRAIN-2026-INT-C06",
    employeeName: "Lucía Prieto Solís",
    companyId: 1,
  }));
  return storage;
}

test("clasifica operaciones persistentes de extinción pero no la previsualización", () => {
  assert.deepEqual(classifyCaseOperation("/employment-terminations", "POST"), {
    moduleCode: "terminations",
    actionCode: "manage_termination",
    label: "Extinción registrada",
    method: "POST",
    path: "/employment-terminations",
  });
  assert.deepEqual(classifyCaseOperation("/employment-terminations/17/finalize", "POST"), {
    moduleCode: "terminations",
    actionCode: "manage_termination",
    label: "Finiquito cerrado",
    method: "POST",
    path: "/employment-terminations/17/finalize",
  });
  assert.equal(classifyCaseOperation("/employment-terminations/preview", "POST"), null);
});

test("una extinción real puede validar el hito C06 aunque use una acción pedagógica específica", async () => {
  const storage = contextStorage("review_integrated_c06_termination");
  let emitted = null;

  const result = await emitCaseOperationEvent({
    apiBaseUrl: "http://127.0.0.1:8000",
    path: "/employment-terminations",
    method: "POST",
    operationStatus: "success",
    responseData: { id: 44, contract_id: 8, status: "registered" },
    storage,
    fetchImpl: async (_url, options) => {
      emitted = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          validation: { passed: true, message: "Extinción validada" },
          scenario: { assignment_id: 91 },
        }),
      };
    },
  });

  assert.equal(emitted.task_id, 301);
  assert.equal(emitted.action_code, "manage_termination");
  assert.equal(emitted.auto_validate, true);
  assert.equal(emitted.metadata.module, "terminations");
  assert.equal(result.validation.passed, true);
});

test("la generación de la baja AFI es compatible con el hito de afiliación de C06", async () => {
  const storage = contextStorage("review_integrated_c06_affiliation", 303);
  let emitted = null;

  await emitCaseOperationEvent({
    apiBaseUrl: "http://127.0.0.1:8000",
    path: "/affiliation-remittances",
    method: "POST",
    operationStatus: "success",
    responseData: { id: 71, status: "DRAFT" },
    storage,
    fetchImpl: async (_url, options) => {
      emitted = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ validation: { passed: true }, scenario: { assignment_id: 91 } }),
      };
    },
  });

  assert.equal(emitted.task_id, 303);
  assert.equal(emitted.action_code, "prepare_affiliation");
  assert.equal(emitted.metadata.module, "affiliations");
});
