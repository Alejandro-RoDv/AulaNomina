import { apiRequest } from "./httpClient";

export function fetchEmploymentTerminations() {
  return apiRequest(
    "/employment-terminations",
    {},
    "Error al cargar extinciones y finiquitos"
  );
}

export function previewEmploymentTermination(payload) {
  return apiRequest(
    "/employment-terminations/preview",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al calcular la liquidación"
  );
}

export function createEmploymentTermination(payload) {
  return apiRequest(
    "/employment-terminations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al registrar la extinción"
  );
}

export function updateEmploymentTermination(id, payload) {
  return apiRequest(
    `/employment-terminations/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar el finiquito"
  );
}

export function finalizeEmploymentTermination(id) {
  return apiRequest(
    `/employment-terminations/${id}/finalize`,
    { method: "POST" },
    "Error al cerrar el finiquito"
  );
}

export function fetchTerminationContracts() {
  return apiRequest("/contracts", {}, "Error al cargar contratos");
}

export function fetchTerminationEmployees() {
  return apiRequest("/employees/all", {}, "Error al cargar trabajadores");
}

export function fetchBajaCandidates({ date, employeeId }) {
  const params = new URLSearchParams({
    date_from: date,
    date_to: date,
    movement_type: "BAJA",
  });
  if (employeeId) params.set("employee_id", String(employeeId));
  return apiRequest(
    `/affiliation-remittances/candidates?${params.toString()}`,
    {},
    "Error al localizar la baja de afiliación"
  );
}

export function createAffiliationBajaDraft(movementKey) {
  return apiRequest(
    "/affiliation-remittances",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movement_keys: [movementKey], created_by: null }),
    },
    "Error al preparar la baja AFI"
  );
}
