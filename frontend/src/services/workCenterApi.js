import { apiRequest } from "./httpClient";

export async function fetchWorkCenters() {
  return apiRequest("/work-centers", {}, "Error al cargar centros");
}

export async function fetchWorkCentersByCompany(companyId) {
  return apiRequest(`/work-centers/company/${companyId}`, {}, "Error al cargar centros de la empresa");
}

export async function createWorkCenter(payload) {
  return apiRequest(
    "/work-centers",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear centro"
  );
}

export async function updateWorkCenter(workCenterId, payload) {
  return apiRequest(
    `/work-centers/${workCenterId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar centro"
  );
}

export async function deleteWorkCenter(workCenterId) {
  return apiRequest(
    `/work-centers/${workCenterId}`,
    { method: "DELETE" },
    "Error al eliminar centro"
  );
}
