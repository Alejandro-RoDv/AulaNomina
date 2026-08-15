const ACTIVE_CASE_CONTEXT_KEY = "aulanomina:active-case-context";
const LAST_CASE_FEEDBACK_KEY = "aulanomina:last-case-operation-feedback";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXPLICIT_REVIEW_TRAINING_CODES = new Set(["A07", "A09", "A14", "A29"]);

const OPERATION_ACTION_ALIASES = {
  manage_termination: new Set([
    "review_voluntary_termination",
    "review_temporary_expiry",
    "review_disciplinary_dismissal",
    "review_objective_indemnity",
    "review_final_settlement_breakdown",
    "review_final_settlement_closed",
    "review_integrated_c06_termination",
    "review_integrated_c06_settlement",
  ]),
  prepare_affiliation: new Set([
    "review_termination_afi_baja",
    "review_integrated_c06_affiliation",
  ]),
};

const OPERATION_RULES = [
  { pattern: /^\/communication-submissions\/\d+\/(?:send|process)(?:\?|$)/, moduleCode: "siltra", actionCode: "submit_siltra", label: "Envío procesado en SILTRA" },
  { pattern: /^\/communications\/\d+\/submit(?:\?|$)/, moduleCode: "siltra", actionCode: "submit_siltra", label: "Fichero enviado a SILTRA" },
  { pattern: /^\/model-111\/declarations\/\d+\/present(?:\?|$)/, moduleCode: "tax", actionCode: "present_model_111", label: "Modelo 111 presentado" },
  { pattern: /^\/model-190\/declarations\/\d+\/present(?:\?|$)/, moduleCode: "tax", actionCode: "present_model_190", label: "Modelo 190 presentado" },
  { pattern: /^\/employment-terminations\/\d+\/finalize(?:\?|$)/, moduleCode: "terminations", actionCode: "manage_termination", label: "Finiquito cerrado", methods: new Set(["POST"]) },
  { pattern: /^\/employment-terminations\/\d+(?:\?|$)/, moduleCode: "terminations", actionCode: "manage_termination", label: "Expediente de extinción actualizado", methods: new Set(["PUT", "PATCH"]) },
  { pattern: /^\/employment-terminations(?:\?|$)/, moduleCode: "terminations", actionCode: "manage_termination", label: "Extinción registrada", methods: new Set(["POST"]) },
  { pattern: /^\/payrolls\/\d+\/regularizations\/apply(?:\?|$)/, moduleCode: "regularizations", actionCode: "create_regularization", label: "Regularización aplicada" },
  { pattern: /^\/contracts\/\d+\/payroll-concepts(?:\?|$)/, moduleCode: "payrolls", actionCode: "update_payroll_concept", label: "Concepto salarial asociado" },
  { pattern: /^\/contract-payroll-concepts\/\d+(?:\/deactivate)?(?:\?|$)/, moduleCode: "payrolls", actionCode: "update_payroll_concept", label: "Concepto salarial actualizado" },
  { pattern: /^\/contracts\/\d+\/social-security-registration(?:\?|$)/, moduleCode: "affiliations", actionCode: "prepare_affiliation", label: "Alta de afiliación preparada" },
  { pattern: /^\/affiliation-remittances\/\d+\/(?:submit|send|process)(?:\?|$)/, moduleCode: "affiliations", actionCode: "submit_affiliation", label: "Fichero de afiliación enviado" },
  { pattern: /^\/affiliation-remittances(?:\/.*)?(?:\?|$)/, moduleCode: "affiliations", actionCode: "prepare_affiliation", label: "Movimiento de afiliación preparado" },
  { pattern: /^\/fie\/communications\/\d+\/read(?:\?|$)/, moduleCode: "fie", actionCode: "review_fie", label: "Comunicación FIE revisada" },
  { pattern: /^\/fie\/communications\/\d+\/(?:compare|resolve|apply)(?:\?|$)/, moduleCode: "fie", actionCode: "reconcile_fie", label: "Comunicación FIE conciliada" },
  { pattern: /^\/incidents\/payrolls\/\d+\/process(?:\?|$)/, moduleCode: "payrolls", actionCode: "recalculate_payroll", label: "Incidencias aplicadas a nómina" },
  { pattern: /^\/incidents(?:\?|$)/, moduleCode: "incidents", actionCode: "create_incident", label: "Incidencia registrada", methods: new Set(["POST"]) },
  { pattern: /^\/incidents\/\d+(?:\?|$)/, moduleCode: "incidents", actionCode: "create_incident", label: "Incidencia revisada", methods: new Set(["PUT", "PATCH"]) },
  { pattern: /^\/payroll-generation(?:\?|$)/, moduleCode: "payrolls", actionCode: "recalculate_payroll", label: "Nómina generada", methods: new Set(["POST"]) },
  { pattern: /^\/payrolls\/prepare-monthly(?:\?|$)/, moduleCode: "payrolls", actionCode: "recalculate_payroll", label: "Nóminas del periodo preparadas", methods: new Set(["POST"]) },
  { pattern: /^\/payrolls(?:\/\d+)?(?:\?|$)/, moduleCode: "payrolls", actionCode: "recalculate_payroll", label: "Nómina recalculada", methods: new Set(["POST", "PUT"]) },
  { pattern: /^\/employees(?:\?|$)/, moduleCode: "employees", actionCode: "create_employee", label: "Trabajador creado", methods: new Set(["POST"]) },
  { pattern: /^\/employees\/\d+(?:\?|$)/, moduleCode: "employees", actionCode: "assign_employee", label: "Adscripción de trabajador actualizada", methods: new Set(["PUT", "PATCH"]) },
  { pattern: /^\/contracts(?:\?|$)/, moduleCode: "contracts", actionCode: "create_contract", label: "Contrato creado", methods: new Set(["POST"]) },
  { pattern: /^\/contracts\/\d+(?:\?|$)/, moduleCode: "contracts", actionCode: "review_contract", label: "Contrato actualizado", methods: new Set(["PUT", "PATCH"]) },
  { pattern: /^\/documents(?:\/.*)?(?:\?|$)/, moduleCode: "documents", actionCode: "review_documents", label: "Expediente documental actualizado" },
];

function normalizeMethod(method) {
  return String(method || "GET").toUpperCase();
}

function normalizePath(path) {
  if (!path) return "";
  try {
    const url = new URL(path, "http://aulanomina.local");
    return `${url.pathname}${url.search}`;
  } catch {
    return String(path);
  }
}

export function classifyCaseOperation(path, method) {
  const normalizedMethod = normalizeMethod(method);
  if (!MUTATING_METHODS.has(normalizedMethod)) return null;

  const normalizedPath = normalizePath(path);
  if (
    normalizedPath.startsWith("/case-assignments/")
    || normalizedPath.startsWith("/mail/")
    || normalizedPath.startsWith("/demo/")
  ) return null;

  const rule = OPERATION_RULES.find((candidate) => (
    candidate.pattern.test(normalizedPath)
    && (!candidate.methods || candidate.methods.has(normalizedMethod))
  ));

  if (!rule) return null;
  return {
    moduleCode: rule.moduleCode,
    actionCode: rule.actionCode,
    label: rule.label,
    method: normalizedMethod,
    path: normalizedPath,
  };
}

export function readActiveCaseContext(storage = null) {
  const targetStorage = storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!targetStorage) return null;
  try {
    const raw = targetStorage.getItem(ACTIVE_CASE_CONTEXT_KEY);
    if (!raw) return null;
    const context = JSON.parse(raw);
    if (!context?.assignmentId || !context?.taskId) return null;
    return context;
  } catch {
    return null;
  }
}

function isCompatibleOperation(context, operation) {
  if (!context?.actionCode) return true;
  if (context.actionCode === operation.actionCode) return true;
  return OPERATION_ACTION_ALIASES[operation.actionCode]?.has(context.actionCode) || false;
}

function createEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `case-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function responseObject(data) {
  if (!data || typeof data !== "object") return {};
  if (Array.isArray(data)) return data[0] && typeof data[0] === "object" ? data[0] : {};
  return data;
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

function extractResourceId(data) {
  const item = responseObject(data);
  const nested = firstObject(item.submission, item.result, item.response, item.item);
  return item.id
    || item.payroll_id
    || item.contract_id
    || item.employee_id
    || item.incident_id
    || nested.id
    || null;
}

function textValue(value) {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" ? value : String(value);
}

function extractDomainMetadata(data) {
  const item = responseObject(data);
  const nested = firstObject(item.submission, item.result, item.response, item.item);
  const responseFile = firstObject(item.response_file, nested.response_file);
  return {
    domain_status: textValue(item.status || nested.status || item.result_status),
    response_status: textValue(item.response_status || nested.response_status || responseFile.status),
    response_code: textValue(item.response_code || nested.response_code || responseFile.response_code),
    response_message: textValue(
      item.response_message
      || nested.response_message
      || responseFile.response_message
      || item.message
      || nested.message
    ),
    submission_number: textValue(item.submission_number || nested.submission_number),
  };
}

function feedbackNotice(result, operationStatus) {
  if (result?.validation?.message) return result.validation.message;
  if (operationStatus === "error") return "La operación no se ha completado. Revisa los datos e inténtalo de nuevo.";
  if (result?.professional_message_id) return "La operación se ha procesado y ha generado una nueva comunicación.";
  return "La operación se ha registrado en el seguimiento del caso.";
}

function publishFeedback(storage, detail) {
  if (!storage || !detail) return;
  try {
    storage.setItem(LAST_CASE_FEEDBACK_KEY, JSON.stringify({
      ...detail,
      publishedAt: new Date().toISOString(),
    }));
  } catch {
    // La operación principal no debe fallar por falta de almacenamiento local.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aulanomina-case-operation-feedback", { detail }));
  }
}

export async function emitCaseOperationEvent({
  apiBaseUrl,
  path,
  method,
  operationStatus,
  responseData = null,
  responseSummary = null,
  httpStatus = null,
  storage = null,
  fetchImpl = null,
}) {
  const operation = classifyCaseOperation(path, method);
  const targetStorage = storage || (typeof window !== "undefined" ? window.localStorage : null);
  const context = readActiveCaseContext(targetStorage);
  if (!operation || !context || !isCompatibleOperation(context, operation)) return null;

  const request = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!request) return null;

  // Estas prácticas registran la operación ERP pero necesitan una comprobación
  // pedagógica posterior más estricta que el validador genérico por existencia.
  const explicitCaseReview = EXPLICIT_REVIEW_TRAINING_CODES.has(
    String(context.trainingCode || "").toUpperCase()
  );

  const payload = {
    task_id: Number(context.taskId),
    event_type: "module_operation",
    action_code: operation.actionCode,
    target: operation.path,
    operation_status: operationStatus,
    response_summary: responseSummary || operation.label,
    auto_validate: operationStatus === "success" && !explicitCaseReview,
    metadata: {
      event_id: createEventId(),
      source: "erp_api",
      module: operation.moduleCode,
      method: operation.method,
      path: operation.path,
      http_status: httpStatus,
      resource_id: extractResourceId(responseData),
      scenario_code: context.scenarioCode || null,
      employee_id: context.employeeId || null,
      employee_name: context.employeeName || null,
      company_id: context.companyId || null,
      center_id: context.centerId || null,
      period: context.period || null,
      ...extractDomainMetadata(responseData),
    },
  };

  try {
    const response = await request(
      `${apiBaseUrl}/case-assignments/${encodeURIComponent(context.assignmentId)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) return null;
    const result = await response.json();
    const detail = {
      assignmentId: Number(context.assignmentId),
      taskId: Number(context.taskId),
      operationStatus,
      actionCode: operation.actionCode,
      feedbackMessageId: result.feedback_message_id || null,
      professionalMessageId: result.professional_message_id || null,
      feedbackNotice: feedbackNotice(result, operationStatus),
      validation: result.validation || null,
      scenario: result.scenario || null,
    };
    publishFeedback(targetStorage, detail);
    return detail;
  } catch {
    return null;
  }
}

export { ACTIVE_CASE_CONTEXT_KEY, LAST_CASE_FEEDBACK_KEY };
