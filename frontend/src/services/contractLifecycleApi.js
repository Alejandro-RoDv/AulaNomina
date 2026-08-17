import { apiRequest } from "./httpClient";

export function fetchContractLifecycle(contractId) {
  return apiRequest(`/contracts/${contractId}/lifecycle`, {}, "Error al cargar el histórico contractual");
}

export function registerContractWorkdayChange(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/lifecycle/workday-change`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al registrar la variación de jornada"
  );
}

export function registerContractExtension(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/lifecycle/extension`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al registrar la prórroga contractual"
  );
}
