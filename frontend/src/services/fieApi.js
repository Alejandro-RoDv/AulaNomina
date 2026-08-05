import { apiRequest } from "./httpClient.js";

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  return query.toString() ? `?${query.toString()}` : "";
}

function readFieCaseContext() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const direct = {
    company_id: params.get("companyId"),
    employee_id: params.get("employeeId"),
  };
  if (direct.company_id || direct.employee_id) return direct;
  try {
    const stored = JSON.parse(window.localStorage.getItem("aulanomina:active-case-context") || "null");
    if (!stored) return {};
    return {
      company_id: stored.companyId || null,
      employee_id: stored.employeeId || null,
    };
  } catch {
    return {};
  }
}

export function applyFieCaseContext(filters = {}) {
  const context = readFieCaseContext();
  return {
    ...context,
    ...filters,
  };
}

export async function fetchFieCommunications(filters = {}) {
  return apiRequest(
    `/fie/communications${queryString(applyFieCaseContext(filters))}`,
    {},
    "Error al cargar la bandeja FIE"
  );
}

export async function fetchFieCommunication(communicationId) {
  return apiRequest(
    `/fie/communications/${encodeURIComponent(communicationId)}`,
    {},
    "Error al cargar la comunicación FIE"
  );
}

export async function simulateFieCommunication(payload) {
  return apiRequest(
    "/fie/simulate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al generar la comunicación FIE de prueba"
  );
}

export async function checkNewFieCommunications(params = {}, actor = "Usuario demo") {
  return apiRequest(
    `/fie/check-new-communications${queryString(params)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor }),
    },
    "Error al consultar nuevas comunicaciones en el INSS simulado"
  );
}

export async function generatePendingFieCommunications(params = {}, actor = "Sistema INSS simulado") {
  return apiRequest(
    `/fie/generate-pending${queryString(params)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor }),
    },
    "Error al consultar comunicaciones FIE pendientes"
  );
}

function postAction(communicationId, action, payload = {}) {
  return apiRequest(
    `/fie/communications/${encodeURIComponent(communicationId)}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    `Error al ${action} la comunicación FIE`
  );
}

export async function markFieCommunicationRead(communicationId, actor = null) {
  return postAction(communicationId, "read", { actor });
}

export async function compareFieCommunication(communicationId, actor = null) {
  return postAction(communicationId, "compare", { actor });
}

export async function resolveFieCommunication(communicationId, payload = {}) {
  return postAction(communicationId, "resolve", payload);
}

export async function applyFieCommunication(communicationId, payload = {}) {
  return postAction(communicationId, "apply", payload);
}

export async function ignoreFieCommunication(communicationId, payload = {}) {
  return postAction(communicationId, "ignore", payload);
}

export async function reopenFieCommunication(communicationId, payload = {}) {
  return postAction(communicationId, "reopen", payload);
}
