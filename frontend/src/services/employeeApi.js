const API_BASE_URL = "http://127.0.0.1:8000";

async function handleResponse(response, fallbackMessage) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || fallbackMessage);
  }

  return data;
}

export async function fetchEmployees() {
  const response = await fetch(`${API_BASE_URL}/employees`);
  return handleResponse(response, "Error al cargar trabajadores");
}

export async function fetchAllEmployees() {
  const response = await fetch(`${API_BASE_URL}/employees/all`);
  return handleResponse(response, "Error al cargar trabajadores");
}

export async function createEmployee(payload) {
  const response = await fetch(`${API_BASE_URL}/employees`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response, "Error al crear trabajador");
}

export async function updateEmployee(employeeId, payload) {
  const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response, "Error al actualizar trabajador");
}

export async function deleteEmployee(employeeId) {
  const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, {
    method: "DELETE",
  });

  return handleResponse(response, "Error al desactivar trabajador");
}
