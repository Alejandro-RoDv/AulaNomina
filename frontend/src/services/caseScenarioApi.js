import { apiRequest } from "./httpClient.js";


export function fetchAssignmentScenario(assignmentId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/scenario`,
    {},
    "No se ha podido cargar el progreso del caso"
  );
}


export function startAssignmentScenario(assignmentId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/start`,
    { method: "POST" },
    "No se ha podido iniciar el caso"
  );
}


export function updateAssignmentScenarioStep(assignmentId, taskId, payload) {
  return apiRequest(
    `/case-assignments/${assignmentId}/steps/${taskId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "No se ha podido actualizar el paso del caso"
  );
}


export function resetAssignmentScenario(assignmentId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/reset-progress`,
    { method: "POST" },
    "No se ha podido reiniciar el progreso del caso"
  );
}
