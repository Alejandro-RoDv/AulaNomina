const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDays(date, now = new Date()) {
  const target = toDate(date);
  if (!target) return null;
  return Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY);
}

function fullName(employee) {
  if (!employee) return "Trabajador no localizado";
  return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.employee_code || `Trabajador ${employee.id}`;
}

function findById(items, id) {
  return items.find((item) => Number(item.id) === Number(id));
}

function normalizeStatus(value) {
  return String(value || "").toLowerCase().trim();
}

function buildAlert({
  id,
  source,
  severity,
  title,
  description,
  employeeId,
  employeeName,
  companyName,
  centerName,
  dueDate,
  status,
  metadata = {},
}) {
  const dueDays = diffDays(dueDate);

  return {
    id,
    source,
    severity,
    title,
    description,
    employeeId,
    employeeName,
    companyName,
    centerName,
    dueDate,
    dueDays,
    status,
    metadata,
  };
}

function buildContext(record, collections) {
  const { employees = [], companies = [], workCenters = [] } = collections;
  const employee = findById(employees, record.employee_id);
  const company = findById(companies, record.company_id || employee?.company_id);
  const center = findById(workCenters, record.center_id || employee?.center_id);

  return {
    employeeId: employee?.id || record.employee_id || null,
    employeeName: record.employee_name || fullName(employee),
    companyName: record.company_name || company?.name || "Sin empresa",
    centerName: record.center_name || center?.name || "Sin centro",
  };
}

function generateDocumentAlerts(documents = [], collections, now) {
  return documents.flatMap((document) => {
    const status = normalizeStatus(document.status);
    const context = buildContext(document, collections);
    const alerts = [];
    const documentLabel = document.document_name || document.document_type || "sin nombre";

    if (status === "pending") {
      alerts.push(buildAlert({
        id: `document-pending-${document.id}`,
        source: "document",
        severity: "medium",
        title: `Documento pendiente: ${documentLabel}`,
        description: "Documento laboral pendiente de recibir o validar en el expediente.",
        status: "Pendiente",
        metadata: { documentName: documentLabel, documentId: document.id, documentStatus: status },
        ...context,
      }));
    }

    if (status === "expired") {
      alerts.push(buildAlert({
        id: `document-expired-${document.id}`,
        source: "document",
        severity: "critical",
        title: `Documento caducado: ${documentLabel}`,
        description: "Documento marcado como caducado. Requiere revisión documental.",
        dueDate: document.expiry_date,
        status: "Caducado",
        metadata: { documentName: documentLabel, documentId: document.id, documentStatus: status },
        ...context,
      }));
    }

    const daysToExpiry = diffDays(document.expiry_date, now);
    if (status === "received" && daysToExpiry !== null && daysToExpiry <= 30) {
      alerts.push(buildAlert({
        id: `document-expiry-${document.id}`,
        source: "document",
        severity: daysToExpiry < 0 ? "critical" : daysToExpiry <= 7 ? "high" : "medium",
        title: `Documento próximo a caducar: ${documentLabel}`,
        description: daysToExpiry < 0 ? "Documento recibido con fecha de caducidad vencida." : `Caduca en ${daysToExpiry} días.`,
        dueDate: document.expiry_date,
        status: daysToExpiry < 0 ? "Vencido" : "Próximo vencimiento",
        metadata: { documentName: documentLabel, documentId: document.id, documentStatus: status },
        ...context,
      }));
    }

    return alerts;
  });
}

function generateContractAlerts(contracts = [], collections, now) {
  return contracts.flatMap((contract) => {
    const status = normalizeStatus(contract.status);
    const context = buildContext(contract, collections);
    const daysToEnd = diffDays(contract.end_date, now);
    const alerts = [];

    if (status === "active" && daysToEnd !== null && daysToEnd <= 30) {
      alerts.push(buildAlert({
        id: `contract-ending-${contract.id}`,
        source: "contract",
        severity: daysToEnd < 0 ? "critical" : daysToEnd <= 7 ? "critical" : "high",
        title: daysToEnd < 0 ? "Contrato activo con fecha de fin vencida" : "Contrato próximo a finalizar",
        description: daysToEnd < 0 ? "Contrato activo cuya fecha de finalización ya ha pasado. Revisar baja, prórroga o nuevo contrato." : `Finaliza en ${daysToEnd} días. Revisar prórroga, baja o nuevo contrato.`,
        dueDate: contract.end_date,
        status: daysToEnd < 0 ? "Vencido" : "Vencimiento",
        metadata: { contractId: contract.id, contractType: contract.contract_type },
        ...context,
      }));
    }

    if (status === "active" && !contract.end_date && normalizeStatus(contract.contract_type).includes("temporal")) {
      alerts.push(buildAlert({
        id: `contract-temporary-no-end-${contract.id}`,
        source: "contract",
        severity: "medium",
        title: "Contrato temporal sin fecha de fin",
        description: "Contrato temporal activo sin fecha de finalización informada.",
        status: "Revisión",
        metadata: { contractId: contract.id, contractType: contract.contract_type },
        ...context,
      }));
    }

    return alerts;
  });
}

function generateIncidentAlerts(incidents = [], collections) {
  return incidents.flatMap((incident) => {
    const status = normalizeStatus(incident.status);
    const context = buildContext(incident, collections);

    if (!["open", "active"].includes(status)) return [];

    return [buildAlert({
      id: `incident-open-${incident.id}`,
      source: "incident",
      severity: "medium",
      title: `Incidencia abierta: ${incident.incident_type || "sin tipo"}`,
      description: incident.description || "Incidencia laboral abierta pendiente de cierre o seguimiento.",
      dueDate: incident.end_date || incident.start_date,
      status: "Abierta",
      metadata: { incidentId: incident.id, incidentType: incident.incident_type },
      ...context,
    })];
  });
}

function generatePayrollAlerts(payrolls = [], collections) {
  return payrolls.flatMap((payroll) => {
    const status = normalizeStatus(payroll.status);
    const context = buildContext(payroll, collections);

    if (!["pending", "draft", "calculated"].includes(status)) return [];

    return [buildAlert({
      id: `payroll-pending-${payroll.id}`,
      source: "payroll",
      severity: status === "pending" ? "high" : "medium",
      title: `Nómina pendiente: ${String(payroll.period_month).padStart(2, "0")}/${payroll.period_year}`,
      description: "Nómina simulada pendiente de revisión, cierre o validación docente.",
      status: "Pendiente",
      metadata: { payrollId: payroll.id, periodMonth: payroll.period_month, periodYear: payroll.period_year },
      ...context,
    })];
  });
}

export function generateAlerts({ documents = [], contracts = [], incidents = [], payrolls = [], employees = [], companies = [], workCenters = [] }) {
  const now = new Date();
  const collections = { employees, companies, workCenters };

  return [
    ...generateDocumentAlerts(documents, collections, now),
    ...generateContractAlerts(contracts, collections, now),
    ...generateIncidentAlerts(incidents, collections),
    ...generatePayrollAlerts(payrolls, collections),
  ].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

export function getAlertStats(alerts = []) {
  return {
    total: alerts.length,
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    high: alerts.filter((alert) => alert.severity === "high").length,
    medium: alerts.filter((alert) => alert.severity === "medium").length,
    due7: alerts.filter((alert) => typeof alert.dueDays === "number" && alert.dueDays >= 0 && alert.dueDays <= 7).length,
    overdue: alerts.filter((alert) => typeof alert.dueDays === "number" && alert.dueDays < 0).length,
    document: alerts.filter((alert) => alert.source === "document").length,
    contract: alerts.filter((alert) => alert.source === "contract").length,
    incident: alerts.filter((alert) => alert.source === "incident").length,
    payroll: alerts.filter((alert) => alert.source === "payroll").length,
  };
}
