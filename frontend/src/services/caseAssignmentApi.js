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

export function fetchCaseAssignments() {
  return request("/case-assignments");
}

export function createCaseAssignment(payload) {
  return request("/case-assignments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCaseAssignment(assignmentId, payload) {
  return request(`/case-assignments/${assignmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCaseAssignment(assignmentId) {
  return request(`/case-assignments/${assignmentId}`, {
    method: "DELETE",
  });
}

export function seedDemoCaseAssignments() {
  return request("/case-assignments/seed-demo", {
    method: "POST",
  });
}
