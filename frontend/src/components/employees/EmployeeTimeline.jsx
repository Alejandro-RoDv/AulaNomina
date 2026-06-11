import { useMemo, useState } from "react";

import { buildEmployeeTimeline, getEmployeeTimelineSummary } from "../../utils/buildEmployeeTimeline";

const FILTERS = [
  { id: "all", label: "Todos", groups: [] },
  { id: "labor", label: "Laboral", groups: ["laboral"] },
  { id: "contracts", label: "Contratos", groups: ["contracts"] },
  { id: "incidents", label: "Incidencias", groups: ["incidents"] },
  { id: "payrolls", label: "Nóminas", groups: ["payrolls"] },
  { id: "documents", label: "Documentos", groups: ["documents"] },
  { id: "alerts", label: "Alertas", groups: ["alerts"] },
];

const ACTION_LABELS = {
  contracts: "Ver contrato",
  incidents: "Ver incidencia",
  payrolls: "Ver nómina",
  documents: "Ver documento",
  alerts: "Ver alerta",
  employees: "Ver trabajador",
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getYear(value) {
  if (!value) return "Sin fecha";
  return String(value).slice(0, 4);
}

function getEmployeeName(employee) {
  return [employee?.first_name, employee?.last_name, employee?.second_last_name].filter(Boolean).join(" ") || "Trabajador";
}

function getCurrentCompanyName(employee, contracts, companies) {
  const activeContract = contracts.find((contract) => String(contract.employee_id) === String(employee?.id) && contract.status === "active") || contracts.find((contract) => String(contract.employee_id) === String(employee?.id));
  const companyId = activeContract?.company_id || employee?.company_id;
  return activeContract?.company_name || companies.find((company) => String(company.id) === String(companyId))?.name || "Sin empresa";
}

function getCurrentCenterName(employee, contracts, workCenters) {
  const activeContract = contracts.find((contract) => String(contract.employee_id) === String(employee?.id) && contract.status === "active") || contracts.find((contract) => String(contract.employee_id) === String(employee?.id));
  const centerId = activeContract?.center_id || employee?.center_id;
  return activeContract?.center_name || workCenters.find((center) => String(center.id) === String(centerId))?.name || "Sin centro";
}

function groupEventsByYear(events) {
  return events.reduce((acc, event) => {
    const year = getYear(event.date);
    if (!acc[year]) acc[year] = [];
    acc[year].push(event);
    return acc;
  }, {});
}

function getMetadataItems(event) {
  return [
    event.metadata?.companyName,
    event.metadata?.centerName,
    event.metadata?.contractCode ? `Contrato ${event.metadata.contractCode}` : "",
    event.metadata?.periodLabel ? `Periodo ${event.metadata.periodLabel}` : "",
  ].filter(Boolean);
}

function TimelineStat({ label, value, subtle }) {
  return (
    <div style={subtle ? styles.statBoxSubtle : styles.statBox}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

function TimelineEvent({ event }) {
  const metadataItems = getMetadataItems(event);
  const actionLabel = ACTION_LABELS[event.source];

  return (
    <div style={styles.eventRow}>
      <div style={styles.dateCell}>{formatDate(event.date)}</div>
      <div style={styles.markerColumn}>
        <span style={{ ...styles.marker, backgroundColor: event.color }} />
        <span style={styles.verticalLine} />
      </div>
      <div style={styles.eventCard}>
        <div style={styles.eventTopRow}>
          <span style={{ ...styles.eventBadge, borderColor: event.color, color: event.color }}>{event.label}</span>
          <span style={styles.eventSource}>{event.source}</span>
        </div>
        <div style={styles.eventMainRow}>
          <div style={styles.eventContent}>
            <h4 style={styles.eventTitle}>{event.title}</h4>
            <p style={styles.eventDescription}>{event.description || "Sin detalle registrado."}</p>
            {!!metadataItems.length && (
              <div style={styles.metadataRow}>
                {metadataItems.map((item) => <span key={item} style={styles.metadataPill}>{item}</span>)}
              </div>
            )}
          </div>
          {actionLabel && (
            <button type="button" style={styles.actionButton} title="Acción visual preparada para navegación futura">
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmployeeTimeline({
  employee,
  contracts = [],
  incidents = [],
  payrolls = [],
  documents = [],
  alerts = [],
  companies = [],
  workCenters = [],
}) {
  const [activeFilter, setActiveFilter] = useState("all");

  const events = useMemo(() => buildEmployeeTimeline({ employee, contracts, incidents, payrolls, documents, alerts, companies, workCenters }), [employee, contracts, incidents, payrolls, documents, alerts, companies, workCenters]);
  const summary = useMemo(() => getEmployeeTimelineSummary(events), [events]);

  const selectedFilter = FILTERS.find((filter) => filter.id === activeFilter) || FILTERS[0];
  const filteredEvents = selectedFilter.id === "all" ? events : events.filter((event) => selectedFilter.groups.includes(event.group));
  const groupedEvents = groupEventsByYear(filteredEvents);
  const years = Object.keys(groupedEvents).sort((a, b) => Number(b) - Number(a));

  if (!employee) {
    return <p style={styles.empty}>Selecciona un trabajador para consultar su vida laboral cronológica.</p>;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Trazabilidad del expediente</p>
          <h3 style={styles.title}>Vida laboral cronológica</h3>
          <p style={styles.subtitle}>La vida laboral cronológica permite reconstruir la evolución administrativa del trabajador dentro de la simulación: altas, contratos, incidencias, documentos, nóminas y vencimientos.</p>
        </div>
        <div style={styles.employeeSummary}>
          <strong>{getEmployeeName(employee)}</strong>
          <span>{getCurrentCompanyName(employee, contracts, companies)} · {getCurrentCenterName(employee, contracts, workCenters)}</span>
          <span>{employee.is_active ? "Estado: activo" : "Estado: inactivo"}</span>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <TimelineStat label="Eventos" value={summary.total} />
        <TimelineStat label="Contratos" value={summary.contracts} />
        <TimelineStat label="Incidencias" value={summary.incidents} />
        <TimelineStat label="Nóminas" value={summary.payrolls} />
        <TimelineStat label="Documentos" value={summary.documents} />
        <TimelineStat label="Alertas" value={summary.alerts} subtle />
        <TimelineStat label="Último evento" value={summary.lastEvent?.title || "-"} subtle />
      </div>

      <div style={styles.filters}>
        {FILTERS.map((filter) => (
          <button key={filter.id} type="button" style={activeFilter === filter.id ? styles.filterButtonActive : styles.filterButton} onClick={() => setActiveFilter(filter.id)}>
            {filter.label}
          </button>
        ))}
      </div>

      {!events.length ? (
        <div style={styles.emptyState}>
          <strong>Este trabajador aún no tiene vida laboral registrada.</strong>
          <p>Cuando se creen contratos, incidencias, nóminas o documentos, aparecerán automáticamente en esta línea temporal.</p>
        </div>
      ) : !filteredEvents.length ? (
        <div style={styles.emptyState}>
          <strong>No hay eventos para este filtro.</strong>
          <p>Cambia el filtro para consultar otros movimientos del expediente.</p>
        </div>
      ) : (
        <div style={styles.timeline}>
          {years.map((year) => (
            <section key={year} style={styles.yearSection}>
              <h4 style={styles.yearTitle}>{year}</h4>
              <div style={styles.yearEvents}>
                {groupedEvents[year].map((event) => <TimelineEvent key={event.id} event={event} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", gap: "16px" },
  header: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" },
  eyebrow: { margin: "0 0 4px", fontSize: "11px", fontWeight: 900, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" },
  title: { margin: 0, fontSize: "18px", color: "#111827", fontWeight: 950 },
  subtitle: { margin: "8px 0 0", maxWidth: "760px", color: "#4b5563", fontSize: "13px", lineHeight: 1.5 },
  employeeSummary: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px", minWidth: "280px", fontSize: "13px", color: "#4b5563" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: "10px" },
  statBox: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  statBoxSubtle: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
  statLabel: { color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em" },
  statValue: { color: "#111827", fontSize: "15px", fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  filters: { display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #f3f4f6", paddingTop: "12px" },
  filterButton: { backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "999px", padding: "8px 11px", fontSize: "12px", fontWeight: 900, cursor: "pointer" },
  filterButtonActive: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "999px", padding: "8px 11px", fontSize: "12px", fontWeight: 950, cursor: "pointer" },
  timeline: { display: "flex", flexDirection: "column", gap: "16px" },
  yearSection: { display: "flex", flexDirection: "column", gap: "10px" },
  yearTitle: { margin: 0, padding: "6px 0", color: "#111827", fontSize: "15px", fontWeight: 950, borderBottom: "1px solid #e5e7eb" },
  yearEvents: { display: "flex", flexDirection: "column", gap: "0" },
  eventRow: { display: "grid", gridTemplateColumns: "104px 24px 1fr", gap: "8px", alignItems: "stretch" },
  dateCell: { paddingTop: "12px", color: "#374151", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
  markerColumn: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "15px" },
  marker: { width: "10px", height: "10px", borderRadius: "999px", display: "block", border: "2px solid #ffffff", boxShadow: "0 0 0 1px #d1d5db" },
  verticalLine: { flex: 1, width: "1px", backgroundColor: "#e5e7eb", marginTop: "4px" },
  eventCard: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "11px 12px", marginBottom: "10px", backgroundColor: "#ffffff" },
  eventTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "6px" },
  eventMainRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" },
  eventContent: { minWidth: 0, flex: "1 1 auto" },
  eventBadge: { border: "1px solid", borderRadius: "999px", padding: "3px 7px", fontSize: "11px", fontWeight: 950, backgroundColor: "#ffffff" },
  eventSource: { color: "#9ca3af", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" },
  eventTitle: { margin: 0, color: "#111827", fontSize: "14px", fontWeight: 950 },
  eventDescription: { margin: "5px 0 0", color: "#4b5563", fontSize: "13px", lineHeight: 1.45 },
  metadataRow: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" },
  metadataPill: { border: "1px solid #e5e7eb", borderRadius: "999px", padding: "3px 7px", backgroundColor: "#f9fafb", color: "#4b5563", fontSize: "11px", fontWeight: 800 },
  actionButton: { flex: "0 0 auto", backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "7px 9px", cursor: "pointer", fontSize: "12px", fontWeight: 900 },
  empty: { margin: 0, color: "#6b7280", fontSize: "14px" },
  emptyState: { border: "1px dashed #d1d5db", borderRadius: "12px", padding: "18px", backgroundColor: "#f9fafb", color: "#4b5563" },
};
