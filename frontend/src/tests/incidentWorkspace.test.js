import assert from "node:assert/strict";
import test from "node:test";
import {
  getCategoryFormUpdates,
  getIncidentCategory,
  INCIDENT_CATEGORY_TABS,
} from "../utils/incidentCategories.js";
import {
  buildIncidentAlerts,
  filterIncidentHistory,
  incidentOverlapsMonth,
} from "../utils/incidentWorkspace.js";

test("dashboard payroll control and history are independent tabs", () => {
  assert.equal(getIncidentCategory("all").kind, "dashboard");
  assert.equal(getIncidentCategory("payroll").kind, "payroll");
  assert.equal(getIncidentCategory("history").kind, "history");
  for (const tab of INCIDENT_CATEGORY_TABS.filter((item) => item.kind === "form")) {
    assert.ok(tab.types.includes(tab.defaultType));
  }
});

test("category tabs select only compatible incident types", () => {
  assert.deepEqual(
    getCategoryFormUpdates(getIncidentCategory("medical"), "VACACIONES"),
    { incident_type: "IT", unit_type: "days", payroll_effect: "pending" }
  );
  assert.deepEqual(
    getCategoryFormUpdates(getIncidentCategory("medical"), "RECAIDA"),
    { unit_type: "days", payroll_effect: "pending" }
  );
  assert.deepEqual(getCategoryFormUpdates(getIncidentCategory("history"), "IT"), {});
  assert.deepEqual(getCategoryFormUpdates(getIncidentCategory("payroll"), "IT"), {});
});

test("monthly dashboard includes incidents crossing month boundaries", () => {
  assert.equal(
    incidentOverlapsMonth(
      { start_date: "2026-05-28", end_date: "2026-06-04" },
      2026,
      6
    ),
    true
  );
  assert.equal(
    incidentOverlapsMonth(
      { start_date: "2026-05-01", end_date: "2026-05-20" },
      2026,
      6
    ),
    false
  );
});

test("alerts prioritize regularization and recalculation", () => {
  const alerts = buildIncidentAlerts([
    { id: 1, status: "open", start_date: "2026-06-01", requires_regularization: true },
    { id: 2, status: "processed", start_date: "2026-06-02", requires_recalculation: true },
  ]);
  assert.equal(alerts[0].severity, "critical");
  assert.equal(alerts[1].severity, "warning");
});

test("global history filters worker company agreement and dates", () => {
  const incidents = [
    {
      id: 1,
      employee_id: 3,
      company_id: 2,
      agreement_key: "7",
      incident_type: "IT",
      status: "open",
      start_date: "2026-06-01",
      end_date: "2026-06-10",
      employee_name: "Ana",
    },
    {
      id: 2,
      employee_id: 4,
      company_id: 2,
      agreement_key: "8",
      incident_type: "VACACIONES",
      status: "closed",
      start_date: "2026-07-01",
      end_date: "2026-07-05",
      employee_name: "Luis",
    },
  ];
  const result = filterIncidentHistory(incidents, {
    search: "ana",
    employeeId: "3",
    companyId: "2",
    centerId: "",
    agreementKey: "7",
    incidentType: "IT",
    status: "open",
    dateFrom: "2026-06-01",
    dateTo: "2026-06-30",
  });
  assert.deepEqual(result.map((item) => item.id), [1]);
});
