const API_BASE_URL = "http://127.0.0.1:8000";

export async function fetchCompanies() {
  const response = await fetch(`${API_BASE_URL}/companies`);
  return response.json();
}

export async function fetchCompaniesAll() {
  const response = await fetch(`${API_BASE_URL}/companies/all`);
  return response.json();
}

export async function createCompany(payload) {
  const response = await fetch(`${API_BASE_URL}/companies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Error al crear empresa");
  }

  return data;
}
