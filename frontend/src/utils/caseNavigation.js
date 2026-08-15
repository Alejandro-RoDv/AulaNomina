const ACTION_TARGETS = {
  "employee-record": { label: "Abrir trabajador", page: "employee-record" },
  employees: { label: "Abrir trabajadores", page: "employees-list" },
  create_employee: { label: "Dar de alta trabajadora", page: "employees" },
  assign_employee: { label: "Abrir expediente", page: "employee-record" },
  companies: { label: "Abrir empresas y centros", page: "companies" },
  review_company_structure: { label: "Revisar empresa y centro", page: "companies" },
  "collective-agreements": { label: "Abrir convenios", page: "collective-agreements" },
  review_collective_agreement_assignment: { label: "Revisar contrato y convenio", page: "contracts" },
  review_employee_data_correction: { label: "Abrir trabajadores", page: "employees-list" },
  contracts: { label: "Abrir contratos", page: "contracts" },
  create_contract: { label: "Registrar contrato", page: "contracts" },
  review_contract: { label: "Revisar contrato", page: "employee-record" },
  review_temporary_contract: { label: "Formalizar contrato temporal", page: "contracts" },
  review_alternance_contract: { label: "Formalizar formación en alternancia", page: "contracts" },
  review_professional_practice_contract: { label: "Formalizar práctica profesional", page: "contracts" },
  review_workday_variation: { label: "Registrar variación de jornada", page: "contracts" },
  review_contract_extension_decision: { label: "Revisar y prorrogar contrato", page: "contracts" },
  incidents: { label: "Abrir incidencias", page: "incidents" },
  create_incident: { label: "Registrar incidencia", page: "incidents", incidentCategory: "medical" },
  payrolls: { label: "Abrir nóminas", page: "payroll-history" },
  "payroll-history": { label: "Abrir histórico de nóminas", page: "payroll-history" },
  recalculate_payroll: { label: "Recalcular nómina", page: "payroll-history" },
  update_payroll_concept: { label: "Revisar conceptos salariales", page: "permanent-payroll-concepts" },
  regularizations: { label: "Abrir regularizaciones", page: "payroll-history" },
  create_regularization: { label: "Generar regularización", page: "payroll-history" },
  affiliations: { label: "Abrir afiliación", page: "affiliations" },
  prepare_affiliation: { label: "Preparar movimiento de alta", page: "affiliations" },
  submit_affiliation: { label: "Enviar fichero de afiliación", page: "affiliation-files" },
  "fie-inbox": { label: "Abrir bandeja FIE", hash: "#fie-inbox" },
  fie: { label: "Abrir bandeja FIE", hash: "#fie-inbox" },
  review_fie: { label: "Revisar comunicación FIE", hash: "#fie-inbox" },
  reconcile_fie: { label: "Conciliar comunicación FIE", hash: "#fie-inbox" },
  documents: { label: "Abrir documentos", hash: "#documents" },
  review_documents: { label: "Revisar documentos", hash: "#documents" },
  model111: { label: "Abrir Modelo 111", hash: "#model-111" },
  present_model_111: { label: "Presentar Modelo 111", hash: "#model-111" },
  model190: { label: "Abrir Modelo 190", hash: "#model-190" },
  present_model_190: { label: "Presentar Modelo 190", hash: "#model-190" },
  siltra: { label: "Abrir SILTRA", page: "social-security-files" },
  submit_siltra: { label: "Enviar a SILTRA", page: "social-security-files" },
  mail: { label: "Abrir correo", hash: "#mail" },
  reply_mail: { label: "Responder comunicación", hash: "#mail" },

  review_integrated_c01_employee: { label: "Abrir trabajadores", page: "employees-list" },
  review_integrated_c01_contract: { label: "Abrir contratos", page: "contracts" },
  review_integrated_c01_affiliation: { label: "Abrir afiliación", page: "affiliations" },
  review_integrated_c01_documents: { label: "Abrir documentos", hash: "#documents" },
  review_integrated_c01_payroll: { label: "Abrir nóminas", page: "payroll-history" },

  review_integrated_c03_cause: { label: "Revisar contrato", page: "contracts" },
  review_integrated_c03_concept: { label: "Revisar conceptos salariales", page: "permanent-payroll-concepts" },
  review_integrated_c03_regularization: { label: "Abrir nómina y regularización", page: "payroll-history" },
  review_integrated_c03_reply: { label: "Responder reclamación", hash: "#mail" },

  review_integrated_c04_sources: { label: "Revisar Modelo 111", hash: "#model-111" },
  review_integrated_c04_declaration: { label: "Cerrar Modelo 111", hash: "#model-111" },
  review_integrated_c04_presentation: { label: "Presentar Modelo 111", hash: "#model-111" },

  review_integrated_c05_origin: { label: "Abrir Seguros Sociales", page: "social-security-dashboard" },
  review_integrated_c05_correction: { label: "Abrir ficheros de Seguridad Social", page: "social-security-files" },
  review_integrated_c05_acceptance: { label: "Revisar respuesta SILTRA", page: "social-security-files" },

  review_integrated_c06_termination: { label: "Abrir relación contractual", page: "contracts" },
  review_integrated_c06_settlement: { label: "Abrir relación contractual", page: "contracts" },
  review_integrated_c06_affiliation: { label: "Preparar baja", page: "affiliations" },
  review_integrated_c06_close: { label: "Comunicar cierre", hash: "#mail" },

  general: { label: "Abrir AulaNomina", page: "dashboard" },
};

const MODULE_TARGETS = {
  employees: ACTION_TARGETS.employees,
  companies: ACTION_TARGETS.companies,
  "work-centers": ACTION_TARGETS.companies,
  "collective-agreements": ACTION_TARGETS["collective-agreements"],
  contracts: ACTION_TARGETS.contracts,
  incidents: ACTION_TARGETS.incidents,
  payrolls: ACTION_TARGETS.payrolls,
  regularizations: ACTION_TARGETS.regularizations,
  affiliations: ACTION_TARGETS.affiliations,
  fie: ACTION_TARGETS.fie,
  documents: ACTION_TARGETS.documents,
  tax: ACTION_TARGETS.model111,
  irpf: { label: "Abrir IRPF", page: "irpf" },
  cra: { label: "Abrir Seguros Sociales", page: "social-security-dashboard" },
  "social-security": { label: "Abrir Seguros Sociales", page: "social-security-dashboard" },
  social_security: { label: "Abrir Seguros Sociales", page: "social-security-dashboard" },
  terminations: ACTION_TARGETS.contracts,
  mail: ACTION_TARGETS.mail,
  general: ACTION_TARGETS.general,
};

export function resolveCaseTarget(actionCode, moduleCode) {
  return ACTION_TARGETS[actionCode] || MODULE_TARGETS[moduleCode] || ACTION_TARGETS.general;
}

export function getCaseActionLabel(actionCode, moduleCode) {
  return resolveCaseTarget(actionCode, moduleCode).label;
}

export function buildCaseModuleUrl(context, currentUrl = "http://127.0.0.1:5173/") {
  const target = resolveCaseTarget(context.actionCode, context.moduleCode);
  const url = new URL(currentUrl);
  url.hash = "";
  url.search = "";

  if (target.page) url.searchParams.set("page", target.page);
  if (context.actionCode) url.searchParams.set("caseAction", context.actionCode);
  if (context.assignmentId) url.searchParams.set("caseAssignmentId", String(context.assignmentId));
  if (context.taskId) url.searchParams.set("caseTaskId", String(context.taskId));
  if (context.scenarioCode) url.searchParams.set("scenario", context.scenarioCode);
  if (context.employeeName) url.searchParams.set("employee", context.employeeName);
  if (context.employeeId) url.searchParams.set("employeeId", String(context.employeeId));
  if (context.companyId) url.searchParams.set("companyId", String(context.companyId));
  if (context.period) url.searchParams.set("period", context.period);
  if (context.startDate) url.searchParams.set("startDate", context.startDate);
  if (context.relatedEntityType) url.searchParams.set("entityType", context.relatedEntityType);
  if (context.relatedEntityId) url.searchParams.set("entityId", String(context.relatedEntityId));
  if (target.incidentCategory) url.searchParams.set("incidentCategory", target.incidentCategory);

  if (context.actionCode === "review_company_structure" && context.companyId) {
    url.hash = `#company-detail/${context.companyId}/centers`;
  } else if (target.hash) {
    url.hash = target.hash;
  }

  return url.toString();
}

export function openCaseModule(context) {
  const target = resolveCaseTarget(context.actionCode, context.moduleCode);
  const url = buildCaseModuleUrl(context, window.location.href);
  const storedContext = {
    ...context,
    page: target.page || null,
    hash: new URL(url).hash || target.hash || null,
    incidentCategory: target.incidentCategory || null,
    openedAt: new Date().toISOString(),
  };
  window.localStorage.setItem("aulanomina:active-case-context", JSON.stringify(storedContext));
  window.sessionStorage.setItem("aulanomina:active-case-context", JSON.stringify(storedContext));
  return window.open(url, "aulanomina-erp");
}
