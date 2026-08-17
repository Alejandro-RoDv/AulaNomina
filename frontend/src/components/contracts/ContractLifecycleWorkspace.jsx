import { useEffect, useMemo, useState } from "react";

import {
  fetchContractLifecycle,
  registerContractExtension,
  registerContractWorkdayChange,
} from "../../services/contractLifecycleApi";

const ACTIVE_CASE_CONTEXT_KEY = "aulanomina:active-case-context";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fullName(employee) {
  return [employee?.first_name, employee?.last_name, employee?.second_last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function readContext() {
  try {
    return JSON.parse(window.localStorage.getItem(ACTIVE_CASE_CONTEXT_KEY) || "null");
  } catch {
    return null;
  }
}

function editableContract(contract, patch = {}) {
  return {
    employee_id: contract.employee_id,
    company_id: contract.company_id,
    center_id: contract.center_id,
    contract_type: contract.contract_type,
    contract_code: contract.contract_code || "",
    contract_code_description: contract.contract_code_description || "",
    contract_family: contract.contract_family || "",
    start_date: contract.start_date,
    end_date: contract.end_date || "",
    status: contract.status || "active",
    termination_reason: contract.termination_reason || "",
    salary_base: contract.salary_base ?? "",
    pay_schedule: contract.pay_schedule || "not_prorated_14",
    contribution_group: contract.contribution_group || "",
    professional_category: contract.professional_category || "",
    job_position: contract.job_position || "",
    collective_agreement_code: contract.collective_agreement_code || "",
    collective_agreement_id: contract.collective_agreement_id || "",
    professional_category_id: contract.professional_category_id || "",
    salary_table_row_id: contract.salary_table_row_id || "",
    working_day_type: contract.working_day_type || "full_time",
    weekly_hours: contract.weekly_hours ?? "40",
    full_time_weekly_hours: contract.full_time_weekly_hours ?? "40",
    monthly_hours: contract.monthly_hours ?? "",
    annual_hours: contract.annual_hours ?? "",
    partiality_coefficient: contract.partiality_coefficient ?? "100",
    work_distribution: contract.work_distribution || "",
    monthly_or_daily_contribution: contract.monthly_or_daily_contribution || "monthly",
    temporary_cause: contract.temporary_cause || "",
    training_contract_subtype: contract.training_contract_subtype || "",
    training_program: contract.training_program || "",
    training_center: contract.training_center || "",
    training_company_tutor: contract.training_company_tutor || "",
    training_plan_reference: contract.training_plan_reference || "",
    training_work_percentage: contract.training_work_percentage ?? "",
    qualification_name: contract.qualification_name || "",
    qualification_date: contract.qualification_date || "",
    ...patch,
  };
}

function eventLabel(type) {
  if (type === "workday_change") return "Variación de jornada";
  if (type === "extension") return "Prórroga";
  if (type === "transformation") return "Transformación";
  return type || "Movimiento";
}

function stateSummary(state = {}) {
  if (state.weekly_hours !== undefined) return `${state.weekly_hours} h/semana · ${state.partiality_coefficient ?? "-"} %`;
  if (state.end_date) return `Fin ${state.end_date}`;
  return Object.entries(state).map(([key, value]) => `${key}: ${value}`).join(" · ") || "-";
}

export default function ContractLifecycleWorkspace({ contracts, employees, onUpdateContract, submitting }) {
  const [context, setContext] = useState(readContext);
  const [contractId, setContractId] = useState("");
  const [specific, setSpecific] = useState({});
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [workday, setWorkday] = useState({ effective_date: "", weekly_hours: "", reason: "" });
  const [extension, setExtension] = useState({ effective_date: "", new_end_date: "", reason: "" });

  useEffect(() => {
    const handleContext = (event) => setContext(event?.detail || readContext());
    window.addEventListener("aulanomina-case-context", handleContext);
    return () => window.removeEventListener("aulanomina-case-context", handleContext);
  }, []);

  const expectedEmployee = useMemo(() => {
    if (context?.employeeId) return employees.find((employee) => String(employee.id) === String(context.employeeId)) || null;
    const expected = normalize(context?.employeeName);
    return expected ? employees.find((employee) => normalize(fullName(employee)) === expected) || null : null;
  }, [context, employees]);

  useEffect(() => {
    if (!expectedEmployee) return;
    const candidate = contracts
      .filter((contract) => String(contract.employee_id) === String(expectedEmployee.id))
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")) || Number(b.id) - Number(a.id))[0];
    if (candidate) setContractId(String(candidate.id));
  }, [contracts, expectedEmployee]);

  const selected = useMemo(
    () => contracts.find((contract) => String(contract.id) === String(contractId)) || null,
    [contracts, contractId]
  );

  useEffect(() => {
    if (!selected) {
      setSpecific({});
      setEvents([]);
      return;
    }
    setSpecific({
      temporary_cause: selected.temporary_cause || "",
      training_contract_subtype: selected.training_contract_subtype || "",
      training_program: selected.training_program || "",
      training_center: selected.training_center || "",
      training_company_tutor: selected.training_company_tutor || "",
      training_plan_reference: selected.training_plan_reference || "",
      training_work_percentage: selected.training_work_percentage ?? "",
      qualification_name: selected.qualification_name || "",
      qualification_date: selected.qualification_date || "",
    });
    setWorkday({ effective_date: "", weekly_hours: selected.weekly_hours ?? "", reason: "" });
    setExtension({ effective_date: selected.end_date || "", new_end_date: "", reason: "" });

    let active = true;
    setLoadingEvents(true);
    fetchContractLifecycle(selected.id)
      .then((rows) => active && setEvents(rows || []))
      .catch((requestError) => active && setError(requestError.message || "No se pudo cargar el histórico contractual."))
      .finally(() => active && setLoadingEvents(false));
    return () => { active = false; };
  }, [selected?.id]);

  const saveSpecific = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setMessage("");
    try {
      await onUpdateContract(selected.id, editableContract(selected, specific));
      setMessage("Datos específicos del contrato actualizados.");
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (requestError) {
      setError(requestError.message || "No se pudieron actualizar los datos contractuales.");
    }
  };

  const saveWorkday = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setMessage("");
    try {
      const lifecycleEvent = await registerContractWorkdayChange(selected.id, {
        effective_date: workday.effective_date,
        weekly_hours: Number(workday.weekly_hours),
        reason: workday.reason,
      });
      await onUpdateContract(selected.id, editableContract(selected, lifecycleEvent.new_state || {}));
      setEvents((current) => [...current.filter((row) => row.id !== lifecycleEvent.id), lifecycleEvent].sort((a, b) => String(a.effective_date).localeCompare(String(b.effective_date))));
      setMessage("Variación de jornada registrada con trazabilidad.");
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (requestError) {
      setError(requestError.message || "No se pudo registrar la variación de jornada.");
    }
  };

  const saveExtension = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setMessage("");
    try {
      const lifecycleEvent = await registerContractExtension(selected.id, {
        effective_date: extension.effective_date,
        new_end_date: extension.new_end_date,
        reason: extension.reason,
      });
      await onUpdateContract(selected.id, editableContract(selected, { end_date: extension.new_end_date, status: "active", termination_reason: "" }));
      setEvents((current) => [...current.filter((row) => row.id !== lifecycleEvent.id), lifecycleEvent].sort((a, b) => String(a.effective_date).localeCompare(String(b.effective_date))));
      setMessage("Prórroga registrada y fecha fin anterior preservada.");
      window.dispatchEvent(new Event("aulanomina-activities-refresh"));
    } catch (requestError) {
      setError(requestError.message || "No se pudo registrar la prórroga.");
    }
  };

  return (
    <section style={styles.wrapper} aria-label="Datos específicos y ciclo de vida contractual">
      <div style={styles.header}>
        <div>
          <span style={styles.eyebrow}>Relación contractual</span>
          <h3 style={styles.title}>Datos específicos y ciclo de vida</h3>
          <p style={styles.subtitle}>Causalidad temporal, datos formativos y variaciones que deben conservar histórico.</p>
        </div>
        <label style={styles.selector}>
          <span>Contrato</span>
          <select value={contractId} onChange={(event) => setContractId(event.target.value)} style={styles.input}>
            <option value="">Seleccionar contrato</option>
            {contracts.map((contract) => {
              const employee = employees.find((item) => String(item.id) === String(contract.employee_id));
              return <option key={contract.id} value={contract.id}>{fullName(employee) || `Trabajador ${contract.employee_id}`} · {contract.contract_code || contract.contract_type} · {contract.start_date}</option>;
            })}
          </select>
        </label>
      </div>

      {!selected ? (
        <div style={styles.empty}>Selecciona un contrato. Si el caso todavía no lo tiene, créalo primero desde «Nuevo contrato».</div>
      ) : (
        <>
          <div style={styles.summary}>
            <div><span>Modalidad</span><strong>{selected.contract_code || "-"} · {selected.contract_type || "-"}</strong></div>
            <div><span>Vigencia</span><strong>{selected.start_date} → {selected.end_date || "sin fecha fin"}</strong></div>
            <div><span>Jornada</span><strong>{selected.weekly_hours ?? "-"} h · {selected.partiality_coefficient ?? "-"} %</strong></div>
          </div>

          <form onSubmit={saveSpecific} style={styles.panel}>
            <div style={styles.panelHeading}><strong>Datos específicos</strong><span>Completa únicamente los que correspondan a la modalidad.</span></div>
            <div style={styles.grid}>
              <label style={styles.fieldWide}><span>Causa de temporalidad</span><textarea value={specific.temporary_cause || ""} onChange={(event) => setSpecific((current) => ({ ...current, temporary_cause: event.target.value }))} rows="3" style={styles.textarea} placeholder="Describe la necesidad temporal y su conexión con la duración." /></label>
              <label style={styles.field}><span>Subtipo formativo</span><select value={specific.training_contract_subtype || ""} onChange={(event) => setSpecific((current) => ({ ...current, training_contract_subtype: event.target.value }))} style={styles.input}><option value="">No aplica</option><option value="alternance">Formación en alternancia</option><option value="professional_practice">Obtención de práctica profesional</option></select></label>
              <label style={styles.field}><span>Programa formativo</span><input value={specific.training_program || ""} onChange={(event) => setSpecific((current) => ({ ...current, training_program: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Centro / entidad formativa</span><input value={specific.training_center || ""} onChange={(event) => setSpecific((current) => ({ ...current, training_center: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Tutor/a empresa</span><input value={specific.training_company_tutor || ""} onChange={(event) => setSpecific((current) => ({ ...current, training_company_tutor: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Referencia plan formativo</span><input value={specific.training_plan_reference || ""} onChange={(event) => setSpecific((current) => ({ ...current, training_plan_reference: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>% trabajo efectivo</span><input type="number" min="1" max="100" step="0.01" value={specific.training_work_percentage ?? ""} onChange={(event) => setSpecific((current) => ({ ...current, training_work_percentage: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Titulación</span><input value={specific.qualification_name || ""} onChange={(event) => setSpecific((current) => ({ ...current, qualification_name: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Fecha de obtención</span><input type="date" value={specific.qualification_date || ""} onChange={(event) => setSpecific((current) => ({ ...current, qualification_date: event.target.value }))} style={styles.input} /></label>
            </div>
            <div style={styles.actions}><button type="submit" disabled={submitting} style={styles.primary}>{submitting ? "Guardando…" : "Guardar datos específicos"}</button></div>
          </form>

          <div style={styles.twoColumns}>
            <form onSubmit={saveWorkday} style={styles.panel}>
              <div style={styles.panelHeading}><strong>Variación de jornada</strong><span>Actualiza la situación vigente conservando el antes y el después.</span></div>
              <label style={styles.field}><span>Fecha de efectos</span><input required type="date" value={workday.effective_date} onChange={(event) => setWorkday((current) => ({ ...current, effective_date: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Nuevas horas semanales</span><input required type="number" min="1" step="0.01" value={workday.weekly_hours} onChange={(event) => setWorkday((current) => ({ ...current, weekly_hours: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Motivo</span><textarea required rows="2" value={workday.reason} onChange={(event) => setWorkday((current) => ({ ...current, reason: event.target.value }))} style={styles.textarea} /></label>
              <div style={styles.actions}><button type="submit" style={styles.secondary}>Registrar variación</button></div>
            </form>

            <form onSubmit={saveExtension} style={styles.panel}>
              <div style={styles.panelHeading}><strong>Prórroga</strong><span>Amplía la vigencia sin cambiar la modalidad contractual.</span></div>
              <label style={styles.field}><span>Fecha de efectos</span><input required type="date" value={extension.effective_date} onChange={(event) => setExtension((current) => ({ ...current, effective_date: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Nueva fecha fin</span><input required type="date" value={extension.new_end_date} onChange={(event) => setExtension((current) => ({ ...current, new_end_date: event.target.value }))} style={styles.input} /></label>
              <label style={styles.field}><span>Motivo</span><textarea required rows="2" value={extension.reason} onChange={(event) => setExtension((current) => ({ ...current, reason: event.target.value }))} style={styles.textarea} /></label>
              <div style={styles.actions}><button type="submit" style={styles.secondary}>Registrar prórroga</button></div>
            </form>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeading}><strong>Histórico contractual</strong><span>{loadingEvents ? "Cargando…" : `${events.length} movimientos registrados`}</span></div>
            {!loadingEvents && !events.length ? <div style={styles.emptyInline}>Todavía no hay variaciones o prórrogas registradas.</div> : events.map((row) => (
              <div key={row.id} style={styles.eventRow}>
                <div><strong>{eventLabel(row.event_type)}</strong><span>{row.effective_date}</span></div>
                <div><span>Anterior</span><strong>{stateSummary(row.previous_state)}</strong></div>
                <div><span>Nueva situación</span><strong>{stateSummary(row.new_state)}</strong></div>
                <p>{row.reason || "Sin observaciones"}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {message && <div style={styles.success}>{message}</div>}
      {error && <div style={styles.error}>{error}</div>}
    </section>
  );
}

const styles = {
  wrapper: { marginBottom: "18px", border: "1px solid #dbe3ec", borderRadius: "10px", background: "#fff", overflow: "hidden" },
  header: { padding: "16px 18px", display: "flex", alignItems: "end", justifyContent: "space-between", gap: "20px", borderBottom: "1px solid #e5e7eb" },
  eyebrow: { display: "block", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "#64748b", marginBottom: "4px" },
  title: { margin: 0, fontSize: "18px", color: "#0f172a" },
  subtitle: { margin: "4px 0 0", fontSize: "13px", color: "#64748b" },
  selector: { minWidth: "330px", display: "grid", gap: "5px", fontSize: "12px", fontWeight: 700, color: "#475569" },
  summary: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1px", background: "#e5e7eb", borderBottom: "1px solid #e5e7eb" },
  panel: { padding: "16px 18px", borderBottom: "1px solid #e5e7eb" },
  panelHeading: { display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px", fontSize: "13px", color: "#64748b" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  field: { display: "grid", gap: "5px", marginBottom: "10px", fontSize: "12px", fontWeight: 700, color: "#475569" },
  fieldWide: { display: "grid", gridColumn: "1 / -1", gap: "5px", fontSize: "12px", fontWeight: 700, color: "#475569" },
  input: { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", color: "#0f172a" },
  textarea: { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", resize: "vertical", color: "#0f172a", fontFamily: "inherit" },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: "10px" },
  primary: { border: 0, borderRadius: "6px", padding: "8px 12px", background: "#1d4ed8", color: "#fff", fontWeight: 700, cursor: "pointer" },
  secondary: { border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px 12px", background: "#fff", color: "#334155", fontWeight: 700, cursor: "pointer" },
  empty: { padding: "18px", color: "#64748b", fontSize: "13px" },
  emptyInline: { padding: "8px 0", color: "#64748b", fontSize: "13px" },
  eventRow: { display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: "12px", padding: "11px 0", borderTop: "1px solid #eef2f7", alignItems: "start" },
  success: { margin: "12px 18px", padding: "10px 12px", background: "#f0fdf4", color: "#166534", borderRadius: "6px", fontSize: "13px" },
  error: { margin: "12px 18px", padding: "10px 12px", background: "#fef2f2", color: "#991b1b", borderRadius: "6px", fontSize: "13px" },
};
