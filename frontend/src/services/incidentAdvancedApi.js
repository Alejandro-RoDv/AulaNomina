import { apiRequest } from "./httpClient";


export function fetchIncidentCalculationRules({ agreementId, incidentType, includeInactive = true } = {}) {
  const params = new URLSearchParams();
  if (agreementId) params.set("agreement_id", agreementId);
  if (incidentType) params.set("incident_type", incidentType);
  if (includeInactive) params.set("include_inactive", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(
    `/incidents/calculation-rules${query}`,
    {},
    "Error al cargar reglas de incidencias",
  );
}

export function createIncidentCalculationRule(payload) {
  return apiRequest(
    "/incidents/calculation-rules",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear la regla de incidencia",
  );
}

export function updateIncidentCalculationRule(ruleId, payload) {
  return apiRequest(
    `/incidents/calculation-rules/${ruleId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar la regla de incidencia",
  );
}

export function deactivateIncidentCalculationRule(ruleId) {
  return apiRequest(
    `/incidents/calculation-rules/${ruleId}/deactivate`,
    { method: "POST" },
    "Error al desactivar la regla de incidencia",
  );
}

export function fetchPayrollIncidentSegments(payrollId) {
  return apiRequest(
    `/incidents/payrolls/${payrollId}/segments`,
    {},
    "Error al cargar segmentos y trazas de la nómina",
  );
}

export function previewPayrollIncidents(payrollId) {
  return apiRequest(
    `/incidents/payrolls/${payrollId}/preview`,
    {},
    "Error al calcular la vista previa de incidencias",
  );
}

export function processPayrollIncidents(payrollId, actor = "teacher_ui") {
  return apiRequest(
    `/incidents/payrolls/${payrollId}/process`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor }),
    },
    "Error al procesar las incidencias de la nómina",
  );
}

export function fetchVacationBalance(employeeId, year, contractId = null) {
  const params = new URLSearchParams({ year: String(year) });
  if (contractId) params.set("contract_id", String(contractId));
  return apiRequest(
    `/incidents/employees/${employeeId}/vacation-balance?${params.toString()}`,
    {},
    "Error al cargar el saldo de vacaciones",
  );
}

export function createVacationAdjustment(contractId, payload) {
  return apiRequest(
    `/incidents/contracts/${contractId}/vacation-adjustments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear el ajuste de vacaciones",
  );
}

export function generateIncidentRegularization(incidentId, actor = "teacher_ui") {
  return apiRequest(
    `/incidents/${incidentId}/generate-regularization?actor=${encodeURIComponent(actor)}`,
    { method: "POST" },
    "Error al generar la regularización",
  );
}
