import test from "node:test";
import assert from "node:assert/strict";
import { initialIncidentForm, buildIncidentPayload } from "../utils/incidentPayloads.js";
import { validateContractWorkflow } from "../utils/contractPayloads.js";
import { getIncidentCategory } from "../utils/incidentCategories.js";
const contract = { salary_base: 2000, monthly_hours: 160, partiality_coefficient: 100 };
const overtime = { ...initialIncidentForm, employee_id: "1", company_id: "1", contract_id: "1", start_date: "2026-10-01", incident_type: "HORAS_EXTRA", overtime_quantity: "4", overtime_contract: contract };
test("manual overtime price is configuration rather than a processed payroll result", () => {
  const payload = buildIncidentPayload({ ...overtime, overtime_amount_mode: "manual", overtime_amount: "200", generated_amount: "200" });
  assert.equal(payload.generated_amount, null); assert.equal(payload.hours, 4);
  assert.equal(payload.details.hour_value, 50); assert.equal(payload.details.requested_amount, 200);
  assert.equal(payload.details.inclusion_destination, "payroll");
});
test("overtime days convert to total hours and automatic contract price", () => {
  const payload = buildIncidentPayload({ ...overtime, overtime_unit: "days", overtime_quantity: "5", overtime_day_hours: "8" });
  assert.equal(payload.hours, 40); assert.equal(payload.days, null); assert.equal(payload.unit_type, "hours");
  assert.equal(payload.details.hour_value, 12.5); assert.equal(payload.details.requested_amount, 500);
});
test("medical benefit follows chosen subtype", () => {
  const payload = buildIncidentPayload({ ...initialIncidentForm, incident_type: "NACIMIENTO_CUIDADO", benefit_type: "temporary_disability" });
  assert.equal(payload.details.benefit_type, "birth_care");
});
test("empty draft reports Spanish required-field errors", () => {
  const errors = validateContractWorkflow({}, { status: "draft" }); assert.equal(errors.length, 3);
  assert.ok(errors.every(error => !error.includes("Value error")));
  assert.deepEqual(validateContractWorkflow({ employee_id: 1, contract_type: "indefinido", start_date: "2026-10-01" }, { status: "draft" }), []);
});
test("variations are read-only contract history", () => { assert.equal(getIncidentCategory("movement").kind, "variations"); });
