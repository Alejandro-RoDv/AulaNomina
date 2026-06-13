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

function deleteRequest(path, errorMessage) {
  return apiRequest(path, { method: "DELETE" }, errorMessage);
}

export async function fetchCollectiveAgreements() {
  return apiRequest("/collective-agreements", {}, "Error al cargar convenios");
}

export async function fetchCollectiveAgreement(agreementId) {
  return apiRequest(`/collective-agreements/${agreementId}`, {}, "Error al cargar convenio");
}

export async function createCollectiveAgreement(payload) {
  return jsonRequest("/collective-agreements", "POST", payload, "Error al crear convenio");
}

export async function updateCollectiveAgreement(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}`, "PUT", payload, "Error al actualizar convenio");
}

export async function archiveCollectiveAgreement(agreementId) {
  return deleteRequest(`/collective-agreements/${agreementId}`, "Error al archivar convenio");
}

export async function seedDemoCollectiveAgreement() {
  return apiRequest("/collective-agreements/seed-demo", { method: "POST" }, "Error al cargar convenio demo");
}

export async function createProfessionalGroup(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/professional-groups`, "POST", payload, "Error al crear grupo profesional");
}

export async function updateProfessionalGroup(groupId, payload) {
  return jsonRequest(`/collective-agreements/professional-groups/${groupId}`, "PUT", payload, "Error al actualizar grupo profesional");
}

export async function deleteProfessionalGroup(groupId) {
  return deleteRequest(`/collective-agreements/professional-groups/${groupId}`, "Error al eliminar grupo profesional");
}

export async function createProfessionalCategory(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/professional-categories`, "POST", payload, "Error al crear categoría profesional");
}

export async function updateProfessionalCategory(categoryId, payload) {
  return jsonRequest(`/collective-agreements/professional-categories/${categoryId}`, "PUT", payload, "Error al actualizar categoría profesional");
}

export async function deleteProfessionalCategory(categoryId) {
  return deleteRequest(`/collective-agreements/professional-categories/${categoryId}`, "Error al eliminar categoría profesional");
}

export async function createSalaryTable(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/salary-tables`, "POST", payload, "Error al crear tabla salarial");
}

export async function duplicateSalaryTableRevision(sourceTableId, payload) {
  return jsonRequest(
    `/collective-agreements/salary-tables/${sourceTableId}/duplicate`,
    "POST",
    payload,
    "Error al crear la revisión de la tabla salarial"
  );
}

export async function previewSalaryRegularization(targetTableId, payload) {
  return jsonRequest(
    `/collective-agreements/salary-tables/${targetTableId}/regularization-preview`,
    "POST",
    payload,
    "Error al calcular los atrasos de la revisión salarial"
  );
}

export async function generateSalaryRegularizations(targetTableId, payload) {
  return jsonRequest(
    `/collective-agreements/salary-tables/${targetTableId}/regularizations`,
    "POST",
    payload,
    "Error al generar las nóminas complementarias"
  );
}

export async function updateSalaryTable(salaryTableId, payload) {
  return jsonRequest(`/collective-agreements/salary-tables/${salaryTableId}`, "PUT", payload, "Error al actualizar tabla salarial");
}

export async function deleteSalaryTable(salaryTableId) {
  return deleteRequest(`/collective-agreements/salary-tables/${salaryTableId}`, "Error al eliminar tabla salarial");
}

export async function createSalaryTableRow(salaryTableId, payload) {
  return jsonRequest(`/collective-agreements/salary-tables/${salaryTableId}/rows`, "POST", payload, "Error al crear fila salarial");
}

export async function updateSalaryTableRow(rowId, payload) {
  return jsonRequest(`/collective-agreements/salary-table-rows/${rowId}`, "PUT", payload, "Error al actualizar fila salarial");
}

export async function deleteSalaryTableRow(rowId) {
  return deleteRequest(`/collective-agreements/salary-table-rows/${rowId}`, "Error al eliminar fila salarial");
}

export async function fetchAgreementSeniorityRules(agreementId, includeInactive = false) {
  const query = includeInactive ? "?include_inactive=true" : "";
  return apiRequest(
    `/collective-agreements/${agreementId}/seniority-rules${query}`,
    {},
    "Error al cargar las reglas de antigüedad"
  );
}

export async function createAgreementSeniorityRule(agreementId, payload) {
  return jsonRequest(
    `/collective-agreements/${agreementId}/seniority-rules`,
    "POST",
    payload,
    "Error al crear la regla de antigüedad"
  );
}

export async function updateAgreementSeniorityRule(ruleId, payload) {
  return jsonRequest(
    `/collective-agreements/seniority-rules/${ruleId}`,
    "PUT",
    payload,
    "Error al actualizar la regla de antigüedad"
  );
}

export async function deactivateAgreementSeniorityRule(ruleId) {
  return deleteRequest(
    `/collective-agreements/seniority-rules/${ruleId}`,
    "Error al desactivar la regla de antigüedad"
  );
}

export async function fetchAgreementSeniorityPreview(agreementId, asOf, activeContractsOnly = true) {
  const params = new URLSearchParams();
  if (asOf) params.set("as_of", asOf);
  params.set("active_contracts_only", activeContractsOnly ? "true" : "false");
  return apiRequest(
    `/collective-agreements/${agreementId}/seniority-preview?${params.toString()}`,
    {},
    "Error al calcular los vencimientos de antigüedad"
  );
}

export async function fetchContractSeniorityPreview(contractId, asOf) {
  const query = asOf ? `?as_of=${encodeURIComponent(asOf)}` : "";
  return apiRequest(
    `/contracts/${contractId}/seniority-preview${query}`,
    {},
    "Error al calcular la antigüedad del contrato"
  );
}

export async function createWorkTimeRule(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/work-time-rules`, "POST", payload, "Error al crear regla de jornada");
}

export async function updateWorkTimeRule(ruleId, payload) {
  return jsonRequest(`/collective-agreements/work-time-rules/${ruleId}`, "PUT", payload, "Error al actualizar regla de jornada");
}

export async function deleteWorkTimeRule(ruleId) {
  return deleteRequest(`/collective-agreements/work-time-rules/${ruleId}`, "Error al eliminar regla de jornada");
}

export async function createVacationRule(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/vacation-rules`, "POST", payload, "Error al crear regla de vacaciones");
}

export async function updateVacationRule(ruleId, payload) {
  return jsonRequest(`/collective-agreements/vacation-rules/${ruleId}`, "PUT", payload, "Error al actualizar regla de vacaciones");
}

export async function deleteVacationRule(ruleId) {
  return deleteRequest(`/collective-agreements/vacation-rules/${ruleId}`, "Error al eliminar regla de vacaciones");
}

export async function createLeaveRule(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/leave-rules`, "POST", payload, "Error al crear permiso");
}

export async function updateLeaveRule(ruleId, payload) {
  return jsonRequest(`/collective-agreements/leave-rules/${ruleId}`, "PUT", payload, "Error al actualizar permiso");
}

export async function deleteLeaveRule(ruleId) {
  return deleteRequest(`/collective-agreements/leave-rules/${ruleId}`, "Error al eliminar permiso");
}

export async function fetchAgreementParameterization(agreementId) {
  return apiRequest(`/collective-agreements/${agreementId}/parameterization`, {}, "Error al cargar parametrización del convenio");
}

export async function seedAgreementParameterization(agreementId) {
  return apiRequest(`/collective-agreements/${agreementId}/parameterization/seed`, { method: "POST" }, "Error al cargar parametrización base");
}

export async function createAgreementRuleHeader(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/rule-headers`, "POST", payload, "Error al crear regla de convenio");
}

export async function updateAgreementRuleHeader(ruleId, payload) {
  return jsonRequest(`/collective-agreements/rule-headers/${ruleId}`, "PUT", payload, "Error al actualizar regla de convenio");
}

export async function deleteAgreementRuleHeader(ruleId) {
  return deleteRequest(`/collective-agreements/rule-headers/${ruleId}`, "Error al eliminar regla de convenio");
}

export async function createAgreementRuleDetail(ruleId, payload) {
  return jsonRequest(`/collective-agreements/rule-headers/${ruleId}/details`, "POST", payload, "Error al crear detalle de regla");
}

export async function updateAgreementRuleDetail(detailId, payload) {
  return jsonRequest(`/collective-agreements/rule-details/${detailId}`, "PUT", payload, "Error al actualizar detalle de regla");
}

export async function deleteAgreementRuleDetail(detailId) {
  return deleteRequest(`/collective-agreements/rule-details/${detailId}`, "Error al eliminar detalle de regla");
}

export async function createAgreementConceptCatalogItem(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/concept-catalog`, "POST", payload, "Error al crear concepto de catálogo");
}

export async function updateAgreementConceptCatalogItem(itemId, payload) {
  return jsonRequest(`/collective-agreements/concept-catalog/${itemId}`, "PUT", payload, "Error al actualizar concepto de catálogo");
}

export async function deactivateAgreementConceptCatalogItem(itemId) {
  return deleteRequest(`/collective-agreements/concept-catalog/${itemId}`, "Error al desactivar concepto de catálogo");
}

export async function createAgreementSalaryConcept(agreementId, payload) {
  return jsonRequest(`/collective-agreements/${agreementId}/salary-concepts`, "POST", payload, "Error al crear concepto salarial de convenio");
}

export async function updateAgreementSalaryConcept(conceptId, payload) {
  return jsonRequest(`/collective-agreements/salary-concepts/${conceptId}`, "PUT", payload, "Error al actualizar concepto salarial de convenio");
}

export async function deleteAgreementSalaryConcept(conceptId) {
  return deleteRequest(`/collective-agreements/salary-concepts/${conceptId}`, "Error al eliminar concepto salarial de convenio");
}

export async function fetchContractAgreementParameterization(contractId) {
  return apiRequest(`/contracts/${contractId}/agreement-parameterization`, {}, "Error al cargar parametrización aplicable al contrato");
}
