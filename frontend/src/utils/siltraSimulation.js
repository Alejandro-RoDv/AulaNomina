export const SILTRA_PHASES = [
  "Validando fichero",
  "Preparando transmisión",
  "Conectando con TGSS simulada",
  "Transmitiendo fichero",
  "Procesando respuesta",
  "Respuesta recibida",
];

export const FINAL_SUBMISSION_STATUSES = new Set([
  "ACCEPTED",
  "ACCEPTED_WITH_WARNINGS",
  "REJECTED",
  "CANCELLED",
]);

export const SENDABLE_COMMUNICATION_STATUSES = new Set([
  "GENERATED",
  "ACCEPTED",
  "ACCEPTED_WITH_WARNINGS",
  "REJECTED",
]);

export const SILTRA_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const SILTRA_UPLOAD_EXTENSIONS = new Set(["json", "xml", "txt"]);

export function submissionStatusLabel(status) {
  return {
    PENDING: "Pendiente",
    SENT: "Enviado",
    PROCESSING: "Procesando",
    ACCEPTED: "Aceptado",
    ACCEPTED_WITH_WARNINGS: "Aceptado con advertencias",
    REJECTED: "Rechazado",
    CANCELLED: "Cancelado",
  }[status] || status || "Sin estado";
}

export function submissionStatusTone(status) {
  if (status === "ACCEPTED") return "success";
  if (status === "ACCEPTED_WITH_WARNINGS") return "warning";
  if (status === "REJECTED") return "danger";
  if (status === "PROCESSING" || status === "SENT") return "info";
  return "neutral";
}

export function groupMessagesBySeverity(messages = []) {
  return messages.reduce(
    (groups, message) => {
      const severity = String(message?.severity || "INFO").toUpperCase();
      if (severity === "ERROR") groups.errors.push(message);
      else if (severity === "WARNING") groups.warnings.push(message);
      else groups.information.push(message);
      return groups;
    },
    { errors: [], warnings: [], information: [] }
  );
}

export function submissionCounts(submissions = []) {
  return submissions.reduce(
    (counts, submission) => {
      counts.total += 1;
      if (submission.status === "ACCEPTED") counts.accepted += 1;
      if (submission.status === "ACCEPTED_WITH_WARNINGS") counts.warnings += 1;
      if (submission.status === "REJECTED") counts.rejected += 1;
      return counts;
    },
    { total: 0, accepted: 0, warnings: 0, rejected: 0 }
  );
}

export function latestSubmissionByFile(submissions = []) {
  return submissions.reduce((lookup, submission) => {
    const current = lookup[submission.communication_file_id];
    if (!current || Number(submission.attempt_number || 0) > Number(current.attempt_number || 0)) {
      lookup[submission.communication_file_id] = submission;
    }
    return lookup;
  }, {});
}

export function countAttemptsByFile(submissions = []) {
  return submissions.reduce((lookup, submission) => {
    const fileId = submission.communication_file_id;
    lookup[fileId] = (lookup[fileId] || 0) + 1;
    return lookup;
  }, {});
}

export function canSendCommunication(communication, busyFileId = null) {
  if (!communication || Number(busyFileId) === Number(communication.id)) return false;
  return SENDABLE_COMMUNICATION_STATUSES.has(communication.status) && Boolean(communication.content);
}

export function sortSubmissionsNewestFirst(submissions = []) {
  return [...submissions].sort((left, right) => {
    const dateDifference = new Date(right.created_at || 0) - new Date(left.created_at || 0);
    if (dateDifference !== 0) return dateDifference;
    return Number(right.id || 0) - Number(left.id || 0);
  });
}

export function buildSiltraNavigationPayload(communication) {
  return {
    communicationFileId: communication?.id || null,
    companyId: communication?.company_id || null,
    settlementId: communication?.metadata?.settlement_id || null,
  };
}

export function latestSubmission(submissions = []) {
  return sortSubmissionsNewestFirst(submissions)[0] || null;
}

export function getFileExtension(filename = "") {
  const normalized = String(filename).trim().toLowerCase();
  const separator = normalized.lastIndexOf(".");
  return separator >= 0 ? normalized.slice(separator + 1) : "";
}

export function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateSiltraUpload(file, existingFiles = []) {
  if (!file) return { valid: false, error: "Seleccione un fichero.", warning: "", extension: "" };

  const extension = getFileExtension(file.name);
  if (!SILTRA_UPLOAD_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: "Formato no admitido. Seleccione un fichero JSON, XML o TXT.",
      warning: "",
      extension,
    };
  }

  if (Number(file.size || 0) > SILTRA_UPLOAD_MAX_BYTES) {
    return {
      valid: false,
      error: `El fichero supera el límite de ${formatFileSize(SILTRA_UPLOAD_MAX_BYTES)}.`,
      warning: "",
      extension,
    };
  }

  const duplicate = existingFiles.some((item) => {
    const sameName = String(item?.original_filename || "").toLowerCase() === String(file.name || "").toLowerCase();
    const storedSize = Number(item?.metadata?.source_size_bytes || 0);
    return sameName && (!storedSize || storedSize === Number(file.size || 0));
  });

  let warning = "";
  if (duplicate) warning = "Ya existe un fichero con el mismo nombre en AulaNomina. Se creará un nuevo registro si continúa.";
  else if (extension !== "json") warning = "XML y TXT se almacenan como práctica, pero solo se procesarán si contienen una estructura compatible con AulaNomina.";

  return { valid: true, error: "", warning, extension };
}

export function filePreview(file, companyName = "", ccc = "", period = "") {
  if (!file) return null;
  const extension = getFileExtension(file.name);
  return {
    name: file.name,
    type: extension ? extension.toUpperCase() : "DESCONOCIDO",
    size: formatFileSize(file.size),
    company: companyName || "Sin empresa",
    ccc: ccc || "Sin CCC",
    period: period || "Sin periodo",
  };
}
