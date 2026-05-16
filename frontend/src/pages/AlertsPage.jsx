import { useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import { generateAlerts, getAlertStats } from "../utils/alertRules";

const SOURCE_LABELS = {
  document: "Documentos",
  contract: "Contratos",
  incident: "Incidencias",
  payroll: "Nóminas",
};

const SEVERITY_LABELS = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-ES");
}

function getSeverityStyle(severity) {
  if (severity === "critical") return styles.severityCritical;
  if (severity === "high") return styles.severityHigh;
  if (severity === "medium") return styles.severityMedium;
  return styles.severityLow;
}

export default function AlertsPage({
  documents = [],
  contracts = [],
  incidents = [],
  payrolls = [],
  employees = [],
  companies = [],
  workCenters = [],
  onOpenEmployeeRecord,
}) {
  const [filters, setFilters] = useState({
    search: "",
    source: "",
    severity: "",
  });

  const alerts = useMemo(
    () =>
      generateAlerts({
        documents,
        contracts,
        incidents,
        payrolls,
        employees,
        companies,
        workCenters,
      }),
    [documents, contracts, incidents, payrolls, employees, companies, workCenters]
  );

  const stats = useMemo(() => getAlertStats(alerts), [alerts]);

  const filteredAlerts = useMemo(() => {
    const search = normalizeText(filters.search);

    return alerts.filter((alert) => {
      const alertText = normalizeText(
        `${alert.title} ${alert.description} ${alert.employeeName} ${alert.companyName} ${alert.centerName}`
      );
      const matchesSearch = !search || alertText.includes(search);
      const matchesSource = !filters.source || alert.source === filters.source;
      const matchesSeverity = !filters.severity || alert.severity === filters.severity;

      return matchesSearch && matchesSource && matchesSeverity;
    });
  }, [alerts, filters]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ search: "", source: "", severity: "" });
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Alertas activas</p>
          <strong style={styles.kpiValue}>{stats.total}</strong>
        </div>
        <div style={styles.kpiCardCritical}>
          <p style={styles.kpiLabel}>Críticas</p>
          <strong style={styles.kpiValue}>{stats.critical}</strong>
        </div>
        <div style={styles.kpiCardHigh}>
          <p style={styles.kpiLabel}>Alta prioridad</p>
          <strong style={styles.kpiValue}>{stats.high}</strong>
        </div>
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Documentales</p>
          <strong style={styles.kpiValue}>{stats.document}</strong>
        </div>
      </div>

      <PageCard
        title="Centro de alertas"
        subtitle="Alertas generadas automáticamente desde documentos, contratos, incidencias y nóminas."
      >
        <div style={styles.filters}>
          <div style={styles.searchGroup}>
            <label style={styles.label}>Buscar</label>
            <input
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Trabajador, empresa, documento, incidencia..."
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>Origen</label>
            <select name="source" value={filters.source} onChange={handleFilterChange} style={styles.input}>
              <option value="">Todos</option>
              <option value="document">Documentos</option>
              <option value="contract">Contratos</option>
              <option value="incident">Incidencias</option>
              <option value="payroll">Nóminas</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.label}>Prioridad</label>
            <select name="severity" value={filters.severity} onChange={handleFilterChange} style={styles.input}>
              <option value="">Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>

          <button type="button" onClick={clearFilters} style={styles.clearButton}>
            Limpiar
          </button>
        </div>

        <div style={styles.resultInfo}>
          Mostrando {filteredAlerts.length} de {alerts.length} alertas
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Prioridad</th>
                <th style={styles.th}>Origen</th>
                <th style={styles.th}>Alerta</th>
                <th style={styles.th}>Trabajador</th>
                <th style={styles.th}>Empresa / centro</th>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 && (
                <tr>
                  <td colSpan="7" style={styles.emptyCell}>
                    No hay alertas con los filtros actuales.
                  </td>
                </tr>
              )}

              {filteredAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...getSeverityStyle(alert.severity) }}>
                      {SEVERITY_LABELS[alert.severity] || alert.severity}
                    </span>
                  </td>
                  <td style={styles.td}>{SOURCE_LABELS[alert.source] || alert.source}</td>
                  <td style={styles.tdWide}>
                    <strong style={styles.alertTitle}>{alert.title}</strong>
                    <p style={styles.alertDescription}>{alert.description}</p>
                    <span style={styles.status}>{alert.status}</span>
                  </td>
                  <td style={styles.td}>{alert.employeeName}</td>
                  <td style={styles.td}>
                    <strong>{alert.companyName}</strong>
                    <p style={styles.centerName}>{alert.centerName}</p>
                  </td>
                  <td style={styles.td}>{formatDate(alert.dueDate)}</td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.recordButton}
                      disabled={!alert.employeeId || !onOpenEmployeeRecord}
                      onClick={() => onOpenEmployeeRecord?.(alert.employeeId)}
                    >
                      Abrir expediente
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" },
  kpiCard: { border: "2px solid #111827", backgroundColor: "#ffffff", padding: "16px", boxShadow: "4px 4px 0 #f4df5c" },
  kpiCardCritical: { border: "2px solid #7f1d1d", backgroundColor: "#fef2f2", padding: "16px", boxShadow: "4px 4px 0 #fecaca" },
  kpiCardHigh: { border: "2px solid #92400e", backgroundColor: "#fffbeb", padding: "16px", boxShadow: "4px 4px 0 #fde68a" },
  kpiLabel: { margin: 0, color: "#4b5563", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" },
  kpiValue: { display: "block", marginTop: "8px", color: "#111827", fontSize: "32px", lineHeight: 1, fontWeight: 900 },
  filters: { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 160px 150px 92px", gap: "10px", alignItems: "end", marginBottom: "12px" },
  searchGroup: { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 },
  filterGroup: { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 },
  label: { fontSize: "13px", fontWeight: 800, color: "#374151" },
  input: { width: "100%", height: "36px", boxSizing: "border-box", padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px" },
  clearButton: { width: "92px", height: "36px", backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "7px 8px", cursor: "pointer", fontWeight: 900, fontSize: "12px", textTransform: "uppercase" },
  resultInfo: { marginBottom: "14px", color: "#6b7280", fontSize: "13px", fontWeight: 800 },
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { backgroundColor: "#f9fafb", color: "#111827", borderBottom: "1px solid #e5e7eb", padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 900, textTransform: "uppercase" },
  td: { borderBottom: "1px solid #f3f4f6", padding: "10px", verticalAlign: "top", color: "#374151", fontWeight: 700 },
  tdWide: { borderBottom: "1px solid #f3f4f6", padding: "10px", verticalAlign: "top", minWidth: "240px" },
  emptyCell: { padding: "24px", color: "#6b7280", textAlign: "center", fontWeight: 800 },
  badge: { display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", padding: "4px 8px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  severityCritical: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
  severityHigh: { backgroundColor: "#ffedd5", color: "#9a3412", border: "1px solid #fed7aa" },
  severityMedium: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" },
  severityLow: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  alertTitle: { display: "block", color: "#111827", fontWeight: 900, marginBottom: "4px" },
  alertDescription: { margin: 0, color: "#4b5563", fontSize: "12px", lineHeight: 1.4, fontWeight: 600 },
  status: { display: "inline-block", marginTop: "6px", color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  centerName: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 600 },
  recordButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "7px", padding: "7px 9px", cursor: "pointer", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
};
