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
