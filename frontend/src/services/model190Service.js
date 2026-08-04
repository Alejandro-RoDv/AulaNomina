import { API_BASE_URL, apiRequest } from "./httpClient";

function queryString({ companyId, year }) {
  const params = new URLSearchParams({
    company_id: String(companyId),
    year: String(year),
  });
  return params.toString();
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
    "No se ha podido validar la importación del fichero"
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
    "No se ha podido completar la presentación simulada"
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
