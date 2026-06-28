import { useEffect, useMemo, useState } from "react";

import IncidentForm, { INCIDENT_TYPES, STATUS_OPTIONS } from "../components/incidents/IncidentForm";
import IncidentTable from "../components/incidents/IncidentTable";
import PageCard from "../components/layout/PageCard";
import { getEmployeeVisibleCode } from "../utils/visibleCodes";
import { openReportPreset } from "../utils/reportShortcuts";
import WageGarnishmentManagementPage from "./WageGarnishmentManagementPage";

const INCIDENTS_MODE_KEY = "aulanomina:incidentsMode";
const INCIDENTS_MODE_EVENT = "aulanomina-incidents-mode";
const HEADER_EVENT = "aulanomina-header-context";

const CATEGORY_TABS = [
  { value: "all", label: "Resumen mensual", types: null },
  { value: "medical", label: "Incapacidad y prestaciones", types: ["IT", "RECAIDA", "NACIMIENTO_CUIDADO", "RIESGO_EMBARAZO", "RIESGO_LACTANCIA", "CUIDADO_MENOR"] },
  { value: "absence", label: "Absentismo", types: ["AUSENCIA", "PERMISO_RETRIBUIDO", "PERMISO_NO_RETRIBUIDO", "SUSPENSION", "SANCION"] },
  { value: "vacation", label: "Vacaciones", types: ["VACACIONES"] },
  { value: "overtime", label: "Horas extraordinarias", types: ["HORAS_EXTRA"] },
  { value: "movement", label: "Cambios del trabajador", types: ["MOVIMIENTO"] },
];

function getInitialMode() {
  if (typeof window === "undefined") return "list";
  return window.sessionStorage.getItem(INCIDENTS_MODE_KEY) || "list";
}

function publishHeader(mode) {
  const detail = mode === "embargo"
    ? { title: "Embargos judiciales", subtitle: "Gestión, cálculo y seguimiento de retenciones judiciales" }
    : { title: "Devengos, incidencias y particularidades del trabajador", subtitle: "Registro histórico y trazable de situaciones con impacto en nómina" };
  window.dispatchEvent(new CustomEvent(HEADER_EVENT, { detail }));
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function dateToNumber(value) {
  return value ? Number(String(value).replaceAll("-", "")) : null;
}

function SummaryCard({ label, value, note }) {
  return <div style={styles.summaryCard}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export default function IncidentsPage({
  loading,
  incidents,
  employees,
  contracts,
  companies,
  workCenters,
  payrolls = [],
  incidentForm,
  onIncidentChange,
  onIncidentSubmit,
  onUpdateIncident,
  onDeleteIncident,
  incidentError,
  incidentSuccess,
  incidentSubmitting,
}) {
  const [activeMode, setActiveMode] = useState(getInitialMode);
  const [activeCategory, setActiveCategory] = useState("all");
  const [filters, setFilters] = useState({ employee: "", company: "", incidentType: "", status: "", dateFrom: "", dateTo: "" });

  useEffect(() => {
    const handleModeChange = () => {
      const mode = getInitialMode();
      setActiveMode(mode);
      publishHeader(mode);
    };
    handleModeChange();
    window.addEventListener(INCIDENTS_MODE_EVENT, handleModeChange);
    return () => {
      window.removeEventListener(INCIDENTS_MODE_EVENT, handleModeChange);
      window.dispatchEvent(new CustomEvent(HEADER_EVENT, { detail: null }));
    };
  }, []);

  const incidentsWithEmployeeData = useMemo(() => {
    const employeeMap = Object.fromEntries(employees.map((employee) => [String(employee.id), employee]));
    return incidents.map((incident) => {
      const linkedEmployee = employeeMap[String(incident.employee_id)];
      return {
        ...incident,
        employee_code: linkedEmployee ? getEmployeeVisibleCode(linkedEmployee, employees, contracts, incident.company_id) : `${incident.company_id || "?"}.${incident.employee_id || "?"}`,
      };
    });
  }, [incidents, employees, contracts]);

  const summary = useMemo(() => ({
    total: incidentsWithEmployeeData.length,
    pending: incidentsWithEmployeeData.filter((item) => ["draft", "open", "pending"].includes(item.status) && !item.is_cancelled).length,
    processed: incidentsWithEmployeeData.filter((item) => item.processed_payroll_id || item.status === "processed").length,
    recalculate: incidentsWithEmployeeData.filter((item) => item.requires_recalculation).length,
    regularize: incidentsWithEmployeeData.filter((item) => item.requires_regularization).length,
  }), [incidentsWithEmployeeData]);

  const filteredIncidents = useMemo(() => {
    const employeeFilter = normalizeText(filters.employee);
    const companyFilter = normalizeText(filters.company);
    const typeFilter = normalizeText(filters.incidentType);
    const statusFilter = normalizeText(filters.status);
    const fromDate = dateToNumber(filters.dateFrom);
    const toDate = dateToNumber(filters.dateTo);
    const category = CATEGORY_TABS.find((tab) => tab.value === activeCategory);

    return incidentsWithEmployeeData.filter((incident) => {
      const center = workCenters.find((item) => Number(item.id) === Number(incident.center_id));
      const employeeText = normalizeText(`${incident.employee_code || ""} ${incident.employee_name || ""} ${incident.employee_id || ""}`);
      const companyText = normalizeText(`${incident.company_name || ""} ${center?.name || ""} ${incident.company_id || ""}`);
      const incidentStartDate = dateToNumber(incident.start_date);
      const incidentEndDate = dateToNumber(incident.end_date) || incidentStartDate;
      return (
        (!category?.types || category.types.includes(incident.incident_type))
        && (!employeeFilter || employeeText.includes(employeeFilter))
        && (!companyFilter || companyText.includes(companyFilter))
        && (!typeFilter || normalizeText(incident.incident_type) === typeFilter)
        && (!statusFilter || normalizeText(incident.status) === statusFilter)
        && (!fromDate || (incidentEndDate && incidentEndDate >= fromDate))
        && (!toDate || (incidentStartDate && incidentStartDate <= toDate))
      );
    });
  }, [incidentsWithEmployeeData, filters, workCenters, activeCategory]);

  if (activeMode === "embargo") {
    return <WageGarnishmentManagementPage companies={companies} employees={employees} contracts={contracts} payrolls={payrolls} />;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.summaryGrid}>
        <SummaryCard label="Incidencias registradas" value={summary.total} note="Histórico completo" />
        <SummaryCard label="Pendientes" value={summary.pending} note="Borrador, abiertas o pendientes" />
        <SummaryCard label="Procesadas" value={summary.processed} note="Vinculadas a nómina" />
        <SummaryCard label="Requieren recálculo" value={summary.recalculate} note="Resultado previo afectado" />
        <SummaryCard label="Regularización" value={summary.regularize} note="Existe nómina cerrada" />
      </div>

      <div style={styles.tabs} role="tablist" aria-label="Tipos de incidencias">
        {CATEGORY_TABS.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeCategory === tab.value} onClick={() => setActiveCategory(tab.value)} style={activeCategory === tab.value ? styles.activeTab : styles.tab}>{tab.label}</button>)}
      </div>

      <PageCard title="Registrar incidencia" subtitle="Selecciona trabajador y vida laboral; el backend comprobará vigencia, solapamientos y nóminas afectadas.">
        <IncidentForm form={incidentForm} employees={employees} contracts={contracts} companies={companies} workCenters={workCenters} onChange={onIncidentChange} onSubmit={onIncidentSubmit} error={incidentError} success={incidentSuccess} submitting={incidentSubmitting} />
      </PageCard>

      <PageCard title="Histórico de incidencias" subtitle="Los registros anulados y procesados se conservan para reconstrucción y auditoría.">
        <div style={styles.reportActions}>
          <button type="button" style={styles.reportButton} onClick={() => { const today = new Date(); openReportPreset({ category: "incident", reportId: "incidents-open", year: String(today.getFullYear()), month: String(today.getMonth() + 1).padStart(2, "0") }); }}>Informe del mes</button>
          <button type="button" style={styles.reportButtonSecondary} onClick={() => openReportPreset({ category: "incident", reportId: "incidents-all" })}>Histórico completo</button>
        </div>
        <div style={styles.filters}>
          <label>Trabajador<input name="employee" value={filters.employee} onChange={(event) => setFilters((prev) => ({ ...prev, employee: event.target.value }))} placeholder="Nombre, código o ID" /></label>
          <label>Empresa / centro<input name="company" value={filters.company} onChange={(event) => setFilters((prev) => ({ ...prev, company: event.target.value }))} placeholder="Empresa o centro" /></label>
          <label>Tipo<select name="incidentType" value={filters.incidentType} onChange={(event) => setFilters((prev) => ({ ...prev, incidentType: event.target.value }))}><option value="">Todos</option>{INCIDENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label>Estado<select name="status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}><option value="">Todos</option>{STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label>Desde<input type="date" name="dateFrom" value={filters.dateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} /></label>
          <label>Hasta<input type="date" name="dateTo" value={filters.dateTo} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))} /></label>
          <button type="button" onClick={() => setFilters({ employee: "", company: "", incidentType: "", status: "", dateFrom: "", dateTo: "" })} style={styles.clearButton}>Limpiar</button>
        </div>
        <div style={styles.resultInfo}>Mostrando {filteredIncidents.length} de {incidentsWithEmployeeData.length} incidencias</div>
        <IncidentTable loading={loading} incidents={filteredIncidents} contracts={contracts} employees={employees} onUpdateIncident={onUpdateIncident} onDeleteIncident={onDeleteIncident} submitting={incidentSubmitting} />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "18px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "10px" },
  summaryCard: { border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", padding: "12px", display: "flex", flexDirection: "column", gap: "3px" },
  tabs: { display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" },
  tab: { border: "1px solid #d1d5db", background: "#fff", borderRadius: "7px", padding: "8px 11px", whiteSpace: "nowrap", fontWeight: 800, cursor: "pointer" },
  activeTab: { border: "1px solid #111827", background: "#111827", color: "#fff", borderRadius: "7px", padding: "8px 11px", whiteSpace: "nowrap", fontWeight: 900, cursor: "pointer" },
  reportActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "12px" },
  reportButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "8px 11px", cursor: "pointer", fontWeight: 900 },
  reportButtonSecondary: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "8px 11px", cursor: "pointer", fontWeight: 900 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: "9px", alignItems: "end", marginBottom: "10px" },
  clearButton: { height: "36px", border: "1px solid #d1d5db", borderRadius: "7px", background: "#f3f4f6", fontWeight: 800, cursor: "pointer" },
  resultInfo: { marginBottom: "12px", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
};
