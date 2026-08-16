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

async function fetchActivityMailThreads() {
  try {
    const mailbox = await apiRequest(
      "/mail/demo-mailbox",
      {},
      "No se ha podido preparar el correo formativo"
    );
    if (!mailbox?.id) return [];
    return await apiRequest(
      `/mail/mailboxes/${mailbox.id}/threads`,
      {},
      "No se han podido cargar los correos relacionados"
    );
  } catch {
    return [];
  }
}

function bindMailThreads(course, threads) {
  const byAssignment = new Map();
  for (const thread of threads || []) {
    if (!thread?.case_assignment_id || thread.folder === "trash") continue;
    const current = byAssignment.get(thread.case_assignment_id) || [];
    current.push(thread);
    byAssignment.set(thread.case_assignment_id, current);
  }

  for (const topic of course?.topics || []) {
    for (const activity of topic.activities || []) {
      const candidates = byAssignment.get(activity.assignment_id) || [];
      if (!candidates.length) continue;
      const direct = candidates.filter((thread) => thread.case_task_id === activity.task_id);
      const thread = (direct.length ? direct : candidates)[0];
      const messages = [...(thread.messages || [])].sort((a, b) => new Date(a.sent_at || 0) - new Date(b.sent_at || 0));
      const incoming = messages.find((message) => message.direction === "incoming") || messages[0] || null;
      const attachments = messages.flatMap((message) => message.attachments || []);
      const actionCode = activity?.context?.actionCode || "";
      const role = actionCode === "reply_mail" ? "reply" : attachments.length > 0 ? "attachment" : "consult";

      activity.requires_mail = true;
      activity.related_mail_thread_ids = [thread.id];
      activity.mail_context = {
        thread_id: thread.id,
        role,
        subject: thread.subject,
        sender: incoming?.sender_name || "Correo relacionado",
        has_attachments: attachments.length > 0,
        attachment_count: attachments.length,
        locked: thread.folder === "training_locked",
      };
      activity.situation = "Has recibido una comunicación relacionada con este ejercicio. Consulta el correo antes de continuar.";
      activity.instructions = role === "reply"
        ? "Consulta el correo relacionado y sus adjuntos, realiza la gestión indicada en AulaNomina y responde por el mismo hilo cuando hayas terminado."
        : role === "attachment"
          ? "Consulta el correo relacionado y sus adjuntos. Con la información recibida, realiza en AulaNomina la gestión solicitada."
          : "Consulta el correo relacionado. Con la información recibida, realiza en AulaNomina la gestión solicitada.";
      activity.case_data = [];
    }
  }
  return course;
}

export async function fetchActivityCourse() {
  const [rawCourse, threads] = await Promise.all([
    apiRequest(
      "/case-assignments/course-activities",
      {},
      "No se ha podido cargar el curso práctico"
    ),
    fetchActivityMailThreads(),
  ]);
  const course = normalizeActivityCourseForView(rawCourse);
  return hideUnvalidatedReferenceAnswers(bindMailThreads(course, threads));
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