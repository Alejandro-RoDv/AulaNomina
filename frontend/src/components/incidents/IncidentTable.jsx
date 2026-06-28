import { useState } from "react";

import { INCIDENT_TYPES, STATUS_OPTIONS } from "./IncidentForm";
import { getIncidentContractVisibleCode } from "../../utils/visibleCodes";

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value));
}

function labelOf(options, value) {
  return options.find((item) => item.value === value)?.label || value || "—";
}

function toEditForm(incident) {
  return {
    center_id: incident.center_id || "",
    incident_type: incident.incident_type || "",
    start_date: incident.start_date || "",
    end_date: incident.end_date || "",
    description: incident.description || "",
    status: incident.status || "open",
    unit_type: incident.unit_type || "period",
    hours: incident.hours ?? "",
    days: incident.days ?? "",
    paid: incident.paid ?? "",
    payroll_effect: incident.payroll_effect || "pending",
    generated_amount: incident.generated_amount ?? "",
    overlap_override: Boolean(incident.overlap_override),
    overlap_reason: incident.overlap_reason || "",
    origin: incident.origin || "manual",
    version: incident.version || 1,
    change_reason: "",
    ...(incident.details || {}),
  };
}

function StatusBadges({ incident }) {
  return (
    <div style={styles.badges}>
      <span style={incident.affects_payroll ? styles.warningBadge : styles.neutralBadge}>{incident.affects_payroll ? "Afecta nómina" : "Informativa"}</span>
      {incident.requires_recalculation && <span style={styles.recalculateBadge}>Recalcular</span>}
      {incident.requires_regularization && <span style={styles.regularizationBadge}>Regularizar</span>}
      {incident.is_cancelled && <span style={styles.cancelledBadge}>Anulada</span>}
    </div>
  );
}

function DetailItem({ label, value }) {
  return <div style={styles.detailItem}><span>{label}</span><strong>{value ?? "—"}</strong></div>;
}

export default function IncidentTable({ loading, incidents, contracts = [], employees = [], onUpdateIncident, onDeleteIncident, submitting }) {
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const contractCode = (incident) => getIncidentContractVisibleCode(incident, contracts, employees);

  const open = (incident) => {
    setSelected(incident);
    setEditForm(toEditForm(incident));
    setEditing(false);
    setError("");
  };

  const close = () => {
    setSelected(null);
    setEditForm(null);
    setEditing(false);
    setError("");
  };

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!editing) {
      setEditing(true);
      return;
    }
    try {
      setError("");
      await onUpdateIncident(selected.id, editForm);
      close();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la incidencia");
    }
  };

  const cancelIncident = async () => {
    if (!window.confirm("La incidencia se anulará conservando su histórico. ¿Continuar?")) return;
    try {
      setError("");
      await onDeleteIncident(selected.id);
      close();
    } catch (err) {
      setError(err.message || "No se pudo anular la incidencia");
    }
  };

  if (loading) return <p>Cargando incidencias…</p>;

  return (
    <>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr><th>Trabajador</th><th>Vida laboral</th><th>Tipo</th><th>Periodo</th><th>Estado</th><th>Impacto</th><th>Importe</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id} style={incident.is_cancelled ? styles.cancelledRow : undefined}>
                <td><strong>{incident.employee_name || incident.employee_id}</strong><small>{incident.employee_code || `${incident.company_id}.${incident.employee_id}`}</small></td>
                <td><strong>{contractCode(incident)}</strong><small>{incident.company_name || incident.company_id}</small></td>
                <td>{labelOf(INCIDENT_TYPES, incident.incident_type)}</td>
                <td>{formatDate(incident.start_date)} — {formatDate(incident.end_date || incident.start_date)}</td>
                <td>{labelOf(STATUS_OPTIONS, incident.status)}<small>v{incident.version || 1}</small></td>
                <td><StatusBadges incident={incident} /></td>
                <td>{formatMoney(incident.generated_amount)}</td>
                <td><button type="button" onClick={() => open(incident)} style={styles.actionButton}>Consultar</button></td>
              </tr>
            ))}
            {!incidents.length && <tr><td colSpan="8">No hay incidencias para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && editForm && (
        <div style={styles.backdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div><h3>Incidencia #{selected.id}</h3><p>{selected.employee_name} · {contractCode(selected)}</p></div>
              <button type="button" onClick={close} style={styles.closeButton}>×</button>
            </div>

            <div style={styles.detailsGrid}>
              <DetailItem label="Tipo" value={labelOf(INCIDENT_TYPES, selected.incident_type)} />
              <DetailItem label="Periodo" value={`${formatDate(selected.start_date)} — ${formatDate(selected.end_date || selected.start_date)}`} />
              <DetailItem label="Unidad" value={selected.unit_type} />
              <DetailItem label="Horas / días" value={`${selected.hours ?? "—"} h · ${selected.days ?? "—"} d`} />
              <DetailItem label="Efecto" value={selected.payroll_effect} />
              <DetailItem label="Nómina procesada" value={selected.processed_payroll_id || "Pendiente"} />
              <DetailItem label="Creada" value={formatDate(selected.created_at)} />
              <DetailItem label="Última modificación" value={formatDate(selected.updated_at)} />
            </div>
            <StatusBadges incident={selected} />
            {selected.payroll_message && <div style={styles.notice}>{selected.payroll_message}</div>}

            <form onSubmit={submit} style={styles.form}>
              <div style={styles.editGrid}>
                <label>Tipo<select name="incident_type" value={editForm.incident_type} onChange={change} disabled={!editing}>{INCIDENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                <label>Estado<select name="status" value={editForm.status} onChange={change} disabled={!editing}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
                <label>Fecha inicial<input type="date" name="start_date" value={editForm.start_date} onChange={change} disabled={!editing} /></label>
                <label>Fecha final<input type="date" name="end_date" value={editForm.end_date} onChange={change} disabled={!editing} /></label>
                <label>Horas<input type="number" min="0" max="24" step="0.01" name="hours" value={editForm.hours} onChange={change} disabled={!editing} /></label>
                <label>Días<input type="number" min="0" step="0.01" name="days" value={editForm.days} onChange={change} disabled={!editing} /></label>
                <label>Efecto<select name="payroll_effect" value={editForm.payroll_effect} onChange={change} disabled={!editing}><option value="pending">Pendiente</option><option value="deduction">Deducción</option><option value="earning">Devengo</option><option value="informative">Informativa</option><option value="none">Sin efecto</option></select></label>
                <label>Importe<input type="number" min="0" step="0.01" name="generated_amount" value={editForm.generated_amount} onChange={change} disabled={!editing} /></label>
              </div>
              <label style={styles.fullLabel}>Observaciones<textarea name="description" value={editForm.description} onChange={change} disabled={!editing} rows="3" /></label>
              {editing && <label style={styles.fullLabel}>Motivo del cambio<textarea name="change_reason" value={editForm.change_reason} onChange={change} rows="2" placeholder="Obligatorio cuando afecta a una nómina ya procesada" /></label>}
              {error && <div style={styles.error}>{error}</div>}
              <div style={styles.actions}>
                <button type="button" onClick={cancelIncident} disabled={submitting || selected.is_cancelled} style={styles.dangerButton}>Anular</button>
                <div><button type="button" onClick={close} style={styles.secondaryButton}>Cerrar</button><button type="submit" disabled={submitting} style={styles.primaryButton}>{editing ? "Guardar cambios" : "Editar"}</button></div>
              </div>
            </form>

            <section style={styles.historySection}>
              <h4>Histórico y auditoría</h4>
              {(selected.audit_entries || []).map((entry) => (
                <div key={entry.id} style={styles.historyItem}><strong>{entry.action}</strong><span>v{entry.version} · {formatDate(entry.created_at)} · {entry.actor || "usuario no identificado"}</span>{entry.reason && <p>{entry.reason}</p>}</div>
              ))}
              {!selected.audit_entries?.length && <p>Registro heredado sin eventos de auditoría. Se auditarán sus próximas modificaciones.</p>}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "9px" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "1120px", fontSize: "12px" },
  cancelledRow: { opacity: 0.62, background: "#f9fafb" },
  actionButton: { border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", padding: "6px 9px", fontWeight: 800, cursor: "pointer" },
  badges: { display: "flex", flexWrap: "wrap", gap: "5px" },
  warningBadge: { padding: "3px 6px", borderRadius: "999px", background: "#fef3c7", color: "#92400e", fontWeight: 800 },
  neutralBadge: { padding: "3px 6px", borderRadius: "999px", background: "#f3f4f6", color: "#4b5563", fontWeight: 800 },
  recalculateBadge: { padding: "3px 6px", borderRadius: "999px", background: "#dbeafe", color: "#1e40af", fontWeight: 800 },
  regularizationBadge: { padding: "3px 6px", borderRadius: "999px", background: "#ede9fe", color: "#5b21b6", fontWeight: 800 },
  cancelledBadge: { padding: "3px 6px", borderRadius: "999px", background: "#fee2e2", color: "#991b1b", fontWeight: 800 },
  backdrop: { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: "22px", zIndex: 1000 },
  modal: { width: "min(980px, 96vw)", maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: "12px", padding: "18px", boxShadow: "0 24px 60px rgba(0,0,0,.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: "16px", borderBottom: "1px solid #e5e7eb", marginBottom: "14px" },
  closeButton: { border: 0, background: "transparent", fontSize: "28px", cursor: "pointer" },
  detailsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "9px", marginBottom: "12px" },
  detailItem: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "9px", display: "flex", flexDirection: "column", gap: "4px" },
  notice: { margin: "10px 0", padding: "10px", borderRadius: "8px", background: "#eff6ff", color: "#1e3a8a", fontWeight: 700 },
  form: { marginTop: "14px", borderTop: "1px solid #e5e7eb", paddingTop: "14px" },
  editGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "10px" },
  fullLabel: { display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px", fontWeight: 700 },
  actions: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "14px" },
  dangerButton: { border: "1px solid #dc2626", background: "#fff", color: "#b91c1c", borderRadius: "7px", padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#fff", borderRadius: "7px", padding: "8px 12px", fontWeight: 800, marginRight: "8px", cursor: "pointer" },
  primaryButton: { border: "1px solid #111827", background: "#111827", color: "#fff", borderRadius: "7px", padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  error: { marginTop: "10px", padding: "10px", borderRadius: "8px", background: "#fee2e2", color: "#991b1b" },
  historySection: { marginTop: "18px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" },
  historyItem: { display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 12px", borderBottom: "1px solid #f1f5f9", padding: "8px 0", fontSize: "12px" },
};
