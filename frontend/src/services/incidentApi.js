import { apiRequest } from "./httpClient";

export async function fetchIncidents() {
  return apiRequest("/incidents", {}, "Error al cargar incidencias");
}

export async function createIncident(payload) {
  return apiRequest(
    "/incidents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear incidencia"
  );
}

export async function updateIncident(incidentId, payload) {
  return apiRequest(
    `/incidents/${incidentId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar incidencia"
  );
}

export async function deleteIncident(incidentId) {
  return apiRequest(
    `/incidents/${incidentId}`,
    { method: "DELETE" },
    "Error al eliminar incidencia"
  );
}
