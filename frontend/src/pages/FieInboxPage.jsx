import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyFieCommunication,
  compareFieCommunication,
  fetchFieCommunications,
  ignoreFieCommunication,
  reopenFieCommunication,
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
  RECEIVED: "Recibido",
  PENDING_REVIEW: "Pendiente de revisión",
  MATCHED: "Coincidente",
  DISCREPANCY: "Discrepancia",
  APPLIED: "Aplicado",
  IGNORED: "Ignorado",
  ERROR: "Error",
};

const IMPACT_LABELS = {
  NO_IMPACT: "Sin impacto",
  PENDING_RECALCULATION: "Recalcular nómina",
  RECALCULATED: "Recalculada",
  REGULARIZATION_REQUIRED: "Regularización necesaria",
};

const EMPTY_FILTERS = { status: "", communication_type: "" };

function today() {
  return new Date().toISOString().slice(0, 10);
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

function SummaryCard({ label, value, tone = "neutral" }) {
  return (
    <div className={`fie-summary-card fie-summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ComparisonPanel({ communication }) {
  const result = communication?.reconciliation_result || {};
  const checks = result.checks || [];
  if (!communication) return null;

  return (
    <div className="fie-comparison">
      <section className="fie-detail-card">
        <h3>Información recibida del INSS</h3>
        <dl>
          <div><dt>Trabajador</dt><dd>{communication.employee_name || "-"}</dd></div>
          <div><dt>NAF</dt><dd>{communication.naf || "Sin informar"}</dd></div>
          <div><dt>Proceso</dt><dd>{communication.process_reference}</dd></div>
          <div><dt>Comunicación</dt><dd>{TYPE_LABELS[communication.communication_type]}</dd></div>
          <div><dt>Fecha del hecho</dt><dd>{formatDate(communication.event_date)}</dd></div>
          <div><dt>Contingencia</dt><dd>{communication.contingency_type || "-"}</dd></div>
        </dl>
      </section>

      <section className="fie-detail-card">
        <h3>Información existente en AulaNomina</h3>
        <dl>
          <div><dt>Incidencia vinculada</dt><dd>{communication.incident_id ? `#${communication.incident_id}` : "No localizada"}</dd></div>
          <div><dt>Estado interno</dt><dd>{communication.incident_status || "-"}</dd></div>
          <div><dt>Impacto en nómina</dt><dd>{IMPACT_LABELS[communication.payroll_impact] || communication.payroll_impact}</dd></div>
          <div><dt>Acción propuesta</dt><dd>{result.recommended_action || "Comparar comunicación"}</dd></div>
        </dl>
      </section>

      <section className="fie-result-card">
        <div>
          <span className="fie-eyebrow">Resultado de conciliación</span>
          <h3>{result.summary || "La comunicación todavía no se ha comparado con el ERP."}</h3>
        </div>
        <StatusBadge status={communication.status} />
        {checks.length > 0 && (
          <div className="fie-check-list">
            {checks.map((check) => (
              <div key={check.field} className={check.matches ? "fie-check fie-check--ok" : "fie-check fie-check--warning"}>
                <strong>{check.matches ? "✓" : "!"} {check.field}</strong>
                <span>ERP: {check.internal ?? "-"}</span>
                <span>INSS: {check.external ?? "-"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
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

  const companyEmployees = useMemo(
    () => employees.filter((employee) => !companyId || String(employee.company_id) === String(companyId)),
    [companyId, employees]
  );

  const loadCommunications = useCallback(async () => {
    if (!companyId) {
      setCommunications([]);
      setSelectedId("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchFieCommunications({ company_id: companyId, ...filters });
      setCommunications(data || []);
      setSelectedId((current) => {
        if (current && data?.some((item) => String(item.id) === String(current))) return current;
        return data?.[0] ? String(data[0].id) : "";
      });
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cargar la bandeja FIE");
    } finally {
      setLoading(false);
    }
  }, [companyId, filters]);

  useEffect(() => {
    loadCommunications();
  }, [loadCommunications]);

  const selected = communications.find((item) => String(item.id) === String(selectedId)) || null;
  const stats = useMemo(() => ({
    total: communications.length,
    pending: communications.filter((item) => ["RECEIVED", "PENDING_REVIEW"].includes(item.status)).length,
    discrepancies: communications.filter((item) => ["DISCREPANCY", "ERROR"].includes(item.status)).length,
    applied: communications.filter((item) => item.status === "APPLIED").length,
  }), [communications]);

  const updateSimulation = (field, value) => {
    setSimulation((previous) => {
      const next = { ...previous, [field]: value };
      if (field === "event_date") {
        if (next.communication_type === "SICK_LEAVE") next.sick_leave_date = value;
        if (next.communication_type === "CONFIRMATION") next.confirmation_date = value;
        if (next.communication_type === "MEDICAL_DISCHARGE") next.medical_discharge_date = value;
        if (next.communication_type === "RELAPSE") next.relapse_date = value;
      }
      return next;
    });
  };

  const runAction = async (action) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let updated;
      if (action === "compare") updated = await compareFieCommunication(selected.id, "Usuario demo");
      if (action === "apply") updated = await applyFieCommunication(selected.id, { actor: "Usuario demo" });
      if (action === "ignore") updated = await ignoreFieCommunication(selected.id, { actor: "Usuario demo", notes: "Revisión aplazada desde la bandeja FIE" });
      if (action === "reopen") updated = await reopenFieCommunication(selected.id, { actor: "Usuario demo" });
      setCommunications((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(action === "apply" ? "Comunicación aplicada y trazabilidad actualizada." : "Comunicación actualizada.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido procesar la comunicación");
    } finally {
      setBusy(false);
    }
  };

  const submitSimulation = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...simulation,
        company_id: Number(simulation.company_id),
        employee_id: Number(simulation.employee_id),
        estimated_duration: simulation.estimated_duration ? Number(simulation.estimated_duration) : null,
        sick_leave_date: simulation.sick_leave_date || null,
        confirmation_date: simulation.confirmation_date || null,
        medical_discharge_date: simulation.medical_discharge_date || null,
        relapse_date: simulation.relapse_date || null,
        process_reference: simulation.process_reference || null,
        previous_process_reference: simulation.previous_process_reference || null,
      };
      const created = await simulateFieCommunication(payload);
      setCompanyId(String(created.company_id));
      setFilters(EMPTY_FILTERS);
      setCommunications((previous) => [created, ...previous.filter((item) => item.id !== created.id)]);
      setSelectedId(String(created.id));
      setShowSimulator(false);
      setNotice("Comunicación FIE de prueba recibida en la bandeja.");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido generar la comunicación FIE");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fie-page">
      <section className="fie-summary-grid">
        <SummaryCard label="Comunicaciones" value={stats.total} />
        <SummaryCard label="Pendientes" value={stats.pending} tone="warning" />
        <SummaryCard label="Discrepancias" value={stats.discrepancies} tone="danger" />
        <SummaryCard label="Aplicadas" value={stats.applied} tone="success" />
      </section>

      {error && <div className="fie-banner fie-banner--error">{error}</div>}
      {notice && <div className="fie-banner fie-banner--notice">{notice}</div>}

      <section className="fie-toolbar">
        <label>
          <span>Empresa</span>
          <select value={companyId} onChange={(event) => {
            const value = event.target.value;
            setCompanyId(value);
            const firstEmployee = employees.find((employee) => String(employee.company_id) === value);
            setSimulation(defaultSimulation(value, firstEmployee ? String(firstEmployee.id) : ""));
          }}>
            <option value="">Selecciona empresa</option>
            {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select value={filters.communication_type} onChange={(event) => setFilters((previous) => ({ ...previous, communication_type: event.target.value }))}>
            <option value="">Todos</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="fie-button fie-button--secondary" onClick={loadCommunications} disabled={loading}>{loading ? "Consultando..." : "Consultar comunicaciones"}</button>
        <button type="button" className="fie-button fie-button--primary" onClick={() => setShowSimulator((value) => !value)}>Generar FIE de prueba</button>
      </section>

      {showSimulator && (
        <form className="fie-simulator" onSubmit={submitSimulation}>
          <div className="fie-section-title">
            <div><span className="fie-eyebrow">Modo demo / administrador</span><h2>Generar comunicación FIE de prueba</h2></div>
            <button type="button" className="fie-text-button" onClick={() => setShowSimulator(false)}>Cerrar</button>
          </div>
          <div className="fie-form-grid">
            <label><span>Empresa</span><select required value={simulation.company_id} onChange={(event) => updateSimulation("company_id", event.target.value)}>{activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
            <label><span>Trabajador</span><select required value={simulation.employee_id} onChange={(event) => updateSimulation("employee_id", event.target.value)}><option value="">Selecciona trabajador</option>{companyEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</select></label>
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
          </div>
          <div className="fie-form-actions"><button type="submit" className="fie-button fie-button--primary" disabled={busy}>{busy ? "Generando..." : "Recibir comunicación"}</button></div>
        </form>
      )}

      <div className="fie-workspace">
        <section className="fie-inbox">
          <div className="fie-section-title"><div><span className="fie-eyebrow">SILTRA simulado</span><h2>Bandeja FIE / INSS Empresas</h2></div><strong>{communications.length}</strong></div>
          {loading ? <div className="fie-empty">Cargando comunicaciones...</div> : communications.length === 0 ? <div className="fie-empty">No hay comunicaciones para los filtros seleccionados.</div> : (
            <div className="fie-table-wrapper">
              <table>
                <thead><tr><th>Recepción</th><th>Trabajador</th><th>Comunicación</th><th>Fecha</th><th>Estado</th><th>Resultado</th></tr></thead>
                <tbody>{communications.map((item) => (
                  <tr key={item.id} className={String(item.id) === String(selectedId) ? "is-selected" : ""} onClick={() => setSelectedId(String(item.id))}>
                    <td>{formatDateTime(item.received_at)}</td><td><strong>{item.employee_name}</strong><small>{item.naf || "Sin NAF"}</small></td><td>{TYPE_LABELS[item.communication_type]}</td><td>{formatDate(item.event_date)}</td><td><StatusBadge status={item.status} /></td><td>{IMPACT_LABELS[item.payroll_impact] || item.payroll_impact}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section className="fie-detail">
          {!selected ? <div className="fie-empty">Selecciona una comunicación para revisar sus datos.</div> : (
            <>
              <div className="fie-detail-header">
                <div><span className="fie-eyebrow">{selected.external_message_id}</span><h2>{TYPE_LABELS[selected.communication_type]} · {selected.employee_name}</h2><p>{selected.process_reference}</p></div>
                <StatusBadge status={selected.status} />
              </div>
              <div className="fie-tabs">
                <button type="button" className={selectedTab === "comparison" ? "is-active" : ""} onClick={() => setSelectedTab("comparison")}>Conciliación</button>
                <button type="button" className={selectedTab === "history" ? "is-active" : ""} onClick={() => setSelectedTab("history")}>Histórico</button>
                <button type="button" className={selectedTab === "technical" ? "is-active" : ""} onClick={() => setSelectedTab("technical")}>Contenido técnico</button>
              </div>
              {selectedTab === "comparison" && <ComparisonPanel communication={selected} />}
              {selectedTab === "history" && <div className="fie-timeline">{(selected.events || []).map((event) => <div key={event.id}><span>{formatDateTime(event.created_at)}</span><strong>{event.event_type}</strong><p>{event.detail || "Sin detalle"}</p></div>)}</div>}
              {selectedTab === "technical" && <pre className="fie-technical">{JSON.stringify(selected.raw_content, null, 2)}</pre>}
              <div className="fie-detail-actions">
                <button type="button" className="fie-button fie-button--secondary" disabled={busy || selected.status === "APPLIED"} onClick={() => runAction("compare")}>Comparar con ERP</button>
                <button type="button" className="fie-button fie-button--primary" disabled={busy || ["APPLIED", "IGNORED", "DISCREPANCY", "ERROR"].includes(selected.status)} onClick={() => runAction("apply")}>Aplicar comunicación</button>
                {selected.status === "IGNORED" || selected.status === "ERROR" || selected.status === "DISCREPANCY" ? <button type="button" className="fie-button fie-button--secondary" disabled={busy} onClick={() => runAction("reopen")}>Reabrir</button> : <button type="button" className="fie-button fie-button--danger" disabled={busy || selected.status === "APPLIED"} onClick={() => runAction("ignore")}>Dejar pendiente / ignorar</button>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
