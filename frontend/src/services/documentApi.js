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

export function fetchDocuments() {
  return request("/documents");
}

export function fetchDocumentsByEmployee(employeeId) {
  return request(`/documents/employee/${employeeId}`);
}

export function createDocument(payload) {
  return request("/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDocument(documentId, payload) {
  return request(`/documents/${documentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteDocument(documentId) {
  return request(`/documents/${documentId}`, {
    method: "DELETE",
  });
}
