const API_BASE_URL = "http://127.0.0.1:8000";

export async function fetchIncidents() {
  const response = await fetch(`${API_BASE_URL}/incidents`);
  return response.json();
}

export async function createIncident(payload) {
  const response = await fetch(`${API_BASE_URL}/incidents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al crear incidencia");
  }

  return data;
}

export async function updateIncident(incidentId, payload) {
  const response = await fetch(`${API_BASE_URL}/incidents/${incidentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al actualizar incidencia");
  }

  return data;
}

export async function deleteIncident(incidentId) {
  const response = await fetch(`${API_BASE_URL}/incidents/${incidentId}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al eliminar incidencia");
  }

  return data;
}
