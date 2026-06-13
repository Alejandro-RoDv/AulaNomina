import { apiRequest } from "./httpClient";

function jsonRequest(path, method, payload, errorMessage) {
  return apiRequest(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    errorMessage
  );
}

export async function fetchSalaryTableActivationPreview(tableId, activeContractsOnly = true) {
  const query = activeContractsOnly ? "true" : "false";
  return apiRequest(
    `/collective-agreements/salary-tables/${tableId}/activation-preview?active_contracts_only=${query}`,
    {},
    "Error al revisar la activación de la tabla salarial"
  );
}

export async function activateSalaryTable(tableId) {
  return apiRequest(
    `/collective-agreements/salary-tables/${tableId}/activate`,
    { method: "POST" },
    "Error al activar la tabla salarial"
  );
}

export async function migrateContractsToSalaryTable(tableId, payload) {
  return jsonRequest(
    `/collective-agreements/salary-tables/${tableId}/migrate-contracts`,
    "POST",
    payload,
    "Error al migrar contratos a la tabla salarial"
  );
}
