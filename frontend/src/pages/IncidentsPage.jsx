import { useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import IncidentForm, { INCIDENT_TYPES, STATUS_OPTIONS } from "../components/incidents/IncidentForm";
import IncidentTable from "../components/incidents/IncidentTable";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function dateToNumber(value) {
  if (!value) return null;
  return Number(String(value).replaceAll("-", ""));
}

export default function IncidentsPage({
  loading,
  incidents,
  employees,
  contracts,
  companies,
  incidentForm,
  onIncidentChange,
  onIncidentSubmit,
  onUpdateIncident,
  onDeleteIncident,
  incidentError,
  incidentSuccess,
  incidentSubmitting,
}) {
  const [filters, setFilters] = useState({
    employee: "",
    company: "",
    incidentType: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      employee: "",
      company: "",
      incidentType: "",
      status: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const filteredIncidents = useMemo(() => {
    const employeeFilter = normalizeText(filters.employee);
    const companyFilter = normalizeText(filters.company);
    const typeFilter = normalizeText(filters.incidentType);
    const statusFilter = normalizeText(filters.status);
    const fromDate = dateToNumber(filters.dateFrom);
    const toDate = dateToNumber(filters.dateTo);

    return incidents.filter((incident) => {
      const employeeText = normalizeText(`${incident.employee_name || ""} ${incident.employee_id || ""}`);
      const companyText = normalizeText(`${incident.company_name || ""} ${incident.company_id || ""}`);
      const typeText = normalizeText(incident.incident_type);
      const statusText = normalizeText(incident.status);
      const incidentStartDate = dateToNumber(incident.start_date);
      const incidentEndDate = dateToNumber(incident.end_date) || incidentStartDate;

      const matchesEmployee = !employeeFilter || employeeText.includes(employeeFilter);
      const matchesCompany = !companyFilter || companyText.includes(companyFilter);
      const matchesType = !typeFilter || typeText === typeFilter;
      const matchesStatus = !statusFilter || statusText === statusFilter;
      const matchesFromDate = !fromDate || (incidentEndDate && incidentEndDate >= fromDate);
      const matchesToDate = !toDate || (incidentStartDate && incidentStartDate <= toDate);

      return matchesEmployee && matchesCompany && matchesType && matchesStatus && matchesFromDate && matchesToDate;
    });
  }, [incidents, filters]);

  return (
    <div style={styles.wrapper}>
      <PageCard title="Nueva incidencia" subtitle="Registra una incidencia laboral vinculada a trabajador, contrato y empresa.">
        <IncidentForm
          form={incidentForm}
          employees={employees}
          contracts={contracts}
          companies={companies}
          onChange={onIncidentChange}
          onSubmit={onIncidentSubmit}
          error={incidentError}
          success={incidentSuccess}
          submitting={incidentSubmitting}
        />
      </PageCard>

      <PageCard title="Listado de incidencias" subtitle="Histórico de incidencias laborales registradas en el sistema.">
        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <label>Trabajador</label>
            <input
              name="employee"
              value={filters.employee}
              onChange={handleFilterChange}
              placeholder="Nombre o ID"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroup}>
            <label>Empresa</label>
            <input
              name="company"
              value={filters.company}
              onChange={handleFilterChange}
              placeholder="Empresa o ID"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroup}>
            <label>Tipo</label>
            <select
              name="incidentType"
              value={filters.incidentType}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              {INCIDENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label>Estado</label>
            <select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label>Desde</label>
            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroup}>
            <label>Hasta</label>
            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
              style={styles.input}
            />
          </div>

          <button type="button" onClick={clearFilters} style={styles.clearButton}>
            Limpiar filtros
          </button>
        </div>

        <div style={styles.resultInfo}>
          Mostrando {filteredIncidents.length} de {incidents.length} incidencias
        </div>

        <IncidentTable
          loading={loading}
          incidents={filteredIncidents}
          onUpdateIncident={onUpdateIncident}
          onDeleteIncident={onDeleteIncident}
          submitting={incidentSubmitting}
        />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) 220px 160px 150px 150px 124px",
    columnGap: "14px",
    rowGap: "10px",
    alignItems: "end",
    marginBottom: "10px",
  },
  filterGroup: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
  },
  clearButton: {
    width: "100%",
    backgroundColor: "#f3f4f6",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  resultInfo: {
    marginBottom: "16px",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: 700,
  },
};
