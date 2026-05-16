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

export function fetchStudents() {
  return request("/students");
}

export function fetchNextStudentCode() {
  return request("/students/next-code");
}

export function createStudent(payload) {
  return request("/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateStudent(studentId, payload) {
  return request(`/students/${studentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteStudent(studentId) {
  return request(`/students/${studentId}`, {
    method: "DELETE",
  });
}

export function seedDemoStudents() {
  return request("/students/seed-demo", {
    method: "POST",
  });
}
