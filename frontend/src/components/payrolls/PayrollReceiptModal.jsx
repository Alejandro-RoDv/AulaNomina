import { useEffect, useMemo, useState } from "react";

import { fetchPayrollReceipt } from "../../services/payrollApi";
import { formatCurrency } from "./PayrollForm";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES");
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function safeText(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function PartyBox({ title, party }) {
  return (
    <section style={styles.box}>
      <h4 style={styles.boxTitle}>{title}</h4>
      <div style={styles.partyBody}>
        <strong style={styles.partyName}>{safeText(party?.name)}</strong>
        <span>Código: {safeText(party?.code)}</span>
        <span>NIF/CIF: {safeText(party?.tax_id)}</span>
        <span>NAF/CCC: {safeText(party?.social_security_number || party?.contribution_account)}</span>
        <span>{[party?.address, party?.city, party?.province].filter(Boolean).join(" · ") || "Domicilio no informado"}</span>
      </div>
    </section>
  );
}

function ReceiptTable({ title, lines, emptyLabel = "Sin líneas" }) {
  return (
    <section style={styles.box}>
      <h4 style={styles.boxTitle}>{title}</h4>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thCode}>Código</th>
              <th style={styles.th}>Concepto</th>
              <th style={styles.thMeta}>Origen</th>
              <th style={styles.thAmount}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={`${line.code}-${line.id || line.display_order}`}>
                <td style={styles.tdCode}>{line.code}</td>
                <td style={styles.td}>
                  <strong>{line.name}</strong>
                  {line.description && <span style={styles.description}>{line.description}</span>}
                  {line.formula && <span style={styles.formula}>{line.formula}</span>}
                </td>
                <td style={styles.tdMeta}>{line.source_type}</td>
                <td style={styles.tdAmount}>{formatCurrency(line.amount)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan="4" style={styles.emptyCell}>{emptyLabel}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value, highlight = false }) {
  return (
    <div style={highlight ? styles.metricHighlight : styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IncidentTeachingPanel({ summary, explanations }) {
  if (!summary?.has_incidents && !explanations?.length) return null;
  return (
    <section style={styles.teachingPanel}>
      <div style={styles.teachingHeader}>
        <div>
          <p style={styles.teachingEyebrow}>LECTURA DIDÁCTICA</p>
          <h4 style={styles.teachingTitle}>Cómo afectan las incidencias a esta nómina</h4>
        </div>
        <div style={styles.teachingKpis}>
          <Metric label="Prestaciones" value={formatCurrency(summary?.total_benefits)} />
          <Metric label="Complementos" value={formatCurrency(summary?.total_company_complements)} />
          <Metric label="Descuentos" value={formatCurrency(summary?.total_absence_deductions)} />
        </div>
      </div>
      <p style={styles.teachingSummary}>{summary?.explanation}</p>
      <div style={styles.explanationGrid}>
        {explanations.map((item) => (
          <article key={item.id} style={styles.explanationCard}>
            <div style={styles.explanationCardHeader}>
              <strong>{item.title}</strong>
              <span>{item.period}</span>
            </div>
            <p style={styles.explanationText}>{item.explanation}</p>
            <div style={styles.impactGrid}>
              <Metric label="Días nómina" value={formatNumber(item.payroll_days, 2)} />
              <Metric label="Salario tramo" value={formatCurrency(item.salary_amount)} />
              <Metric label="Prestación" value={formatCurrency(item.benefit_amount)} />
              <Metric label="Complemento" value={formatCurrency(item.complement_amount)} />
              <Metric label="Descuento" value={formatCurrency(item.deduction_amount)} />
              <Metric label="Efecto mostrado" value={formatCurrency(item.net_effect)} highlight />
            </div>
            {item.learning_points?.length > 0 && (
              <ul style={styles.learningList}>
                {item.learning_points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            )}
            {item.affected_concepts?.length > 0 && (
              <div style={styles.affectedConcepts}>
                <strong>Conceptos relacionados:</strong>
                <div style={styles.conceptChips}>
                  {item.affected_concepts.map((concept) => (
                    <span key={`${item.id}-${concept.code}`} style={styles.conceptChip}>
                      {concept.code} · {formatCurrency(concept.amount)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function IncidentSegments({ segments }) {
  if (!segments?.length) return null;
  return (
    <section style={styles.box}>
      <h4 style={styles.boxTitle}>Segmentos de incidencias aplicados</h4>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Tipo</th>
              <th style={styles.thMeta}>Desde</th>
              <th style={styles.thMeta}>Hasta</th>
              <th style={styles.thAmount}>Salario</th>
              <th style={styles.thAmount}>Prestación</th>
              <th style={styles.thAmount}>Complemento</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.id}>
                <td style={styles.td}>{segment.segment_type}</td>
                <td style={styles.tdMeta}>{formatDate(segment.start_date)}</td>
                <td style={styles.tdMeta}>{formatDate(segment.end_date)}</td>
                <td style={styles.tdAmount}>{formatCurrency(segment.salary_amount)}</td>
                <td style={styles.tdAmount}>{formatCurrency(segment.benefit_amount)}</td>
                <td style={styles.tdAmount}>{formatCurrency(segment.complement_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PayrollReceiptModal({ payrollId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadReceipt() {
      if (!payrollId) return;
      try {
        setLoading(true);
        setError("");
        const data = await fetchPayrollReceipt(payrollId);
        if (!cancelled) setReceipt(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudo cargar el recibo de nómina");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReceipt();
    return () => {
      cancelled = true;
    };
  }, [payrollId]);

  const periodLabel = useMemo(() => {
    if (!receipt?.period) return "-";
    return `${receipt.period.label} · ${formatDate(receipt.period.period_start)} - ${formatDate(receipt.period.period_end)}`;
  }, [receipt]);

  if (!payrollId) return null;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <p style={styles.eyebrow}>RECIBO INDIVIDUAL DE SALARIOS</p>
            <h2 style={styles.title}>Recibo profesional de nómina</h2>
            <p style={styles.subtitle}>{receipt ? `${receipt.payroll_code} · ${periodLabel}` : "Cargando recibo..."}</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={() => window.print()} style={styles.secondaryButton}>Imprimir</button>
            <button type="button" onClick={onClose} style={styles.closeButton}>Cerrar</button>
          </div>
        </div>

        {loading && <p style={styles.loading}>Cargando recibo...</p>}
        {error && <div style={styles.error}>{error}</div>}

        {receipt && !loading && (
          <div style={styles.receipt}>
            {receipt.warnings?.length > 0 && (
              <div style={styles.warningBox}>
                {receipt.warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}

            <div style={styles.partyGrid}>
              <PartyBox title="Empresa" party={receipt.company} />
              <PartyBox title="Centro" party={receipt.work_center || receipt.company} />
              <PartyBox title="Trabajador" party={receipt.employee} />
            </div>

            <section style={styles.periodBox}>
              <Metric label="Periodo" value={receipt.period.label} />
              <Metric label="Días cotización" value={formatNumber(receipt.period.contribution_days)} />
              <Metric label="Días trabajados" value={formatNumber(receipt.period.worked_days)} />
              <Metric label="Días incidencia" value={formatNumber(receipt.period.incident_days)} />
              <Metric label="Contrato" value={safeText(receipt.contract.code || receipt.contract.type)} />
              <Metric label="Categoría" value={safeText(receipt.contract.professional_category || receipt.contract.job_position)} />
            </section>

            <div style={styles.totalsGrid}>
              <Metric label="Total devengos" value={formatCurrency(receipt.totals.total_earnings)} />
              <Metric label="Total deducciones" value={formatCurrency(receipt.totals.total_deductions)} />
              <Metric label="Líquido a percibir" value={formatCurrency(receipt.totals.net_salary)} highlight />
              <Metric label="Coste empresa" value={formatCurrency(receipt.totals.company_total_cost)} />
            </div>

            <IncidentTeachingPanel
              summary={receipt.incident_summary}
              explanations={receipt.incident_explanations || []}
            />

            <div style={styles.twoColumns}>
              <ReceiptTable title="Devengos" lines={receipt.earnings || []} />
              <ReceiptTable title="Deducciones" lines={receipt.deductions || []} />
            </div>

            <div style={styles.twoColumns}>
              <ReceiptTable title="Bases de cotización e IRPF" lines={receipt.base_lines || []} />
              <ReceiptTable title="Coste de empresa" lines={receipt.company_cost_lines || []} />
            </div>

            <IncidentSegments segments={receipt.incident_segments || []} />

            {receipt.informative_lines?.length > 0 && (
              <ReceiptTable title="Líneas informativas" lines={receipt.informative_lines} />
            )}

            <section style={styles.legalFooter}>{receipt.legal_footer}</section>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.65)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px", overflowY: "auto" },
  modal: { width: "min(1180px, 100%)", backgroundColor: "#f9fafb", border: "3px solid #111827", borderRadius: "16px", boxShadow: "8px 8px 0 rgba(17,24,39,0.25)", overflow: "hidden" },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", padding: "18px 20px", backgroundColor: "#111827", color: "#ffffff" },
  eyebrow: { margin: "0 0 4px", fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", color: "#e6d85c" },
  title: { margin: 0, fontSize: "24px", fontWeight: 950 },
  subtitle: { margin: "6px 0 0", color: "#d1d5db", fontSize: "13px", fontWeight: 700 },
  headerActions: { display: "flex", gap: "8px", alignItems: "center" },
  secondaryButton: { backgroundColor: "#e6d85c", color: "#111827", border: "2px solid #e6d85c", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  closeButton: { backgroundColor: "#ffffff", color: "#111827", border: "2px solid #ffffff", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  receipt: { padding: "18px", display: "flex", flexDirection: "column", gap: "14px" },
  loading: { padding: "24px", fontWeight: 800 },
  error: { margin: "16px", backgroundColor: "#fee2e2", color: "#991b1b", border: "2px solid #ef4444", borderRadius: "10px", padding: "12px", fontWeight: 800 },
  warningBox: { backgroundColor: "#fff7ed", color: "#9a3412", border: "2px solid #fdba74", borderRadius: "12px", padding: "10px 12px", fontWeight: 800, display: "grid", gap: "4px" },
  partyGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  box: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "12px", overflow: "hidden" },
  boxTitle: { margin: 0, padding: "10px 12px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", fontSize: "14px", fontWeight: 950, color: "#111827" },
  partyBody: { padding: "12px", display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", color: "#374151", fontWeight: 700 },
  partyName: { color: "#111827", fontSize: "15px", marginBottom: "3px" },
  periodBox: { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "10px", backgroundColor: "#fffdf0", border: "2px solid #111827", borderRadius: "12px", padding: "12px" },
  totalsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" },
  metric: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "5px" },
  metricHighlight: { backgroundColor: "#e6d85c", border: "2px solid #111827", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "5px" },
  teachingPanel: { backgroundColor: "#eef2ff", border: "2px solid #111827", borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "3px 3px 0 #c7d2fe" },
  teachingHeader: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "14px", alignItems: "start" },
  teachingEyebrow: { margin: "0 0 4px", fontSize: "11px", fontWeight: 950, letterSpacing: "0.08em", color: "#3730a3" },
  teachingTitle: { margin: 0, fontSize: "18px", fontWeight: 950, color: "#111827" },
  teachingKpis: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" },
  teachingSummary: { margin: 0, color: "#1f2937", fontSize: "14px", fontWeight: 800, lineHeight: 1.45 },
  explanationGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" },
  explanationCard: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" },
  explanationCardHeader: { display: "flex", justifyContent: "space-between", gap: "12px", color: "#111827", fontSize: "14px", fontWeight: 900 },
  explanationText: { margin: 0, color: "#374151", fontSize: "13px", fontWeight: 700, lineHeight: 1.45 },
  impactGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" },
  learningList: { margin: 0, paddingLeft: "18px", color: "#374151", fontSize: "13px", fontWeight: 700, display: "grid", gap: "5px" },
  affectedConcepts: { borderTop: "1px solid #d1d5db", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "#374151" },
  conceptChips: { display: "flex", flexWrap: "wrap", gap: "6px" },
  conceptChip: { backgroundColor: "#fffdf0", border: "1px solid #111827", borderRadius: "999px", padding: "4px 8px", fontSize: "11px", fontWeight: 900, color: "#111827" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", alignItems: "start" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  th: { textAlign: "left", padding: "9px", backgroundColor: "#f9fafb", borderBottom: "1px solid #d1d5db", fontSize: "12px", color: "#374151" },
  thCode: { width: "120px", textAlign: "left", padding: "9px", backgroundColor: "#f9fafb", borderBottom: "1px solid #d1d5db", fontSize: "12px", color: "#374151" },
  thMeta: { width: "90px", textAlign: "left", padding: "9px", backgroundColor: "#f9fafb", borderBottom: "1px solid #d1d5db", fontSize: "12px", color: "#374151" },
  thAmount: { width: "120px", textAlign: "right", padding: "9px", backgroundColor: "#f9fafb", borderBottom: "1px solid #d1d5db", fontSize: "12px", color: "#374151" },
  td: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", fontSize: "13px", wordBreak: "break-word" },
  tdCode: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", fontSize: "12px", fontWeight: 900, wordBreak: "break-word" },
  tdMeta: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", fontSize: "12px", color: "#6b7280", fontWeight: 800, wordBreak: "break-word" },
  tdAmount: { padding: "9px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", fontWeight: 900 },
  description: { display: "block", marginTop: "3px", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  formula: { display: "block", marginTop: "3px", color: "#92400e", fontSize: "11px", fontWeight: 800 },
  emptyCell: { padding: "14px", textAlign: "center", color: "#6b7280", fontWeight: 800 },
  legalFooter: { backgroundColor: "#ffffff", border: "2px solid #d1d5db", borderRadius: "10px", padding: "10px 12px", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
};
