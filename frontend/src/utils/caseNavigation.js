const ACTION_TARGETS = {
  "employee-record": { label: "Abrir trabajador", page: "employee-record" },
  employees: { label: "Abrir trabajadores", page: "employees" },
  create_employee: { label: "Dar de alta trabajadora", page: "employees" },
  assign_employee: { label: "Abrir expediente", page: "employee-record" },
  contracts: { label: "Abrir contratos", page: "contracts" },
  create_contract: { label: "Registrar contrato", page: "contracts" },
  review_contract: { label: "Revisar contrato", page: "contracts" },
  incidents: { label: "Abrir incidencias", page: "incidents" },
  create_incident: { label: "Registrar incidencia", page: "incidents" },
  payrolls: { label: "Abrir nóminas", page: "payroll-history" },
  "payroll-history": { label: "Abrir histórico de nóminas", page: "payroll-history" },
  recalculate_payroll: { label: "Recalcular nómina", page: "payroll-history" },
  update_payroll_concept: { label: "Revisar conceptos salariales", page: "permanent-payroll-concepts" },
  regularizations: { label: "Abrir regularizaciones", page: "payroll-history" },
  create_regularization: { label: "Generar regularización", page: "payroll-history" },
  affiliations: { label: "Abrir afiliación", page: "affiliations" },
  prepare_affiliation: { label: "Preparar movimiento de alta", page: "affiliations" },
  "fie-inbox": { label: "Abrir bandeja FIE", hash: "#fie-inbox" },
  fie: { label: "Abrir bandeja FIE", hash: "#fie-inbox" },
  review_fie: { label: "Revisar comunicación FIE", hash: "#fie-inbox" },
  reconcile_fie: { label: "Conciliar comunicación FIE", hash: "#fie-inbox" },
  documents: { label: "Abrir documentos", hash: "#documents" },
  review_documents: { label: "Revisar documentos", hash: "#documents" },
  model111: { label: "Abrir Modelo 111", hash: "#model-111" },
  model190: { label: "Abrir Modelo 190", hash: "#model-190" },
  siltra: { label: "Abrir ficheros de Seguridad Social", page: "social-security-files" },
  general: { label: "Abrir AulaNomina", page: "dashboard" },
};

const MODULE_TARGETS = {
  employees: ACTION_TARGETS.employees,
  contracts: ACTION_TARGETS.contracts,
  incidents: ACTION_TARGETS.incidents,
  payrolls: ACTION_TARGETS.payrolls,
  regularizations: ACTION_TARGETS.regularizations,
  affiliations: ACTION_TARGETS.affiliations,
  fie: ACTION_TARGETS.fie,
  documents: ACTION_TARGETS.documents,
  tax: ACTION_TARGETS.model111,
  general: ACTION_TARGETS.general,
};

export function resolveCaseTarget(actionCode, moduleCode) {
  return ACTION_TARGETS[actionCode] || MODULE_TARGETS[moduleCode] || ACTION_TARGETS.general;
}

export function getCaseActionLabel(actionCode, moduleCode) {
  return resolveCaseTarget(actionCode, moduleCode).label;
}

export function buildCaseModuleUrl(
  {
    actionCode,
    moduleCode,
    assignmentId,
    taskId,
    scenarioCode,
    employeeName,
  },
  currentUrl = "http://127.0.0.1:5173/"
) {
  const target = resolveCaseTarget(actionCode, moduleCode);
  const url = new URL(currentUrl);
  url.hash = "";
  url.search = "";

  if (target.page) url.searchParams.set("page", target.page);
  if (assignmentId) url.searchParams.set("caseAssignmentId", String(assignmentId));
  if (taskId) url.searchParams.set("caseTaskId", String(taskId));
  if (scenarioCode) url.searchParams.set("scenario", scenarioCode);
  if (employeeName) url.searchParams.set("employee", employeeName);
  if (target.hash) url.hash = target.hash;

  return url.toString();
}

export function openCaseModule(context) {
  const target = resolveCaseTarget(context.actionCode, context.moduleCode);
  const url = buildCaseModuleUrl(context, window.location.href);
  const storedContext = {
    ...context,
    page: target.page || null,
    hash: target.hash || null,
    openedAt: new Date().toISOString(),
  };
  window.localStorage.setItem("aulanomina:active-case-context", JSON.stringify(storedContext));
  return window.open(url, "aulanomina-erp");
}
