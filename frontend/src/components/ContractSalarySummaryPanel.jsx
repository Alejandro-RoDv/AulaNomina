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

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function buildSummaryAlerts(summary) {
  const alerts = [];
  const partiality = toNumber(summary.partiality_coefficient);
  const weeklyHours = toNumber(summary.weekly_hours);
  const monthlyHours = toNumber(summary.monthly_hours);
  const annualHours = toNumber(summary.annual_hours);
  const fullTimeHours = toNumber(summary.full_time_weekly_hours);
  const salaryBase = toNumber(summary.salary_base_theoretical);
  const annualAgreementHours = toNumber(summary.annual_agreement_hours);
  const conceptLines = summary.concept_lines || [];
  const conceptsWithoutWorkday = conceptLines.filter((line) => !line.applies_workday_percentage);

  if (salaryBase <= 0) {
    alerts.push({ level: "danger", title: "Salario base no informado", detail: "El resumen retributivo no puede dar una referencia útil sin salario base." });
  }

  if (partiality <= 0) {
    alerts.push({ level: "danger", title: "Parcialidad sin calcular", detail: "Introduce horas semanales o coeficiente de parcialidad en el contrato." });
  }

  if (weeklyHours <= 0) {
    alerts.push({ level: "warning", title: "Horas semanales vacías", detail: "La jornada existe, pero no hay horas semanales reales informadas." });
  }

  if (fullTimeHours <= 0) {
    alerts.push({ level: "danger", title: "Jornada completa de referencia inválida", detail: "No se puede calcular la parcialidad sin una jornada completa de referencia mayor que 0." });
  }

  if (weeklyHours > 0 && fullTimeHours > 0) {
    const expectedPartiality = Math.round((weeklyHours / fullTimeHours) * 10000) / 100;
    if (partiality > 0 && Math.abs(expectedPartiality - partiality) > 0.5) {
      alerts.push({
        level: "warning",
        title: "Parcialidad incoherente con las horas",
        detail: `Con ${weeklyHours} h sobre ${fullTimeHours} h, la parcialidad esperada sería ${expectedPartiality}%.`,
      });
    }
  }

  if (monthlyHours <= 0 || annualHours <= 0) {
    alerts.push({ level: "warning", title: "Horas mensuales/anuales incompletas", detail: "Conviene completar estos datos para futuras vacaciones, IT, absentismo y horas extra." });
  }

  if (annualAgreementHours <= 0) {
    alerts.push({ level: "info", title: "Jornada anual de convenio no informada", detail: "No bloquea el MVP, pero será útil para cálculo anual, vacaciones y comparativas." });
  }

  if (conceptLines.length === 0) {
    alerts.push({ level: "info", title: "Sin complementos permanentes", detail: "El contrato solo está usando salario base. Añade complementos si el caso práctico lo necesita." });
  }

  if (partiality > 0 && partiality < 100 && conceptsWithoutWorkday.length > 0) {
    alerts.push({
      level: "info",
      title: "Hay conceptos que no aplican parcialidad",
      detail: `${conceptsWithoutWorkday.length} concepto(s) se mantienen íntegros aunque el contrato sea parcial. Revísalo si no es intencionado.`,
    });
  }

  if (partiality > 100) {
    alerts.push({ level: "warning", title: "Parcialidad superior al 100%", detail: "Puede servir como simulación, pero no debería ser el caso normal del MVP." });
  }

  return alerts;
}

function SummaryMetric({ label, value, strong = false }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={strong ? styles.metricValueStrong : styles.metricValue}>{value}</strong>
    </div>
  );
}

function AlertPanel({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <div style={styles.alertOk}>
        <strong>Sin alertas relevantes</strong>
        <span>La jornada y el resumen salarial tienen una estructura coherente para el MVP.</span>
      </div>
    );
  }

  return (
    <div style={styles.alertPanel}>
      <div style={styles.alertHeader}>
        <h5 style={styles.subTitle}>Alertas inteligentes</h5>
        <span style={styles.alertCount}>{alerts.length}</span>
      </div>
      <div style={styles.alertList}>
        {alerts.map((alert, index) => (
          <div key={`${alert.title}-${index}`} style={styles[`${alert.level}Alert`] || styles.infoAlert}>
            <strong>{alert.title}</strong>
            <span>{alert.detail}</span>
          </div>
        ))}
      </div>
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
          <span>{formatMoney(simulation.before.monthly_remuneration)} / mes</span>
          <span>{formatMoney(simulation.before.annual_remuneration)} / año</span>
        </div>
        <div style={styles.compareCardHighlight}>
          <span style={styles.compareLabel}>Después</span>
          <strong>{formatNumber(simulation.after.partiality_coefficient, "%")}</strong>
          <span>{formatMoney(simulation.after.monthly_remuneration)} / mes</span>
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

  const alerts = buildSummaryAlerts(summary);

  return (
    <section style={styles.sectionBox}>
      <div style={styles.headerRow}>
        <div>
          <h4 style={styles.sectionTitle}>Resumen retributivo</h4>
          <p style={styles.sectionSubtitle}>Aplicación de jornada, complementos permanentes y coste empresa estimado.</p>
        </div>
        <span style={styles.badge}>{formatNumber(summary.partiality_coefficient, "%")} jornada</span>
      </div>

      <AlertPanel alerts={alerts} />

      <div style={styles.metricsGrid}>
        <SummaryMetric label="Salario teórico" value={formatMoney(summary.salary_base_theoretical)} />
        <SummaryMetric label="Salario aplicado" value={formatMoney(summary.salary_base_applied)} strong />
        <SummaryMetric label="Complementos aplicados" value={formatMoney(summary.permanent_concepts_applied)} />
        <SummaryMetric label="Retribución mensual" value={formatMoney(summary.monthly_remuneration)} strong />
        <SummaryMetric label="Retribución anual" value={formatMoney(summary.annual_remuneration)} strong />
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
  sectionTitle: { margin: 0, fontSize: "14px", fontWeight: 900, color: "#111827" },
  sectionSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  subTitle: { margin: "14px 0 10px", fontSize: "13px", fontWeight: 900, color: "#111827" },
  badge: { display: "inline-flex", alignItems: "center", backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #f59e0b", borderRadius: "999px", padding: "5px 10px", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
  alertOk: { display: "flex", flexDirection: "column", gap: "3px", marginBottom: "12px", padding: "10px 12px", border: "1px solid #bbf7d0", borderRadius: "10px", backgroundColor: "#f0fdf4", color: "#166534", fontSize: "13px", fontWeight: 800 },
  alertPanel: { marginBottom: "12px", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px", backgroundColor: "#f9fafb" },
  alertHeader: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" },
  alertCount: { backgroundColor: "#111827", color: "#ffffff", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 900 },
  alertList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px" },
  dangerAlert: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px", backgroundColor: "#fef2f2", color: "#991b1b", fontSize: "12px", fontWeight: 800 },
  warningAlert: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #fcd34d", borderRadius: "10px", padding: "10px", backgroundColor: "#fffbeb", color: "#92400e", fontSize: "12px", fontWeight: 800 },
  infoAlert: { display: "flex", flexDirection: "column", gap: "3px", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "10px", backgroundColor: "#eff6ff", color: "#1e40af", fontSize: "12px", fontWeight: 800 },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "10px" },
  hoursGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" },
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
  compareGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginTop: "8px" },
  compareCard: { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", fontWeight: 800 },
  compareCardHighlight: { backgroundColor: "#ffffff", border: "2px solid #111827", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", fontWeight: 900 },
  compareLabel: { color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  error: { marginTop: "10px", backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontWeight: 800 },
};
