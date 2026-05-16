const API_URL = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Error en la petición";
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function fetchCorrections() {
  return request("/corrections");
}

export function createCorrection(payload) {
  return request("/corrections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCorrection(correctionId, payload) {
  return request(`/corrections/${correctionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCorrection(correctionId) {
  return request(`/corrections/${correctionId}`, {
    method: "DELETE",
  });
}

export function seedDemoCorrections() {
  return request("/corrections/seed-demo", {
    method: "POST",
  });
}
