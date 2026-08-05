const ACTIVE_CASE_CONTEXT_KEY = "aulanomina:active-case-context";
const LAST_CASE_FEEDBACK_KEY = "aulanomina:last-case-operation-feedback";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const OPERATION_RULES = [
  { pattern: /^\/payrolls\/\d+\/regularizations\/apply(?:\?|$)/, moduleCode: "regularizations", actionCode: "create_regularization", label: "Regularización aplicada" },
  { pattern: /^\/contracts\/\d+\/payroll-concepts(?:\?|$)/, moduleCode: "payrolls", actionCode: "update_payroll_concept", label: "Concepto salarial asociado" },
  { pattern: /^\/contract-payroll-concepts\/\d+(?:\/deactivate)?(?:\?|$)/, moduleCode: "payrolls", actionCode: "update_payroll_concept", label: "Concepto salarial actualizado" },
  { pattern: /^\/contracts\/\d+\/social-security-registration(?:\?|$)/, moduleCode: "affiliations", actionCode: "prepare_affiliation", label: "Alta de afiliación preparada" },
  { pattern: /^\/affiliation-remittances(?:\/.*)?(?:\?|$)/, moduleCode: "affiliations", actionCode: "prepare_affiliation", label: "Movimiento de afiliación preparado" },
  { pattern: /^\/fie\/communications\/\d+\/read(?:\?|$)/, moduleCode: "fie", actionCode: "review_fie", label: "Comunicación FIE revisada" },
  { pattern: /^\/fie\/communications\/\d+\/(?:compare|resolve|apply)(?:\?|$)/, moduleCode: "fie", actionCode: "reconcile_fie", label: "Comunicación FIE conciliada" },
  { pattern: /^\/incidents(?:\?|$)/, moduleCode: "incidents", actionCode: "create_incident", label: "Incidencia registrada", methods: new Set(["POST"]) },
  { pattern: /^\/incidents\/payrolls\/\d+\/process(?:\?|$)/, moduleCode: "payrolls", actionCode: "recalculate_payroll", label: "Incidencias aplicadas a nómina" },
  { pattern: /^\/payrolls(?:\/\d+)?(?:\?|$)/, moduleCode: "payrolls", actionCode: "recalculate_payroll", label: "Nómina recalculada", methods: new Set(["POST", "PUT"]) },
  { pattern: /^\/employees(?:\?|$)/, moduleCode: "employees", actionCode: "create_employee", label: "Trabajador creado", methods: new Set(["POST"]) },
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
  return context.actionCode === operation.actionCode;
}

function createEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `case-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractResourceId(data) {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) return data[0]?.id || null;
  return data.id || data.payroll_id || data.contract_id || data.employee_id || data.incident_id || null;
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

  const payload = {
    task_id: Number(context.taskId),
    event_type: "module_operation",
    action_code: operation.actionCode,
    target: operation.path,
    operation_status: operationStatus,
    response_summary: responseSummary || operation.label,
    auto_validate: operationStatus === "success",
    metadata: {
      event_id: createEventId(),
      source: "erp_api",
      module: operation.moduleCode,
      method: operation.method,
      path: operation.path,
      http_status: httpStatus,
      resource_id: extractResourceId(responseData),
      scenario_code: context.scenarioCode || null,
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
