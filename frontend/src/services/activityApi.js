import { apiRequest } from "./httpClient.js";

export function fetchActivityCourse() {
  return apiRequest(
    "/case-assignments/course-activities",
    {},
    "No se ha podido cargar el curso práctico"
  );
}

export function validateActivity(assignmentId, taskId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/steps/${taskId}/validate`,
    { method: "POST" },
    "No se ha podido comprobar automáticamente la actividad"
  );
}
