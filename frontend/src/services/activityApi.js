import { apiRequest } from "./httpClient.js";
import { normalizeActivityCourseForView } from "../utils/activityCourseView.js";

let mailThreadsCache = null;
let mailThreadsPromise = null;

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

function scheduleActivityMailLoad() {
  if (mailThreadsCache !== null || mailThreadsPromise) return;

  mailThreadsPromise = fetchActivityMailThreads()
    .then((threads) => {
      mailThreadsCache = threads;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("aulanomina-activities-refresh"));
      }
      return threads;
    })
    .finally(() => {
      mailThreadsPromise = null;
    });
}

function threadTrainingCode(thread) {
  const subject = String(thread?.subject || "");
  const match = subject.match(/^([AC]\d{2})\s*·/i);
  return match?.[1]?.toUpperCase() || null;
}

function bindMailThreads(course, threads) {
  const usable = (threads || []).filter((thread) => thread?.folder !== "trash");
  const byCode = new Map();
  const byTask = new Map();

  for (const thread of usable) {
    const code = threadTrainingCode(thread);
    if (code && !byCode.has(code)) byCode.set(code, thread);
    if (thread.case_task_id && !byTask.has(thread.case_task_id)) byTask.set(thread.case_task_id, thread);
  }

  for (const topic of course?.topics || []) {
    for (const activity of topic.activities || []) {
      const code = String(activity?.training_code || "").toUpperCase();
      const thread = byTask.get(activity.task_id) || byCode.get(code) || null;
      if (!thread) continue;

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
      activity.case_data = [];
    }
  }
  return course;
}

export async function fetchActivityCourse() {
  const rawCourse = await apiRequest(
    "/case-assignments/course-activities",
    {},
    "No se ha podido cargar el curso práctico"
  );
  const course = normalizeActivityCourseForView(rawCourse);

  // El correo puede requerir materialización/sincronización y no debe bloquear
  // el primer render del curso. Cuando termina, reutilizamos el evento de
  // refresco existente para enriquecer la ficha con el hilo correspondiente.
  if (mailThreadsCache === null) {
    scheduleActivityMailLoad();
    return hideUnvalidatedReferenceAnswers(course);
  }

  return hideUnvalidatedReferenceAnswers(bindMailThreads(course, mailThreadsCache));
}

if (typeof window !== "undefined") {
  window.addEventListener("aulanomina-mail-stats-refresh", () => {
    mailThreadsCache = null;
  });
}

export function validateActivity(assignmentId, taskId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/steps/${taskId}/validate`,
    { method: "POST" },
    "No se ha podido comprobar automáticamente la actividad"
  );
}

export function requestActivityHint(assignmentId, taskId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/steps/${taskId}/hint`,
    { method: "POST" },
    "No se ha podido mostrar la siguiente ayuda"
  );
}

export function fetchActivityAttempts(assignmentId, taskId = null) {
  const query = taskId == null ? "" : `?task_id=${encodeURIComponent(taskId)}`;
  return apiRequest(
    `/case-assignments/${assignmentId}/attempts${query}`,
    {},
    "No se ha podido cargar el historial de intentos"
  );
}

export function fetchEvaluationResult(assignmentId) {
  return apiRequest(
    `/case-assignments/${assignmentId}/evaluation-result`,
    {},
    "No se ha podido calcular el resultado de la evaluación"
  );
}

export function fetchTutorialState() {
  return apiRequest(
    "/training-workspace/tutorial-state",
    {},
    "No se ha podido recuperar el estado del tutorial"
  );
}

export function saveTutorialState(state) {
  return apiRequest(
    "/training-workspace/tutorial-state",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    },
    "No se ha podido guardar el estado del tutorial"
  );
}

export function resetTrainingWorkspace() {
  return apiRequest(
    "/training-workspace/reset",
    { method: "POST" },
    "No se ha podido restablecer el entorno práctico"
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
