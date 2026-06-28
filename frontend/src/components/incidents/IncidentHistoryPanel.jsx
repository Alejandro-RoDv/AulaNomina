import { useMemo, useState } from "react";
import { filterIncidentHistory } from "../../utils/incidentWorkspace";
import { openReportPreset } from "../../utils/reportShortcuts";
import { INCIDENT_TYPES, STATUS_OPTIONS } from "./IncidentForm";
import IncidentTable from "./IncidentTableContent";

const EMPTY = { search: "", employeeId: "", companyId: "", centerId: "", agreementKey: "", incidentType: "", status: "", dateFrom: "", dateTo: "" };

export default function IncidentHistoryPanel({ loading, incidents, employees, companies, workCenters, contracts, onUpdateIncident, incidentSubmitting }) {
  const [filters, setFilters] = useState(EMPTY);
  const filtered = useMemo(() => filterIncidentHistory(incidents, filters), [incidents, filters]);
  const agreements = useMemo(() => {
    const map = new Map();
    incidents.forEach((item) => { if (item.agreement_key) map.set(String(item.agreement_key), item.agreement_name || item.agreement_key); });
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [incidents]);
  const change = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));

  return <section className="incident-workspace-panel incident-history-panel">
    <header><div><h2>Historial de incidencias</h2><p>Consulta global por trabajador, empresa, centro, convenio, tipo, estado y periodo.</p></div><div className="incident-history-actions"><button type="button" onClick={() => openReportPreset({ category: "incident", reportId: "incidents-all" })}>Informe completo</button><button type="button" onClick={() => setFilters(EMPTY)}>Limpiar filtros</button></div></header>
    <div className="incident-history-filters">
      <label className="wide">Búsqueda<input name="search" value={filters.search} onChange={change} placeholder="Trabajador, empresa, convenio, categoría…" /></label>
      <label>Trabajador<select name="employeeId" value={filters.employeeId} onChange={change}><option value="">Todos</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.employee_code || item.id} · {item.first_name} {item.last_name}</option>)}</select></label>
      <label>Empresa<select name="companyId" value={filters.companyId} onChange={change}><option value="">Todas</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Centro<select name="centerId" value={filters.centerId} onChange={change}><option value="">Todos</option>{workCenters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Convenio<select name="agreementKey" value={filters.agreementKey} onChange={change}><option value="">Todos</option>{agreements.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label>Tipo<select name="incidentType" value={filters.incidentType} onChange={change}><option value="">Todos</option>{INCIDENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Estado<select name="status" value={filters.status} onChange={change}><option value="">Todos</option>{STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Desde<input type="date" name="dateFrom" value={filters.dateFrom} onChange={change} /></label>
      <label>Hasta<input type="date" name="dateTo" value={filters.dateTo} onChange={change} /></label>
    </div>
    <div className="incident-history-result">Mostrando <strong>{filtered.length}</strong> de {incidents.length} incidencias</div>
    <IncidentTable loading={loading} incidents={filtered} contracts={contracts} employees={employees} onUpdateIncident={onUpdateIncident} submitting={incidentSubmitting} />
  </section>;
}
