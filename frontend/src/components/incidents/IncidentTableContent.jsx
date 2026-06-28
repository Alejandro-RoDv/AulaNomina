import { useState } from "react";

import {
  cancelIncident,
  cancelIncidentConfirmation,
  createIncidentConfirmation,
  requestIncidentRecalculation,
} from "../../services/incidentApi";
import { getIncidentContractVisibleCode } from "../../utils/visibleCodes";
import { INCIDENT_TYPES, STATUS_OPTIONS } from "./IncidentForm";

const MEDICAL_TYPES = new Set([
  "IT",
  "RECAIDA",
  "NACIMIENTO_CUIDADO",
  "RIESGO_EMBARAZO",
  "RIESGO_LACTANCIA",
  "CUIDADO_MENOR",
]);

const EMPTY_CONFIRMATION = {
  number: "",
  confirmation_date: "",
  confirmation_type: "confirmation",
  doctor_number: "",
  observations: "",
};

function optionLabel(options, value) {
  return options.find((item) => item.value === value)?.label || value || "—";
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value));
}

function editFormOf(incident) {
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

function Badges({ incident }) {
  return (
    <div className="incident-badges">
      <span>{incident.affects_payroll ? "Afecta nómina" : "Informativa"}</span>
      {incident.requires_recalculation && <span>Recalcular</span>}
      {incident.requires_regularization && <span>Regularizar</span>}
      {incident.is_cancelled && <span>Anulada</span>}
    </div>
  );
}

export default function IncidentTableContent({
  loading,
  incidents,
  contracts = [],
  employees = [],
  onUpdateIncident,
  submitting,
}) {
  const [overrides, setOverrides] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [confirmationForm, setConfirmationForm] = useState(EMPTY_CONFIRMATION);

  const visibleIncidents = incidents.map((incident) => ({ ...incident, ...(overrides[incident.id] || {}) }));
  const selected = visibleIncidents.find((incident) => incident.id === selectedId) || null;
  const busy = submitting || actionSubmitting;

  const contractCode = (incident) => getIncidentContractVisibleCode(incident, contracts, employees);

  const applyServerIncident = (incident) => {
    setOverrides((current) => ({ ...current, [incident.id]: incident }));
    setEditForm(editFormOf(incident));
  };

  const openIncident = (incident) => {
    setSelectedId(incident.id);
    setEditForm(editFormOf(incident));
    setEditing(false);
    setError("");
    setShowCancellation(false);
    setCancellationReason("");
    setConfirmationForm(EMPTY_CONFIRMATION);
  };

  const closeIncident = () => {
    setSelectedId(null);
    setEditForm(null);
    setEditing(false);
    setError("");
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editing) {
      setEditing(true);
      return;
    }
    try {
      setError("");
      await onUpdateIncident(selected.id, editForm);
      closeIncident();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la incidencia");
    }
  };

  const confirmCancellation = async () => {
    if (cancellationReason.trim().length < 3) {
      setError("Indique un motivo de anulación");
      return;
    }
    try {
      setActionSubmitting(true);
      const updated = await cancelIncident(selected.id, {
        reason: cancellationReason.trim(),
        expected_version: selected.version,
      });
      applyServerIncident(updated);
      setShowCancellation(false);
      setCancellationReason("");
    } catch (err) {
      setError(err.message || "No se pudo anular la incidencia");
    } finally {
      setActionSubmitting(false);
    }
  };

  const requestRecalculation = async () => {
    const reason = window.prompt("Motivo del recálculo o regularización:");
    if (!reason?.trim()) return;
    try {
      setActionSubmitting(true);
      const updated = await requestIncidentRecalculation(selected.id, {
        reason: reason.trim(),
        expected_version: selected.version,
      });
      applyServerIncident(updated);
    } catch (err) {
      setError(err.message || "No se pudo solicitar el recálculo");
    } finally {
      setActionSubmitting(false);
    }
  };

  const addConfirmation = async (event) => {
    event.preventDefault();
    try {
      setActionSubmitting(true);
      const updated = await createIncidentConfirmation(selected.id, {
        ...confirmationForm,
        doctor_number: confirmationForm.doctor_number || null,
        observations: confirmationForm.observations || null,
        expected_incident_version: selected.version,
      });
      applyServerIncident(updated);
      setConfirmationForm(EMPTY_CONFIRMATION);
    } catch (err) {
      setError(err.message || "No se pudo crear el parte de confirmación");
    } finally {
      setActionSubmitting(false);
    }
  };

  const annulConfirmation = async (confirmation) => {
    const reason = window.prompt("Motivo de anulación del parte:");
    if (!reason?.trim()) return;
    try {
      setActionSubmitting(true);
      const updated = await cancelIncidentConfirmation(selected.id, confirmation.id, {
        reason: reason.trim(),
        expected_version: confirmation.version,
        expected_incident_version: selected.version,
      });
      applyServerIncident(updated);
    } catch (err) {
      setError(err.message || "No se pudo anular el parte");
    } finally {
      setActionSubmitting(false);
    }
  };

  if (loading) return <p>Cargando incidencias…</p>;

  return (
    <>
      <div className="incident-table-wrap">
        <table className="incident-table">
          <thead><tr><th>Trabajador</th><th>Vida laboral</th><th>Tipo</th><th>Periodo</th><th>Estado</th><th>Impacto</th><th>Importe</th><th /></tr></thead>
          <tbody>
            {visibleIncidents.map((incident) => (
              <tr key={incident.id} className={incident.is_cancelled ? "is-cancelled" : ""}>
                <td><strong>{incident.employee_name || incident.employee_id}</strong><small>{incident.employee_code || `${incident.company_id}.${incident.employee_id}`}</small></td>
                <td><strong>{contractCode(incident)}</strong><small>{incident.company_name || incident.company_id}</small></td>
                <td>{optionLabel(INCIDENT_TYPES, incident.incident_type)}</td>
                <td>{formatDate(incident.start_date)} — {formatDate(incident.end_date || incident.start_date)}</td>
                <td>{optionLabel(STATUS_OPTIONS, incident.status)}<small>v{incident.version}</small></td>
                <td><Badges incident={incident} /></td>
                <td>{formatMoney(incident.generated_amount)}</td>
                <td><button type="button" onClick={() => openIncident(incident)}>Consultar</button></td>
              </tr>
            ))}
            {!visibleIncidents.length && <tr><td colSpan="8">No hay incidencias para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && editForm && (
        <div className="incident-modal-backdrop">
          <article className="incident-modal">
            <header><div><h3>Incidencia #{selected.id}</h3><p>{selected.employee_name} · {contractCode(selected)}</p></div><button type="button" onClick={closeIncident}>×</button></header>
            <div className="incident-summary-grid">
              <div><span>Tipo</span><strong>{optionLabel(INCIDENT_TYPES, selected.incident_type)}</strong></div>
              <div><span>Periodo</span><strong>{formatDate(selected.start_date)} — {formatDate(selected.end_date || selected.start_date)}</strong></div>
              <div><span>Nómina</span><strong>{selected.processed_payroll_id || "Pendiente"}</strong></div>
              <div><span>Versión</span><strong>{selected.version}</strong></div>
            </div>
            <Badges incident={selected} />
            {selected.payroll_message && <p className="incident-notice">{selected.payroll_message}</p>}
            {error && <p className="incident-error">{error}</p>}

            <form onSubmit={submitEdit} className="incident-edit-form">
              <label>Estado<select name="status" value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))} disabled={!editing}>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
              <label>Fecha inicial<input type="date" value={editForm.start_date} onChange={(event) => setEditForm((current) => ({ ...current, start_date: event.target.value }))} disabled={!editing} /></label>
              <label>Fecha final<input type="date" value={editForm.end_date} onChange={(event) => setEditForm((current) => ({ ...current, end_date: event.target.value }))} disabled={!editing} /></label>
              <label>Importe<input type="number" min="0" step="0.01" value={editForm.generated_amount} onChange={(event) => setEditForm((current) => ({ ...current, generated_amount: event.target.value }))} disabled={!editing} /></label>
              <label className="wide">Observaciones<textarea value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} disabled={!editing} rows="3" /></label>
              {editing && <label className="wide">Motivo del cambio<textarea value={editForm.change_reason} onChange={(event) => setEditForm((current) => ({ ...current, change_reason: event.target.value }))} rows="2" /></label>}
              <div className="incident-actions wide"><button type="button" onClick={() => setShowCancellation(true)} disabled={busy || selected.is_cancelled}>Anular</button><button type="button" onClick={requestRecalculation} disabled={busy || selected.is_cancelled}>Solicitar recálculo</button><span /><button type="button" onClick={closeIncident}>Cerrar</button><button type="submit" disabled={busy || selected.is_cancelled}>{editing ? "Guardar" : "Editar"}</button></div>
            </form>

            {showCancellation && <section className="incident-cancel-box"><strong>Anulación con trazabilidad</strong><textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} rows="2" placeholder="Motivo obligatorio" /><button type="button" onClick={confirmCancellation} disabled={busy}>Confirmar anulación</button></section>}

            {MEDICAL_TYPES.has(selected.incident_type) && (
              <section className="incident-section">
                <h4>Partes de confirmación</h4>
                {(selected.confirmations || []).map((confirmation) => <div className="incident-confirmation" key={confirmation.id}><strong>{confirmation.number}</strong><span>{formatDate(confirmation.confirmation_date)}</span><span>{confirmation.observations || "Sin observaciones"}</span><button type="button" onClick={() => annulConfirmation(confirmation)} disabled={busy || confirmation.is_cancelled}>{confirmation.is_cancelled ? "Anulado" : "Anular"}</button></div>)}
                {!selected.confirmations?.length && <p>No hay partes registrados.</p>}
                {!selected.is_cancelled && <form onSubmit={addConfirmation} className="incident-confirmation-form"><input name="number" value={confirmationForm.number} onChange={(event) => setConfirmationForm((current) => ({ ...current, number: event.target.value }))} placeholder="Número" required /><input type="date" value={confirmationForm.confirmation_date} onChange={(event) => setConfirmationForm((current) => ({ ...current, confirmation_date: event.target.value }))} required /><input value={confirmationForm.doctor_number} onChange={(event) => setConfirmationForm((current) => ({ ...current, doctor_number: event.target.value }))} placeholder="N.º colegiado" /><textarea value={confirmationForm.observations} onChange={(event) => setConfirmationForm((current) => ({ ...current, observations: event.target.value }))} placeholder="Observaciones" /><button type="submit" disabled={busy}>Añadir parte</button></form>}
              </section>
            )}

            <section className="incident-section"><h4>Auditoría</h4>{(selected.audit_entries || []).map((entry) => <div className="incident-audit" key={entry.id}><strong>{entry.action}</strong><span>v{entry.version} · {formatDate(entry.created_at)} · {entry.actor || "usuario no identificado"}</span><p>{entry.reason || "Sin motivo adicional"}</p></div>)}</section>
          </article>
        </div>
      )}
    </>
  );
}
