import { useEffect, useMemo, useState } from "react";

import {
  fetchPayrollIncidentSegments,
  previewPayrollIncidents,
  processPayrollIncidents,
} from "../../services/incidentAdvancedApi";
import { formatCurrency } from "./PayrollForm";


function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("es-ES") : "—";
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
}

function labelForType(value) {
  const labels = {
    normal_work: "Trabajo ordinario",
    it_waiting: "IT · días sin prestación",
    it_common_60_company: "IT común · 60 % empresa",
    it_common_60_delegated: "IT común · 60 % pago delegado",
    it_common_75: "IT común · 75 %",
    work_accident_salary_day: "Accidente laboral · día de baja",
    work_accident_75: "Accidente laboral · 75 %",
    vacation: "Vacaciones",
    paid_leave: "Permiso retribuido",
    unpaid_leave: "Permiso no retribuido",
    unpaid_absence: "Ausencia no retribuida",
    sanction: "Sanción",
    suspension: "Suspensión",
    overtime: "Horas extraordinarias",
    overtime_rest: "Horas extra compensadas",
  };
  return labels[value] || value || "Segmento";
}

function Trace({ trace }) {
  const entries = Object.entries(trace || {});
  if (!entries.length) return <span style={styles.muted}>Sin traza adicional.</span>;
  return (
    <dl style={styles.traceGrid}>
      {entries.map(([key, value]) => (
        <div key={key} style={styles.traceItem}>
          <dt style={styles.traceKey}>{key}</dt>
          <dd style={styles.traceValue}>{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PayrollIncidentSegmentsPanel({ payrollId }) {
  const [segments, setSegments] = useState([]);
  const [preview, setPreview] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const totals = useMemo(() => segments.reduce((acc, segment) => {
    acc.salary += Number(segment.salary_amount || 0);
    acc.benefit += Number(segment.benefit_amount || 0);
    acc.complement += Number(segment.complement_amount || 0);
    acc.deduction += Number(segment.deduction_amount || 0);
    return acc;
  }, { salary: 0, benefit: 0, complement: 0, deduction: 0 }), [segments]);

  async function loadSegments() {
    if (!payrollId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchPayrollIncidentSegments(payrollId);
      setSegments(data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los segmentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSegments(); }, [payrollId]);

  async function handlePreview() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await previewPayrollIncidents(payrollId);
      setPreview(data);
      setMessage("Vista previa calculada sin modificar la nómina.");
    } catch (err) {
      setError(err.message || "No se pudo calcular la vista previa.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProcess() {
    if (!window.confirm("Reprocesar las incidencias y regenerar las líneas automáticas de esta nómina?")) return;
    setProcessing(true);
    setError("");
    setMessage("");
    try {
      const result = await processPayrollIncidents(payrollId);
      setMessage(`Procesado: ${result.segments} segmentos, ${result.created_items} líneas nuevas y ${result.updated_items} actualizadas.`);
      setPreview(null);
      await loadSegments();
    } catch (err) {
      setError(err.message || "No se pudieron procesar las incidencias.");
    } finally {
      setProcessing(false);
    }
  }

  const visibleSegments = preview?.segments || segments;

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h4 style={styles.title}>Segmentos y trazas de incidencias</h4>
          <p style={styles.subtitle}>Explica qué regla, base, porcentaje y tratamiento de cotización se aplicó en cada tramo del mes.</p>
        </div>
        <div style={styles.actions}>
          <button type="button" onClick={handlePreview} style={styles.secondaryButton} disabled={loading || processing}>Previsualizar</button>
          <button type="button" onClick={handleProcess} style={styles.primaryButton} disabled={loading || processing}>{processing ? "Procesando…" : "Reprocesar"}</button>
          <button type="button" onClick={loadSegments} style={styles.secondaryButton} disabled={loading || processing}>{loading ? "Cargando…" : "Actualizar"}</button>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}
      {preview?.warnings?.length > 0 && (
        <div style={styles.warning}><strong>Advertencias de la vista previa</strong>{preview.warnings.map((item) => <span key={item}>{item}</span>)}</div>
      )}

      <div style={styles.summary}>
        <div style={styles.summaryCard}><span>Salario por tramos</span><strong>{formatCurrency(preview?.worked_base_salary ?? totals.salary)}</strong></div>
        <div style={styles.summaryCard}><span>Prestaciones</span><strong>{formatCurrency(preview?.temporary_disability_benefit ?? totals.benefit)}</strong></div>
        <div style={styles.summaryCard}><span>Complementos IT</span><strong>{formatCurrency(preview?.company_disability_complement ?? totals.complement)}</strong></div>
        <div style={styles.deductionCard}><span>Reducciones</span><strong>{formatCurrency(preview?.salary_deductions ?? totals.deduction)}</strong></div>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Periodo</th>
              <th style={styles.th}>Tratamiento</th>
              <th style={styles.thRight}>Días</th>
              <th style={styles.thRight}>Salario</th>
              <th style={styles.thRight}>Prestación</th>
              <th style={styles.thRight}>Complemento</th>
              <th style={styles.th}>Cotización</th>
              <th style={styles.th}>Traza</th>
            </tr>
          </thead>
          <tbody>
            {visibleSegments.map((segment, index) => {
              const id = segment.id || segment.segment_key || index;
              const expanded = expandedId === id;
              return (
                <tr key={id}>
                  <td style={styles.td}>{formatDate(segment.start_date)}<small style={styles.small}>a {formatDate(segment.end_date)}</small></td>
                  <td style={styles.td}><strong>{labelForType(segment.segment_type)}</strong><small style={styles.small}>Proceso {segment.process_day_from || "—"}–{segment.process_day_to || "—"}</small></td>
                  <td style={styles.tdRight}>{segment.calendar_days}<small style={styles.small}>{Number(segment.payroll_days || 0).toLocaleString("es-ES")} salariales</small></td>
                  <td style={styles.tdRight}>{formatCurrency(segment.salary_amount)}<small style={styles.small}>{formatPercent(segment.salary_percentage)}</small></td>
                  <td style={styles.tdRight}>{formatCurrency(segment.benefit_amount)}<small style={styles.small}>{formatPercent(segment.benefit_percentage)}</small></td>
                  <td style={styles.tdRight}>{formatCurrency(segment.complement_amount)}<small style={styles.small}>{formatPercent(segment.complement_percentage)}</small></td>
                  <td style={styles.td}><span style={styles.badge}>{segment.contribution_treatment || "—"}</span></td>
                  <td style={styles.td}>
                    <button type="button" onClick={() => setExpandedId(expanded ? null : id)} style={styles.traceButton}>{expanded ? "Ocultar" : "Ver cálculo"}</button>
                    {expanded && <Trace trace={segment.calculation_trace || segment.trace} />}
                  </td>
                </tr>
              );
            })}
            {!visibleSegments.length && !loading && <tr><td colSpan="8" style={styles.empty}>La nómina todavía no tiene segmentos persistidos. Usa Previsualizar o Reprocesar.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px", border: "1px solid #d1d5db", background: "#fff", padding: "14px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  title: { margin: 0, color: "#111827", fontSize: "15px", fontWeight: 900 },
  subtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "11px" },
  actions: { display: "flex", gap: "7px", flexWrap: "wrap" },
  primaryButton: { border: "1px solid #111827", background: "#eab308", color: "#111827", padding: "7px 10px", fontWeight: 850, cursor: "pointer" },
  secondaryButton: { border: "1px solid #9ca3af", background: "#fff", color: "#374151", padding: "7px 10px", fontWeight: 800, cursor: "pointer" },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" },
  summaryCard: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #d1d5db", borderLeft: "3px solid #eab308", padding: "9px", color: "#374151", fontSize: "11px" },
  deductionCard: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #fecaca", borderLeft: "3px solid #dc2626", padding: "9px", color: "#7f1d1d", fontSize: "11px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", minWidth: "1120px", borderCollapse: "collapse", fontSize: "11px" },
  th: { textAlign: "left", padding: "8px", borderBottom: "1px solid #d1d5db", background: "#f9fafb" },
  thRight: { textAlign: "right", padding: "8px", borderBottom: "1px solid #d1d5db", background: "#f9fafb" },
  td: { padding: "8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  tdRight: { padding: "8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", textAlign: "right" },
  small: { display: "block", marginTop: "3px", color: "#6b7280" },
  badge: { display: "inline-block", borderRadius: "999px", background: "#e5e7eb", color: "#374151", padding: "3px 7px", fontWeight: 800 },
  traceButton: { border: "1px solid #9ca3af", background: "#fff", color: "#374151", padding: "4px 7px", fontSize: "10px", fontWeight: 800, cursor: "pointer" },
  traceGrid: { margin: "8px 0 0", display: "grid", gap: "5px", minWidth: "230px" },
  traceItem: { display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px", borderTop: "1px solid #e5e7eb", paddingTop: "4px" },
  traceKey: { color: "#6b7280", fontFamily: "monospace", overflowWrap: "anywhere" },
  traceValue: { margin: 0, color: "#111827", fontFamily: "monospace", overflowWrap: "anywhere" },
  muted: { color: "#6b7280" },
  empty: { padding: "18px", textAlign: "center", color: "#6b7280" },
  error: { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: "9px", fontSize: "11px", fontWeight: 750 },
  success: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", padding: "9px", fontSize: "11px", fontWeight: 750 },
  warning: { display: "flex", flexDirection: "column", gap: "4px", border: "1px solid #fde68a", background: "#fffbeb", color: "#854d0e", padding: "9px", fontSize: "11px" },
};
