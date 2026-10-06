import test from "node:test";
import assert from "node:assert/strict";
import { createCompanyDemo, createCenterDemo, createEmployeeDemo, createContractDemo, eligibleDemoEmployees, COMPANY_PRESETS } from "../utils/demoFormData.js";
import { scopeCompanyData } from "../utils/companyScope.js";
import { validateContractWorkflow } from "../utils/contractPayloads.js";

const companies = [{ id: 1, name: "A", ccc: "0111/14000000124", is_active: true }, { id: 2, name: "B", is_active: true }];
const centers = [{ id: 11, company_id: 1, is_active: true }, { id: 12, company_id: 2, is_active: true }, { id: 13, company_id: 1, is_active: false }];

test("company presets change on every click and produce distinct CIFs and CCCs", () => {
  for (const kind of Object.keys(COMPANY_PRESETS)) {
    const used = [];
    for (let i = 0; i < 25; i++) {
      const demo = createCompanyDemo(kind, used);
      assert.match(demo.cif, /^B\d{8}$/);
      assert.match(demo.ccc_code, /^\d{11}$/);
      assert.notEqual(demo.name, used.at(-1)?.name);
      assert.ok(!used.some((item) => item.cif === demo.cif || item.ccc_code === demo.ccc_code));
      assert.equal(demo.main_collective_agreement, "");
      used.push(demo);
    }
  }
  assert.ok(!COMPANY_PRESETS.nonprofit);
});

test("employee generator requires a center belonging to the selected company", () => {
  assert.equal(createEmployeeDemo("", centers), null);
  assert.equal(createEmployeeDemo("99", centers), null);
  const first = createEmployeeDemo("1", centers);
  const second = createEmployeeDemo("1", centers, [first]);
  assert.equal(first.center_id, "11");
  assert.equal(second.company_id, "1");
  assert.notEqual(first.dni, second.dni);
  assert.match(second.naf, /^\d{12}$/);
  const number = Number(first.dni.slice(0, -1));
  assert.equal(first.dni.at(-1), "TRWAGMYFPDXBNJZSQVHLCKE"[number % 23]);
  assert.equal(createCenterDemo(companies[0]).general_ccc, companies[0].ccc);
});

test("contract examples are coherent full/part time and retain the selected company", () => {
  const employee = { id: 21, company_id: 1, center_id: 11, is_active: true };
  let previous;
  for (let i = 0; i < 20; i++) {
    const demo = createContractDemo(employee, companies[0]);
    assert.equal(demo.form.company_id, "1");
    assert.equal(demo.form.employee_id, "21");
    assert.equal(demo.form.center_id, "11");
    assert.notEqual(demo.extra.contract_code, previous);
    assert.deepEqual(validateContractWorkflow(demo.form, demo.extra, demo.ss), []);
    assert.equal(demo.ss.registration_date, demo.form.start_date);
    assert.equal(Number(demo.extra.partiality_coefficient), demo.extra.contract_code === "200" ? 50 : 100);
    previous = demo.extra.contract_code;
  }
  const employees = [employee, { id: 22, company_id: 2, center_id: 12 }, { id: 23, company_id: 1, center_id: 12 }];
  assert.deepEqual(eligibleDemoEmployees(employees, [], "1", centers).map((item) => item.id), [21]);
  assert.deepEqual(eligibleDemoEmployees(employees, [{ employee_id: 21, status: "active" }], "1", centers), []);
});

test("company scope filters linked data without leaking unrelated employee records", () => {
  const data = { companies, workCenters: centers, employees: [{ id: 21, company_id: 1 }, { id: 22, company_id: 2 }], contracts: [{ id: 31, company_id: 1, employee_id: 21 }], documents: [{ id: 41, employee_id: 21 }, { id: 42, employee_id: 22 }], incidents: [{ id: 51, contract_id: 31 }, { id: 52, company_id: 2 }], payrolls: [{ id: 61, company_id: 1 }, { id: 62, company_id: 2 }] };
  const scoped = scopeCompanyData(data, "1");
  assert.deepEqual(scoped.companies.map((item) => item.id), [1]);
  assert.deepEqual(scoped.documents.map((item) => item.id), [41]);
  assert.deepEqual(scoped.incidents.map((item) => item.id), [51]);
  assert.deepEqual(scoped.payrolls.map((item) => item.id), [61]);
  assert.equal(scopeCompanyData(data, ""), data);
  assert.deepEqual(scopeCompanyData(data, "99").employees, []);
});

test("company context notifies once per actual change and supports clearing", async () => {
  const originalWindow = globalThis.window;
  const storage = new Map();
  const target = new EventTarget();
  target.sessionStorage = { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  globalThis.window = target;
  try {
    const { getSelectedCompanyId, setSelectedCompanyId, subscribeSelectedCompany } = await import("../utils/companyContext.js");
    const changes = [];
    const unsubscribe = subscribeSelectedCompany((id) => changes.push(id));
    setSelectedCompanyId(1); setSelectedCompanyId("1"); setSelectedCompanyId(2); setSelectedCompanyId("");
    assert.deepEqual(changes, ["1", "2", ""]);
    assert.equal(getSelectedCompanyId(), "");
    unsubscribe(); setSelectedCompanyId(3); assert.equal(changes.length, 3);
  } finally { globalThis.window = originalWindow; }
});
