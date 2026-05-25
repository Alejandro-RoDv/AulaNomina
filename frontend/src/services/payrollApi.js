import { apiRequest } from "./httpClient";

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
