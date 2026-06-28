import assert from "node:assert/strict";
import test from "node:test";

import { buildIncidentPayload, buildIncidentUpdatePayload, initialIncidentForm } from "../utils/incidentPayloads.js";


test("serializa una ausencia no retribuida sin convertir false en true", () => {
  const payload = buildIncidentPayload({
    ...initialIncidentForm,
    employee_id: "1",
    contract_id: "2",
    company_id: "3",
    incident_type: "PERMISO_NO_RETRIBUIDO",
    start_date: "2026-06-10",
    paid: "false",
    cause_code: "PERMISO_NO_RETRIBUIDO",
  });
  assert.equal(payload.paid, false);
  assert.equal(payload.details.cause_code, "PERMISO_NO_RETRIBUIDO");
});


test("conserva indicadores booleanos falsos para poder desactivarlos", () => {
  const payload = buildIncidentPayload({
    ...initialIncidentForm,
    employee_id: "1",
    contract_id: "2",
    company_id: "3",
    incident_type: "VACACIONES",
    start_date: "2026-07-01",
    pay_in_payroll: false,
  });
  assert.equal(payload.details.pay_in_payroll, false);
});


test("envía la versión esperada al editar", () => {
  const payload = buildIncidentUpdatePayload({
    ...initialIncidentForm,
    incident_type: "IT",
    start_date: "2026-06-01",
    version: 4,
    change_reason: "Corrección del parte",
  });
  assert.equal(payload.expected_version, 4);
  assert.equal(payload.change_reason, "Corrección del parte");
});
