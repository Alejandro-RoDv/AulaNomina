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
  assert.deepEqual(classifyCaseOperation("/model-111/declarations/4/present", "POST"), {
    moduleCode: "tax",
    actionCode: "present_model_111",
    label: "Modelo 111 presentado",
    method: "POST",
    path: "/model-111/declarations/4/present",
  });
  assert.deepEqual(classifyCaseOperation("/incidents/42", "PATCH"), {
    moduleCode: "incidents",
    actionCode: "create_incident",
    label: "Incidencia revisada",
    method: "PATCH",
    path: "/incidents/42",
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
          professional_message_id: null,
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
  assert.equal(result.feedbackNotice, "Paso completado");
  assert.equal(JSON.parse(storage.getItem(LAST_CASE_FEEDBACK_KEY)).assignmentId, 12);
});


test("conserva el resultado de dominio de una respuesta SILTRA", async () => {
  const storage = new MemoryStorage();
  storage.setItem(ACTIVE_CASE_CONTEXT_KEY, JSON.stringify({
    assignmentId: 21,
    taskId: 90,
    actionCode: "submit_siltra",
    moduleCode: "siltra",
    scenarioCode: "LAB-2026-001",
    employeeId: 2,
    employeeName: "Javier Romero Sánchez",
    companyId: 1,
    period: "2026-05",
  }));

  let requestPayload = null;
  await emitCaseOperationEvent({
    apiBaseUrl: "http://127.0.0.1:8000",
    path: "/communication-submissions/15/process",
    method: "POST",
    operationStatus: "success",
    responseData: {
      id: 15,
      status: "REJECTED",
      response_code: "R9501",
      response_message: "El NAF es obligatorio.",
      submission_number: "SILTRA-SIM-2026-000015",
    },
    httpStatus: 200,
    storage,
    fetchImpl: async (_url, options) => {
      requestPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          feedback_message_id: null,
          professional_message_id: 201,
          validation: { passed: false, message: "Revisa la respuesta de SILTRA" },
          scenario: { assignment_id: 21 },
        }),
      };
    },
  });

  assert.equal(requestPayload.metadata.domain_status, "REJECTED");
  assert.equal(requestPayload.metadata.response_code, "R9501");
  assert.equal(requestPayload.metadata.response_message, "El NAF es obligatorio.");
  assert.equal(requestPayload.metadata.submission_number, "SILTRA-SIM-2026-000015");
  assert.equal(requestPayload.metadata.employee_name, "Javier Romero Sánchez");
  assert.equal(requestPayload.metadata.period, "2026-05");
});


test("publica que una operación externa ha generado una comunicación", async () => {
  const storage = new MemoryStorage();
  storage.setItem(ACTIVE_CASE_CONTEXT_KEY, JSON.stringify({
    assignmentId: 8,
    taskId: 19,
    actionCode: "present_model_111",
    moduleCode: "tax",
  }));

  const result = await emitCaseOperationEvent({
    apiBaseUrl: "http://127.0.0.1:8000",
    path: "/model-111/declarations/4/present",
    method: "POST",
    operationStatus: "success",
    storage,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        feedback_message_id: null,
        professional_message_id: 120,
        validation: null,
        scenario: { assignment_id: 8 },
      }),
    }),
  });

  assert.equal(result.professionalMessageId, 120);
  assert.match(result.feedbackNotice, /nueva comunicación/i);
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
