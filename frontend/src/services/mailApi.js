import { API_BASE_URL, apiRequest } from "./httpClient.js";

const CATEGORY_LABELS = {
  payroll: "Nómina",
  contract: "Contratación",
  social_security: "Seguridad Social",
  tax: "Fiscal",
  absence: "Ausencias",
  employee_request: "Solicitud de trabajador",
  document: "Documentación",
  general: "General",
};

const STATUS_MAP = {
  open: "pending",
  in_progress: "in_progress",
  waiting: "waiting",
  resolved: "resolved",
};

function buildQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatReceivedAt(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isTutorNotice(message) {
  return message.direction === "system"
    && message.message_type === "automatic"
    && message.sender_address === "tutor@aulanomina.local";
}

export function mapThreadToWorkspaceMessage(thread) {
  const allMessages = thread.messages || [];
  const tutorNotices = allMessages.filter(isTutorNotice);
  const messages = allMessages.filter((message) => !isTutorNotice(message));
  const latestMessage = messages[messages.length - 1] || allMessages[allMessages.length - 1] || {};
  const initialMessage = messages[0] || latestMessage;
  const attachments = messages.flatMap((message) => message.attachments || []);

  return {
    id: thread.id,
    folder: thread.folder,
    sender: initialMessage.sender_name || "Remitente simulado",
    address: initialMessage.sender_address || "correo@aulanomina.local",
    recipientName: initialMessage.recipient_name || "Usuario demo",
    recipientAddress: initialMessage.recipient_address || "usuario.demo@aulanomina.local",
    ccAddress: initialMessage.cc_address || "",
    subject: thread.subject,
    preview: thread.preview || latestMessage.body_text || "",
    receivedAt: formatReceivedAt(thread.updated_at),
    unread: !thread.is_read,
    priority: thread.priority,
    category: CATEGORY_LABELS[thread.category] || thread.category,
    categoryCode: thread.category,
    companyId: thread.company_id || null,
    employeeId: thread.employee_id || null,
    relatedEntityType: thread.related_entity_type || null,
    relatedEntityId: thread.related_entity_id || null,
    caseReference: thread.case_reference,
    caseStudyId: thread.case_study_id || null,
    caseAssignmentId: thread.case_assignment_id || null,
    caseTaskId: thread.case_task_id || null,
    caseStatus: STATUS_MAP[thread.status] || thread.status,
    backendStatus: thread.status,
    attachments: attachments.map((attachment) => attachment.filename),
    attachmentRecords: attachments,
    body: (initialMessage.body_text || "").split(/\n\s*\n/).filter(Boolean),
    requirements: thread.expected_actions || [],
    contextActions: thread.context_actions || [],
    tutorNotices,
    latestTutorNotice: tutorNotices[tutorNotices.length - 1]?.body_text || "",
    messages,
  };
}

export async function fetchDemoMailbox() {
  return apiRequest("/mail/demo-mailbox", {}, "No se ha podido cargar el buzón de demostración");
}

export async function resetDemoMailbox() {
  return apiRequest(
    "/mail/demo-mailbox/reset",
    { method: "POST" },
    "No se ha podido reiniciar el buzón de demostración"
  );
}

export async function fetchMailboxThreads(mailboxId, filters = {}) {
  const data = await apiRequest(
    `/mail/mailboxes/${mailboxId}/threads${buildQuery(filters)}`,
    {},
    "No se han podido cargar los mensajes"
  );
  return (data || []).map(mapThreadToWorkspaceMessage);
}

export async function fetchMailThread(threadId) {
  const data = await apiRequest(
    `/mail/threads/${threadId}`,
    {},
    "No se ha podido abrir el correo relacionado"
  );
  return mapThreadToWorkspaceMessage(data);
}

export async function createMailThread(mailboxId, payload) {
  const data = await apiRequest(
    `/mail/mailboxes/${mailboxId}/threads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "No se ha podido crear el correo"
  );
  return mapThreadToWorkspaceMessage(data);
}

export async function fetchMailboxStats(mailboxId) {
  return apiRequest(
    `/mail/mailboxes/${mailboxId}/stats`,
    {},
    "No se han podido cargar los contadores del buzón"
  );
}

export async function updateMailThread(threadId, payload) {
  const data = await apiRequest(
    `/mail/threads/${threadId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "No se ha podido actualizar el mensaje"
  );
  return mapThreadToWorkspaceMessage(data);
}

export async function createMailMessage(threadId, payload) {
  const data = await apiRequest(
    `/mail/threads/${threadId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "No se ha podido guardar la respuesta"
  );
  return mapThreadToWorkspaceMessage(data);
}

export async function fetchMailAttachmentPreview(attachmentId) {
  return apiRequest(
    `/mail/attachments/${attachmentId}/preview`,
    {},
    "No se ha podido abrir el adjunto"
  );
}

export async function fetchMailAttachmentCandidateDocuments(attachmentId) {
  return apiRequest(
    `/mail/attachments/${attachmentId}/candidate-documents`,
    {},
    "No se han podido cargar los documentos candidatos"
  );
}

export async function linkMailAttachmentToDocument(attachmentId, documentId) {
  return apiRequest(
    `/mail/attachments/${attachmentId}/link-document/${documentId}`,
    { method: "POST" },
    "No se ha podido vincular el adjunto al documento ERP"
  );
}

export function getMailAttachmentDownloadUrl(attachmentId) {
  return `${API_BASE_URL}/mail/attachments/${attachmentId}/download`;
}