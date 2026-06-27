import { apiRequest } from "./httpClient";

const BASE_PATH = "/wage-garnishments";

export function fetchWageGarnishments(filters = {}) {
  const params = new URLSearchParams();
  if (filters.companyId) params.set("company_id", filters.companyId);
  if (filters.employeeId) params.set("employee_id", filters.employeeId);
  if (filters.status) params.set("status", filters.status);
  if (filters.includeArchived) params.set("include_archived", "true");
  const query = params.toString();
  return apiRequest(`${BASE_PATH}${query ? `?${query}` : ""}`, {}, "Error al cargar los embargos");
}

export function fetchCurrentSmi(targetDate) {
  const query = targetDate ? `?target_date=${encodeURIComponent(targetDate)}` : "";
  return apiRequest(`${BASE_PATH}/smi/current${query}`, {}, "Error al cargar el SMI aplicable");
}

export function fetchSmiParameters(includeInactive = false) {
  return apiRequest(`${BASE_PATH}/smi/parameters?include_inactive=${includeInactive ? "true" : "false"}`, {}, "Error al cargar los parámetros del SMI");
}

export function createWageGarnishment(payload) {
  return apiRequest(BASE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, "Error al guardar el embargo");
}

export function updateWageGarnishment(id, payload) {
  return apiRequest(`${BASE_PATH}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, "Error al actualizar el embargo");
}

export function removeWageGarnishment(id, reason = "") {
  const params = new URLSearchParams();
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return apiRequest(`${BASE_PATH}/${id}${query ? `?${query}` : ""}`, { method: "DELETE" }, "Error al eliminar o archivar el embargo");
}

export function fetchWageGarnishmentMovements(id) {
  return apiRequest(`${BASE_PATH}/${id}/movements`, {}, "Error al cargar los movimientos del embargo");
}

export function createWageGarnishmentMovement(id, payload) {
  return apiRequest(`${BASE_PATH}/${id}/movements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, "Error al registrar el movimiento");
}

export function updateWageGarnishmentMovement(id, movementId, payload) {
  return apiRequest(`${BASE_PATH}/${id}/movements/${movementId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, "Error al actualizar el movimiento");
}

export function removeWageGarnishmentMovement(id, movementId) {
  return apiRequest(`${BASE_PATH}/${id}/movements/${movementId}`, { method: "DELETE" }, "Error al eliminar el movimiento");
}

export function fetchWageGarnishmentDocuments(id) {
  return apiRequest(`${BASE_PATH}/${id}/documents`, {}, "Error al cargar los documentos del embargo");
}

export function createWageGarnishmentDocument(id, payload) {
  return apiRequest(`${BASE_PATH}/${id}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, "Error al vincular el documento");
}
