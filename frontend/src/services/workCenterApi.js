const API_BASE_URL = "http://127.0.0.1:8000";

export async function fetchWorkCenters() {
  const response = await fetch(`${API_BASE_URL}/work-centers`);
  return response.json();
}

export async function fetchWorkCentersByCompany(companyId) {
  const response = await fetch(`${API_BASE_URL}/work-centers/company/${companyId}`);
  return response.json();
}

export async function createWorkCenter(payload) {
  const response = await fetch(`${API_BASE_URL}/work-centers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al crear centro");
  }

  return data;
}

export async function updateWorkCenter(workCenterId, payload) {
  const response = await fetch(`${API_BASE_URL}/work-centers/${workCenterId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al actualizar centro");
  }

  return data;
}

export async function deleteWorkCenter(workCenterId) {
  const response = await fetch(`${API_BASE_URL}/work-centers/${workCenterId}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al eliminar centro");
  }

  return data;
}
