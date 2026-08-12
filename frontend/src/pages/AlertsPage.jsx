import { useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import { buildDatedFilename, exportRowsToCsv } from "../utils/csvExport";
import { generateAlerts, getAlertStats, groupAlertsForDisplay } from "../utils/alertRules";

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
  { id: "urgent", label: "Urgentes" },
  { id: "critical", label: "Críticas" },
  { id: "high", label: "Alta prioridad" },
  { id: "due7", label: "Próximos 7 días" },
  { id: "overdue", label: "Vencidas" },
  { id: "documents", label: "Documentales" },
  { id: "incomplete", label: "Expedientes incompletos" },
];

const SORT_OPTIONS = {
  priority: "Prioridad",
  deadline: "Plazo",
  employee: "Trabajador",
  company: "Empresa",
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

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

function formatDateTime(value) {
  if (!value) return "—";
  return value.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDeadline(alert) {
  if (typeof alert.dueDays !== "number") return "Sin plazo";
  if (alert.dueDays < 0) return `Vencido · ${Math.abs(alert.dueDays)} d`;
  if (alert.dueDays === 0) return "Vence hoy";
  if (alert.dueDays === 1) return "Vence mañana";
  return `En ${alert.dueDays} días`;
}

function getDeadlineClass(alert) {
  if (typeof alert.dueDays !== "number") return "";
  if (alert.dueDays < 0) return "alerts-pill--overdue";
  if (alert.dueDays <= 7) return "alerts-pill--soon";
  return "";
}

function getActionLabel(source) {
  if (source === "document") return "Ver documentación";
  if (source === "contract") return "Ver contrato";
  if (source === "incident") return "Ver incidencia";
  if (source === "payroll") return "Ver nómina";
  return "Abrir expediente";
}

function sortAlerts(alerts, sortBy) {
  const sorted = [...alerts];

  if (sortBy === "deadline") {
    return sorted.sort((a, b) => {
      const aValue = typeof a.dueDays === "number" ? a.dueDays : Number.POSITIVE_INFINITY;
      const bValue = typeof b.dueDays === "number" ? b.dueDays : Number.POSITIVE_INFINITY;
      return aValue - bValue;
    });
  }

  if (sortBy === "employee") {
    return sorted.sort((a, b) => String(a.employeeName || "").localeCompare(String(b.employeeName || ""), "es"));
  }

  if (sortBy === "company") {
    return sorted.sort((a, b) => String(a.companyName || "").localeCompare(String(b.companyName || ""), "es"));
  }

  return sorted.sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    if (severityDiff !== 0) return severityDiff;
    const aDays = typeof a.dueDays === "number" ? a.dueDays : Number.POSITIVE_INFINITY;
    const bDays = typeof b.dueDays === "number" ? b.dueDays : Number.POSITIVE_INFINITY;
    return aDays - bDays;
  });
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "es"));
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
  const [updatedAt] = useState(() => new Date());
  const [filters, setFilters] = useState({
    search: "",
    source: "",
    severity: "",
    company: "",
    center: "",
    sortBy: "priority",
    quick: "all",
  });

  const alerts = useMemo(
    () => groupAlertsForDisplay(generateAlerts({ documents, contracts, incidents, payrolls, employees, companies, workCenters })),
    [documents, contracts, incidents, payrolls, employees, companies, workCenters]
  );

  const stats = useMemo(() => getAlertStats(alerts), [alerts]);
  const urgentCount = useMemo(
    () => alerts.filter((alert) => alert.severity === "critical" || alert.severity === "high" || (typeof alert.dueDays === "number" && alert.dueDays <= 7)).length,
    [alerts]
  );
  const companyOptions = useMemo(() => uniqueSorted(alerts.map((alert) => alert.companyName)), [alerts]);
  const centerOptions = useMemo(() => uniqueSorted(alerts.map((alert) => alert.centerName)), [alerts]);

  const filteredAlerts = useMemo(() => {
    const search = normalizeText(filters.search);

    const matches = alerts.filter((alert) => {
      const alertText = normalizeText(
        `${alert.title} ${alert.description} ${alert.employeeName} ${alert.companyName} ${alert.centerName}`
      );
      const matchesSearch = !search || alertText.includes(search);
      const matchesSource = !filters.source || alert.source === filters.source;
      const matchesSeverity = !filters.severity || alert.severity === filters.severity;
      const matchesCompany = !filters.company || alert.companyName === filters.company;
      const matchesCenter = !filters.center || alert.centerName === filters.center;
      const matchesQuick =
        filters.quick === "all" ||
        (filters.quick === "urgent" && (alert.severity === "critical" || alert.severity === "high" || (typeof alert.dueDays === "number" && alert.dueDays <= 7))) ||
        (filters.quick === "critical" && alert.severity === "critical") ||
        (filters.quick === "high" && alert.severity === "high") ||
        (filters.quick === "due7" && typeof alert.dueDays === "number" && alert.dueDays >= 0 && alert.dueDays <= 7) ||
        (filters.quick === "overdue" && typeof alert.dueDays === "number" && alert.dueDays < 0) ||
        (filters.quick === "documents" && alert.source === "document") ||
        (filters.quick === "incomplete" && alert.isGroupedDocumentAlert);

      return matchesSearch && matchesSource && matchesSeverity && matchesCompany && matchesCenter && matchesQuick;
    });

    return sortAlerts(matches, filters.sortBy);
  }, [alerts, filters]);

  const filteredStats = useMemo(() => getAlertStats(filteredAlerts), [filteredAlerts]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  const setQuickFilter = (quick) => {
    setFilters((previous) => ({ ...previous, quick }));
  };

  const toggleSource = (source) => {
    setFilters((previous) => ({ ...previous, source: previous.source === source ? "" : source }));
  };

  const clearFilters = () => {
    setFilters({ search: "", source: "", severity: "", company: "", center: "", sortBy: "priority", quick: "all" });
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
    <div className="alerts-page">
      <div className="alerts-kpi-grid" aria-label="Resumen de alertas">
        <button
          type="button"
          className={`alerts-kpi${filters.quick === "all" ? " is-selected" : ""}`}
          onClick={() => setQuickFilter("all")}
        >
          <p className="alerts-kpi__label">Alertas activas</p>
          <strong className="alerts-kpi__value">{stats.total}</strong>
          <span className="alerts-kpi__hint">Total del sistema</span>
        </button>

        <button
          type="button"
          className={`alerts-kpi alerts-kpi--danger${filters.quick === "critical" ? " is-selected" : ""}`}
          onClick={() => setQuickFilter("critical")}
        >
          <p className="alerts-kpi__label">Críticas</p>
          <strong className="alerts-kpi__value">{stats.critical}</strong>
          <span className="alerts-kpi__hint">{stats.critical === 0 ? "Sin incidencias críticas" : "Requieren atención inmediata"}</span>
        </button>

        <button
          type="button"
          className={`alerts-kpi alerts-kpi--warning${filters.quick === "urgent" ? " is-selected" : ""}`}
          onClick={() => setQuickFilter("urgent")}
        >
          <p className="alerts-kpi__label">Urgentes</p>
          <strong className="alerts-kpi__value">{urgentCount}</strong>
          <span className="alerts-kpi__hint">Prioridad alta o plazo próximo</span>
        </button>

        <button
          type="button"
          className={`alerts-kpi${filters.quick === "due7" ? " is-selected" : ""}`}
          onClick={() => setQuickFilter("due7")}
        >
          <p className="alerts-kpi__label">Próximos 7 días</p>
          <strong className="alerts-kpi__value">{stats.due7}</strong>
          <span className="alerts-kpi__hint">Vencimientos inmediatos</span>
        </button>
      </div>

      {stats.critical === 0 && (
        <div className="alerts-status-line">
          Sin alertas críticas activas. No se detectan vencimientos críticos pendientes.
        </div>
      )}

      <div className="alerts-filter-strip" aria-label="Filtros rápidos">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`alerts-filter-chip${filters.quick === filter.id ? " is-active" : ""}`}
            onClick={() => setQuickFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="alerts-source-grid" aria-label="Alertas por origen">
        {Object.entries(SOURCE_LABELS).map(([source, label]) => (
          <button
            key={source}
            type="button"
            className={`alerts-source-button${filters.source === source ? " is-active" : ""}`}
            onClick={() => toggleSource(source)}
          >
            <span>{label}</span>
            <strong>{filteredStats[source]}</strong>
          </button>
        ))}
      </div>

      <PageCard
        className="alerts-card"
        title="Centro de alertas laborales"
        subtitle="Consulta, filtra y prioriza los avisos generados desde documentación, contratos, incidencias y nóminas."
      >
        <div className="alerts-toolbar">
          <div className="alerts-field">
            <label htmlFor="alerts-search">Buscar</label>
            <input
              id="alerts-search"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Trabajador, empresa, documento o incidencia"
            />
          </div>

          <div className="alerts-field">
            <label htmlFor="alerts-source">Origen</label>
            <select id="alerts-source" name="source" value={filters.source} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="alerts-field">
            <label htmlFor="alerts-severity">Prioridad</label>
            <select id="alerts-severity" name="severity" value={filters.severity} onChange={handleFilterChange}>
              <option value="">Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>

          <div className="alerts-field">
            <label htmlFor="alerts-company">Empresa</label>
            <select id="alerts-company" name="company" value={filters.company} onChange={handleFilterChange}>
              <option value="">Todas</option>
              {companyOptions.map((company) => <option key={company} value={company}>{company}</option>)}
            </select>
          </div>

          <div className="alerts-field">
            <label htmlFor="alerts-center">Centro</label>
            <select id="alerts-center" name="center" value={filters.center} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {centerOptions.map((center) => <option key={center} value={center}>{center}</option>)}
            </select>
          </div>

          <div className="alerts-field">
            <label htmlFor="alerts-sort">Ordenar</label>
            <select id="alerts-sort" name="sortBy" value={filters.sortBy} onChange={handleFilterChange}>
              {Object.entries(SORT_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="alerts-toolbar__actions">
            <button type="button" className="alerts-button" onClick={clearFilters}>Limpiar</button>
            <button
              type="button"
              className="alerts-button alerts-button--primary"
              onClick={exportFilteredAlerts}
              disabled={filteredAlerts.length === 0}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="alerts-result-meta">
          <span>{filteredAlerts.length} de {alerts.length} alertas · Orden: {SORT_OPTIONS[filters.sortBy]}</span>
          <span>Actualizado {formatDateTime(updatedAt)}</span>
        </div>

        <div className="alerts-table-wrap">
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Prioridad</th>
                <th>Origen</th>
                <th>Alerta</th>
                <th>Trabajador</th>
                <th>Empresa / centro</th>
                <th>Plazo</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 && (
                <tr>
                  <td colSpan="7" className="alerts-empty">No hay alertas con los filtros actuales.</td>
                </tr>
              )}

              {filteredAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="alerts-table__priority">
                    <span className={`alerts-pill alerts-pill--${alert.severity}`}>
                      {SEVERITY_LABELS[alert.severity] || alert.severity}
                    </span>
                  </td>
                  <td className="alerts-table__origin">{SOURCE_LABELS[alert.source] || alert.source}</td>
                  <td className="alerts-table__message">
                    <strong className="alerts-table__title">{alert.title}</strong>
                    <p className="alerts-table__description">{alert.description}</p>
                    <span className="alerts-status-text">{alert.status}</span>
                  </td>
                  <td>{alert.employeeName}</td>
                  <td>
                    <span className="alerts-table__company">{alert.companyName}</span>
                    <p className="alerts-table__center">{alert.centerName}</p>
                  </td>
                  <td className="alerts-table__deadline">
                    <span className={`alerts-pill ${getDeadlineClass(alert)}`.trim()}>{formatDeadline(alert)}</span>
                    <p className="alerts-table__date">{formatDate(alert.dueDate)}</p>
                  </td>
                  <td className="alerts-table__action">
                    <button
                      type="button"
                      className="alerts-button"
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
