import { apiRequest } from "./httpClient";

export async function fetchCompanyPreferences(companyId) {
  return apiRequest(
    `/companies/${companyId}/preferences`,
    {},
    "Error al cargar las preferencias de empresa"
  );
}

export async function updateCompanyPreferences(companyId, payload) {
  return apiRequest(
    `/companies/${companyId}/preferences`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al guardar las preferencias de empresa"
  );
}
