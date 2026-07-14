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

export async function createCommunicationFile(payload) {
  return apiRequest(
    "/communications",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al incorporar el fichero de comunicación"
  );
}

export async function validateCommunicationFile(communicationId, createdBy = null) {
  return apiRequest(
    `/communications/${encodeURIComponent(communicationId)}/validate${buildQuery({ created_by: createdBy })}`,
    { method: "POST" },
    "Error al validar el fichero de comunicación"
  );
}

export async function generateCommunicationFile(communicationId, payload) {
  return apiRequest(
    `/communications/${encodeURIComponent(communicationId)}/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al adaptar el fichero de comunicación"
  );
}

export async function importCommunicationFile(payload) {
  const created = await createCommunicationFile(payload);
  const validated = await validateCommunicationFile(created.id, payload.created_by ?? null);
  if (validated.status !== "READY") return validated;
  return generateCommunicationFile(created.id, {
    content: payload.content,
    original_filename: payload.original_filename,
    metadata: {
      ...(payload.metadata || {}),
      imported_at: new Date().toISOString(),
    },
    created_by: payload.created_by ?? null,
  });
}

export async function fetchCommunicationSubmissions(filters = {}) {
  return apiRequest(
    `/communication-submissions${buildQuery(filters)}`,
    {},
    "Error al cargar el historial de envíos SILTRA"
  );
}

export async function fetchCommunicationSubmission(submissionId) {
  return apiRequest(
    `/communication-submissions/${encodeURIComponent(submissionId)}`,
    {},
    "Error al cargar el detalle del envío SILTRA"
  );
}

export async function createCommunicationSubmission(communicationFileId, createdBy = null) {
  return apiRequest(
    "/communication-submissions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communication_file_id: communicationFileId, created_by: createdBy }),
    },
    "Error al crear el intento de envío"
  );
}

export async function sendCommunicationSubmission(submissionId, createdBy = null) {
  return apiRequest(
    `/communication-submissions/${encodeURIComponent(submissionId)}/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_by: createdBy }),
    },
    "Error al transmitir el fichero"
  );
}

export async function processCommunicationSubmission(submissionId, createdBy = null) {
  return apiRequest(
    `/communication-submissions/${encodeURIComponent(submissionId)}/process`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_by: createdBy }),
    },
    "Error al procesar la respuesta simulada"
  );
}

export async function submitCommunicationFile(communicationFileId, createdBy = null) {
  return apiRequest(
    `/communications/${encodeURIComponent(communicationFileId)}/submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_by: createdBy }),
    },
    "Error al enviar el fichero a SILTRA simulado"
  );
}

export async function fetchCommunicationSubmissionResponse(submissionId) {
  return apiRequest(
    `/communication-submissions/${encodeURIComponent(submissionId)}/response`,
    {},
    "Error al cargar la respuesta SILTRA"
  );
}

export async function cancelCommunicationSubmission(submissionId, createdBy = null) {
  return apiRequest(
    `/communication-submissions/${encodeURIComponent(submissionId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_by: createdBy }),
    },
    "Error al cancelar el intento de envío"
  );
}

export { buildQuery };
