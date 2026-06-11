const EVENT_META = {
  employee_hired: { label: "Alta", group: "laboral", color: "#16a34a", severity: "success" },
  employee_terminated: { label: "Baja", group: "laboral", color: "#6b7280", severity: "danger" },
  contract_start: { label: "Contrato", group: "contracts", color: "#2563eb", severity: "info" },
  contract_end: { label: "Fin contrato", group: "contracts", color: "#64748b", severity: "warning" },
  contract_update: { label: "Variación", group: "contracts", color: "#0891b2", severity: "info" },
  incident_start: { label: "Incidencia", group: "incidents", color: "#f97316", severity: "warning" },
  incident_end: { label: "Fin incidencia", group: "incidents", color: "#fb923c", severity: "info" },
  document_requested: { label: "Documento", group: "documents", color: "#7c3aed", severity: "info" },
  document_received: { label: "Documento", group: "documents", color: "#7c3aed", severity: "success" },
  document_validated: { label: "Documento", group: "documents", color: "#7c3aed", severity: "success" },
  document_expired: { label: "Documento", group: "documents", color: "#9333ea", severity: "warning" },
  payroll_generated: { label: "Nómina", group: "payrolls", color: "#d97706", severity: "info" },
  alert_created: { label: "Alerta", group: "alerts", color: "#dc2626", severity: "danger" },
};

const PRIORITY = {
  alert_created: 10,
  employee_terminated: 20,
  contract_end: 30,
  incident_end: 40,
  payroll_generated: 50,
  document_expired: 60,
  document_validated: 70,
  document_received: 80,
  document_requested: 90,
  incident_start: 100,
  contract_update: 110,
  contract_start: 120,
  employee_hired: 130,
};

const INCIDENT_LABELS = {
  IT: "Incapacidad temporal",
  RECAIDA: "Recaída",
  VACACIONES: "Vacaciones",
  AUSENCIA: "Ausencia",
  PERMISO_RETRIBUIDO: "Permiso retribuido",
  PERMISO_NO_RETRIBUIDO: "Permiso no retribuido",
};

const WORKDAY_LABELS = {
  full_time: "tiempo completo",
  part_time: "tiempo parcial",
  fixed_discontinuous: "fijo discontinuo",
};

const DOCUMENT_EVENT_BY_STATUS = {
  pending: "document_requested",
  received: "document_received",
  signed: "document_validated",
  accepted: "document_validated",
  reviewed: "document_validated",
  validated: "document_validated",
  expired: "document_expired",
};

const DOCUMENT_TITLE_BY_STATUS = {
  pending: "Documento solicitado",
  received: "Documento recibido",
  signed: "Documento firmado",
  accepted: "Documento validado",
  reviewed: "Documento revisado",
  validated: "Documento validado",
  expired: "Documento caducado",
};

function normalizeId(value) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function sameId(a, b) {
  return normalizeId(a) !== "" && normalizeId(a) === normalizeId(b);
}

function indexById(items = []) {
  return items.reduce((acc, item) => {
    if (item?.id !== undefined && item?.id !== null) acc[normalizeId(item.id)] = item;
    return acc;
  }, {});
}

function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function joinDetails(parts) {
  return parts.filter((part) => part !== null && part !== undefined && String(part).trim() !== "").join(" · ");
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(number);
}

function getCompanyName(companyId, companyMap, fallback) {
  return fallback || companyMap[normalizeId(companyId)]?.name || "Sin empresa";
}

function getCenterName(centerId, centerMap, fallback) {
  return fallback || centerMap[normalizeId(centerId)]?.name || "Sin centro";
}

function addEvent(events, event) {
  const date = dateOnly(event.date);
  if (!date) return;
  const meta = EVENT_META[event.type] || { label: event.type, group: "other", color: "#6b7280", severity: "info" };
  events.push({
    id: event.id,
    date,
    type: event.type,
    label: meta.label,
    group: meta.group,
    title: event.title,
    description: event.description,
    source: event.source,
    sourceId: event.sourceId,
    severity: event.severity || meta.severity,
    color: meta.color,
    metadata: event.metadata || {},
  });
}

function firstContractDate(contracts) {
  return contracts.map((contract) => dateOnly(contract.start_date)).filter(Boolean).sort()[0] || "";
}

function employeeStartDate(employee, employeeContracts) {
  return dateOnly(employee.hire_date || employee.employment_start_date || employee.start_date || employee.registration_date) || firstContractDate(employeeContracts) || dateOnly(employee.created_at);
}

function employeeEndDate(employee, employeeContracts) {
  const explicitDate = dateOnly(employee.termination_date || employee.end_date || employee.leaving_date || employee.inactive_at);
  if (explicitDate) return explicitDate;
  if (employee.is_active !== false) return "";
  const endDates = employeeContracts.map((contract) => dateOnly(contract.end_date)).filter(Boolean).sort();
  return endDates.length ? endDates[endDates.length - 1] : "";
}

function payrollDate(payroll) {
  if (payroll.generated_at || payroll.created_at) return dateOnly(payroll.generated_at || payroll.created_at);
  if (!payroll.period_year || !payroll.period_month) return "";
  const month = Math.min(Math.max(Number(payroll.period_month) || 1, 1), 12);
  const lastDay = new Date(Number(payroll.period_year), month, 0).getDate();
  return `${payroll.period_year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function documentDate(document) {
  const status = String(document.status || "").toLowerCase();
  if (status === "expired") return dateOnly(document.expiry_date || document.expiration_date || document.created_at);
  if (["received", "signed", "accepted", "reviewed", "validated"].includes(status)) return dateOnly(document.issue_date || document.received_at || document.validated_at || document.created_at);
  return dateOnly(document.request_date || document.created_at || document.issue_date);
}

function contractDescription(contract) {
  return joinDetails([
    contract.contract_code_description || contract.contract_type || "Contrato laboral",
    contract.working_day_type ? `Jornada: ${WORKDAY_LABELS[contract.working_day_type] || contract.working_day_type}` : "",
    contract.weekly_hours ? `${contract.weekly_hours} h/semana` : "",
    contract.partiality_coefficient ? `coeficiente ${contract.partiality_coefficient}%` : "",
  ]);
}

export function buildEmployeeTimeline({
  employee,
  contracts = [],
  incidents = [],
  payrolls = [],
  documents = [],
  alerts = [],
  companies = [],
  workCenters = [],
} = {}) {
  if (!employee?.id) return [];

  const events = [];
  const companyMap = indexById(companies);
  const centerMap = indexById(workCenters);
  const employeeContracts = contracts.filter((contract) => sameId(contract.employee_id, employee.id));
  const employeeIncidents = incidents.filter((incident) => sameId(incident.employee_id, employee.id));
  const employeePayrolls = payrolls.filter((payroll) => sameId(payroll.employee_id, employee.id));
  const employeeDocuments = documents.filter((document) => sameId(document.employee_id, employee.id));
  const employeeAlerts = alerts.filter((alert) => sameId(alert.employee_id, employee.id));

  const employeeCompany = getCompanyName(employee.company_id, companyMap);
  const employeeCenter = getCenterName(employee.center_id, centerMap);

  addEvent(events, {
    id: `employee-${employee.id}-hired`,
    date: employeeStartDate(employee, employeeContracts),
    type: "employee_hired",
    title: "Alta del trabajador",
    description: `Alta inicial en ${employeeCompany} — ${employeeCenter}`,
    source: "employees",
    sourceId: employee.id,
    metadata: { employeeId: employee.id, employeeCode: employee.employee_code, companyName: employeeCompany, centerName: employeeCenter },
  });

  addEvent(events, {
    id: `employee-${employee.id}-terminated`,
    date: employeeEndDate(employee, employeeContracts),
    type: "employee_terminated",
    title: "Baja del trabajador",
    description: `Baja en ${employeeCompany} — ${employeeCenter}`,
    source: "employees",
    sourceId: employee.id,
    metadata: { employeeId: employee.id, employeeCode: employee.employee_code, companyName: employeeCompany, centerName: employeeCenter },
  });

  employeeContracts.forEach((contract) => {
    const code = contract.contract_code || contract.code || contract.id || "sin código";
    const contractCompany = getCompanyName(contract.company_id, companyMap, contract.company_name);
    const contractCenter = getCenterName(contract.center_id, centerMap, contract.center_name);
    const metadata = { employeeId: contract.employee_id, contractId: contract.id, contractCode: code, companyName: contractCompany, centerName: contractCenter };

    addEvent(events, {
      id: `contract-${contract.id}-start`,
      date: contract.start_date,
      type: "contract_start",
      title: `Inicio contrato ${code}`,
      description: joinDetails([contractDescription(contract), contractCompany, contractCenter]),
      source: "contracts",
      sourceId: contract.id,
      metadata,
    });

    addEvent(events, {
      id: `contract-${contract.id}-end`,
      date: contract.end_date,
      type: "contract_end",
      title: `Fin contrato ${code}`,
      description: contract.termination_reason || "Finalización del contrato laboral.",
      source: "contracts",
      sourceId: contract.id,
      metadata,
    });

    addEvent(events, {
      id: `contract-${contract.id}-transformation`,
      date: contract.transformation_date,
      type: "contract_update",
      title: `Transformación contrato ${code}`,
      description: contract.transformation_reason || "Transformación contractual registrada.",
      source: "contracts",
      sourceId: contract.id,
      metadata,
    });
  });

  employeeIncidents.forEach((incident) => {
    const label = INCIDENT_LABELS[incident.incident_type] || incident.incident_type || "Incidencia laboral";
    const incidentCompany = getCompanyName(incident.company_id, companyMap, incident.company_name);
    const incidentCenter = getCenterName(incident.center_id, centerMap, incident.center_name);
    const metadata = { employeeId: incident.employee_id, incidentId: incident.id, incidentType: incident.incident_type, companyName: incidentCompany, centerName: incidentCenter };

    addEvent(events, {
      id: `incident-${incident.id}-start`,
      date: incident.start_date,
      type: "incident_start",
      title: `Inicio ${label}`,
      description: joinDetails([incident.description || label, incident.status ? `Estado: ${incident.status}` : "", incidentCompany, incidentCenter]),
      source: "incidents",
      sourceId: incident.id,
      metadata,
    });

    addEvent(events, {
      id: `incident-${incident.id}-end`,
      date: incident.end_date,
      type: "incident_end",
      title: `Fin ${label}`,
      description: incident.description || `Finaliza ${label}.`,
      source: "incidents",
      sourceId: incident.id,
      metadata,
    });
  });

  employeePayrolls.forEach((payroll) => {
    const period = payroll.period_label || `${String(payroll.period_month || "").padStart(2, "0")}/${payroll.period_year || ""}`;
    addEvent(events, {
      id: `payroll-${payroll.id}-generated`,
      date: payrollDate(payroll),
      type: "payroll_generated",
      title: `Nómina ${period}`,
      description: joinDetails([payroll.gross_salary ? `Bruto ${formatCurrency(payroll.gross_salary)}` : "", payroll.net_salary ? `Neto ${formatCurrency(payroll.net_salary)}` : "", payroll.status ? `Estado: ${payroll.status}` : ""]),
      source: "payrolls",
      sourceId: payroll.id,
      metadata: { employeeId: payroll.employee_id, payrollId: payroll.id, contractId: payroll.contract_id, periodLabel: period, status: payroll.status },
    });
  });

  employeeDocuments.forEach((document) => {
    const status = String(document.status || "pending").toLowerCase();
    const type = DOCUMENT_EVENT_BY_STATUS[status] || "document_requested";
    const name = document.document_name || document.name || document.title || document.document_type || "Documento";
    addEvent(events, {
      id: `document-${document.id}-${type}`,
      date: documentDate(document),
      type,
      title: DOCUMENT_TITLE_BY_STATUS[status] || "Documento registrado",
      description: joinDetails([name, document.document_type, document.status ? `Estado: ${document.status}` : ""]),
      source: "documents",
      sourceId: document.id,
      metadata: { employeeId: document.employee_id, documentId: document.id, documentType: document.document_type, documentName: name, status: document.status },
    });
  });

  employeeAlerts.forEach((alert) => {
    addEvent(events, {
      id: `alert-${alert.id || alert.title || alert.alert_type}`,
      date: alert.due_date || alert.target_date || alert.expiration_date || alert.date || alert.created_at,
      type: "alert_created",
      title: alert.title || alert.alert_type || "Alerta laboral",
      description: alert.description || alert.message || alert.detail || "Alerta asociada al trabajador.",
      source: "alerts",
      sourceId: alert.id,
      metadata: { employeeId: alert.employee_id, alertId: alert.id, alertType: alert.alert_type || alert.type, status: alert.status },
    });
  });

  return events.sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return (PRIORITY[a.type] || 999) - (PRIORITY[b.type] || 999);
  });
}

export function getEmployeeTimelineSummary(events = []) {
  const byGroup = events.reduce((acc, event) => ({ ...acc, [event.group]: (acc[event.group] || 0) + 1 }), {});
  return {
    total: events.length,
    labor: byGroup.laboral || 0,
    contracts: byGroup.contracts || 0,
    incidents: byGroup.incidents || 0,
    payrolls: byGroup.payrolls || 0,
    documents: byGroup.documents || 0,
    alerts: byGroup.alerts || 0,
    lastEvent: events[0] || null,
  };
}

export function getEmployeeTimelineEventMeta(type) {
  return EVENT_META[type] || { label: type, group: "other", color: "#6b7280", severity: "info" };
}
