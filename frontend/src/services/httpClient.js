import { emitCaseOperationEvent } from "../utils/caseOperationBridge.js";

export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export class ApiRequestError extends Error {
  constructor(message, { status = 0, detail = null, path = "" } = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
    this.code = detail && typeof detail === "object" ? detail.code || null : null;
    this.path = path;
  }
}

function messageFromDetail(detail, fallbackMessage, status) {
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(" | ");
  }
  if (detail && typeof detail === "object") {
    return detail.message || fallbackMessage || `Error de API (${status})`;
  }
  return detail || `${fallbackMessage} (${status})`;
}

function resolveCompatibilityPath(path) {
  // El botón histórico de reset se conserva, pero ahora vacía todo el entorno
  // empresarial para evitar datos antiguos y dependencias huérfanas.
  return path === "/demo/reset" ? "/demo/clear" : path;
}

async function publishCaseOperation({
  path,
  options,
  operationStatus,
  responseData,
  responseSummary,
  httpStatus,
}) {
  await emitCaseOperationEvent({
    apiBaseUrl: API_BASE_URL,
    path,
    method: options.method || "GET",
    operationStatus,
    responseData,
    responseSummary,
    httpStatus,
  });
}

export async function apiRequest(path, options = {}, fallbackMessage = "Error de comunicación con la API") {
  let response;
  const resolvedPath = resolveCompatibilityPath(path);

  try {
    response = await fetch(`${API_BASE_URL}${resolvedPath}`, options);
  } catch {
    throw new ApiRequestError(
      `No se ha podido conectar con la API (${API_BASE_URL}). Revisa que el backend esté arrancado y que VITE_API_BASE_URL apunte correctamente.`,
      { path: resolvedPath }
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const detail = data?.detail ?? null;
    const errorMessage = messageFromDetail(detail, fallbackMessage, response.status);
    await publishCaseOperation({
      path: resolvedPath,
      options,
      operationStatus: "error",
      responseData: data,
      responseSummary: errorMessage,
      httpStatus: response.status,
    });
    throw new ApiRequestError(
      errorMessage,
      { status: response.status, detail, path: resolvedPath }
    );
  }

  await publishCaseOperation({
    path: resolvedPath,
    options,
    operationStatus: "success",
    responseData: data,
    responseSummary: fallbackMessage.replace(/^Error al\s+/i, "").replace(/^Error de\s+/i, ""),
    httpStatus: response.status,
  });

  return data;
}
