export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function apiRequest(path, options = {}, fallbackMessage = "Error de comunicación con la API") {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || fallbackMessage);
  }

  return data;
}
