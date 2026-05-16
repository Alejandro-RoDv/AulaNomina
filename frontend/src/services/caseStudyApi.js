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

export function fetchCaseStudies() {
  return request("/case-studies");
}

export function createCaseStudy(payload) {
  return request("/case-studies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCaseStudy(caseStudyId, payload) {
  return request(`/case-studies/${caseStudyId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCaseStudy(caseStudyId) {
  return request(`/case-studies/${caseStudyId}`, {
    method: "DELETE",
  });
}

export function createCaseTask(caseStudyId, payload) {
  return request(`/case-studies/${caseStudyId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCaseTask(taskId, payload) {
  return request(`/case-tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCaseTask(taskId) {
  return request(`/case-tasks/${taskId}`, {
    method: "DELETE",
  });
}

export function seedDemoCaseStudies() {
  return request("/case-studies/seed-demo", {
    method: "POST",
  });
}
