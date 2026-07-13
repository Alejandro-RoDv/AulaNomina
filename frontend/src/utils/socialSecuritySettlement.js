export const SETTLEMENT_STATUS_LABELS = {
  DRAFT: "Borrador",
  VALIDATION_ERROR: "Con errores",
  READY: "Preparada",
  CONFIRMED: "Confirmada",
  GENERATED: "Fichero generado",
  CANCELLED: "Cancelada",
};

export const COMMUNICATION_STATUS_LABELS = {
  DRAFT: "Borrador",
  VALIDATING: "Validando",
  VALIDATION_ERROR: "Con errores",
  READY: "Preparado",
  GENERATED: "Generado",
  SENT: "Enviado",
  PROCESSING: "Procesando",
  ACCEPTED: "Aceptado",
  ACCEPTED_WITH_WARNINGS: "Aceptado con avisos",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

export function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPeriod(year, month) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

export function getSettlementIssues(settlement) {
  if (!settlement) return [];
  const settlementIssues = Array.isArray(settlement.validation_errors)
    ? settlement.validation_errors
    : [];
  const lineIssues = (settlement.lines || []).flatMap((line) =>
    (Array.isArray(line.validation_errors) ? line.validation_errors : []).map((issue) => ({
      ...issue,
      payroll_id: issue.payroll_id ?? line.payroll_id,
      employee_id: line.employee_id,
      employee_name: line.employee_name,
    }))
  );
  return [...settlementIssues, ...lineIssues];
}

export function countSettlementIssues(settlement) {
  return getSettlementIssues(settlement).reduce(
    (summary, issue) => {
      const severity = String(issue.severity || "ERROR").toUpperCase();
      if (severity === "WARNING") summary.warnings += 1;
      else summary.errors += 1;
      return summary;
    },
    { errors: 0, warnings: 0 }
  );
}

export function canConfirmSettlement(settlement) {
  if (!settlement || settlement.status !== "READY") return false;
  return countSettlementIssues(settlement).errors === 0;
}

export function canGenerateSettlement(settlement) {
  return Boolean(settlement && settlement.status === "CONFIRMED" && !settlement.communication_file_id);
}

export function settlementStatusLabel(status) {
  return SETTLEMENT_STATUS_LABELS[status] || status || "Sin estado";
}

export function communicationStatusLabel(status) {
  return COMMUNICATION_STATUS_LABELS[status] || status || "Sin estado";
}

export function downloadCommunicationContent(communication) {
  if (!communication?.content) {
    throw new Error("El fichero no contiene datos descargables");
  }
  const filename = communication.original_filename || `comunicacion-${communication.id}.txt`;
  const blob = new Blob([communication.content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
