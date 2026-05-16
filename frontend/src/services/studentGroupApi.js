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

export function fetchStudentGroups() {
  return request("/student-groups");
}

export function fetchNextStudentGroupCode() {
  return request("/student-groups/next-code");
}

export function createStudentGroup(payload) {
  return request("/student-groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateStudentGroup(groupId, payload) {
  return request(`/student-groups/${groupId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteStudentGroup(groupId) {
  return request(`/student-groups/${groupId}`, {
    method: "DELETE",
  });
}

export function seedDemoStudentGroups() {
  return request("/student-groups/seed-demo", {
    method: "POST",
  });
}
