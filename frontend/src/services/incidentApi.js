import { apiRequest } from "./httpClient";

export async function fetchIncidents() {
  return apiRequest("/incidents", {}, "Error al cargar incidencias");
}

export async function createIncident(payload) {
  return apiRequest(
    "/incidents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear incidencia"
  );
}

export async function updateIncident(incidentId, payload) {
  return apiRequest(
    `/incidents/${incidentId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar incidencia"
  );
}

export async function deleteIncident(incidentId) {
  return apiRequest(
    `/incidents/${incidentId}`,
    { method: "DELETE" },
    "Error al anular incidencia"
  );
}

export async function cancelIncident(incidentId, payload) {
  return apiRequest(
    `/incidents/${incidentId}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al anular incidencia"
  );
}

export async function processIncident(incidentId, payload) {
  return apiRequest(
    `/incidents/${incidentId}/process`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al procesar incidencia"
  );
}

export async function requestIncidentRecalculation(incidentId, payload) {
  return apiRequest(
    `/incidents/${incidentId}/request-recalculation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al solicitar recálculo"
  );
}

export async function createIncidentConfirmation(incidentId, payload) {
  return apiRequest(
    `/incidents/${incidentId}/confirmations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear parte de confirmación"
  );
}

export async function updateIncidentConfirmation(incidentId, confirmationId, payload) {
  return apiRequest(
    `/incidents/${incidentId}/confirmations/${confirmationId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar parte de confirmación"
  );
}

export async function cancelIncidentConfirmation(incidentId, confirmationId, payload) {
  return apiRequest(
    `/incidents/${incidentId}/confirmations/${confirmationId}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al anular parte de confirmación"
  );
}

export async function fetchIncidentMonthlySummary(employeeId, year, month, contractId = null) {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (contractId) params.set("contract_id", String(contractId));
  return apiRequest(
    `/incidents/employee/${employeeId}/monthly-summary?${params.toString()}`,
    {},
    "Error al cargar resumen mensual de incidencias"
  );
}

export async function fetchPayrollIncidentPreview(payrollId) {
  return apiRequest(
    `/incidents/payrolls/${payrollId}/preview`,
    {},
    "Error al calcular la vista previa de incidencias"
  );
}

export async function fetchPayrollIncidentSegments(payrollId) {
  return apiRequest(
    `/incidents/payrolls/${payrollId}/segments`,
    {},
    "Error al cargar los segmentos de nómina"
  );
}

export async function processPayrollIncidents(payrollId, payload) {
  return apiRequest(
    `/incidents/payrolls/${payrollId}/process`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al procesar las incidencias de la nómina"
  );
}

export async function updatePayrollContributionBaseOverrides(payrollId, payload) {
  return apiRequest(
    `/incidents/payrolls/${payrollId}/contribution-base-overrides`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar las bases de cotización forzadas"
  );
}
