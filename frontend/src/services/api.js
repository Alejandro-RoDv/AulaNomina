const API_BASE_URL = "http://127.0.0.1:8000";

export async function fetchContracts() {
  const response = await fetch(`${API_BASE_URL}/contracts`);
  return response.json();
}

export async function fetchEmployees() {
  const response = await fetch(`${API_BASE_URL}/employees/all`);
  return response.json();
}

export async function createContract(payload) {
  const response = await fetch(`${API_BASE_URL}/contracts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al crear contrato");
  }

  return data;
}

export async function updateContract(contractId, payload) {
  const response = await fetch(`${API_BASE_URL}/contracts/${contractId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al actualizar contrato");
  }

  return data;
}
