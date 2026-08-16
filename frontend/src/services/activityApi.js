import { apiRequest } from "./httpClient.js";
import { normalizeActivityCourseForView } from "../utils/activityCourseView.js";

export async function fetchActivityCourse() {
  const course = await apiRequest(
    "/case-assignments/course-activities",
    {},
    "No se ha podido cargar el curso práctico"
  );
  return normalizeActivityCourseForView(course);
}

export function validateActivity(assignmentId, taskId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/steps/${taskId}/validate`,
    { method: "POST" },
    "No se ha podido comprobar automáticamente la actividad"
  );
}

export function saveActivityResponse(assignmentId, taskId, response, validationResult = {}) {
  const studentResponse = { ...(response || {}) };
  delete studentResponse._validation_passed;
  delete studentResponse._reference_answer;

  return apiRequest(
    `/case-assignments/${assignmentId}/steps/${taskId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "in_progress",
        student_notes: JSON.stringify(studentResponse),
        validation_result: {
          ...(validationResult || {}),
          student_response: studentResponse,
        },
      }),
    },
    "No se ha podido guardar la respuesta de la actividad"
  );
}

export function completeActivityManually(assignmentId, taskId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/steps/${taskId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    },
    "No se ha podido confirmar la actividad"
  );
}
