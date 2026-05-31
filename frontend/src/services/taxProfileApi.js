import { apiRequest } from "./httpClient";

export async function fetchTaxProfiles() {
  return apiRequest("/tax-profiles", {}, "Error al cargar datos fiscales");
}

export async function fetchEmployeeTaxProfile(employeeId) {
  return apiRequest(
    `/tax-profiles/employee/${employeeId}`,
    {},
    "Error al cargar datos fiscales del trabajador"
  );
}

export async function fetchEmployeeIrpfAnnualSummary(employeeId, year) {
  return apiRequest(
    `/employees/${employeeId}/irpf-annual-summary?year=${year}`,
    {},
    "Error al cargar resumen anual de IRPF"
  );
}

export async function simulateEmployeeIrpfAnnualSummary(employeeId, payload) {
  return apiRequest(
    `/employees/${employeeId}/irpf-annual-summary/simulate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al simular resumen anual de IRPF"
  );
}

export async function calculateEmployeeIrpf(employeeId) {
  return apiRequest(
    `/tax-profiles/employee/${employeeId}`,
    {},
    "Error al calcular IRPF del trabajador"
  );
}

export async function calculateIrpf(payload) {
  return apiRequest(
    "/irpf/calculate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al calcular IRPF"
  );
}

export async function updateEmployeeTaxProfile(employeeId, payload) {
  return apiRequest(
    `/tax-profiles/employee/${employeeId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al guardar datos fiscales"
  );
}
