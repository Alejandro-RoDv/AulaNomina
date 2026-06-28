const PENDING_STATUSES = new Set(["draft", "open", "pending"]);
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

export function normalizeIncidentText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function dateToNumber(value) {
  return value ? Number(String(value).slice(0, 10).replaceAll("-", "")) : null;
}

export function incidentOverlapsMonth(incident, year, month) {
  if (!year || !month) return true;
  const monthStart = Number(`${year}${String(month).padStart(2, "0")}01`);
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const monthEnd = Number(`${year}${String(month).padStart(2, "0")}${String(lastDay).padStart(2, "0")}`);
  const incidentStart = dateToNumber(incident.start_date);
  const incidentEnd = dateToNumber(incident.end_date) || incidentStart;
  if (!incidentStart) return false;
  return incidentStart <= monthEnd && incidentEnd >= monthStart;
}

export function buildIncidentAlerts(incidents) {
  return incidents
    .filter((incident) => !incident.is_cancelled)
    .map((incident) => {
      const reasons = [];
      let severity = "info";

      if (incident.requires_regularization) {
        severity = "critical";
        reasons.push("La incidencia afecta a una nómina cerrada y requiere regularización.");
      }
      if (incident.requires_recalculation) {
        if (severity !== "critical") severity = "warning";
        reasons.push("Existe un resultado de nómina que debe recalcularse.");
      }
      if (PENDING_STATUSES.has(incident.status) && !incident.processed_payroll_id) {
        reasons.push("La incidencia todavía está pendiente de procesar en nómina.");
      }
      if (incident.has_overlap_conflict || incident.overlap_conflict || incident.conflict_detected) {
        if (severity === "info") severity = "warning";
        reasons.push("Se ha detectado un posible solapamiento que necesita revisión.");
      }

      return reasons.length ? { incident, reasons, severity } : null;
    })
    .filter(Boolean)
    .sort((left, right) => {
      const severityDifference = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
      if (severityDifference !== 0) return severityDifference;
      return String(right.incident.start_date || "").localeCompare(String(left.incident.start_date || ""));
    });
}

export function filterIncidentHistory(incidents, filters) {
  const search = normalizeIncidentText(filters.search);
  const fromDate = dateToNumber(filters.dateFrom);
  const toDate = dateToNumber(filters.dateTo);

  return incidents.filter((incident) => {
    const incidentStart = dateToNumber(incident.start_date);
    const incidentEnd = dateToNumber(incident.end_date) || incidentStart;
    const searchable = normalizeIncidentText([
      incident.employee_name,
      incident.employee_code,
      incident.company_name,
      incident.center_name,
      incident.agreement_name,
      incident.professional_category,
      incident.incident_type,
      incident.description,
    ].join(" "));

    return (
      (!search || searchable.includes(search))
      && (!filters.employeeId || String(incident.employee_id) === String(filters.employeeId))
      && (!filters.companyId || String(incident.company_id) === String(filters.companyId))
      && (!filters.centerId || String(incident.center_id || "") === String(filters.centerId))
      && (!filters.agreementKey || String(incident.agreement_key || "") === String(filters.agreementKey))
      && (!filters.incidentType || incident.incident_type === filters.incidentType)
      && (!filters.status || incident.status === filters.status)
      && (!fromDate || (incidentEnd && incidentEnd >= fromDate))
      && (!toDate || (incidentStart && incidentStart <= toDate))
    );
  });
}

export function countIncidentsByTypes(incidents, types) {
  if (!types) return incidents.length;
  return incidents.filter((incident) => types.includes(incident.incident_type)).length;
}
