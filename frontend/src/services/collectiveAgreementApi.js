import { apiRequest } from "./httpClient";

export async function fetchCollectiveAgreements() {
  return apiRequest("/collective-agreements", {}, "Error al cargar convenios");
}

export async function fetchCollectiveAgreement(agreementId) {
  return apiRequest(`/collective-agreements/${agreementId}`, {}, "Error al cargar convenio");
}

export async function createCollectiveAgreement(payload) {
  return apiRequest(
    "/collective-agreements",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear convenio"
  );
}

export async function updateCollectiveAgreement(agreementId, payload) {
  return apiRequest(
    `/collective-agreements/${agreementId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar convenio"
  );
}

export async function archiveCollectiveAgreement(agreementId) {
  return apiRequest(
    `/collective-agreements/${agreementId}`,
    { method: "DELETE" },
    "Error al archivar convenio"
  );
}

export async function seedDemoCollectiveAgreement() {
  return apiRequest(
    "/collective-agreements/seed-demo",
    { method: "POST" },
    "Error al cargar convenio demo"
  );
}

export async function createProfessionalGroup(agreementId, payload) {
  return apiRequest(
    `/collective-agreements/${agreementId}/professional-groups`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear grupo profesional"
  );
}

export async function createProfessionalCategory(agreementId, payload) {
  return apiRequest(
    `/collective-agreements/${agreementId}/professional-categories`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear categoría profesional"
  );
}

export async function createSalaryTable(agreementId, payload) {
  return apiRequest(
    `/collective-agreements/${agreementId}/salary-tables`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear tabla salarial"
  );
}

export async function createSalaryTableRow(salaryTableId, payload) {
  return apiRequest(
    `/collective-agreements/salary-tables/${salaryTableId}/rows`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear fila salarial"
  );
}

export async function createWorkTimeRule(agreementId, payload) {
  return apiRequest(
    `/collective-agreements/${agreementId}/work-time-rules`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear regla de jornada"
  );
}

export async function createVacationRule(agreementId, payload) {
  return apiRequest(
    `/collective-agreements/${agreementId}/vacation-rules`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear regla de vacaciones"
  );
}

export async function createLeaveRule(agreementId, payload) {
  return apiRequest(
    `/collective-agreements/${agreementId}/leave-rules`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear permiso"
  );
}
