import { apiRequest } from "./httpClient";

const CONTRACT_EXTRA_FIELDS = [
  "contract_code",
  "contract_code_description",
  "contract_family",
  "contribution_group",
  "professional_category",
  "job_position",
  "collective_agreement_code",
  "working_day_type",
  "weekly_hours",
  "full_time_weekly_hours",
  "partiality_coefficient",
  "monthly_or_daily_contribution",
  "red_occupation_code",
  "red_reduction_code",
  "gross_annual_salary",
];

function enrichContractPayload(payload) {
  const source = window.__aulanominaContractForm || {};
  const enriched = { ...payload };

  CONTRACT_EXTRA_FIELDS.forEach((field) => {
    if (source[field] === undefined || source[field] === "") return;

    if (["weekly_hours", "full_time_weekly_hours", "partiality_coefficient", "gross_annual_salary"].includes(field)) {
      enriched[field] = Number(source[field]);
      return;
    }

    enriched[field] = source[field];
  });

  return enriched;
}

export async function fetchContracts() {
  return apiRequest("/contracts", {}, "Error al cargar contratos");
}

export async function fetchCatalogs() {
  return apiRequest("/catalogs/all", {}, "Error al cargar catálogos laborales");
}

export async function fetchEmployees() {
  return apiRequest("/employees/all", {}, "Error al cargar trabajadores");
}

export async function resetDemo() {
  return apiRequest(
    "/demo/reset",
    { method: "POST" },
    "Error al reiniciar la demo"
  );
}

export async function createContract(payload) {
  return apiRequest(
    "/contracts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichContractPayload(payload)),
    },
    "Error al crear contrato"
  );
}

export async function updateContract(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichContractPayload(payload)),
    },
    "Error al actualizar contrato"
  );
}

export async function deleteContract(contractId) {
  return apiRequest(
    `/contracts/${contractId}`,
    { method: "DELETE" },
    "Error al eliminar contrato"
  );
}
