import { useCallback, useEffect, useMemo, useState } from "react";

import {
  checkNewFieCommunications,
  compareFieCommunication,
  fetchFieCommunications,
  ignoreFieCommunication,
  markFieCommunicationRead,
  reopenFieCommunication,
  resolveFieCommunication,
  simulateFieCommunication,
} from "../services/fieApi";
import "./fieInboxPage.css";

const TYPE_LABELS = {
  SICK_LEAVE: "Baja médica",
  CONFIRMATION: "Confirmación",
  MEDICAL_DISCHARGE: "Alta médica",
  MODIFICATION: "Modificación",
  CANCELLATION: "Anulación",
  RELAPSE: "Recaída",
};

const STATUS_LABELS = {
  RECEIVED: "Recibida",
  PENDING_REVIEW: "Pendiente de revisión",
  MATCHED: "Coincidente",
  DISCREPANCY: "Discrepancia",
  UNMATCHED_WORKER: "Trabajador no identificado",
  DUPLICATE: "Duplicada",
  APPLIED: "Aplicada",
  IGNORED: "Descartada",
  ERROR: "Error",
};

const IMPACT_LABELS = {
  NO_IMPACT: "Sin impacto",
  PENDING_RECALCULATION: "Pendiente de recálculo",
  RECALCULATED: "Recalculada",
  REGULARIZATION_REQUIRED: "Regularización necesaria",
};

const ACTION_LABELS = {
  LINK_INCIDENT: "Vincular a incidencia existente",
  CREATE_INCIDENT: "Crear nueva incidencia",
  UPDATE_INCIDENT: "Actualizar fechas de la incidencia",
  ADD_CONFIRMATION: "Añadir parte de confirmación",
  CLOSE_INCIDENT: "Cerrar incidencia por alta",
  CANCEL_INCIDENT: "Anular incidencia",
  CREATE_RELAPSE: "Crear recaída",
  MARK_FOR_REVIEW: "Marcar para revisión manual",
  IGNORE_DUPLICATE: "Descartar como duplicada",
};

const SCENARIO_LABELS = {
  AUTO: "Caso normal / automático",
  DATE_MISMATCH: "Fecha distinta a la incidencia",
  UNKNOWN_WORKER: "Trabajador no identificado",
  NO_ACTIVE_CONTRACT: "Sin contrato vigente",
  CONFIRMATION_WITHOUT_PROCESS: "Confirmación sin proceso abierto",
  DISCHARGE_WITHOUT_PROCESS: "Alta sin baja previa",
  RELAPSE_WITHOUT_PREVIOUS: "Recaída sin proceso anterior",
  DUPLICATE: "Comunicación duplicada",
};

const EMPTY_FILTERS = { status: "", communication_type: "", priority: "", unread: false };
const QUERY_PHASES = [
  "Conectando con INSS Empresas...",
  "Consultando procesos disponibles...",
  "Validando comunicaciones recibidas...",
  "Actualizando la bandeja...",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function lastCheckStorageKey(companyId) {
  return `aulanomina:fie:lastCheck:${companyId}`;
}

function defaultSimulation(companyId = "", employeeId = "") {
  return {
    company_id: companyId,
    employee_id: employeeId,
    communication_type: "SICK_LEAVE",
    event_date: today(),
    sick_leave_date: today(),
    medical_discharge_date: "",
    confirmation_date: "",
    relapse_date: "",
    contingency_type: "COMMON_DISEASE",
    process_reference: "",
    previous_process_reference: "",
    estimated_duration: "",
    result_scenario: "AUTO",
    priority: "NORMAL",
    external_worker_name: "",
    external_nif: "",
    external_naf: "",
    notes: "",
    created_by: "Usuario demo",
  };
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("es-ES");
}

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function StatusBadge({ status }) {
  return <span className={`fie-status fie-status--${String(status || "received").toLowerCase()}`}>{STATUS_LABELS[status] || status}</span>;
}

function PriorityBadge({ priority }) {
  return <span className={`fie-priority fie-priority--${String(priority || "normal").toLowerCase()}`}>{priority === "URGENT" ? "Urgente" : priority === "HIGH" ? "Alta" : "Normal"}</span>;
}

function SummaryCard({ label, value, tone = "neutral" }) {
  return <div className={`fie-summary-card fie-summary-card--${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function QueryResult({ result, onClose }) {
  if (!result) return null;
  return (
    <section className="fie-query-result">
      <div className="fie-query-result__header">
        <div>
          <span className="fie-eyebrow">Consulta INSS finalizada</span>
          <h2>{result.message}</h2>
          <p>Última consulta: {formatDateTime(result.checked_at)}</p>
        </div>
        <button type="button" className="fie-text-button" onClick={onClose}>Cerrar resumen</button>
      </div>
      <div className="fie-query-result__grid">
        <div><span>Nuevas</span><strong>{result.received_count}</strong></div>
        <div><span>Identificadas</span><strong>{result.identified_count}</strong></div>
        <div><span>Sin identificar</span><strong>{result.unmatched_count}</strong></div>
        <div><span>Pendientes de revisión</span><strong>{result.pending_review_count}</strong></div>
      </div>
    </section>
  );
}

function QueryOverlay({ phase }) {
  return (
    <div className="fie-query-overlay" role="status" aria-live="polite">
      <div className="fie-query-dialog">
        <div className="fie-query-spinner" />
        <span className="fie-eyebrow">Consulta manual</span>
        <h2>Consultando el INSS simulado</h2>
        <p>{phase}</p>
        <small>La bandeja no se modifica hasta que finalice la consulta.</small>
      </div>
    </div>
  );
}

function ComparisonPanel({ communication }) {
  const result = communication?.reconciliation_result || {};
  const checks = result.checks || [];
  const issues = result.issues || [];
  if (!communication) return null;

  return (
    <div className="fie-comparison">
      <section className="fie-detail-card">
        <h3>Información recibida del INSS</h3>
        <dl>
          <div><dt>Trabajador</dt><dd>{communication.external_worker_name || communication.employee_name || "No identificado"}</dd></div>
          <div><dt>NIF</dt><dd>{communication.external_nif || "Sin informar"}</dd></div>
          <div><dt>NAF</dt><dd>{communication.naf || "Sin informar"}</dd></div>
          <div><dt>Proceso</dt><dd>{communication.process_reference}</dd></div>
          <div><dt>Comunicación</dt><dd>{TYPE_LABELS[communication.communication_type]}</dd></div>
          <div><dt>Fecha del hecho</dt><dd>{formatDate(communication.event_date)}</dd></div>
          <div><dt>Contingencia</dt><dd>{communication.contingency_type || "-"}</dd></div>
        </dl>
      </section>

      <section className="fie-detail-card">
        <h3>Información registrada en AulaNomina</h3>
        <dl>
          <div><dt>Trabajador</dt><dd>{communication.employee_id ? `${communication.employee_name} (#${communication.employee_id})` : "No localizado"}</dd></div>
          <div><dt>Contrato vigente</dt><dd>{communication.contract_id ? `#${communication.contract_id}` : "No localizado"}</dd></div>
          <div><dt>Incidencia</dt><dd>{communication.incident_id ? `#${communication.incident_id}` : "No vinculada"}</dd></div>
          <div><dt>Estado interno</dt><dd>{communication.incident_status || "-"}</dd></div>
          <div><dt>Acción propuesta</dt><dd>{ACTION_LABELS[result.recommended_action] || result.recommended_action || "Comparar comunicación"}</dd></div>
        </dl>
      </section>

      <section className="fie-result-card">
        <div className="fie-result-heading">
          <div><span className="fie-eyebrow">Resultado de conciliación</span><h3>{result.summary || "La comunicación todavía no se ha comparado con AulaNomina."}</h3></div>
          <StatusBadge status={communication.status} />
        </div>
        {issues.length > 0 && <div className="fie-issue-list">{issues.map((issue, index) => <p key={`${issue.code}-${index}`}><strong>{issue.code}</strong>{issue.message}</p>)}</div>}
        {checks.length > 0 && (
          <div className="fie-check-table">
            <div className="fie-check-table__head"><span>Campo</span><span>INSS</span><span>AulaNomina</span><span>Resultado</span></div>
            {checks.map((check) => (
              <div key={check.field} className={check.matches ? "fie-check-row fie-check-row--ok" : "fie-check-row fie-check-row--warning"}>
                <strong>{check.label || check.field}</strong><span>{check.external ?? "-"}</span><span>{check.internal ?? "-"}</span><span>{check.message || (check.matches ? "Coincide" : "Revisar")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={`fie-impact-card fie-impact-card--${String(communication.payroll_impact || "NO_IMPACT").toLowerCase()}`}>
        <span className="fie-eyebrow">Impacto previsto en nómina</span>
        <h3>{IMPACT_LABELS[communication.payroll_impact] || communication.payroll_impact}</h3>
        <p>{result.payroll_explanation || "La comunicación no recalcula automáticamente ninguna nómina."}</p>
      </section>
    </div>
  );
}

function ResolutionPanel({ communication, busy, onResolve }) {
  const result = communication?.reconciliation_result || {};
  const actions = result.available_actions || [];
  const candidates = result.candidate_incidents || [];
  const actionsKey = actions.join("|");
  const [action, setAction] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [notes, setNotes] = useState("");
  const [allowDateOverride, setAllowDateOverride] = useState(false);

  useEffect(() => {
    const next = actions[0] || "";
    setAction(next);
    setIncidentId(communication?.incident_id ? String(communication.incident_id) : candidates[0]?.id ? String(candidates[0].id) : "");
    setNotes("");
    setAllowDateOverride(false);
  }, [communication?.id, communication?.incident_id, actionsKey, candidates]);

  if (!communication || communication.status === "APPLIED") return null;
  if (actions.length === 0) return <div className="fie-resolution-empty">Compara la comunicación para obtener opciones de resolución.</div>;

  const needsIncident = ["LINK_INCIDENT", "UPDATE_INCIDENT", "ADD_CONFIRMATION", "CLOSE_INCIDENT", "CANCEL_INCIDENT", "CREATE_RELAPSE"].includes(action);
  return (
    <section className="fie-resolution-panel">
      <div><span className="fie-eyebrow">Decisión del usuario</span><h3>Resolver comunicación</h3></div>
      <label><span>Actuación</span><select value={action} onChange={(event) => setAction(event.target.value)}>{actions.map((value) => <option key={value} value={value}>{ACTION_LABELS[value] || value}</option>)}</select></label>
      {needsIncident && <label><span>Incidencia relacionada</span><select value={incidentId} onChange={(event) => setIncidentId(event.target.value)}><option value="">Selecciona incidencia</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>#{candidate.id} · {candidate.type} · {formatDate(candidate.start_date)} · {candidate.status}</option>)}</select></label>}
      {action === "UPDATE_INCIDENT" && <label className="fie-checkbox"><input type="checkbox" checked={allowDateOverride} onChange={(event) => setAllowDateOverride(event.target.checked)} /><span>Confirmo que las fechas recibidas sustituirán a las registradas.</span></label>}
      <label><span>Motivo / observaciones</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Explica la decisión adoptada" /></label>
      <button type="button" className="fie-button fie-button--primary" disabled={busy || !action || (needsIncident && !incidentId)} onClick={() => onResolve({ action, incident_id: incidentId ? Number(incidentId) : null, allow_date_override: allowDateOverride, notes })}>Aplicar resolución</button>
    </section>
  );
}

export default function FieInboxPage({ companies = [], employees = [] }) {
  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active !== false), [companies]);
  const [companyId, setCompanyId] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [communications, setCommunications] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedTab, setSelectedTab] = useState("comparison");
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulation, setSimulation] = useState(defaultSimulation());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingInss, setCheckingInss] = useState(false);
  const [queryPhase, setQueryPhase] = useState(QUERY_PHASES[0]);
  const [queryResult, setQueryResult] = useState(null);
  const [lastCheckedAt, setLastCheckedAt] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!companyId && activeCompanies.length > 0) {
      const nextCompanyId = String(activeCompanies[0].id);
      setCompanyId(nextCompanyId);
      const firstEmployee = employees.find((employee) => String(employee.company_id) === nextCompanyId);
      setSimulation(defaultSimulation(nextCompanyId, firstEmployee ? String(firstEmployee.id) : ""));
    }
  }, [activeCompanies, companyId, employees]);

  useEffect(() => {
    if (!companyId) {
      setLastCheckedAt("");
      return;
    }
    setLastCheckedAt(window.localStorage.getItem(lastCheckStorageKey(companyId)) || "");
    setQueryResult(null);
  }, [companyId]);

  const companyEmployees = useMemo(() => employees.filter((employee) => !companyId || String(employee.company_id) === String(companyId)), [companyId, employees]);

  const loadCommunications = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchFieCommunications({ company_id: companyId, status: filters.status, communication_type: filters.communication_type });
      setCommunications(data || []);
      setSelectedId((current) => current && data?.some((item) => String(item.id) === String(current)) ? current : data?.[0] ? String(data[0].id) : "");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cargar la bandeja FIE");
    } finally {
      setLoading(false);
    }
  }, [companyId, filters.status, filters.communication_type]);

  useEffect(() => { loadCommunications(); }, [loadCommunications]);

  const visibleCommunications = useMemo(() => communications.filter((item) => (!filters.priority || item.priority === filters.priority) && (!filters.unread || !item.is_read)), [communications, filters.priority, filters.unread]);
  const selected = communications.find((item) => String(item.id) === String(selectedId)) || null;
  const stats = useMemo(() => ({
    total: communications.length,
    unread: communications.filter((item) => !item.is_read).length,
    pending: communications.filter((item) => ["RECEIVED", "PENDING_REVIEW"].includes(item.status)).length,
    discrepancies: communications.filter((item) => ["DISCREPANCY", "ERROR", "DUPLICATE"].includes(item.status)).length,
    unmatched: communications.filter((item) => item.status === "UNMATCHED_WORKER").length,
    regularization: communications.filter((item) => item.payroll_impact === "REGULARIZATION_REQUIRED").length,
  }), [communications]);

  const replaceCommunication = (updated) => setCommunications((previous) => previous.map((item) => item.id === updated.id ? updated : item));

  const selectCommunication = async (item) => {
    setSelectedId(String(item.id));
    setSelectedTab("comparison");
    if (!item.is_read) {
      try { replaceCommunication(await markFieCommunicationRead(item.id, "Usuario demo")); } catch { /* La lectura no bloquea la revisión. */ }
    }
  };

  const updateSimulation = (field, value) => setSimulation((previous) => ({ ...previous, [field]: value }));

  const checkNewCommunications = async () => {
    if (!companyId) return;
    setCheckingInss(true);
    setError("");
    setNotice("");
    setQueryResult(null);
    setQueryPhase(QUERY_PHASES[0]);

    const timers = [
      window.setTimeout(() => setQueryPhase(QUERY_PHASES[1]), 250),
      window.setTimeout(() => setQueryPhase(QUERY_PHASES[2]), 550),
    ];
    const startedAt = Date.now();

    try {
      const result = await checkNewFieCommunications(
        { company_id: Number(companyId), limit: 100 },
        "Usuario demo"
      );
      const remaining = Math.max(0, 850 - (Date.now() - startedAt));
      if (remaining) await delay(remaining);
      setQueryPhase(QUERY_PHASES[3]);
      await loadCommunications();
      setQueryResult(result);
      setLastCheckedAt(result.checked_at);
      window.localStorage.setItem(lastCheckStorageKey(companyId), result.checked_at);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido consultar el INSS simulado");
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
      setCheckingInss(false);
    }
  };

  const runAction = async (action) => {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      let updated;
      if (action === "compare") updated = await compareFieCommunication(selected.id, "Usuario demo");
      if (action === "ignore") updated = await ignoreFieCommunication(selected.id, { actor: "Usuario demo", notes: "Descartada desde la bandeja FIE" });
      if (action === "reopen") updated = await reopenFieCommunication(selected.id, { actor: "Usuario demo" });
      replaceCommunication(updated);
      setNotice(action === "compare" ? "Conciliación completada. Revisa las diferencias y selecciona una resolución." : "Comunicación actualizada.");
    } catch (requestError) { setError(requestError.message || "No se ha podido procesar la comunicación"); }
    finally { setBusy(false); }
  };

  const resolveCommunication = async (resolution) => {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await resolveFieCommunication(selected.id, { ...resolution, actor: "Usuario demo" });
      replaceCommunication(updated);
      setNotice("Resolución aplicada. Se ha actualizado la trazabilidad y el posible impacto en nómina.");
    } catch (requestError) { setError(requestError.message || "No se ha podido aplicar la resolución"); }
    finally { setBusy(false); }
  };

  const submitSimulation = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const unknownWorker = simulation.result_scenario === "UNKNOWN_WORKER";
      const payload = {
        ...simulation,
        company_id: Number(simulation.company_id),
        employee_id: unknownWorker ? null : Number(simulation.employee_id),
        estimated_duration: simulation.estimated_duration ? Number(simulation.estimated_duration) : null,
        sick_leave_date: simulation.sick_leave_date || null,
        confirmation_date: simulation.confirmation_date || null,
        medical_discharge_date: simulation.medical_discharge_date || null,
        relapse_date: simulation.relapse_date || null,
        process_reference: simulation.process_reference || null,
        previous_process_reference: simulation.previous_process_reference || null,
        external_worker_name: simulation.external_worker_name || null,
        external_nif: simulation.external_nif || null,
        external_naf: simulation.external_naf || null,
      };
      const created = await simulateFieCommunication(payload);
      setCompanyId(String(created.company_id)); setFilters(EMPTY_FILTERS);
      setCommunications((previous) => [created, ...previous.filter((item) => item.id !== created.id)]);
      setSelectedId(String(created.id)); setShowSimulator(false);
      setNotice("Comunicación de práctica recibida en la bandeja.");
    } catch (requestError) { setError(requestError.message || "No se ha podido generar la comunicación FIE"); }
    finally { setBusy(false); }
  };

  const copyTechnical = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(JSON.stringify(selected.raw_content, null, 2));
    setNotice("Contenido técnico copiado.");
  };

  const downloadTechnical = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected.raw_content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${selected.external_message_id}.json`; anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fie-page">
      {checkingInss && <QueryOverlay phase={queryPhase} />}

      <section className="fie-summary-grid">
        <SummaryCard label="Comunicaciones" value={stats.total} />
        <SummaryCard label="No leídas" value={stats.unread} tone="info" />
        <SummaryCard label="Pendientes" value={stats.pending} tone="warning" />
        <SummaryCard label="Discrepancias" value={stats.discrepancies} tone="danger" />
        <SummaryCard label="Sin identificar" value={stats.unmatched} tone="danger" />
        <SummaryCard label="A regularizar" value={stats.regularization} tone="warning" />
      </section>

      {error && <div className="fie-banner fie-banner--error">{error}</div>}
      {notice && <div className="fie-banner fie-banner--notice">{notice}</div>}
      <QueryResult result={queryResult} onClose={() => setQueryResult(null)} />

      <section className="fie-query-toolbar">
        <div>
          <span className="fie-eyebrow">Recepción de comunicaciones</span>
          <strong>La bandeja solo recibe novedades cuando ejecutas una consulta.</strong>
          <small>Última consulta: {lastCheckedAt ? formatDateTime(lastCheckedAt) : "Todavía no realizada para esta empresa"}</small>
        </div>
        <button type="button" className="fie-button fie-button--primary" onClick={checkNewCommunications} disabled={checkingInss || !companyId}>
          {checkingInss ? "Consultando INSS..." : "Consultar nuevas comunicaciones"}
        </button>
      </section>

      <section className="fie-toolbar">
        <label><span>Empresa</span><select value={companyId} onChange={(event) => { const value = event.target.value; setCompanyId(value); const firstEmployee = employees.find((employee) => String(employee.company_id) === value); setSimulation(defaultSimulation(value, firstEmployee ? String(firstEmployee.id) : "")); }}><option value="">Selecciona empresa</option>{activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label><span>Estado</span><select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}><option value="">Todos</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Tipo</span><select value={filters.communication_type} onChange={(event) => setFilters((previous) => ({ ...previous, communication_type: event.target.value }))}><option value="">Todos</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Prioridad</span><select value={filters.priority} onChange={(event) => setFilters((previous) => ({ ...previous, priority: event.target.value }))}><option value="">Todas</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label>
        <label className="fie-checkbox fie-checkbox--toolbar"><input type="checkbox" checked={filters.unread} onChange={(event) => setFilters((previous) => ({ ...previous, unread: event.target.checked }))} /><span>Solo no leídas</span></label>
        <button type="button" className="fie-button fie-button--secondary" onClick={loadCommunications} disabled={loading}>{loading ? "Actualizando..." : "Actualizar bandeja"}</button>
        <button type="button" className="fie-button fie-button--secondary" onClick={() => setShowSimulator((value) => !value)}>Generar caso práctico</button>
      </section>

      {showSimulator && (
        <form className="fie-simulator" onSubmit={submitSimulation}>
          <div className="fie-section-title"><div><span className="fie-eyebrow">Modo docente / administrador</span><h2>Generar comunicación de práctica</h2></div><button type="button" className="fie-text-button" onClick={() => setShowSimulator(false)}>Cerrar</button></div>
          <div className="fie-form-grid">
            <label><span>Empresa</span><select required value={simulation.company_id} onChange={(event) => updateSimulation("company_id", event.target.value)}>{activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
            <label><span>Escenario</span><select value={simulation.result_scenario} onChange={(event) => updateSimulation("result_scenario", event.target.value)}>{Object.entries(SCENARIO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Prioridad</span><select value={simulation.priority} onChange={(event) => updateSimulation("priority", event.target.value)}><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label>
            {simulation.result_scenario !== "UNKNOWN_WORKER" && <label><span>Trabajador</span><select required value={simulation.employee_id} onChange={(event) => updateSimulation("employee_id", event.target.value)}><option value="">Selecciona trabajador</option>{companyEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</select></label>}
            {simulation.result_scenario === "UNKNOWN_WORKER" && <><label><span>Nombre recibido</span><input value={simulation.external_worker_name} onChange={(event) => updateSimulation("external_worker_name", event.target.value)} placeholder="Persona no registrada" /></label><label><span>NIF recibido</span><input value={simulation.external_nif} onChange={(event) => updateSimulation("external_nif", event.target.value)} /></label><label><span>NAF recibido</span><input value={simulation.external_naf} onChange={(event) => updateSimulation("external_naf", event.target.value)} /></label></>}
            <label><span>Tipo</span><select value={simulation.communication_type} onChange={(event) => updateSimulation("communication_type", event.target.value)}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Fecha del hecho</span><input type="date" required value={simulation.event_date} onChange={(event) => updateSimulation("event_date", event.target.value)} /></label>
            <label><span>Fecha de baja</span><input type="date" value={simulation.sick_leave_date} onChange={(event) => updateSimulation("sick_leave_date", event.target.value)} /></label>
            <label><span>Fecha de confirmación</span><input type="date" value={simulation.confirmation_date} onChange={(event) => updateSimulation("confirmation_date", event.target.value)} /></label>
            <label><span>Fecha de alta</span><input type="date" value={simulation.medical_discharge_date} onChange={(event) => updateSimulation("medical_discharge_date", event.target.value)} /></label>
            <label><span>Fecha de recaída</span><input type="date" value={simulation.relapse_date} onChange={(event) => updateSimulation("relapse_date", event.target.value)} /></label>
            <label><span>Referencia proceso</span><input value={simulation.process_reference} placeholder="Automática si se deja vacío" onChange={(event) => updateSimulation("process_reference", event.target.value)} /></label>
            <label><span>Proceso anterior</span><input value={simulation.previous_process_reference} onChange={(event) => updateSimulation("previous_process_reference", event.target.value)} /></label>
            <label><span>Contingencia</span><select value={simulation.contingency_type} onChange={(event) => updateSimulation("contingency_type", event.target.value)}><option value="COMMON_DISEASE">Enfermedad común</option><option value="NON_WORK_ACCIDENT">Accidente no laboral</option><option value="WORK_ACCIDENT">Accidente de trabajo</option><option value="OCCUPATIONAL_DISEASE">Enfermedad profesional</option></select></label>
            <label><span>Días estimados</span><input type="number" min="0" value={simulation.estimated_duration} onChange={(event) => updateSimulation("estimated_duration", event.target.value)} /></label>
            <label className="fie-form-grid__wide"><span>Observaciones del caso</span><input value={simulation.notes} onChange={(event) => updateSimulation("notes", event.target.value)} /></label>
          </div>
          <div className="fie-form-actions"><button type="submit" className="fie-button fie-button--primary" disabled={busy}>{busy ? "Generando..." : "Recibir comunicación"}</button></div>
        </form>
      )}

      <div className="fie-workspace">
        <section className="fie-inbox">
          <div className="fie-section-title"><div><span className="fie-eyebrow">Gestión laboral</span><h2>Comunicaciones INSS (FIE)</h2></div><strong>{visibleCommunications.length}</strong></div>
          {loading ? <div className="fie-empty">Actualizando comunicaciones...</div> : visibleCommunications.length === 0 ? <div className="fie-empty">No hay comunicaciones para los filtros seleccionados. Pulsa «Consultar nuevas comunicaciones» para buscar novedades.</div> : (
            <div className="fie-table-wrapper"><table><thead><tr><th></th><th>Recepción</th><th>Trabajador</th><th>Comunicación</th><th>Prioridad</th><th>Estado</th><th>Impacto</th></tr></thead><tbody>{visibleCommunications.map((item) => <tr key={item.id} className={`${String(item.id) === String(selectedId) ? "is-selected" : ""} ${!item.is_read ? "is-unread" : ""}`} onClick={() => selectCommunication(item)}><td>{item.is_read ? "" : <span className="fie-unread-dot" title="No leída" />}</td><td>{formatDateTime(item.received_at)}</td><td><strong>{item.external_worker_name || item.employee_name || "No identificado"}</strong><small>{item.naf || "Sin NAF"}</small></td><td>{TYPE_LABELS[item.communication_type]}<small>{formatDate(item.event_date)}</small></td><td><PriorityBadge priority={item.priority} /></td><td><StatusBadge status={item.status} /></td><td>{IMPACT_LABELS[item.payroll_impact] || item.payroll_impact}</td></tr>)}</tbody></table></div>
          )}
        </section>

        <section className="fie-detail">
          {!selected ? <div className="fie-empty">Selecciona una comunicación para revisar sus datos.</div> : <>
            <div className="fie-detail-header"><div><span className="fie-eyebrow">{selected.external_message_id}</span><h2>{TYPE_LABELS[selected.communication_type]} · {selected.external_worker_name || selected.employee_name || "Sin identificar"}</h2><p>{selected.process_reference}</p></div><div className="fie-detail-badges"><PriorityBadge priority={selected.priority} /><StatusBadge status={selected.status} /></div></div>
            <div className="fie-tabs"><button type="button" className={selectedTab === "comparison" ? "is-active" : ""} onClick={() => setSelectedTab("comparison")}>Conciliación</button><button type="button" className={selectedTab === "resolution" ? "is-active" : ""} onClick={() => setSelectedTab("resolution")}>Resolución</button><button type="button" className={selectedTab === "history" ? "is-active" : ""} onClick={() => setSelectedTab("history")}>Histórico</button><button type="button" className={selectedTab === "technical" ? "is-active" : ""} onClick={() => setSelectedTab("technical")}>Contenido técnico</button></div>
            {selectedTab === "comparison" && <ComparisonPanel communication={selected} />}
            {selectedTab === "resolution" && <ResolutionPanel communication={selected} busy={busy} onResolve={resolveCommunication} />}
            {selectedTab === "history" && <div className="fie-timeline">{(selected.events || []).map((event) => <div key={event.id}><span>{formatDateTime(event.created_at)}</span><strong>{event.event_type}</strong><p>{event.detail || "Sin detalle"}</p>{event.actor && <small>Usuario: {event.actor}</small>}</div>)}</div>}
            {selectedTab === "technical" && <div className="fie-technical-wrap"><div className="fie-technical-actions"><button type="button" className="fie-button fie-button--secondary" onClick={copyTechnical}>Copiar JSON</button><button type="button" className="fie-button fie-button--secondary" onClick={downloadTechnical}>Descargar</button></div><pre className="fie-technical">{JSON.stringify(selected.raw_content, null, 2)}</pre><div className="fie-field-help"><strong>process.reference</strong><span>Relaciona la baja, las confirmaciones y el alta del mismo proceso simulado.</span><strong>simulation_scenario</strong><span>Indica el conflicto didáctico introducido por el profesor.</span><strong>worker.naf</strong><span>Dato principal utilizado para localizar el expediente interno.</span></div></div>}
            <div className="fie-detail-actions"><button type="button" className="fie-button fie-button--secondary" disabled={busy || selected.status === "APPLIED"} onClick={() => runAction("compare")}>Comparar con AulaNomina</button>{["IGNORED", "ERROR", "DISCREPANCY", "DUPLICATE", "UNMATCHED_WORKER"].includes(selected.status) ? <button type="button" className="fie-button fie-button--secondary" disabled={busy} onClick={() => runAction("reopen")}>Reabrir</button> : <button type="button" className="fie-button fie-button--danger" disabled={busy || selected.status === "APPLIED"} onClick={() => runAction("ignore")}>Descartar</button>}</div>
          </>}
        </section>
      </div>
    </div>
  );
}
