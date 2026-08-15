import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_CASE_CONTEXT_KEY,
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


async function emittedPayload({ trainingCode, actionCode, moduleCode, path, method = "POST" }) {
  const storage = new MemoryStorage();
  storage.setItem(ACTIVE_CASE_CONTEXT_KEY, JSON.stringify({
    assignmentId: 71,
    taskId: 81,
    trainingCode,
    actionCode,
    moduleCode,
    scenarioCode: trainingCode === "A09" ? "ALT-2026-021" : `TRAIN-2026-${trainingCode}`,
  }));

  let payload = null;
  await emitCaseOperationEvent({
    apiBaseUrl: "http://127.0.0.1:8000",
    path,
    method,
    operationStatus: "success",
    responseData: { id: 900 },
    storage,
    fetchImpl: async (_url, options) => {
      payload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ validation: null, scenario: { assignment_id: 71 } }),
      };
    },
  });
  return payload;
}


test("A07 registra la creación de contrato pero no la auto-valida", async () => {
  const payload = await emittedPayload({
    trainingCode: "A07",
    actionCode: "create_contract",
    moduleCode: "contracts",
    path: "/contracts",
  });

  assert.equal(payload.action_code, "create_contract");
  assert.equal(payload.auto_validate, false);
});


test("A09 registra la sustitución pero espera la comprobación de causa y NAF", async () => {
  const payload = await emittedPayload({
    trainingCode: "A09",
    actionCode: "create_contract",
    moduleCode: "contracts",
    path: "/contracts",
  });

  assert.equal(payload.action_code, "create_contract");
  assert.equal(payload.auto_validate, false);
});


test("A29 registra el borrador de afiliación pero espera la comprobación de la remesa", async () => {
  const payload = await emittedPayload({
    trainingCode: "A29",
    actionCode: "prepare_affiliation",
    moduleCode: "affiliations",
    path: "/affiliation-remittances",
  });

  assert.equal(payload.action_code, "prepare_affiliation");
  assert.equal(payload.auto_validate, false);
});


test("una operación ordinaria mantiene la auto-validación", async () => {
  const payload = await emittedPayload({
    trainingCode: "A04",
    actionCode: "create_employee",
    moduleCode: "employees",
    path: "/employees",
  });

  assert.equal(payload.action_code, "create_employee");
  assert.equal(payload.auto_validate, true);
});
