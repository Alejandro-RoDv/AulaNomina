import test from "node:test";
import assert from "node:assert/strict";

import {
  getCategoryFormUpdates,
  getIncidentCategory,
  INCIDENT_CATEGORY_TABS,
} from "../utils/incidentCategories.js";

test("every functional category has a valid default incident type", () => {
  for (const tab of INCIDENT_CATEGORY_TABS.filter((item) => item.defaultType)) {
    assert.ok(tab.types.includes(tab.defaultType), `${tab.value} has an invalid default type`);
  }
});

test("medical tab selects IT when the current type belongs to another category", () => {
  const tab = getIncidentCategory("medical");
  assert.deepEqual(getCategoryFormUpdates(tab, "VACACIONES"), {
    incident_type: "IT",
    unit_type: "days",
    payroll_effect: "pending",
  });
});

test("category keeps a compatible subtype while applying its form defaults", () => {
  const tab = getIncidentCategory("medical");
  assert.deepEqual(getCategoryFormUpdates(tab, "RECAIDA"), {
    unit_type: "days",
    payroll_effect: "pending",
  });
});

test("overtime tab activates the hours and earning form", () => {
  const tab = getIncidentCategory("overtime");
  assert.deepEqual(getCategoryFormUpdates(tab, ""), {
    incident_type: "HORAS_EXTRA",
    unit_type: "hours",
    payroll_effect: "earning",
  });
});

test("summary tab does not overwrite the current form", () => {
  assert.deepEqual(getCategoryFormUpdates(getIncidentCategory("all"), "IT"), {});
});
