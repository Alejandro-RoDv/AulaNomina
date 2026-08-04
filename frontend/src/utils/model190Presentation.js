export const MODEL190_PRESENTATION_STEPS = [
  "Acceso",
  "Importación",
  "Validación",
  "Revisión",
  "Firma y envío",
  "Justificante",
];

export function model190ImportSummary(report) {
  return {
    recordsRead: Number(report?.records_read || 0),
    correctRecords: Number(report?.correct_records || 0),
    errorRecords: Number(report?.error_records || 0),
    canPresent: Boolean(report?.can_present),
  };
}

export function model190PresentationStartStep(declaration) {
  return declaration?.status === "presented" ? 5 : 0;
}

export function canSignModel190(report, { signerName = "", confirmed = false } = {}) {
  return Boolean(
    report?.can_present
      && String(report?.sha256 || "").length === 64
      && String(signerName).trim().length >= 2
      && confirmed
  );
}

export function model190ImportTone(report) {
  if (!report) return "pending";
  if (Number(report.error_records || 0) > 0) return "error";
  return report.can_present || report.already_presented ? "success" : "warning";
}
