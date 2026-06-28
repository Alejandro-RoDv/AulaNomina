import { useEffect, useMemo, useState } from "react";

import {
  createIncidentCalculationRule,
  deactivateIncidentCalculationRule,
  fetchIncidentCalculationRules,
  updateIncidentCalculationRule,
} from "../../services/incidentAdvancedApi";


const EMPTY_FORM = {
  code: "",
  name: "",
  incident_type: "IT",
  process_type: "",
  valid_from: `${new Date().getFullYear()}-01-01`,
  valid_to: "",
  priority: "200",
  legal_reference: "",
  configuration: JSON.stringify({
    kind: "medical",
    contribution_treatment: "maintain",
    bands: [
      { from: 1, to: 3, segment_type: "it_waiting", benefit_percentage: 0, payer: "none" },
      { from: 4, to: 20, segment_type: "it_common_60", benefit_percentage: 60, payer: "social_security" },
      { from: 21, to: null, segment_type: "it_common_75", benefit_percentage: 75, payer: "social_security" },
    ],
  }, null, 2),
};

const INCIDENT_TYPES = [
  ["IT", "Incapacidad temporal"],
  ["RECAIDA", "Recaída"],
  ["VACACIONES", "Vacaciones"],
  ["AUSENCIA", "Ausencia"],
  ["PERMISO_RETRIBUIDO", "Permiso retribuido"],
  ["PERMISO_NO_RETRIBUIDO", "Permiso no retribuido"],
  ["SUSPENSION", "Suspensión"],
  ["SANCION", "Sanción"],
  ["HORAS_EXTRA", "Horas extraordinarias"],
  ["NACIMIENTO_CUIDADO", "Nacimiento y cuidado"],
];

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("es-ES") : "Sin fin";
}

function parseConfiguration(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("La configuración debe ser un objeto JSON.");
    }
    return parsed;
  } catch (error) {
    throw new Error(error.message || "JSON de configuración no válido.");
  }
}

export default function IncidentRuleManager({ agreement }) {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const agreementId = agreement?.id;

  const agreementRules = useMemo(
    () => rules.filter((rule) => Number(rule.agreement_id) === Number(agreementId)),
    [rules, agreementId],
  );

  async function loadRules() {
    if (!agreementId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchIncidentCalculationRules({ agreementId, includeInactive: true });
      setRules(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las reglas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRules(); }, [agreementId]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage("");
  }

  function startEdit(rule) {
    setEditingId(rule.id);
    setForm({
      code: rule.code,
      name: rule.name,
      incident_type: rule.incident_type,
      process_type: rule.process_type || "",
      valid_from: rule.valid_from,
      valid_to: rule.valid_to || "",
      priority: String(rule.priority ?? 100),
      legal_reference: rule.legal_reference || "",
      configuration: JSON.stringify(rule.configuration || {}, null, 2),
    });
    setError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name.trim(),
        incident_type: form.incident_type,
        process_type: form.process_type || null,
        agreement_id: Number(agreementId),
        valid_from: form.valid_from,
        valid_to: form.valid_to || null,
        priority: Number(form.priority || 100),
        legal_reference: form.legal_reference || null,
        configuration: parseConfiguration(form.configuration),
        actor: "teacher_ui",
      };
      if (editingId) {
        await updateIncidentCalculationRule(editingId, payload);
        setMessage("Regla actualizada.");
      } else {
        await createIncidentCalculationRule({ ...payload, code: form.code.trim() });
        setMessage("Regla creada.");
      }
      resetForm();
      await loadRules();
    } catch (err) {
      setError(err.message || "No se pudo guardar la regla.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(rule) {
    if (!window.confirm(`Desactivar la regla ${rule.name}?`)) return;
    setSaving(true);
    setError("");
    try {
      await deactivateIncidentCalculationRule(rule.id);
      setMessage("Regla desactivada.");
      await loadRules();
    } catch (err) {
      setError(err.message || "No se pudo desactivar la regla.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <section style={styles.infoBox}>
        <strong>Reglas de cálculo para docencia</strong>
        <span>Configura vigencia, prioridad, bandas, porcentajes y tratamiento de cotización sin editar código ni base de datos.</span>
      </section>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h4 style={styles.heading}>Reglas del convenio</h4>
            <p style={styles.help}>{agreementRules.length} reglas configuradas para {agreement?.name}.</p>
          </div>
          <button type="button" onClick={loadRules} style={styles.secondaryButton} disabled={loading || saving}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Código / nombre</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Vigencia</th>
                <th style={styles.th}>Prioridad</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agreementRules.map((rule) => (
                <tr key={rule.id}>
                  <td style={styles.td}><strong>{rule.code}</strong><small style={styles.small}>{rule.name}</small></td>
                  <td style={styles.td}>{rule.incident_type}{rule.process_type ? <small style={styles.small}>{rule.process_type}</small> : null}</td>
                  <td style={styles.td}>{formatDate(rule.valid_from)}<small style={styles.small}>hasta {formatDate(rule.valid_to)}</small></td>
                  <td style={styles.td}>{rule.priority}</td>
                  <td style={styles.td}><span style={rule.is_active ? styles.active : styles.inactive}>{rule.is_active ? "Activa" : "Inactiva"}</span></td>
                  <td style={styles.actions}>
                    <button type="button" onClick={() => startEdit(rule)} style={styles.smallButton}>Editar</button>
                    {rule.is_active && <button type="button" onClick={() => deactivate(rule)} style={styles.dangerButton}>Desactivar</button>}
                  </td>
                </tr>
              ))}
              {!agreementRules.length && !loading && <tr><td colSpan="6" style={styles.empty}>No hay reglas específicas. Se aplicarán las reglas generales del sistema.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <form onSubmit={handleSubmit} style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h4 style={styles.heading}>{editingId ? "Editar regla" : "Nueva regla"}</h4>
            <p style={styles.help}>Las reglas con mayor prioridad prevalecen sobre las generales.</p>
          </div>
          {editingId && <button type="button" onClick={resetForm} style={styles.secondaryButton}>Cancelar edición</button>}
        </div>

        <div style={styles.formGrid}>
          <label style={styles.field}>Código
            <input name="code" value={form.code} onChange={handleChange} disabled={Boolean(editingId)} required style={styles.input} placeholder="CONVENIO_IT_100" />
          </label>
          <label style={styles.field}>Nombre
            <input name="name" value={form.name} onChange={handleChange} required style={styles.input} />
          </label>
          <label style={styles.field}>Tipo de incidencia
            <select name="incident_type" value={form.incident_type} onChange={handleChange} style={styles.input}>
              {INCIDENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={styles.field}>Proceso / subtipo
            <input name="process_type" value={form.process_type} onChange={handleChange} style={styles.input} placeholder="common_disease" />
          </label>
          <label style={styles.field}>Vigente desde
            <input type="date" name="valid_from" value={form.valid_from} onChange={handleChange} required style={styles.input} />
          </label>
          <label style={styles.field}>Vigente hasta
            <input type="date" name="valid_to" value={form.valid_to} onChange={handleChange} style={styles.input} />
          </label>
          <label style={styles.field}>Prioridad
            <input type="number" name="priority" value={form.priority} onChange={handleChange} min="1" style={styles.input} />
          </label>
          <label style={{ ...styles.field, gridColumn: "span 2" }}>Referencia / explicación
            <input name="legal_reference" value={form.legal_reference} onChange={handleChange} style={styles.input} />
          </label>
        </div>

        <label style={styles.field}>Configuración JSON
          <textarea name="configuration" value={form.configuration} onChange={handleChange} rows="15" spellCheck="false" style={styles.codeInput} />
        </label>
        <div style={styles.footer}>
          <span style={styles.help}>La previsualización de nómina mostrará la regla, bandas y porcentajes aplicados.</span>
          <button type="submit" style={styles.primaryButton} disabled={saving}>{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear regla"}</button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "12px" },
  infoBox: { display: "flex", flexDirection: "column", gap: "4px", border: "1px solid #fde68a", borderLeft: "4px solid #eab308", background: "#fffbeb", padding: "12px", color: "#713f12", fontSize: "12px" },
  panel: { border: "1px solid #d1d5db", background: "#fff", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  heading: { margin: 0, fontSize: "15px", fontWeight: 850, color: "#111827" },
  help: { margin: "3px 0 0", color: "#6b7280", fontSize: "11px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", minWidth: "880px", borderCollapse: "collapse", fontSize: "12px" },
  th: { textAlign: "left", padding: "9px", borderBottom: "1px solid #d1d5db", background: "#f9fafb" },
  td: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  small: { display: "block", marginTop: "3px", color: "#6b7280" },
  actions: { padding: "7px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: "6px" },
  active: { background: "#dcfce7", color: "#166534", borderRadius: "999px", padding: "3px 7px", fontWeight: 800 },
  inactive: { background: "#e5e7eb", color: "#4b5563", borderRadius: "999px", padding: "3px 7px", fontWeight: 800 },
  empty: { padding: "16px", color: "#6b7280", textAlign: "center" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "11px", fontWeight: 800, color: "#374151" },
  input: { minHeight: "36px", border: "1px solid #d1d5db", padding: "7px 9px", fontSize: "12px", boxSizing: "border-box" },
  codeInput: { width: "100%", border: "1px solid #9ca3af", background: "#111827", color: "#f9fafb", padding: "10px", fontFamily: "monospace", fontSize: "12px", boxSizing: "border-box" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  primaryButton: { border: "1px solid #111827", background: "#eab308", color: "#111827", padding: "8px 13px", fontWeight: 850, cursor: "pointer" },
  secondaryButton: { border: "1px solid #9ca3af", background: "#fff", color: "#374151", padding: "7px 10px", fontWeight: 800, cursor: "pointer" },
  smallButton: { border: "1px solid #9ca3af", background: "#fff", color: "#374151", padding: "5px 8px", fontWeight: 750, cursor: "pointer" },
  dangerButton: { border: "1px solid #dc2626", background: "#fff", color: "#b91c1c", padding: "5px 8px", fontWeight: 750, cursor: "pointer" },
  error: { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: "10px", fontSize: "12px", fontWeight: 750 },
  success: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", padding: "10px", fontSize: "12px", fontWeight: 750 },
};
