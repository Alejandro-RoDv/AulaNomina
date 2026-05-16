import { useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import { buildDatedFilename, exportRowsToCsv } from "../utils/csvExport";
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

const QUICK_FILTERS = [
  { id: "all", label: "Todas" },
  { id: "critical", label: "Críticas" },
  { id: "high", label: "Alta prioridad" },
  { id: "due7", label: "Próximos 7 días" },
  { id: "overdue", label: "Vencidas" },
  { id: "documents", label: "Documentales" },
];

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

function formatDeadline(alert) {
  if (typeof alert.dueDays !== "number") return "Sin plazo";
  if (alert.dueDays < 0) return `Vencido hace ${Math.abs(alert.dueDays)} días`;
  if (alert.dueDays === 0) return "Vence hoy";
  if (alert.dueDays === 1) return "Vence mañana";
  return `Vence en ${alert.dueDays} días`;
}

function getDeadlineStyle(alert) {
  if (typeof alert.dueDays !== "number") return styles.deadlineNeutral;
  if (alert.dueDays < 0) return styles.deadlineOverdue;
  if (alert.dueDays <= 7) return styles.deadlineSoon;
  return styles.deadlineNormal;
}

function getSeverityStyle(severity) {
  if (severity === "critical") return styles.severityCritical;
  if (severity === "high") return styles.severityHigh;
  if (severity === "medium") return styles.severityMedium;
  return styles.severityLow;
}

function getActionLabel(source) {
  if (source === "document") return "Ver documentación";
  if (source === "contract") return "Ver contrato";
  if (source === "incident") return "Ver incidencia";
  if (source === "payroll") return "Ver nómina";
  return "Abrir expediente";
}

function buildGroupedDocumentAlerts(alerts) {
  const pendingDocuments = alerts.filter((alert) => alert.source === "document" && alert.status === "Pendiente");
  const grouped = new Map();

  pendingDocuments.forEach((alert) => {
    const key = alert.employeeId || alert.employeeName;
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: `document-group-${key}`,
        source: "document",
        severity: "medium",
        title: `${alert.employeeName} tiene documentación pendiente`,
        description: "Expediente documental incompleto. Revisar documentación obligatoria.",
        employeeId: alert.employeeId,
        employeeName: alert.employeeName,
        companyName: alert.companyName,
        centerName: alert.centerName,
        dueDate: null,
        dueDays: null,
        status: "Pendiente",
        metadata: { documents: [] },
        isGroupedDocumentAlert: true,
      });
    }

    grouped.get(key).metadata.documents.push(alert.metadata?.documentName || alert.title.replace("Documento pendiente: ", ""));
  });

  return alerts
    .filter((alert) => !(alert.source === "document" && alert.status === "Pendiente"))
    .concat(
      Array.from(grouped.values()).map((group) => ({
        ...group,
        title: `${group.employeeName} tiene ${group.metadata.documents.length} documentos pendientes`,
        description: group.metadata.documents.slice(0, 4).join(" · ") + (group.metadata.documents.length > 4 ? " · ..." : ""),
      }))
    );
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
    quick: "all",
  });

  const alerts = useMemo(
    () =>
      buildGroupedDocumentAlerts(
        generateAlerts({
          documents,
          contracts,
          incidents,
          payrolls,
          employees,
          companies,
          workCenters,
        })
      ),
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
      const matchesQuick =
        filters.quick === "all" ||
        (filters.quick === "critical" && alert.severity === "critical") ||
        (filters.quick === "high" && alert.severity === "high") ||
        (filters.quick === "due7" && typeof alert.dueDays === "number" && alert.dueDays >= 0 && alert.dueDays <= 7) ||
        (filters.quick === "overdue" && typeof alert.dueDays === "number" && alert.dueDays < 0) ||
        (filters.quick === "documents" && alert.source === "document");

      return matchesSearch && matchesSource && matchesSeverity && matchesQuick;
    });
  }, [alerts, filters]);

  const filteredStats = useMemo(() => getAlertStats(filteredAlerts), [filteredAlerts]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const setQuickFilter = (quick) => {
    setFilters((prev) => ({ ...prev, quick }));
  };

  const clearFilters = () => {
    setFilters({ search: "", source: "", severity: "", quick: "all" });
  };

  const exportFilteredAlerts = () => {
    exportRowsToCsv(
      filteredAlerts,
      [
        { label: "Prioridad", value: (alert) => SEVERITY_LABELS[alert.severity] || alert.severity },
        { label: "Origen", value: (alert) => SOURCE_LABELS[alert.source] || alert.source },
        { label: "Titulo", value: "title" },
        { label: "Descripcion", value: "description" },
        { label: "Estado", value: "status" },
        { label: "Trabajador", value: "employeeName" },
        { label: "Empresa", value: "companyName" },
        { label: "Centro", value: "centerName" },
        { label: "Plazo", value: (alert) => formatDeadline(alert) },
        { label: "Fecha", value: (alert) => formatDate(alert.dueDate) },
      ],
      buildDatedFilename("aulanomina_alertas")
    );
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.kpiGrid}>
        <button type="button" style={styles.kpiCard} onClick={() => setQuickFilter("all")}>
          <p style={styles.kpiLabel}>Alertas activas</p>
          <strong style={styles.kpiValue}>{stats.total}</strong>
          <span style={styles.kpiHint}>Total del sistema</span>
        </button>
        <button type="button" style={styles.kpiCardCritical} onClick={() => setQuickFilter("critical")}>
          <p style={styles.kpiLabel}>Críticas</p>
          <strong style={styles.kpiValue}>{stats.critical}</strong>
          <span style={styles.kpiHint}>Revisión inmediata</span>
        </button>
        <button type="button" style={styles.kpiCardHigh} onClick={() => setQuickFilter("high")}>
          <p style={styles.kpiLabel}>Alta prioridad</p>
          <strong style={styles.kpiValue}>{stats.high}</strong>
          <span style={styles.kpiHint}>Seguimiento próximo</span>
        </button>
        <button type="button" style={styles.kpiCardDue} onClick={() => setQuickFilter("due7")}>
          <p style={styles.kpiLabel}>Próximos 7 días</p>
          <strong style={styles.kpiValue}>{stats.due7}</strong>
          <span style={styles.kpiHint}>Plazos inmediatos</span>
        </button>
      </div>

      <div style={styles.quickFilters}>
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setQuickFilter(filter.id)}
            style={{ ...styles.quickFilter, ...(filters.quick === filter.id ? styles.quickFilterActive : {}) }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div style={styles.summaryGrid}>
        <button type="button" onClick={() => setFilters((prev) => ({ ...prev, source: "document" }))} style={styles.summaryItem}><span>Documentos</span><strong>{filteredStats.document}</strong></button>
        <button type="button" onClick={() => setFilters((prev) => ({ ...prev, source: "contract" }))} style={styles.summaryItem}><span>Contratos</span><strong>{filteredStats.contract}</strong></button>
        <button type="button" onClick={() => setFilters((prev) => ({ ...prev, source: "incident" }))} style={styles.summaryItem}><span>Incidencias</span><strong>{filteredStats.incident}</strong></button>
        <button type="button" onClick={() => setFilters((prev) => ({ ...prev, source: "payroll" }))} style={styles.summaryItem}><span>Nóminas</span><strong>{filteredStats.payroll}</strong></button>
      </div>

      <PageCard
        title="Centro de alertas"
        subtitle="Alertas generadas automáticamente desde documentos, contratos, incidencias y nóminas."
      >
        <div style={styles.toolbar}>
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

          <button type="button" onClick={exportFilteredAlerts} style={styles.exportButton} disabled={filteredAlerts.length === 0}>
            Exportar CSV
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
                <th style={styles.th}>Plazo</th>
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
                <tr key={alert.id} style={styles.row}>
                  <td style={styles.tdCompact}>
                    <span style={{ ...styles.badge, ...getSeverityStyle(alert.severity) }}>
                      {SEVERITY_LABELS[alert.severity] || alert.severity}
                    </span>
                  </td>
                  <td style={styles.tdCompact}>{SOURCE_LABELS[alert.source] || alert.source}</td>
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
                  <td style={styles.tdCompact}>
                    <span style={{ ...styles.deadlineBadge, ...getDeadlineStyle(alert) }}>{formatDeadline(alert)}</span>
                    <p style={styles.deadlineDate}>{formatDate(alert.dueDate)}</p>
                  </td>
                  <td style={styles.tdCompact}>
                    <button
                      type="button"
                      style={styles.recordButton}
                      disabled={!alert.employeeId || !onOpenEmployeeRecord}
                      onClick={() => onOpenEmployeeRecord?.(alert.employeeId)}
                    >
                      {getActionLabel(alert.source)}
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
  kpiCard: { border: "2px solid #111827", backgroundColor: "#ffffff", padding: "16px", boxShadow: "4px 4px 0 #f4df5c", textAlign: "left", cursor: "pointer" },
  kpiCardCritical: { border: "2px solid #7f1d1d", backgroundColor: "#fef2f2", padding: "16px", boxShadow: "4px 4px 0 #fecaca", textAlign: "left", cursor: "pointer" },
  kpiCardHigh: { border: "2px solid #92400e", backgroundColor: "#fffbeb", padding: "16px", boxShadow: "4px 4px 0 #fde68a", textAlign: "left", cursor: "pointer" },
  kpiCardDue: { border: "2px solid #854d0e", backgroundColor: "#fefce8", padding: "16px", boxShadow: "4px 4px 0 #facc15", textAlign: "left", cursor: "pointer" },
  kpiLabel: { margin: 0, color: "#4b5563", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" },
  kpiValue: { display: "block", marginTop: "8px", color: "#111827", fontSize: "32px", lineHeight: 1, fontWeight: 900 },
  kpiHint: { display: "block", marginTop: "7px", color: "#6b7280", fontSize: "12px", fontWeight: 800 },
  quickFilters: { display: "flex", flexWrap: "wrap", gap: "8px" },
  quickFilter: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "999px", padding: "8px 12px", cursor: "pointer", fontWeight: 900, fontSize: "12px", textTransform: "uppercase" },
  quickFilterActive: { backgroundColor: "#111827", color: "#ffffff", borderColor: "#111827" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" },
  summaryItem: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 850, color: "#374151", cursor: "pointer" },
  toolbar: { display: "flex", alignItems: "end", justifyContent: "space-between", gap: "14px", marginBottom: "12px" },
  filters: { flex: 1, display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 160px 150px 92px", gap: "10px", alignItems: "end" },
  searchGroup: { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 },
  filterGroup: { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 },
  label: { fontSize: "13px", fontWeight: 800, color: "#374151" },
  input: { width: "100%", height: "36px", boxSizing: "border-box", padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px" },
  clearButton: { width: "92px", height: "36px", backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "7px 8px", cursor: "pointer", fontWeight: 900, fontSize: "12px", textTransform: "uppercase" },
  exportButton: { height: "36px", backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "7px", padding: "7px 12px", cursor: "pointer", fontWeight: 900, fontSize: "12px", textTransform: "uppercase", whiteSpace: "nowrap" },
  resultInfo: { marginBottom: "14px", color: "#6b7280", fontSize: "13px", fontWeight: 800 },
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px" },
  th: { backgroundColor: "#f9fafb", color: "#111827", borderBottom: "1px solid #e5e7eb", padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: 900, textTransform: "uppercase" },
  row: { backgroundColor: "#ffffff" },
  td: { borderBottom: "1px solid #f3f4f6", padding: "13px 12px", verticalAlign: "top", color: "#374151", fontWeight: 700 },
  tdCompact: { borderBottom: "1px solid #f3f4f6", padding: "13px 12px", verticalAlign: "top", color: "#374151", fontWeight: 700, whiteSpace: "nowrap" },
  tdWide: { borderBottom: "1px solid #f3f4f6", padding: "13px 12px", verticalAlign: "top", minWidth: "280px", maxWidth: "420px" },
  emptyCell: { padding: "24px", color: "#6b7280", textAlign: "center", fontWeight: 800 },
  badge: { display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", padding: "4px 8px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  severityCritical: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
  severityHigh: { backgroundColor: "#ffedd5", color: "#9a3412", border: "1px solid #fed7aa" },
  severityMedium: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" },
  severityLow: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  deadlineBadge: { display: "inline-flex", borderRadius: "999px", padding: "4px 8px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  deadlineOverdue: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
  deadlineSoon: { backgroundColor: "#ffedd5", color: "#9a3412", border: "1px solid #fed7aa" },
  deadlineNormal: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" },
  deadlineNeutral: { backgroundColor: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" },
  deadlineDate: { margin: "5px 0 0", color: "#6b7280", fontSize: "11px", fontWeight: 700 },
  alertTitle: { display: "block", color: "#111827", fontWeight: 900, marginBottom: "4px", lineHeight: 1.25 },
  alertDescription: { margin: 0, color: "#6b7280", fontSize: "12px", lineHeight: 1.35, fontWeight: 600, maxWidth: "390px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  status: { display: "inline-block", marginTop: "6px", color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  centerName: { margin: "4px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 600 },
  recordButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "7px", padding: "7px 9px", cursor: "pointer", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
};
