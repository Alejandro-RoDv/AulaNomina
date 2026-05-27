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

const SS_FIELDS = [
  "situation_code",
  "situation_description",
  "registration_date",
  "contribution_group",
  "monthly_or_daily_contribution",
  "disability_degree",
  "occupation_code",
  "cno",
  "worker_collective_code",
  "unemployed_condition_code",
  "social_exclusion_or_victim_status",
  "is_replacement",
  "replacement_cause_code",
  "replaced_worker_naf",
  "inactivity_type_code",
  "working_time_reduction",
  "initial_ctp",
  "red_contract_key",
  "red_occupation_code",
  "red_contribution_group",
  "red_reduction_code",
  "red_special_relation",
];

const NUMERIC_CONTRACT_FIELDS = new Set([
  "weekly_hours",
  "full_time_weekly_hours",
  "partiality_coefficient",
  "gross_annual_salary",
]);

const NUMERIC_SS_FIELDS = new Set(["disability_degree", "working_time_reduction", "initial_ctp"]);

function enrichContractPayload(payload) {
  const source = window.__aulanominaContractForm || {};
  const enriched = { ...payload };

  CONTRACT_EXTRA_FIELDS.forEach((field) => {
    if (source[field] === undefined || source[field] === "") return;
    enriched[field] = NUMERIC_CONTRACT_FIELDS.has(field) ? Number(source[field]) : source[field];
  });

  return enriched;
}

function buildSocialSecurityPayload() {
  const source = window.__aulanominaSocialSecurityForm || {};
  const payload = {};

  SS_FIELDS.forEach((field) => {
    const value = source[field];
    if (value === undefined || value === "") return;

    if (field === "is_replacement") {
      payload[field] = Boolean(value);
      return;
    }

    payload[field] = NUMERIC_SS_FIELDS.has(field) ? Number(value) : value;
  });

  return Object.keys(payload).length ? payload : null;
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

export async function createSocialSecurityRegistration(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/social-security-registration`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear alta SS simulada"
  );
}

export async function updateSocialSecurityRegistration(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/social-security-registration`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar alta SS simulada"
  );
}

async function upsertSocialSecurityRegistration(contractId, payload) {
  if (!payload || !contractId) return null;

  try {
    return await updateSocialSecurityRegistration(contractId, payload);
  } catch (error) {
    if (String(error.message || "").includes("no encontrada")) {
      return createSocialSecurityRegistration(contractId, payload);
    }
    throw error;
  }
}

export async function createContract(payload) {
  const contract = await apiRequest(
    "/contracts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichContractPayload(payload)),
    },
    "Error al crear contrato"
  );

  const socialSecurityPayload = buildSocialSecurityPayload();
  if (socialSecurityPayload && contract?.id) {
    await createSocialSecurityRegistration(contract.id, socialSecurityPayload);
  }

  return contract;
}

export async function updateContract(contractId, payload) {
  const contract = await apiRequest(
    `/contracts/${contractId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichContractPayload(payload)),
    },
    "Error al actualizar contrato"
  );

  const socialSecurityPayload = buildSocialSecurityPayload();
  if (socialSecurityPayload) {
    await upsertSocialSecurityRegistration(contractId, socialSecurityPayload);
  }

  return contract;
}

export async function deleteContract(contractId) {
  return apiRequest(
    `/contracts/${contractId}`,
    { method: "DELETE" },
    "Error al eliminar contrato"
  );
}
