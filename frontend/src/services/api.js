import { apiRequest } from "./httpClient";

export async function fetchContracts() {
  return apiRequest("/contracts", {}, "Error al cargar contratos");
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
      body: JSON.stringify(payload),
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
      body: JSON.stringify(payload),
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
