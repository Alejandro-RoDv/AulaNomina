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
