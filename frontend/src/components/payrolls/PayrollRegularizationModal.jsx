import { useMemo, useState } from "react";

import { applyPayrollRegularization, previewPayrollRegularization } from "../../services/payrollApi";
import { formatCurrency } from "./PayrollForm";

const REASON_OPTIONS = [
  ["INCIDENCIA_TARDIA", "Incidencia tardía"],
  ["BAJA_TARDIA", "Baja tardía"],
  ["CAMBIO_SALARIAL", "Cambio salarial"],
  ["ANTIGUEDAD", "Antigüedad"],
  ["CONVENIO", "Convenio"],
  ["IRPF", "IRPF"],
  ["SEGURIDAD_SOCIAL", "Seguridad Social"],
  ["MANUAL", "Manual"],
];

const INITIAL_FORM = {
  origin_payroll_id: "",
  reason: "INCIDENCIA_TARDIA",
  description: "Regularización por diferencia detectada",
  gross_delta: "0.00",
  employee_deduction_delta: "0.00",
  irpf_delta: "0.00",
  company_cost_delta: "0.00",
  contribution_base_delta: "",
  irpf_base_delta: "",
  taxable: true,
  contribution_base: true,
};

function periodLabel(payroll) {
  if (!payroll) return "-";
  if (payroll.period_label) return payroll.period_label;
  return `${String(payroll.period_month || "").padStart(2, "0")}/${payroll.period_year || ""}`;
}

function safeAmount(value, fallback = "0.00") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(",", ".");
}

function optionalAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  return safeAmount(value);
}

function previewLineKey(line, index) {
  return `${line.code}-${index}`;
}

function buildPayload(form) {
  return {
    origin_payroll_id: form.origin_payroll_id ? Number(form.origin_payroll_id) : null,
    reason: form.reason,
    description: form.description,
    gross_delta: safeAmount(form.gross_delta),
    employee_deduction_delta: safeAmount(form.employee_deduction_delta),
    irpf_delta: safeAmount(form.irpf_delta),
    company_cost_delta: safeAmount(form.company_cost_delta),
    contribution_base_delta: optionalAmount(form.contribution_base_delta),
    irpf_base_delta: optionalAmount(form.irpf_base_delta),
    taxable: Boolean(form.taxable),
    contribution_base: Boolean(form.contribution_base),
    actor: "regularization_panel",
  };
}

function AmountInput({ label, name, value, onChange, helper }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      <input name={name} value={value} onChange={onChange} type="number" step="0.01" style={styles.input} />
      {helper && <small style={styles.helper}>{helper}</small>}
    </label>
  );
}

function SummaryMetric({ label, value, highlight = false }) {
  return (
    <div style={highlight ? styles.metricHighlight : styles.metric}>
      <span>{label}</span>
      <strong>{formatCurrency(value || 0)}</strong>
    </div>
  );
}

export default function PayrollRegularizationModal({
  payroll,
  payrolls = [],
  payrollCode = "",
  onClose,
  onApplied,
  onOpenReceipt,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const originOptions = useMemo(
    () => payrolls.filter((item) => item.id !== payroll?.id),
    [payrolls, payroll?.id]
  );

  if (!payroll) return null;

  const isBlocked = ["closed", "cancelled"].includes(payroll.status);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setResult(null);
    setConfirmed(false);
  }

  async function handlePreview(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setConfirmed(false);
    try {
      setSubmitting(true);
      const data = await previewPayrollRegularization(payroll.id, buildPayload(form));
      setPreview(data);
    } catch (err) {
      setError(err.message || "No se pudo previsualizar la regularización");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApply() {
    setError("");
    try {
      setSubmitting(true);
      const data = await applyPayrollRegularization(payroll.id, buildPayload(form));
      setResult(data);
      setPreview(data);
      setConfirmed(false);
      if (onApplied) await onApplied();
    } catch (err) {
      setError(err.message || "No se pudo aplicar la regularización");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>REGULARIZACIÓN DE NÓMINA</p>
            <h2 style={styles.title}>Panel de regularización</h2>
            <p style={styles.subtitle}>{payrollCode} · {payroll.employee_name || payroll.employee_id} · {periodLabel(payroll)}</p>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton}>Cerrar</button>
        </header>

        <form onSubmit={handlePreview} style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}
          {isBlocked && (
            <div style={styles.warning}>
              Esta nómina está cerrada o cancelada. Puedes previsualizar, pero no aplicar regularizaciones sobre ella.
            </div>
          )}

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Datos de la regularización</h3>
            <div style={styles.grid2}>
              <label style={styles.field}>
                <span>Nómina origen</span>
                <select name="origin_payroll_id" value={form.origin_payroll_id} onChange={handleChange} style={styles.input}>
                  <option value="">Sin origen específico</option>
                  {originOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {periodLabel(item)} · {item.employee_name || item.employee_id} · {formatCurrency(item.net_salary)}
                    </option>
                  ))}
                </select>
                <small style={styles.helper}>Se referencia, no se modifica.</small>
              </label>
              <label style={styles.field}>
                <span>Motivo</span>
                <select name="reason" value={form.reason} onChange={handleChange} style={styles.input}>
                  {REASON_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <label style={styles.field}>
              <span>Descripción</span>
              <textarea name="description" value={form.description} onChange={handleChange} rows="3" style={styles.textarea} />
            </label>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Impacto económico</h3>
            <div style={styles.grid4}>
              <AmountInput label="Bruto" name="gross_delta" value={form.gross_delta} onChange={handleChange} />
              <AmountInput label="Deducción trabajador" name="employee_deduction_delta" value={form.employee_deduction_delta} onChange={handleChange} />
              <AmountInput label="IRPF" name="irpf_delta" value={form.irpf_delta} onChange={handleChange} />
              <AmountInput label="Coste empresa SS" name="company_cost_delta" value={form.company_cost_delta} onChange={handleChange} />
            </div>
            <div style={styles.grid2}>
              <AmountInput label="Override base cotización" name="contribution_base_delta" value={form.contribution_base_delta} onChange={handleChange} helper="Vacío = usa bruto si cotiza" />
              <AmountInput label="Override base IRPF" name="irpf_base_delta" value={form.irpf_base_delta} onChange={handleChange} helper="Vacío = usa bruto si tributa" />
            </div>
            <div style={styles.checks}>
              <label style={styles.checkLabel}>
                <input type="checkbox" name="contribution_base" checked={form.contribution_base} onChange={handleChange} />
                Cotiza
              </label>
              <label style={styles.checkLabel}>
                <input type="checkbox" name="taxable" checked={form.taxable} onChange={handleChange} />
                Tributa
              </label>
            </div>
          </section>

          <div style={styles.actions}>
            <button type="submit" disabled={submitting} style={styles.primaryButton}>Previsualizar</button>
            <button type="button" onClick={() => { setForm(INITIAL_FORM); setPreview(null); setResult(null); setError(""); }} style={styles.secondaryButton}>Limpiar</button>
          </div>
        </form>

        {preview && (
          <section style={styles.preview}>
            <div style={styles.previewHeader}>
              <div>
                <p style={styles.eyebrowDark}>PREVIEW</p>
                <h3 style={styles.previewTitle}>Impacto previsto</h3>
              </div>
              {result && <span style={styles.appliedBadge}>Aplicada</span>}
            </div>
            <p style={styles.explanation}>{preview.explanation}</p>
            {preview.warnings?.length > 0 && (
              <div style={styles.warningList}>{preview.warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>
            )}
            <div style={styles.metricsGrid}>
              <SummaryMetric label="Bruto" value={preview.gross_delta} />
              <SummaryMetric label="Deducciones" value={preview.total_deduction_delta} />
              <SummaryMetric label="Neto" value={preview.net_delta} highlight />
              <SummaryMetric label="Coste empresa" value={preview.company_total_cost_delta} />
            </div>
            <div style={styles.metricsGrid}>
              <SummaryMetric label="Base cotización" value={preview.contribution_base_delta} />
              <SummaryMetric label="Base IRPF" value={preview.irpf_base_delta} />
              <SummaryMetric label="SS empresa" value={preview.company_social_security_delta} />
              <SummaryMetric label="IRPF" value={preview.irpf_delta} />
            </div>

            <div style={styles.linesBox}>
              <strong>Líneas que se generarían</strong>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Concepto</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.thAmount}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.lines || []).map((line, index) => (
                    <tr key={previewLineKey(line, index)}>
                      <td style={styles.td}><strong>{line.code}</strong><span style={styles.lineName}>{line.name}</span></td>
                      <td style={styles.td}>{line.concept_type}</td>
                      <td style={styles.tdAmount}>{formatCurrency(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!result && (
              <div style={styles.applyBox}>
                <label style={styles.checkLabel}>
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  Confirmo que quiero aplicar esta regularización sobre la nómina destino abierta.
                </label>
                <button type="button" disabled={submitting || isBlocked || !confirmed} onClick={handleApply} style={styles.dangerButton}>
                  Aplicar regularización
                </button>
              </div>
            )}

            {result && (
              <div style={styles.resultBox}>
                <strong>Regularización aplicada</strong>
                <span>Nuevo neto: {formatCurrency(result.resulting_net_salary)}</span>
                <span>Nuevo bruto: {formatCurrency(result.resulting_gross_salary)}</span>
                <span>Líneas creadas: {(result.created_item_ids || []).length}</span>
                <div style={styles.actionsInline}>
                  <button type="button" onClick={() => onOpenReceipt?.(payroll.id)} style={styles.primaryButton}>Abrir recibo actualizado</button>
                  <button type="button" onClick={onClose} style={styles.secondaryButton}>Cerrar</button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.65)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px", overflowY: "auto" },
  modal: { width: "min(1080px, 100%)", backgroundColor: "#f9fafb", border: "3px solid #111827", borderRadius: "16px", boxShadow: "8px 8px 0 rgba(17,24,39,0.25)", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", gap: "16px", padding: "18px 20px", backgroundColor: "#111827", color: "#ffffff" },
  eyebrow: { margin: "0 0 4px", fontSize: "11px", fontWeight: 950, letterSpacing: "0.08em", color: "#e6d85c" },
  eyebrowDark: { margin: "0 0 4px", fontSize: "11px", fontWeight: 950, letterSpacing: "0.08em", color: "#4f46e5" },
  title: { margin: 0, fontSize: "24px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#d1d5db", fontSize: "13px", fontWeight: 700 },
  closeButton: { alignSelf: "flex-start", backgroundColor: "#ffffff", color: "#111827", border: "2px solid #ffffff", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  body: { padding: "16px", display: "grid", gap: "14px" },
  section: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "12px", padding: "14px", display: "grid", gap: "12px" },
  sectionTitle: { margin: 0, fontSize: "16px", fontWeight: 950, color: "#111827" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: 850, color: "#374151" },
  input: { border: "2px solid #d1d5db", borderRadius: "8px", padding: "9px", fontWeight: 800, backgroundColor: "#ffffff" },
  textarea: { border: "2px solid #d1d5db", borderRadius: "8px", padding: "9px", fontWeight: 700, resize: "vertical", minHeight: "70px" },
  helper: { color: "#6b7280", fontWeight: 700 },
  checks: { display: "flex", gap: "14px", flexWrap: "wrap" },
  checkLabel: { display: "flex", gap: "7px", alignItems: "center", fontWeight: 850, color: "#374151", fontSize: "13px" },
  actions: { display: "flex", gap: "10px", justifyContent: "flex-end" },
  actionsInline: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" },
  primaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  secondaryButton: { backgroundColor: "#ffffff", color: "#111827", border: "2px solid #111827", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "2px solid #991b1b", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", border: "2px solid #ef4444", borderRadius: "10px", padding: "10px 12px", fontWeight: 850 },
  warning: { backgroundColor: "#fff7ed", color: "#9a3412", border: "2px solid #fdba74", borderRadius: "10px", padding: "10px 12px", fontWeight: 850 },
  preview: { margin: "0 16px 16px", backgroundColor: "#f5f3ff", border: "2px solid #111827", borderRadius: "14px", padding: "14px", display: "grid", gap: "12px", boxShadow: "3px 3px 0 #ddd6fe" },
  previewHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" },
  previewTitle: { margin: 0, fontSize: "18px", fontWeight: 950, color: "#111827" },
  appliedBadge: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #166534", borderRadius: "999px", padding: "5px 10px", fontSize: "12px", fontWeight: 900 },
  explanation: { margin: 0, color: "#374151", fontSize: "13px", fontWeight: 750, lineHeight: 1.45 },
  warningList: { backgroundColor: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74", borderRadius: "10px", padding: "9px 11px", display: "grid", gap: "4px", fontWeight: 800, fontSize: "13px" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" },
  metric: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "5px" },
  metricHighlight: { backgroundColor: "#e6d85c", border: "2px solid #111827", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "5px" },
  linesBox: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "12px", padding: "12px", display: "grid", gap: "10px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "8px", backgroundColor: "#f9fafb", borderBottom: "1px solid #d1d5db", fontSize: "12px", color: "#374151" },
  thAmount: { textAlign: "right", padding: "8px", backgroundColor: "#f9fafb", borderBottom: "1px solid #d1d5db", fontSize: "12px", color: "#374151" },
  td: { padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", verticalAlign: "top" },
  tdAmount: { padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", textAlign: "right", fontWeight: 900, whiteSpace: "nowrap" },
  lineName: { display: "block", color: "#6b7280", fontSize: "12px", marginTop: "2px", fontWeight: 750 },
  applyBox: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "12px", padding: "12px" },
  resultBox: { backgroundColor: "#ecfdf5", border: "2px solid #166534", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "5px", color: "#14532d", fontWeight: 800 },
};
