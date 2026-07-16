import { apiRequest } from "./httpClient.js";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

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

export async function fetchAffiliationCandidates(filters) {
  return apiRequest(
    `/affiliation-remittances/candidates${buildQuery(filters)}`,
    {},
    "Error al cargar altas, modificaciones y bajas"
  );
}

export async function fetchAffiliationDrafts(filters = {}) {
  return apiRequest(
    `/affiliation-remittances${buildQuery(filters)}`,
    {},
    "Error al cargar borradores de afiliación"
  );
}

export async function fetchAffiliationDraft(draftId) {
  return apiRequest(
    `/affiliation-remittances/${encodeURIComponent(draftId)}`,
    {},
    "Error al cargar el borrador de afiliación"
  );
}

export async function createAffiliationDraft(movementKeys, createdBy = null) {
  return jsonRequest(
    "/affiliation-remittances",
    "POST",
    { movement_keys: movementKeys, created_by: createdBy },
    "Error al crear el borrador de afiliación"
  );
}

export async function addAffiliationMovements(draftId, movementKeys, createdBy = null) {
  return jsonRequest(
    `/affiliation-remittances/${encodeURIComponent(draftId)}/movements`,
    "POST",
    { movement_keys: movementKeys, created_by: createdBy },
    "Error al cargar movimientos en el borrador"
  );
}

export async function removeAffiliationMovement(draftId, movementKey, createdBy = null) {
  return apiRequest(
    `/affiliation-remittances/${encodeURIComponent(draftId)}/movements/${encodeURIComponent(movementKey)}${buildQuery({ created_by: createdBy })}`,
    { method: "DELETE" },
    "Error al retirar el movimiento del borrador"
  );
}

export async function generateAffiliationDraft(draftId, createdBy = null) {
  return jsonRequest(
    `/affiliation-remittances/${encodeURIComponent(draftId)}/generate`,
    "POST",
    { created_by: createdBy },
    "Error al generar el fichero AFI"
  );
}

export async function sendAffiliationDraft(draftId, createdBy = null) {
  return jsonRequest(
    `/affiliation-remittances/${encodeURIComponent(draftId)}/send`,
    "POST",
    { created_by: createdBy },
    "Error al transmitir el fichero AFI"
  );
}

export async function receiveAffiliationResponse(submissionId, createdBy = null) {
  return jsonRequest(
    `/affiliation-remittances/submissions/${encodeURIComponent(submissionId)}/receive`,
    "POST",
    { created_by: createdBy },
    "Error al recibir la respuesta de afiliación"
  );
}

export { buildQuery };
