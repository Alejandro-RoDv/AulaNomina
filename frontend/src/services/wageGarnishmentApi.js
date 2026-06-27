import { apiRequest } from "./httpClient";

const BASE_PATH = "/wage-garnishments";

export function fetchWageGarnishments(filters = {}) {
  const params = new URLSearchParams();
  if (filters.companyId) params.set("company_id", filters.companyId);
  if (filters.employeeId) params.set("employee_id", filters.employeeId);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return apiRequest(`${BASE_PATH}${query ? `?${query}` : ""}`, {}, "Error al cargar los embargos");
}

export function createWageGarnishment(payload) {
  return apiRequest(
    BASE_PATH,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al guardar el embargo"
  );
}

export function updateWageGarnishment(id, payload) {
  return apiRequest(
    `${BASE_PATH}/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar el embargo"
  );
}

export function deleteWageGarnishment(id) {
  return apiRequest(`${BASE_PATH}/${id}`, { method: "DELETE" }, "Error al eliminar el embargo");
}
