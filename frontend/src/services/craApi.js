import { apiRequest } from "./httpClient.js";

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  return query.toString() ? `?${query.toString()}` : "";
}

export async function fetchCraCatalog() {
  return apiRequest("/cra/catalog", {}, "Error al cargar el catálogo CRA");
}

export async function fetchCraMappings(includeInactive = true) {
  return apiRequest(
    `/cra/mappings${queryString({ include_inactive: includeInactive })}`,
    {},
    "Error al cargar la vinculación de conceptos CRA"
  );
}

export async function saveCraMapping(payrollConceptId, payload) {
  return apiRequest(
    `/cra/mappings/${encodeURIComponent(payrollConceptId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al guardar la vinculación CRA"
  );
}

export async function previewCra(payload) {
  return apiRequest(
    "/cra/preview",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al preparar la vista previa CRA"
  );
}

export async function generateCra(payload) {
  return apiRequest(
    "/cra/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al generar el fichero CRA"
  );
}

export async function fetchCraFiles(filters = {}) {
  return apiRequest(
    `/cra/files${queryString(filters)}`,
    {},
    "Error al cargar los ficheros CRA"
  );
}

export async function sendCraFile(fileId, createdBy = null) {
  return apiRequest(
    `/cra/files/${encodeURIComponent(fileId)}/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_by: createdBy }),
    },
    "Error al enviar el fichero CRA por SILTRA simulado"
  );
}
