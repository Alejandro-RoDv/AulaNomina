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

export async function fetchCompanyCccOptions(companyId) {
  return apiRequest(
    `/social-security-settlements/ccc-options${buildQuery({ company_id: companyId })}`,
    {},
    "Error al cargar los CCC de la empresa"
  );
}

export async function prepareSocialSecuritySettlement(payload) {
  return apiRequest(
    "/social-security-settlements/prepare",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al preparar la liquidación de Seguridad Social"
  );
}

export async function fetchSocialSecuritySettlements(filters = {}) {
  return apiRequest(
    `/social-security-settlements${buildQuery(filters)}`,
    {},
    "Error al cargar el historial de liquidaciones"
  );
}

export async function fetchSocialSecuritySettlement(settlementId) {
  return apiRequest(
    `/social-security-settlements/${encodeURIComponent(settlementId)}`,
    {},
    "Error al cargar la liquidación"
  );
}

export async function confirmSocialSecuritySettlement(settlementId, createdBy = null) {
  return apiRequest(
    `/social-security-settlements/${encodeURIComponent(settlementId)}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_by: createdBy }),
    },
    "Error al confirmar la liquidación"
  );
}

export async function generateSocialSecuritySettlement(settlementId, createdBy = null) {
  return apiRequest(
    `/social-security-settlements/${encodeURIComponent(settlementId)}/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_by: createdBy }),
    },
    "Error al generar el fichero de liquidación"
  );
}

export async function fetchCommunicationFiles(filters = {}) {
  return apiRequest(
    `/communications${buildQuery(filters)}`,
    {},
    "Error al cargar los ficheros de comunicaciones"
  );
}

export async function fetchCommunicationFile(communicationId) {
  return apiRequest(
    `/communications/${encodeURIComponent(communicationId)}`,
    {},
    "Error al cargar el fichero generado"
  );
}

export { buildQuery };
