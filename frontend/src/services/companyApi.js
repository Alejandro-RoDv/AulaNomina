import { apiRequest } from "./httpClient";

export async function fetchCompanies() {
  return apiRequest("/companies", {}, "Error al cargar empresas");
}

export async function fetchCompaniesAll() {
  return apiRequest("/companies/all", {}, "Error al cargar empresas");
}

export async function createCompany(payload) {
  return apiRequest(
    "/companies",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear empresa"
  );
}

export async function updateCompany(companyId, payload) {
  return apiRequest(
    `/companies/${companyId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar empresa"
  );
}

export async function deleteCompany(companyId) {
  return apiRequest(
    `/companies/${companyId}`,
    { method: "DELETE" },
    "Error al eliminar empresa"
  );
}
