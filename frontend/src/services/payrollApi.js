import { API_BASE_URL, apiRequest } from "./httpClient";

function getFormVariableIncentives() {
  if (typeof document === "undefined") return 0;
  const input = document.querySelector('input[name="variable_incentives"]');
  return Number(input?.value || 0);
}

function withVariableIncentives(payload) {
  return {
    ...payload,
    variable_incentives: Number(payload.variable_incentives ?? getFormVariableIncentives() ?? 0),
  };
}

export async function fetchPayrolls() {
  return apiRequest("/payrolls", {}, "Error al cargar nóminas");
}

export async function createPayroll(payload) {
  return apiRequest(
    "/payrolls",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withVariableIncentives(payload)),
    },
    "Error al crear nómina"
  );
}

export async function prepareMonthlyPayrolls(payload) {
  return apiRequest(
    "/payrolls/prepare-monthly",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al preparar nóminas mensuales"
  );
}

export async function simulateFuturePayrolls(payload) {
  return apiRequest(
    "/payrolls/simulate-future",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al simular nóminas futuras"
  );
}

export async function updatePayroll(payrollId, payload) {
  return apiRequest(
    `/payrolls/${payrollId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withVariableIncentives(payload)),
    },
    "Error al actualizar nómina"
  );
}

export async function deletePayroll(payrollId) {
  return apiRequest(
    `/payrolls/${payrollId}`,
    { method: "DELETE" },
    "Error al eliminar nómina"
  );
}

export async function fetchPayrollConcepts(includeInactive = false) {
  const query = includeInactive ? "?include_inactive=true" : "";
  return apiRequest(`/payroll-concepts${query}`, {}, "Error al cargar conceptos salariales");
}

export async function createPayrollConcept(payload) {
  return apiRequest(
    "/payroll-concepts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear concepto retributivo"
  );
}

export async function updatePayrollConcept(conceptId, payload) {
  return apiRequest(
    `/payroll-concepts/${conceptId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar concepto retributivo"
  );
}

export async function deactivatePayrollConcept(conceptId) {
  return apiRequest(
    `/payroll-concepts/${conceptId}/deactivate`,
    { method: "POST" },
    "Error al desactivar concepto retributivo"
  );
}

export async function fetchContractPayrollConcepts(contractId, includeInactive = false) {
  const query = includeInactive ? "?include_inactive=true" : "";
  return apiRequest(`/contracts/${contractId}/payroll-concepts${query}`, {}, "Error al cargar conceptos permanentes");
}

export async function createContractPayrollConcept(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/payroll-concepts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear concepto permanente"
  );
}

export async function loadAgreementConceptsIntoContract(contractId, payload = {}) {
  return apiRequest(
    `/contracts/${contractId}/load-agreement-concepts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overwrite_salary_base: Boolean(payload.overwrite_salary_base),
        reactivate_inactive: payload.reactivate_inactive !== false,
      }),
    },
    "Error al cargar conceptos desde el convenio"
  );
}

export async function updateContractPayrollConcept(lineId, payload) {
  return apiRequest(
    `/contract-payroll-concepts/${lineId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar concepto permanente"
  );
}

export async function deactivateContractPayrollConcept(lineId) {
  return apiRequest(
    `/contract-payroll-concepts/${lineId}/deactivate`,
    { method: "POST" },
    "Error al desactivar concepto permanente"
  );
}

export async function loadContractConceptsIntoPayroll(payrollId) {
  return apiRequest(
    `/payrolls/${payrollId}/load-contract-concepts`,
    { method: "POST" },
    "Error al cargar conceptos permanentes en nómina"
  );
}

export async function fetchPayrollItems(payrollId) {
  return apiRequest(`/payrolls/${payrollId}/items`, {}, "Error al cargar líneas de nómina");
}

export async function fetchPayrollBreakdown(payrollId) {
  return apiRequest(`/payrolls/${payrollId}/breakdown`, {}, "Error al cargar desglose de nómina");
}

export async function fetchPayrollReceipt(payrollId) {
  return apiRequest(`/payrolls/${payrollId}/receipt`, {}, "Error al cargar recibo de nómina");
}

export function buildPayrollReceiptPrintUrl(payrollId) {
  return `${API_BASE_URL}/payrolls/${encodeURIComponent(payrollId)}/receipt/print`;
}

export async function fetchPayrollRegularizations(payrollId) {
  return apiRequest(
    `/payrolls/${payrollId}/regularizations`,
    {},
    "Error al cargar regularizaciones"
  );
}

export async function previewPayrollRegularization(payrollId, payload) {
  return apiRequest(
    `/payrolls/${payrollId}/regularizations/preview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al previsualizar regularización"
  );
}

export async function applyPayrollRegularization(payrollId, payload) {
  return apiRequest(
    `/payrolls/${payrollId}/regularizations/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al aplicar regularización"
  );
}

export async function previewPayrollRegularizationReversal(payrollId, payload) {
  return apiRequest(
    `/payrolls/${payrollId}/regularizations/reversal/preview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al previsualizar reversión de regularización"
  );
}

export async function applyPayrollRegularizationReversal(payrollId, payload) {
  return apiRequest(
    `/payrolls/${payrollId}/regularizations/reversal/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al aplicar reversión de regularización"
  );
}

export async function createPayrollItem(payrollId, payload) {
  return apiRequest(
    `/payrolls/${payrollId}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al añadir concepto a la nómina"
  );
}

export async function updatePayrollItem(itemId, payload) {
  return apiRequest(
    `/payroll-items/${itemId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar concepto de nómina"
  );
}

export async function deletePayrollItem(itemId) {
  return apiRequest(
    `/payroll-items/${itemId}`,
    { method: "DELETE" },
    "Error al eliminar concepto de nómina"
  );
}
