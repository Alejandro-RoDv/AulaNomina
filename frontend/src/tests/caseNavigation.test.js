import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaseModuleUrl,
  getCaseActionLabel,
  resolveCaseTarget,
} from "../utils/caseNavigation.js";


test("buildCaseModuleUrl abre incidencias conservando el contexto del caso", () => {
  const url = new URL(buildCaseModuleUrl({
    actionCode: "create_incident",
    moduleCode: "incidents",
    assignmentId: 18,
    taskId: 42,
    scenarioCode: "IT-2026-008",
    employeeName: "Ana Martín",
    employeeId: 7,
    startDate: "2026-08-03",
  }, "http://127.0.0.1:5173/#mail"));

  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("page"), "incidents");
  assert.equal(url.searchParams.get("caseAction"), "create_incident");
  assert.equal(url.searchParams.get("caseAssignmentId"), "18");
  assert.equal(url.searchParams.get("caseTaskId"), "42");
  assert.equal(url.searchParams.get("scenario"), "IT-2026-008");
  assert.equal(url.searchParams.get("employee"), "Ana Martín");
  assert.equal(url.searchParams.get("employeeId"), "7");
  assert.equal(url.searchParams.get("startDate"), "2026-08-03");
  assert.equal(url.searchParams.get("incidentCategory"), "medical");
  assert.equal(url.hash, "");
});


test("buildCaseModuleUrl dirige FIE a su ruta superpuesta", () => {
  const url = new URL(buildCaseModuleUrl({
    actionCode: "reconcile_fie",
    moduleCode: "fie",
    assignmentId: 3,
  }, "http://localhost:5173/#mail"));

  assert.equal(url.hash, "#fie-inbox");
  assert.equal(url.searchParams.get("caseAssignmentId"), "3");
  assert.equal(url.searchParams.get("page"), null);
});


test("buildCaseModuleUrl filtra el histórico de nómina por trabajador y periodo", () => {
  const url = new URL(buildCaseModuleUrl({
    actionCode: "recalculate_payroll",
    moduleCode: "payrolls",
    employeeId: 9,
    period: "2026-07",
    companyId: 2,
  }, "http://localhost:5173/#mail"));

  assert.equal(url.searchParams.get("page"), "payroll-history");
  assert.equal(url.searchParams.get("employeeId"), "9");
  assert.equal(url.searchParams.get("period"), "2026-07");
  assert.equal(url.searchParams.get("companyId"), "2");
});


test("B01 abre las superficies ERP de empresa, convenio y expediente", () => {
  const companyUrl = new URL(buildCaseModuleUrl({
    actionCode: "review_company_structure",
    moduleCode: "companies",
    assignmentId: 101,
    taskId: 401,
    companyId: 7,
  }, "http://localhost:5173/"));
  assert.equal(companyUrl.searchParams.get("page"), "companies");
  assert.equal(companyUrl.searchParams.get("companyId"), "7");
  assert.equal(companyUrl.hash, "#company-detail/7/centers");
  assert.equal(getCaseActionLabel("review_company_structure", "companies"), "Revisar empresa y centro");

  const agreementUrl = new URL(buildCaseModuleUrl({
    actionCode: "review_collective_agreement_assignment",
    moduleCode: "contracts",
    employeeName: "Elena Ruiz Mora",
    companyId: 7,
  }, "http://localhost:5173/"));
  assert.equal(agreementUrl.searchParams.get("page"), "contracts");
  assert.equal(agreementUrl.searchParams.get("employee"), "Elena Ruiz Mora");
  assert.equal(getCaseActionLabel("review_collective_agreement_assignment", "contracts"), "Revisar contrato y convenio");

  const employeeUrl = new URL(buildCaseModuleUrl({
    actionCode: "review_employee_data_correction",
    moduleCode: "employees",
    employeeName: "Nuria Gómez Alba",
    companyId: 7,
  }, "http://localhost:5173/"));
  assert.equal(employeeUrl.searchParams.get("page"), "employees-list");
  assert.equal(employeeUrl.searchParams.get("employee"), "Nuria Gómez Alba");
  assert.equal(employeeUrl.searchParams.get("companyId"), "7");
});


test("B02 dirige altas temporales, formativas y variaciones al módulo de contratos", () => {
  const temporaryUrl = new URL(buildCaseModuleUrl({
    actionCode: "review_temporary_contract",
    moduleCode: "contracts",
    assignmentId: 202,
    taskId: 502,
    scenarioCode: "TRAIN-2026-HIRE-A08",
    employeeName: "Marta Soler Vidal",
    companyId: 7,
  }, "http://localhost:5173/"));
  assert.equal(temporaryUrl.searchParams.get("page"), "contracts");
  assert.equal(temporaryUrl.searchParams.get("caseAction"), "review_temporary_contract");
  assert.equal(temporaryUrl.searchParams.get("scenario"), "TRAIN-2026-HIRE-A08");
  assert.equal(temporaryUrl.searchParams.get("employee"), "Marta Soler Vidal");
  assert.equal(getCaseActionLabel("review_temporary_contract", "contracts"), "Formalizar contrato temporal");

  const alternance = resolveCaseTarget("review_alternance_contract", "contracts");
  assert.equal(alternance.page, "contracts");
  assert.equal(alternance.label, "Formalizar formación en alternancia");

  const practice = resolveCaseTarget("review_professional_practice_contract", "contracts");
  assert.equal(practice.page, "contracts");
  assert.equal(practice.label, "Formalizar práctica profesional");

  const workday = resolveCaseTarget("review_workday_variation", "contracts");
  assert.equal(workday.page, "contracts");
  assert.equal(workday.label, "Registrar variación de jornada");

  const extension = resolveCaseTarget("review_contract_extension_decision", "contracts");
  assert.equal(extension.page, "contracts");
  assert.equal(extension.label, "Revisar y prorrogar contrato");
});


test("C06 abre Contratos conservando el contexto del expediente integral", () => {
  const url = new URL(buildCaseModuleUrl({
    actionCode: "review_integrated_c06_termination",
    moduleCode: "terminations",
    assignmentId: 91,
    taskId: 301,
    scenarioCode: "TRAIN-2026-INT-C06",
    employeeName: "Lucía Prieto Solís",
    companyId: 1,
    startDate: "2026-12-31",
  }, "http://127.0.0.1:5173/#mail"));

  assert.equal(url.searchParams.get("page"), "contracts");
  assert.equal(url.searchParams.get("caseAction"), "review_integrated_c06_termination");
  assert.equal(url.searchParams.get("caseAssignmentId"), "91");
  assert.equal(url.searchParams.get("caseTaskId"), "301");
  assert.equal(url.searchParams.get("scenario"), "TRAIN-2026-INT-C06");
  assert.equal(url.searchParams.get("employee"), "Lucía Prieto Solís");
  assert.equal(url.searchParams.get("companyId"), "1");
  assert.equal(url.searchParams.get("startDate"), "2026-12-31");
  assert.equal(url.hash, "");
  assert.equal(getCaseActionLabel("review_integrated_c06_termination", "terminations"), "Abrir relación contractual");
});


test("resolveCaseTarget usa el módulo cuando la acción no está catalogada", () => {
  const target = resolveCaseTarget("accion_desconocida", "contracts");
  assert.equal(target.page, "contracts");
  assert.equal(getCaseActionLabel("accion_desconocida", "contracts"), "Abrir contratos");
});
