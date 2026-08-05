import { apiRequest } from "./httpClient.js";


function buildQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}


export function fetchCaseAssignments() {
  return apiRequest("/case-assignments", {}, "Error al cargar asignaciones");
}


export function createCaseAssignment(payload) {
  return apiRequest(
    "/case-assignments",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear asignación"
  );
}


export function updateCaseAssignment(assignmentId, payload) {
  return apiRequest(
    `/case-assignments/${assignmentId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar asignación"
  );
}


export function deleteCaseAssignment(assignmentId) {
  return apiRequest(
    `/case-assignments/${assignmentId}`,
    { method: "DELETE" },
    "Error al eliminar asignación"
  );
}


export function seedDemoCaseAssignments() {
  return apiRequest(
    "/case-assignments/seed-demo",
    { method: "POST" },
    "Error al cargar asignaciones demo"
  );
}


export function fetchTeacherCaseDashboard(filters = {}) {
  return apiRequest(
    `/case-assignments/teacher-dashboard${buildQuery(filters)}`,
    {},
    "No se ha podido cargar la trazabilidad de los casos"
  );
}


export function fetchTeacherCaseDetail(assignmentId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/teacher-detail`,
    {},
    "No se ha podido cargar el detalle docente del caso"
  );
}


export { buildQuery };
