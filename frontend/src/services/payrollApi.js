import { apiRequest } from "./httpClient";

export async function fetchPayrolls() {
  return apiRequest("/payrolls", {}, "Error al cargar nóminas");
}

export async function createPayroll(payload) {
  return apiRequest(
    "/payrolls",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

export async function updatePayroll(payrollId, payload) {
  return apiRequest(
    `/payrolls/${payrollId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
