import { useEffect, useState } from "react";

import { fetchContractSalarySummary, simulateContractWorkday } from "../services/api";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return `${number.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
}

function toPositiveNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (Number.isNaN(number) || number <= 0) return null;
  return number;
}

function payScheduleLabel(value) {
  return value === "prorated_12" ? "12 pagas · extras prorrateadas" : "14 pagas · extras separadas";
}

function SummaryMetric({ label, value, strong = false }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={strong ? styles.metricValueStrong : styles.metricValue}>{value}</strong>
    </div>
  );
}

function ConceptLines({ lines = [] }) {
  if (!lines.length) {
    return <div style={styles.emptyBox}>No hay complementos permanentes vinculados al contrato.</div>;
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Concepto</th>
            <th style={styles.thRight}>Importe original</th>
            <th style={styles.thRight}>Importe aplicado</th>
            <th style={styles.thCenter}>% jornada</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td style={styles.td}>{line.concept_name || line.concept_code || `Concepto ${line.concept_id}`}</td>
              <td style={styles.tdRight}>{formatMoney(line.original_amount)}</td>
              <td style={styles.tdRight}>{formatMoney(line.applied_amount)}</td>
              <td style={styles.tdCenter}>{line.applies_workday_percentage ? "Sí" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimulationResult({ simulation }) {
  if (!simulation) return null;

  return (
    <div style={styles.simulationResult}>
      <div style={styles.simulationHeader}>
        <h5 style={styles.subTitle}>Resultado de simulación</h5>
        <span style={styles.badge}>Diferencia anual {formatMoney(simulation.annual_difference)}</span>
      </div>
      <div style={styles.compareGrid}>
        <div style={styles.compareCard}>
          <span style={styles.compareLabel}>Antes</span>
          <strong>{formatNumber(simulation.before.partiality_coefficient, "%")}</strong>
          <span>{formatMoney(simulation.before.monthly_remuneration)} cobrados / mes</span>
          <span>{formatMoney(simulation.before.annual_remuneration)} / año</span>
        </div>
        <div style={styles.compareCardHighlight}>
          <span style={styles.compareLabel}>Después</span>
          <strong>{formatNumber(simulation.after.partiality_coefficient, "%")}</strong>
          <span>{formatMoney(simulation.after.monthly_remuneration)} cobrados / mes</span>
          <span>{formatMoney(simulation.after.annual_remuneration)} / año</span>
        </div>
        <div style={styles.compareCard}>
          <span style={styles.compareLabel}>Diferencia</span>
          <strong>{formatMoney(simulation.monthly_difference)} / mes</strong>
          <span>{formatMoney(simulation.annual_difference)} / año</span>
        </div>
      </div>
    </div>
  );
}

export default function ContractSalarySummaryPanel({ contractId }) {
  const [summary, setSummary] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [targetPartiality, setTargetPartiality] = useState("75");
  const [targetWeeklyHours, setTargetWeeklyHours] = useState("");
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contractId) return;
    let active = true;
    setLoading(true);
    setError("");
    setSimulation(null);

    fetchContractSalarySummary(contractId)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "No se pudo cargar el resumen retributivo");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [contractId]);

  const handleSimulate = async () => {
    setError("");
    setSimulation(null);

    const targetHours = toPositiveNumber(targetWeeklyHours);
    const targetPercentage = toPositiveNumber(targetPartiality);
    const payload = {};

    if (targetHours !== null) {
      payload.target_weekly_hours = targetHours;
      payload.target_full_time_weekly_hours = Number(summary?.full_time_weekly_hours || 40);
    } else if (targetPercentage !== null) {
      if (targetPercentage > 100) {
        setError("La parcialidad objetivo no puede ser superior al 100% en esta simulación MVP.");
        return;
      }
      payload.target_partiality_coefficient = targetPercentage;
    } else {
      setError("Indica una parcialidad objetivo o unas horas semanales objetivo mayor que 0.");
      return;
    }

    try {
      setSimulating(true);
      const result = await simulateContractWorkday(contractId, payload);
      setSimulation(result);
    } catch (err) {
      setError(err.message || "No se pudo simular el cambio de jornada");
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return <section style={styles.sectionBox}><h4 style={styles.sectionTitle}>Resumen retributivo</h4><div style={styles.emptyBox}>Cargando resumen retributivo...</div></section>;
  }

  if (!summary) {
    return <section style={styles.sectionBox}><h4 style={styles.sectionTitle}>Resumen retributivo</h4>{error && <div style={styles.error}>{error}</div>}</section>;
  }

  return (
    <section style={styles.sectionBox}>
      <div style={styles.headerRow}>
        <div>
          <h4 style={styles.sectionTitle}>Resumen retributivo</h4>
          <p style={styles.sectionSubtitle}>Importes mensuales, prorrata, jornada y coste anual estimado.</p>
        </div>
        <div style={styles.badgeGroup}>
          <span style={styles.badge}>{formatNumber(summary.partiality_coefficient, "%")} jornada</span>
          <span style={styles.neutralBadge}>{payScheduleLabel(summary.pay_schedule)}</span>
        </div>
      </div>

      <div style={styles.metricsGrid}>
        <SummaryMetric label="Salario teórico mensual" value={formatMoney(summary.salary_base_theoretical)} />
        <SummaryMetric label="Salario aplicado mensual" value={formatMoney(summary.salary_base_applied)} strong />
        <SummaryMetric label="Complementos aplicados" value={formatMoney(summary.permanent_concepts_applied)} />
        <SummaryMetric label="Mensual ordinaria" value={formatMoney(summary.ordinary_monthly_remuneration)} />
        <SummaryMetric label="Prorrata mensual estimada" value={formatMoney(summary.monthly_extra_pay_proration)} />
        <SummaryMetric label="Mensual cobrada" value={formatMoney(summary.monthly_remuneration)} strong />
        <SummaryMetric label="Retribución anual" value={formatMoney(summary.annual_remuneration)} strong />
        <SummaryMetric label="Seguridad Social empresa" value={formatMoney(summary.estimated_company_social_security)} />
        <SummaryMetric label="Coste empresa estimado" value={formatMoney(summary.estimated_company_cost)} strong />
      </div>

      <div style={styles.hoursGrid}>
        <SummaryMetric label="Horas semanales" value={formatNumber(summary.weekly_hours, " h")} />
        <SummaryMetric label="Horas mensuales" value={formatNumber(summary.monthly_hours, " h")} />
        <SummaryMetric label="Horas anuales" value={formatNumber(summary.annual_hours, " h")} />
        <SummaryMetric label="Jornada anual convenio" value={formatNumber(summary.annual_agreement_hours, " h")} />
      </div>

      <h5 style={styles.subTitle}>Conceptos permanentes</h5>
      <ConceptLines lines={summary.concept_lines} />

      <div style={styles.simulatorBox}>
        <h5 style={styles.subTitle}>Simular nueva jornada</h5>
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Parcialidad objetivo (%)</label>
            <input type="number" min="0" max="100" value={targetPartiality} onChange={(event) => { setTargetPartiality(event.target.value); setTargetWeeklyHours(""); }} style={styles.input} placeholder="Ej. 75" />
          </div>
          <div style={styles.formGroup}>
            <label>O bien horas semanales</label>
            <input type="number" min="0" value={targetWeeklyHours} onChange={(event) => { setTargetWeeklyHours(event.target.value); setTargetPartiality(""); }} style={styles.input} placeholder="Ej. 30" />
          </div>
          <button type="button" onClick={handleSimulate} disabled={simulating} style={styles.button}>{simulating ? "Simulando..." : "Simular nueva jornada"}</button>
        </div>
        <SimulationResult simulation={simulation} />
      </div>

      {error && <div style={styles.error}>{error}</div>}
    </section>
  );
}

const styles = {
  sectionBox: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", backgroundColor: "#ffffff" },
  headerRow: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start", marginBottom: "12px" },
  badgeGroup: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "6px" },
  sectionTitle: { margin: 0, fontSize: "14px", fontWeight: 900, color: "#111827" },
  sectionSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  subTitle: { margin: "14px 0 10px", fontSize: "13px", fontWeight: 900, color: "#111827" },
  badge: { display: "inline-flex", alignItems: "center", backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #f59e0b", borderRadius: "999px", padding: "5px 10px", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
  neutralBadge: { display: "inline-flex", alignItems: "center", backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "999px", padding: "5px 10px", fontSize: "12px", fontWeight: 850, whiteSpace: "nowrap" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "10px" },
  hoursGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" },
  metricCard: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px" },
  metricLabel: { color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  metricValue: { color: "#111827", fontSize: "15px", fontWeight: 900 },
  metricValueStrong: { color: "#111827", fontSize: "17px", fontWeight: 900 },
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", padding: "9px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  thRight: { textAlign: "right", padding: "9px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  thCenter: { textAlign: "center", padding: "9px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "9px", borderBottom: "1px solid #f3f4f6" },
  tdRight: { padding: "9px", borderBottom: "1px solid #f3f4f6", textAlign: "right", fontWeight: 800 },
  tdCenter: { padding: "9px", borderBottom: "1px solid #f3f4f6", textAlign: "center", fontWeight: 800 },
  emptyBox: { backgroundColor: "#f9fafb", border: "1px dashed #d1d5db", color: "#6b7280", borderRadius: "10px", padding: "12px", fontWeight: 700 },
  simulatorBox: { marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "10px" },
  formRow: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "end" },
  formGroup: { minWidth: "180px", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#374151" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  button: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  simulationResult: { marginTop: "12px", backgroundColor: "#fffbeb", border: "1px solid #f59e0b", borderRadius: "10px", padding: "12px" },
  simulationHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" },
  compareGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginTop: "8px" },
  compareCard: { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", fontWeight: 800 },
  compareCardHighlight: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", fontWeight: 900 },
  compareLabel: { color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  error: { marginTop: "10px", backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontWeight: 800 },
};
