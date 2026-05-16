import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import { generateAlerts } from "../utils/alertRules";

const ALERT_SEVERITY_LABELS = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const ALERT_SOURCE_LABELS = {
  document: "Documentos",
  contract: "Contratos",
  incident: "Incidencias",
  payroll: "Nóminas",
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value));
}

function formatPeriod(payroll) {
  if (!payroll) return "-";
  return `${String(payroll.period_month || "").padStart(2, "0")}/${payroll.period_year || ""}`;
}

function getEmployeeName(employee) {
  return `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim() || `Trabajador ${employee?.id || ""}`;
}

function getCompany(companies, id) {
  return companies.find((company) => Number(company.id) === Number(id));
}

function getCenter(workCenters, id) {
  return workCenters.find((center) => Number(center.id) === Number(id));
}

function getActiveContract(contracts, employeeId) {
  const employeeContracts = contracts.filter((contract) => Number(contract.employee_id) === Number(employeeId));
  return employeeContracts.find((contract) => contract.status === "active") || employeeContracts[0];
}

function getEmployeeCompany(employee, contracts, companies) {
  const activeContract = getActiveContract(contracts, employee.id);
  return getCompany(companies, activeContract?.company_id || employee.company_id);
}

function getEmployeeCenter(employee, contracts, workCenters) {
  const activeContract = getActiveContract(contracts, employee.id);
  return getCenter(workCenters, activeContract?.center_id || employee.center_id);
}

function payrollPeriodSortValue(payroll) {
  return Number(`${payroll.period_year || 0}${String(payroll.period_month || 0).padStart(2, "0")}`);
}

function getDocumentStatusStyle(status) {
  if (status === "received") return styles.receivedBadge;
  if (status === "expired") return styles.expiredBadge;
  if (status === "not_applicable") return styles.neutralBadge;
  return styles.pendingBadge;
}

function getDocumentStatusLabel(status) {
  const labels = {
    pending: "Pendiente",
    received: "Recibido",
    expired: "Caducado",
    not_applicable: "No aplica",
  };
  return labels[status] || status || "-";
}

function getIncidentLabel(type) {
  const labels = {
    IT: "IT / baja médica",
    RECAIDA: "Recaída",
    VACACIONES: "Vacaciones",
    AUSENCIA: "Ausencia",
    PERMISO_RETRIBUIDO: "Permiso retribuido",
    PERMISO_NO_RETRIBUIDO: "Permiso no retribuido",
  };
  return labels[type] || type || "-";
}

function getAlertSeverityStyle(severity) {
  if (severity === "critical") return styles.alertCritical;
  if (severity === "high") return styles.alertHigh;
  if (severity === "medium") return styles.alertMedium;
  return styles.alertLow;
}

export default function EmployeeRecordPage({ loading, employees, companies, workCenters, contracts, incidents, payrolls, documents }) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [filters, setFilters] = useState({ companyId: "", search: "", status: "" });

  useEffect(() => {
    const handleExternalOpenRecord = (event) => {
      const employeeId = event.detail?.employeeId;
      if (!employeeId) return;

      setSelectedEmployeeId(String(employeeId));
      window.sessionStorage.setItem("aulanomina:selectedEmployeeId", String(employeeId));
    };

    window.addEventListener("aulanomina-open-employee-record", handleExternalOpenRecord);

    return () => window.removeEventListener("aulanomina-open-employee-record", handleExternalOpenRecord);
  }, []);

  useEffect(() => {
    const storedEmployeeId = window.sessionStorage.getItem("aulanomina:selectedEmployeeId");
    const existsStoredEmployee = employees.some((employee) => String(employee.id) === String(storedEmployeeId));

    if (existsStoredEmployee) {
      setSelectedEmployeeId(String(storedEmployeeId));
      return;
    }

    if (!selectedEmployeeId && employees[0]?.id) {
      setSelectedEmployeeId(String(employees[0].id));
    }
  }, [employees, selectedEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const search = normalizeText(filters.search);

    return employees.filter((employee) => {
      const company = getEmployeeCompany(employee, contracts, companies);
      const center = getEmployeeCenter(employee, contracts, workCenters);
      const employeeText = normalizeText(`${employee.employee_code || ""} ${employee.dni || ""} ${employee.naf || ""} ${getEmployeeName(employee)}`);
      const matchesCompany = !filters.companyId || Number(company?.id) === Number(filters.companyId);
      const matchesStatus = !filters.status || String(employee.is_active) === filters.status;
      const matchesSearch = !search || employeeText.includes(search);

      return matchesCompany && matchesStatus && matchesSearch;
    });
  }, [employees, filters, contracts, companies, workCenters]);

  useEffect(() => {
    if (!filteredEmployees.length) return;
    const selectedVisible = filteredEmployees.some((employee) => String(employee.id) === String(selectedEmployeeId));

    if (!selectedVisible) {
      setSelectedEmployeeId(String(filteredEmployees[0].id));
    }
  }, [filteredEmployees, selectedEmployeeId]);

  const selectedEmployee = employees.find((employee) => String(employee.id) === String(selectedEmployeeId)) || filteredEmployees[0] || employees[0];

  const handleSelectEmployee = (employee) => {
    setSelectedEmployeeId(String(employee.id));
    window.sessionStorage.setItem("aulanomina:selectedEmployeeId", String(employee.id));
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => setFilters({ companyId: "", search: "", status: "" });

  const record = useMemo(() => {
    if (!selectedEmployee) return null;

    const activeContract = getActiveContract(contracts, selectedEmployee.id);
    const company = getCompany(companies, activeContract?.company_id || selectedEmployee.company_id);
    const center = getCenter(workCenters, activeContract?.center_id || selectedEmployee.center_id);
    const employeeDocuments = documents.filter((document) => Number(document.employee_id) === Number(selectedEmployee.id));
    const receivedDocuments = employeeDocuments.filter((document) => document.status === "received").length;
    const pendingDocuments = employeeDocuments.filter((document) => document.status === "pending").length;
    const employeeIncidents = incidents
      .filter((incident) => Number(incident.employee_id) === Number(selectedEmployee.id))
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));
    const openIncidents = employeeIncidents.filter((incident) => incident.status === "open");
    const employeePayrolls = payrolls
      .filter((payroll) => Number(payroll.employee_id) === Number(selectedEmployee.id))
      .sort((a, b) => payrollPeriodSortValue(b) - payrollPeriodSortValue(a));
    const latestPayroll = employeePayrolls[0];
    const employeeAlerts = generateAlerts({
      documents: employeeDocuments,
      contracts: contracts.filter((contract) => Number(contract.employee_id) === Number(selectedEmployee.id)),
      incidents: employeeIncidents,
      payrolls: employeePayrolls,
      employees,
      companies,
      workCenters,
    }).filter((alert) => Number(alert.employeeId) === Number(selectedEmployee.id));

    return {
      activeContract,
      company,
      center,
      employeeDocuments,
      receivedDocuments,
      pendingDocuments,
      employeeIncidents,
      openIncidents,
      employeePayrolls,
      latestPayroll,
      employeeAlerts,
    };
  }, [selectedEmployee, employees, companies, workCenters, contracts, incidents, payrolls, documents]);

  if (loading) return <p>Cargando expediente...</p>;

  if (!selectedEmployee || !record) {
    return (
      <PageCard title="Expediente laboral" subtitle="Ficha profesional integral del trabajador.">
        <p>No hay trabajadores disponibles.</p>
      </PageCard>
    );
  }

  return (
    <div style={styles.wrapper}>
      <PageCard title="Buscar trabajador" subtitle="Listado filtrable por empresa, estado, nombre, DNI, NAF o código. Selecciona un trabajador para abrir su expediente.">
        <div style={styles.filters}>
          <div style={styles.filterCompany}>
            <label style={styles.label}>Empresa</label>
            <select name="companyId" value={filters.companyId} onChange={handleFilterChange} style={styles.input}>
              <option value="">Todas</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </div>
          <div style={styles.filterSearch}>
            <label style={styles.label}>Buscar</label>
            <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Nombre, DNI, NAF o código" style={styles.input} />
          </div>
          <div style={styles.filterStatus}>
            <label style={styles.label}>Estado</label>
            <select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}>
              <option value="">Todos</option>
              <option value="true">Alta</option>
              <option value="false">Baja</option>
            </select>
          </div>
          <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar</button>
        </div>

        <div style={styles.employeeListWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>Trabajador</th>
                <th style={styles.th}>DNI</th>
                <th style={styles.th}>Empresa</th>
                <th style={styles.th}>Centro</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 && <tr><td style={styles.td} colSpan="7">No hay trabajadores que coincidan con los filtros.</td></tr>}
              {filteredEmployees.map((employee) => {
                const company = getEmployeeCompany(employee, contracts, companies);
                const center = getEmployeeCenter(employee, contracts, workCenters);
                const isSelected = String(employee.id) === String(selectedEmployee.id);

                return (
                  <tr key={employee.id} style={isSelected ? styles.selectedRow : undefined}>
                    <td style={styles.tdStrong}>{employee.employee_code || employee.id}</td>
                    <td style={styles.tdStrong}>{getEmployeeName(employee)}</td>
                    <td style={styles.td}>{employee.dni || "-"}</td>
                    <td style={styles.td}>{company?.name || "-"}</td>
                    <td style={styles.td}>{center?.name || "-"}</td>
                    <td style={styles.td}><span style={employee.is_active ? styles.activeBadgeSmall : styles.inactiveBadgeSmall}>{employee.is_active ? "Alta" : "Baja"}</span></td>
                    <td style={styles.td}><button type="button" onClick={() => handleSelectEmployee(employee)} style={isSelected ? styles.selectedButton : styles.openButton}>{isSelected ? "Abierto" : "Abrir"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageCard>

      <section style={styles.heroCard}>
        <div>
          <p style={styles.eyebrow}>EXPEDIENTE LABORAL</p>
          <h2 style={styles.heroTitle}>{getEmployeeName(selectedEmployee)}</h2>
          <p style={styles.heroSubtitle}>DNI: {selectedEmployee.dni || "-"} · NAF: {selectedEmployee.naf || "-"}</p>
        </div>
        <div style={styles.statusPanel}>
          <span style={selectedEmployee.is_active ? styles.activeBadgeLarge : styles.inactiveBadgeLarge}>{selectedEmployee.is_active ? "Alta" : "Baja"}</span>
          <strong>{record.company?.name || "Sin empresa"}</strong>
          <span>{record.center?.name || "Sin centro"}</span>
        </div>
      </section>

      <div style={styles.kpiGrid}>
        <div style={styles.kpi}><span>Contrato activo</span><strong>{record.activeContract?.contract_type || "No"}</strong></div>
        <div style={styles.kpi}><span>Estado documental</span><strong>{record.receivedDocuments}/{record.employeeDocuments.length}</strong></div>
        <div style={styles.kpi}><span>Última nómina</span><strong>{formatPeriod(record.latestPayroll)}</strong></div>
        <div style={styles.kpi}><span>Incidencias activas</span><strong>{record.openIncidents.length}</strong></div>
      </div>

      <PageCard title={`Alertas del expediente (${record.employeeAlerts.length})`} subtitle="Avisos generados automáticamente para este trabajador desde documentos, contratos, incidencias y nóminas.">
        {record.employeeAlerts.length === 0 && <p style={styles.emptyText}>Este expediente no tiene alertas activas.</p>}

        {record.employeeAlerts.length > 0 && (
          <div style={styles.alertGrid}>
            {record.employeeAlerts.map((alert) => (
              <article key={alert.id} style={styles.alertCard}>
                <div style={styles.alertHeader}>
                  <span style={{ ...styles.alertBadge, ...getAlertSeverityStyle(alert.severity) }}>
                    {ALERT_SEVERITY_LABELS[alert.severity] || alert.severity}
                  </span>
                  <span style={styles.alertSource}>{ALERT_SOURCE_LABELS[alert.source] || alert.source}</span>
                </div>
                <strong style={styles.alertTitle}>{alert.title}</strong>
                <p style={styles.alertDescription}>{alert.description}</p>
                <div style={styles.alertMeta}>
                  <span>{alert.status || "Revisión"}</span>
                  <span>{formatDate(alert.dueDate)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </PageCard>

      <div style={styles.gridTwoColumns}>
        <PageCard title="Datos personales" subtitle="Identificación y contacto.">
          <div style={styles.infoGrid}>
            <div><span>Código</span><strong>{selectedEmployee.employee_code || selectedEmployee.id}</strong></div>
            <div><span>DNI</span><strong>{selectedEmployee.dni || "-"}</strong></div>
            <div><span>NAF</span><strong>{selectedEmployee.naf || "-"}</strong></div>
            <div><span>Email</span><strong>{selectedEmployee.email || "-"}</strong></div>
            <div><span>Teléfono</span><strong>{selectedEmployee.phone || "-"}</strong></div>
            <div><span>Localidad</span><strong>{selectedEmployee.city || "-"}</strong></div>
            <div style={styles.fullWidth}><span>Dirección</span><strong>{selectedEmployee.address || "-"}</strong></div>
          </div>
        </PageCard>

        <PageCard title="Contrato activo" subtitle="Relación laboral principal del trabajador.">
          <div style={styles.infoGrid}>
            <div><span>Tipo</span><strong>{record.activeContract?.contract_type || "-"}</strong></div>
            <div><span>Estado</span><strong>{record.activeContract?.status || "-"}</strong></div>
            <div><span>Inicio</span><strong>{formatDate(record.activeContract?.start_date)}</strong></div>
            <div><span>Fin</span><strong>{formatDate(record.activeContract?.end_date)}</strong></div>
            <div><span>Empresa</span><strong>{record.company?.name || "-"}</strong></div>
            <div><span>Centro</span><strong>{record.center?.name || "-"}</strong></div>
            <div><span>Salario base</span><strong>{formatMoney(record.activeContract?.salary_base)}</strong></div>
          </div>
        </PageCard>
      </div>

      <PageCard title="Documentación" subtitle={`Recibidos ${record.receivedDocuments}. Pendientes ${record.pendingDocuments}.`}>
        <table style={styles.table}>
          <thead>
            <tr><th style={styles.th}>Documento</th><th style={styles.th}>Tipo</th><th style={styles.th}>Estado</th><th style={styles.th}>Caducidad</th></tr>
          </thead>
          <tbody>
            {record.employeeDocuments.length === 0 && <tr><td style={styles.td} colSpan="4">Sin documentación registrada.</td></tr>}
            {record.employeeDocuments.map((document) => (
              <tr key={document.id}>
                <td style={styles.tdStrong}>{document.document_name}</td>
                <td style={styles.td}>{document.document_type}</td>
                <td style={styles.td}><span style={getDocumentStatusStyle(document.status)}>{getDocumentStatusLabel(document.status)}</span></td>
                <td style={styles.td}>{formatDate(document.expiry_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PageCard>

      <div style={styles.gridTwoColumns}>
        <PageCard title="Incidencias" subtitle="IT, vacaciones, ausencias y permisos.">
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Tipo</th><th style={styles.th}>Desde</th><th style={styles.th}>Hasta</th><th style={styles.th}>Estado</th></tr>
            </thead>
            <tbody>
              {record.employeeIncidents.length === 0 && <tr><td style={styles.td} colSpan="4">Sin incidencias registradas.</td></tr>}
              {record.employeeIncidents.slice(0, 6).map((incident) => (
                <tr key={incident.id}>
                  <td style={styles.tdStrong}>{getIncidentLabel(incident.incident_type)}</td>
                  <td style={styles.td}>{formatDate(incident.start_date)}</td>
                  <td style={styles.td}>{formatDate(incident.end_date)}</td>
                  <td style={styles.td}>{incident.status === "open" ? "Abierta" : "Cerrada"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PageCard>

        <PageCard title="Nóminas" subtitle="Últimas nóminas generadas.">
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Periodo</th><th style={styles.th}>Bruto</th><th style={styles.th}>Neto</th><th style={styles.th}>Estado</th></tr>
            </thead>
            <tbody>
              {record.employeePayrolls.length === 0 && <tr><td style={styles.td} colSpan="4">Sin nóminas generadas.</td></tr>}
              {record.employeePayrolls.slice(0, 6).map((payroll) => (
                <tr key={payroll.id}>
                  <td style={styles.tdStrong}>{formatPeriod(payroll)}</td>
                  <td style={styles.td}>{formatMoney(payroll.gross_salary)}</td>
                  <td style={styles.td}>{formatMoney(payroll.net_salary)}</td>
                  <td style={styles.td}>{payroll.status || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PageCard>
      </div>

      <PageCard title="Documentos generados" subtitle="Preparado para conectar con el motor HTML/PDF del módulo Informes.">
        <div style={styles.generatedGrid}>
          <div><strong>Expediente laboral HTML</strong><span>Disponible desde Informes</span></div>
          <div><strong>Checklist documental</strong><span>Disponible desde Informes</span></div>
          <div><strong>Contrato simulado</strong><span>Disponible desde Informes</span></div>
          <div><strong>Informe de incidencias</strong><span>Disponible desde Informes</span></div>
        </div>
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  filters: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(280px, 1.5fr) 140px 90px", gap: "12px", alignItems: "end", marginBottom: "16px" },
  filterCompany: { display: "flex", flexDirection: "column", gap: "6px" },
  filterSearch: { display: "flex", flexDirection: "column", gap: "6px" },
  filterStatus: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: 800, color: "#374151" },
  input: { height: "39px", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box" },
  clearButton: { height: "39px", backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "8px 10px", cursor: "pointer", fontWeight: 800 },
  employeeListWrapper: { maxHeight: "320px", overflowY: "auto", border: "1px solid #d1d5db" },
  selectedRow: { backgroundColor: "#fffdf0" },
  openButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", padding: "7px 10px", cursor: "pointer", fontWeight: 900 },
  selectedButton: { backgroundColor: "#f8f3b5", color: "#111827", border: "1px solid #111827", padding: "7px 10px", cursor: "pointer", fontWeight: 900 },
  heroCard: { border: "3px solid #111", backgroundColor: "#fff", boxShadow: "6px 6px 0 #f5ef9c", padding: "24px", display: "flex", justifyContent: "space-between", gap: "24px", alignItems: "center" },
  eyebrow: { margin: "0 0 8px", fontSize: "12px", fontWeight: 950, letterSpacing: "0.08em", color: "#92400e" },
  heroTitle: { margin: 0, fontSize: "30px", fontWeight: 950, color: "#111" },
  heroSubtitle: { margin: "8px 0 0", color: "#4b5563", fontWeight: 800 },
  statusPanel: { border: "2px solid #111", padding: "12px", display: "flex", flexDirection: "column", gap: "6px", minWidth: "260px", backgroundColor: "#fffdf0" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" },
  kpi: { border: "2px solid #111", backgroundColor: "#fff", boxShadow: "4px 4px 0 #f5ef9c", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" },
  alertGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  alertCard: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "13px", display: "flex", flexDirection: "column", gap: "7px" },
  alertHeader: { display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" },
  alertBadge: { borderRadius: "999px", padding: "4px 8px", fontSize: "11px", fontWeight: 950, textTransform: "uppercase" },
  alertCritical: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
  alertHigh: { backgroundColor: "#ffedd5", color: "#9a3412", border: "1px solid #fed7aa" },
  alertMedium: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" },
  alertLow: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  alertSource: { color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  alertTitle: { color: "#111827", fontSize: "14px", fontWeight: 950, lineHeight: 1.25 },
  alertDescription: { margin: 0, color: "#4b5563", fontSize: "13px", fontWeight: 650, lineHeight: 1.35 },
  alertMeta: { display: "flex", justifyContent: "space-between", gap: "10px", color: "#6b7280", fontSize: "12px", fontWeight: 900, textTransform: "uppercase" },
  emptyText: { margin: 0, color: "#6b7280", fontSize: "14px", fontWeight: 750 },
  gridTwoColumns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  fullWidth: { gridColumn: "1 / -1" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", borderBottom: "2px solid #111", padding: "10px", backgroundColor: "#f8f3b5", fontWeight: 900, position: "sticky", top: 0, zIndex: 1 },
  td: { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "middle" },
  tdStrong: { borderBottom: "1px solid #e5e7eb", padding: "10px", fontWeight: 900, verticalAlign: "middle" },
  activeBadgeSmall: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "4px 8px", fontWeight: 900 },
  inactiveBadgeSmall: { backgroundColor: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db", padding: "4px 8px", fontWeight: 900 },
  activeBadgeLarge: { width: "fit-content", backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "5px 9px", fontWeight: 950 },
  inactiveBadgeLarge: { width: "fit-content", backgroundColor: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db", padding: "5px 9px", fontWeight: 950 },
  receivedBadge: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac", padding: "4px 8px", fontWeight: 900 },
  pendingBadge: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", padding: "4px 8px", fontWeight: 900 },
  expiredBadge: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", padding: "4px 8px", fontWeight: 900 },
  neutralBadge: { backgroundColor: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db", padding: "4px 8px", fontWeight: 900 },
  generatedGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
};
