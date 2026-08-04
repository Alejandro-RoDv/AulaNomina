import { API_BASE_URL, apiRequest } from "./httpClient";

function queryString({ companyId, year }) {
  const params = new URLSearchParams({
    company_id: String(companyId),
    year: String(year),
  });
  return params.toString();
}

function companyQuery(companyId) {
  const params = new URLSearchParams();
  if (companyId !== undefined && companyId !== null && companyId !== "") {
    params.set("company_id", String(companyId));
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function fetchModel190Preview({ companyId, year }) {
  return apiRequest(
    `/model-190/preview?${queryString({ companyId, year })}`,
    {},
    "No se ha podido calcular el Modelo 190"
  );
}

export function fetchModel190Reconciliation({ companyId, year }) {
  return apiRequest(
    `/model-190/reconciliation?${queryString({ companyId, year })}`,
    {},
    "No se ha podido conciliar el Modelo 190 con los Modelos 111"
  );
}

export function fetchModel190Validations({ companyId, year }) {
  return apiRequest(
    `/model-190/validations?${queryString({ companyId, year })}`,
    {},
    "No se han podido validar los datos del Modelo 190"
  );
}

export function fetchModel190DemoStatus(companyId) {
  return apiRequest(
    `/model-190/demo-status${companyQuery(companyId)}`,
    {},
    "No se ha podido consultar el caso demo del Modelo 190"
  );
}

export function seedModel190Demo(companyId = null) {
  return apiRequest(
    `/model-190/demo-seed${companyQuery(companyId)}`,
    { method: "POST" },
    "No se ha podido preparar el caso demo integral del Modelo 190"
  );
}

export function correctModel190Demo(companyId) {
  return apiRequest(
    `/model-190/demo-correct${companyQuery(companyId)}`,
    { method: "POST" },
    "No se ha podido corregir el caso demo del Modelo 190"
  );
}

export function fetchModel190Declarations({ companyId, year }) {
  return apiRequest(
    `/model-190/declarations?${queryString({ companyId, year })}`,
    {},
    "No se ha podido cargar el histórico del Modelo 190"
  );
}

export function fetchModel190Declaration(declarationId) {
  return apiRequest(
    `/model-190/declarations/${declarationId}`,
    {},
    "No se ha podido abrir la declaración del Modelo 190"
  );
}

export function generateModel190Declaration(payload) {
  return apiRequest(
    "/model-190/declarations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "No se ha podido generar la declaración del Modelo 190"
  );
}

export function fetchModel190ImportValidation(declarationId) {
  return apiRequest(
    `/model-190/declarations/${declarationId}/import-validation`,
    {},
    "No se ha podido validar el fichero del Modelo 190"
  );
}

export function presentModel190Declaration(declarationId, payload) {
  return apiRequest(
    `/model-190/declarations/${declarationId}/present`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "No se ha podido presentar el Modelo 190"
  );
}

export function model190FileUrl(declarationId, format = "fixed_width") {
  const params = new URLSearchParams({ format });
  return `${API_BASE_URL}/model-190/declarations/${declarationId}/file?${params.toString()}`;
}

export function model190ErrorReportUrl(declarationId) {
  return `${API_BASE_URL}/model-190/declarations/${declarationId}/errors`;
}

export function model190ReceiptUrl(declarationId) {
  return `${API_BASE_URL}/model-190/declarations/${declarationId}/receipt`;
}

export function model190AnnualSummaryUrl(declarationId) {
  return `${API_BASE_URL}/model-190/declarations/${declarationId}/annual-summary`;
}

export function model190RecipientsDocumentUrl(declarationId) {
  return `${API_BASE_URL}/model-190/declarations/${declarationId}/recipients-document`;
}

export function model190CertificatesDirectoryUrl(declarationId) {
  return `${API_BASE_URL}/model-190/declarations/${declarationId}/certificates`;
}

export function model190RecipientCertificateUrl(declarationId, recipientId) {
  return `${API_BASE_URL}/model-190/declarations/${declarationId}/certificates/${recipientId}`;
}

export function model190CertificatesArchiveUrl(declarationId) {
  return `${API_BASE_URL}/model-190/declarations/${declarationId}/certificates.zip`;
}
