import { apiRequest } from "./httpClient";

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

export async function createContract(contractPayload, socialSecurityPayload = null) {
  const contract = await apiRequest(
    "/contracts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contractPayload),
    },
    "Error al crear contrato"
  );

  if (socialSecurityPayload && contract?.id) {
    await createSocialSecurityRegistration(contract.id, socialSecurityPayload);
  }

  return contract;
}

export async function updateContract(contractId, contractPayload, socialSecurityPayload = null) {
  const contract = await apiRequest(
    `/contracts/${contractId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contractPayload),
    },
    "Error al actualizar contrato"
  );

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
