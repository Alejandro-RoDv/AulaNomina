import { apiRequest } from "./httpClient";

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

export async function fetchAgreementExtraPays(agreementId, salaryTableId = null) {
  const query = salaryTableId ? `?salary_table_id=${salaryTableId}` : "";
  return apiRequest(
    `/collective-agreements/${agreementId}/extra-pays${query}`,
    {},
    "Error al cargar pagas extraordinarias"
  );
}

export async function createAgreementExtraPay(agreementId, payload) {
  return jsonRequest(
    `/collective-agreements/${agreementId}/extra-pays`,
    "POST",
    payload,
    "Error al crear paga extraordinaria"
  );
}

export async function updateAgreementExtraPay(extraPayId, payload) {
  return jsonRequest(
    `/collective-agreements/extra-pays/${extraPayId}`,
    "PUT",
    payload,
    "Error al actualizar paga extraordinaria"
  );
}

export async function deleteAgreementExtraPay(extraPayId) {
  return apiRequest(
    `/collective-agreements/extra-pays/${extraPayId}`,
    { method: "DELETE" },
    "Error al eliminar paga extraordinaria"
  );
}

export async function createAgreementExtraPayConcept(extraPayId, payload) {
  return jsonRequest(
    `/collective-agreements/extra-pays/${extraPayId}/concepts`,
    "POST",
    payload,
    "Error al añadir concepto a la paga extraordinaria"
  );
}

export async function updateAgreementExtraPayConcept(conceptLineId, payload) {
  return jsonRequest(
    `/collective-agreements/extra-pay-concepts/${conceptLineId}`,
    "PUT",
    payload,
    "Error al actualizar concepto de paga extraordinaria"
  );
}

export async function deleteAgreementExtraPayConcept(conceptLineId) {
  return apiRequest(
    `/collective-agreements/extra-pay-concepts/${conceptLineId}`,
    { method: "DELETE" },
    "Error al eliminar concepto de paga extraordinaria"
  );
}

export async function fetchAgreementExtraPayCandidates(
  agreementId,
  salaryTableId,
  professionalCategoryId
) {
  return apiRequest(
    `/collective-agreements/${agreementId}/extra-pay-candidates?salary_table_id=${salaryTableId}&professional_category_id=${professionalCategoryId}`,
    {},
    "Error al cargar conceptos disponibles para la paga extraordinaria"
  );
}

export async function fetchAgreementExtraPayPreview(
  extraPayId,
  professionalCategoryId,
  salaryTableId = null
) {
  const tableQuery = salaryTableId ? `&salary_table_id=${salaryTableId}` : "";
  return apiRequest(
    `/collective-agreements/extra-pays/${extraPayId}/preview?professional_category_id=${professionalCategoryId}${tableQuery}`,
    {},
    "Error al calcular la paga extraordinaria"
  );
}
