const API_BASE_URL = "http://127.0.0.1:8000";

export async function fetchPayrolls() {
  const response = await fetch(`${API_BASE_URL}/payrolls`);
  return response.json();
}

export async function createPayroll(payload) {
  const response = await fetch(`${API_BASE_URL}/payrolls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al crear nómina");
  }

  return data;
}

export async function updatePayroll(payrollId, payload) {
  const response = await fetch(`${API_BASE_URL}/payrolls/${payrollId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al actualizar nómina");
  }

  return data;
}

export async function deletePayroll(payrollId) {
  const response = await fetch(`${API_BASE_URL}/payrolls/${payrollId}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al eliminar nómina");
  }

  return data;
}
