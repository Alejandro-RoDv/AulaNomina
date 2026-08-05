import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_CASE_CONTEXT_KEY,
  LAST_CASE_FEEDBACK_KEY,
  classifyCaseOperation,
  emitCaseOperationEvent,
  readActiveCaseContext,
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


test("clasifica únicamente operaciones mutables relevantes", () => {
  assert.deepEqual(classifyCaseOperation("/employees", "POST"), {
    moduleCode: "employees",
    actionCode: "create_employee",
    label: "Trabajador creado",
    method: "POST",
    path: "/employees",
  });
  assert.equal(classifyCaseOperation("/employees", "GET"), null);
  assert.equal(classifyCaseOperation("/case-assignments/4/events", "POST"), null);
});


test("lee el contexto activo guardado por la navegación del caso", () => {
  const storage = new MemoryStorage();
  storage.setItem(ACTIVE_CASE_CONTEXT_KEY, JSON.stringify({
    assignmentId: 12,
    taskId: 44,
    actionCode: "create_employee",
  }));

  assert.equal(readActiveCaseContext(storage).assignmentId, 12);
});


test("emite el evento, solicita validación y publica el feedback", async () => {
  const storage = new MemoryStorage();
  storage.setItem(ACTIVE_CASE_CONTEXT_KEY, JSON.stringify({
    assignmentId: 12,
    taskId: 44,
    actionCode: "create_employee",
    moduleCode: "employees",
    scenarioCode: "ALT-2026-021",
  }));

  let requestUrl = "";
  let requestPayload = null;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestPayload = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          feedback_message_id: 91,
          validation: { passed: true, message: "Paso completado" },
          scenario: { assignment_id: 12, completion_percentage: 33 },
        };
      },
    };
  };

  const result = await emitCaseOperationEvent({
    apiBaseUrl: "http://127.0.0.1:8000",
    path: "/employees",
    method: "POST",
    operationStatus: "success",
    responseData: { id: 77 },
    responseSummary: "Alta completada",
    httpStatus: 200,
    storage,
    fetchImpl,
  });

  assert.equal(requestUrl, "http://127.0.0.1:8000/case-assignments/12/events");
  assert.equal(requestPayload.task_id, 44);
  assert.equal(requestPayload.action_code, "create_employee");
  assert.equal(requestPayload.operation_status, "success");
  assert.equal(requestPayload.auto_validate, true);
  assert.equal(requestPayload.metadata.resource_id, 77);
  assert.equal(result.feedbackMessageId, 91);
  assert.equal(JSON.parse(storage.getItem(LAST_CASE_FEEDBACK_KEY)).assignmentId, 12);
});


test("no registra operaciones que no corresponden al paso activo", async () => {
  const storage = new MemoryStorage();
  storage.setItem(ACTIVE_CASE_CONTEXT_KEY, JSON.stringify({
    assignmentId: 12,
    taskId: 44,
    actionCode: "create_contract",
    moduleCode: "contracts",
  }));

  let called = false;
  const result = await emitCaseOperationEvent({
    apiBaseUrl: "http://127.0.0.1:8000",
    path: "/employees",
    method: "POST",
    operationStatus: "success",
    storage,
    fetchImpl: async () => {
      called = true;
      return { ok: true, json: async () => ({}) };
    },
  });

  assert.equal(result, null);
  assert.equal(called, false);
});
