const FROZEN_STATUSES = new Set(["generated", "validated", "presented"]);

export function model190DocumentAvailability(declaration) {
  const frozen = Boolean(declaration?.locked && FROZEN_STATUSES.has(declaration?.status));
  const presented = declaration?.status === "presented";
  return {
    annualSummary: frozen,
    recipientRelation: frozen,
    certificateDirectory: presented,
    certificateArchive: presented,
  };
}

export function model190DocumentsStatusText(declaration) {
  const availability = model190DocumentAvailability(declaration);
  if (!availability.annualSummary) return "Documentos no disponibles";
  if (!availability.certificateDirectory) return "Resumen y perceptores disponibles · certificados tras presentar";
  return "Resumen, perceptores y certificados disponibles";
}
