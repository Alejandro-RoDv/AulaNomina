import { API_BASE_URL, apiRequest } from "./httpClient";

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function jsonOptions(method, payload) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export function fetchModel111Preview({ companyId, year, period }) {
  return apiRequest(
    withQuery("/model-111/preview", { company_id: companyId, year, period }),
    {},
    "No se ha podido calcular el Modelo 111"
  );
}

export function fetchProfessionals(companyId, includeInactive = false) {
  return apiRequest(
    withQuery("/model-111/professionals", { company_id: companyId, include_inactive: includeInactive }),
    {},
    "No se han podido cargar los profesionales"
  );
}

export function createProfessional(payload) {
  return apiRequest(
    "/model-111/professionals",
    jsonOptions("POST", payload),
    "No se ha podido guardar el profesional"
  );
}

export function updateProfessional(professionalId, payload) {
  return apiRequest(
    `/model-111/professionals/${professionalId}`,
    jsonOptions("PUT", payload),
    "No se ha podido actualizar el profesional"
  );
}

export function fetchProfessionalInvoices({ companyId, year, period }) {
  return apiRequest(
    withQuery("/model-111/invoices", { company_id: companyId, year, period }),
    {},
    "No se han podido cargar las facturas profesionales"
  );
}

export function createProfessionalInvoice(payload) {
  return apiRequest(
    "/model-111/invoices",
    jsonOptions("POST", payload),
    "No se ha podido guardar la factura profesional"
  );
}

export function updateProfessionalInvoice(invoiceId, payload) {
  return apiRequest(
    `/model-111/invoices/${invoiceId}`,
    jsonOptions("PUT", payload),
    "No se ha podido actualizar la factura profesional"
  );
}

export function fetchTaxWithholdingAdjustments({ companyId, year, period }) {
  return apiRequest(
    withQuery("/model-111/adjustments", { company_id: companyId, year, period }),
    {},
    "No se han podido cargar los ajustes fiscales"
  );
}

export function createTaxWithholdingAdjustment(payload) {
  return apiRequest(
    "/model-111/adjustments",
    jsonOptions("POST", payload),
    "No se ha podido guardar el ajuste fiscal"
  );
}

export function seedModel111Demo(companyId) {
  return apiRequest(
    withQuery("/model-111/demo-seed", { company_id: companyId }),
    { method: "POST" },
    "No se ha podido cargar el caso demostrativo"
  );
}

export function fetchModel111Declarations({ companyId, year }) {
  return apiRequest(
    withQuery("/model-111/declarations", { company_id: companyId, year }),
    {},
    "No se han podido cargar las declaraciones"
  );
}

export function fetchModel111Declaration(declarationId) {
  return apiRequest(
    `/model-111/declarations/${declarationId}`,
    {},
    "No se ha podido cargar la declaración"
  );
}

export function generateModel111Declaration(payload) {
  return apiRequest(
    "/model-111/declarations",
    jsonOptions("POST", payload),
    "No se ha podido generar la declaración"
  );
}

export function presentModel111Declaration(declarationId, payload) {
  return apiRequest(
    `/model-111/declarations/${declarationId}/present`,
    jsonOptions("POST", payload),
    "No se ha podido presentar la declaración simulada"
  );
}

export function model111ReceiptUrl(declarationId) {
  return `${API_BASE_URL}/model-111/declarations/${declarationId}/receipt`;
}
