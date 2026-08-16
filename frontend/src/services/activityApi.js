import { apiRequest } from "./httpClient.js";
import { normalizeActivityCourseForView } from "../utils/activityCourseView.js";

function hideUnvalidatedReferenceAnswers(course) {
  for (const topic of course?.topics || []) {
    for (const activity of topic.activities || []) {
      if (!activity?.response_schema) continue;
      const quizPassed = activity?.validation_result?.student_response?._validation_passed === true;
      if (quizPassed) continue;
      const { explanation_placeholder: _hiddenReferenceAnswer, ...safeSchema } = activity.response_schema;
      activity.response_schema = safeSchema;
    }
  }
  return course;
}

export async function fetchActivityCourse() {
  const course = await apiRequest(
    "/case-assignments/course-activities",
    {},
    "No se ha podido cargar el curso práctico"
  );
  return hideUnvalidatedReferenceAnswers(normalizeActivityCourseForView(course));
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
