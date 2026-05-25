export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function apiRequest(path, options = {}, fallbackMessage = "Error de comunicación con la API") {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    throw new Error(
      `No se ha podido conectar con la API (${API_BASE_URL}). Revisa que el backend esté arrancado y que VITE_API_BASE_URL apunte correctamente.`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join(" | ")
      : detail;

    throw new Error(message || `${fallbackMessage} (${response.status})`);
  }

  return data;
}
