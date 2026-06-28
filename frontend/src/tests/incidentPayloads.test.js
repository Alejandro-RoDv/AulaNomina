import assert from "node:assert/strict";
import test from "node:test";

import {
  getCategoryFormUpdates,
  getIncidentCategory,
  INCIDENT_CATEGORY_TABS,
} from "../utils/incidentCategories.js";
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


test("conserva la autorización y el motivo de un solapamiento revisado", () => {
  const payload = buildIncidentPayload({
    ...initialIncidentForm,
    employee_id: "1",
    contract_id: "2",
    company_id: "3",
    incident_type: "VACACIONES",
    start_date: "2026-08-03",
    end_date: "2026-08-07",
    overlap_override: true,
    overlap_reason: "Conflicto revisado por el docente",
  });
  assert.equal(payload.overlap_override, true);
  assert.equal(payload.overlap_reason, "Conflicto revisado por el docente");
});


test("cada pestaña funcional tiene un tipo de incidencia predeterminado válido", () => {
  for (const tab of INCIDENT_CATEGORY_TABS.filter((item) => item.defaultType)) {
    assert.ok(tab.types.includes(tab.defaultType), `${tab.value} tiene un tipo predeterminado inválido`);
  }
});


test("la pestaña médica selecciona IT al venir de otra categoría", () => {
  const tab = getIncidentCategory("medical");
  assert.deepEqual(getCategoryFormUpdates(tab, "VACACIONES"), {
    incident_type: "IT",
    unit_type: "days",
    payroll_effect: "pending",
  });
});


test("una pestaña conserva un subtipo compatible", () => {
  const tab = getIncidentCategory("medical");
  assert.deepEqual(getCategoryFormUpdates(tab, "RECAIDA"), {
    unit_type: "days",
    payroll_effect: "pending",
  });
});


test("horas extraordinarias activa el formulario por horas y devengo", () => {
  const tab = getIncidentCategory("overtime");
  assert.deepEqual(getCategoryFormUpdates(tab, ""), {
    incident_type: "HORAS_EXTRA",
    unit_type: "hours",
    payroll_effect: "earning",
  });
});


test("el resumen mensual no sobrescribe el formulario actual", () => {
  assert.deepEqual(getCategoryFormUpdates(getIncidentCategory("all"), "IT"), {});
});
