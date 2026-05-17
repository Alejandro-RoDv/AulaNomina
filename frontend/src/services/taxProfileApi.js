import { apiRequest } from "./httpClient";

export async function fetchTaxProfiles() {
  return apiRequest("/tax-profiles", {}, "Error al cargar datos fiscales");
}

export async function fetchEmployeeTaxProfile(employeeId) {
  return apiRequest(
    `/employees/${employeeId}/tax-profile`,
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

export async function calculateEmployeeIrpf(employeeId) {
  return apiRequest(
    `/employees/${employeeId}/tax-profile/calculate-irpf`,
    {},
    "Error al calcular IRPF del trabajador"
  );
}

export async function calculateIrpf(payload) {
  return apiRequest(
    "/tax-profiles/calculate-irpf",
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
    `/employees/${employeeId}/tax-profile`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al guardar datos fiscales"
  );
}