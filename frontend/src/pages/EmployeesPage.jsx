import { useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import EmployeeForm from "../components/employees/EmployeeForm";
import EmployeeTable from "../components/employees/EmployeeTable";
import { openReportPreset } from "../utils/reportShortcuts";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function TabButton({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={active ? styles.tabButtonActive : styles.tabButton}>
      {children}
    </button>
  );
}

export default function EmployeesPage({
  loading,
  employees,
  companies,
  workCenters,
  contracts,
  incidents,
  payrolls,
  employeeForm,
  onEmployeeChange,
  onEmployeeSubmit,
  onUpdateEmployee,
  onDeleteEmployee,
  onOpenRecord,
  employeeError,
  employeeSuccess,
  employeeSubmitting,
}) {
  const [activeSection, setActiveSection] = useState("new");
  const [recordEmployeeId, setRecordEmployeeId] = useState("");
  const [filters, setFilters] = useState({ id: "", name: "", dni: "", companyId: "", centerId: "", status: "" });

  const companyMap = useMemo(() => companies.reduce((acc, company) => ({ ...acc, [company.id]: company }), {}), [companies]);
  const centerMap = useMemo(() => workCenters.reduce((acc, center) => ({ ...acc, [center.id]: center }), {}), [workCenters]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: name === "companyId" ? value : value, ...(name === "companyId" ? { centerId: "" } : {}) }));
  };

  const clearFilters = () => setFilters({ id: "", name: "", dni: "", companyId: "", centerId: "", status: "" });

  const availableFilterCenters = useMemo(() => {
    return workCenters.filter((center) => !filters.companyId || String(center.company_id) === String(filters.companyId));
  }, [workCenters, filters.companyId]);

  const filteredEmployees = useMemo(() => {
    const idFilter = normalizeText(filters.id);
    const nameFilter = normalizeText(filters.name);
    const dniFilter = normalizeText(filters.dni);

    return employees.filter((employee) => {
      const employeeId = normalizeText(employee.employee_code || employee.id);
      const fullName = normalizeText(`${employee.first_name} ${employee.last_name} ${employee.second_last_name || ""}`);
      const dni = normalizeText(employee.dni);
      const activeContract = contracts.find((contract) => Number(contract.employee_id) === Number(employee.id) && contract.status === "active") || contracts.find((contract) => Number(contract.employee_id) === Number(employee.id));
      const companyId = activeContract?.company_id || employee.company_id;
      const centerId = activeContract?.center_id || employee.center_id;
      const status = employee.is_active ? "active" : "inactive";

      return (
        (!idFilter || employeeId.includes(idFilter) || String(employee.id).includes(idFilter)) &&
        (!nameFilter || fullName.includes(nameFilter)) &&
        (!dniFilter || dni.includes(dniFilter)) &&
        (!filters.companyId || String(companyId) === String(filters.companyId)) &&
        (!filters.centerId || String(centerId) === String(filters.centerId)) &&
        (!filters.status || status === filters.status)
      );
    });
  }, [employees, contracts, filters]);

  const selectedRecordEmployee = employees.find((employee) => String(employee.id) === String(recordEmployeeId));
  const selectedEmployeeContracts = selectedRecordEmployee
    ? contracts.filter((contract) => Number(contract.employee_id) === Number(selectedRecordEmployee.id))
    : [];
  const selectedEmployeeIncidents = selectedRecordEmployee
    ? incidents.filter((incident) => Number(incident.employee_id) === Number(selectedRecordEmployee.id))
    : [];
  const selectedEmployeePayrolls = selectedRecordEmployee
    ? payrolls.filter((payroll) => Number(payroll.employee_id) === Number(selectedRecordEmployee.id))
    : [];

  return (
    <div style={styles.wrapper}>
      <div style={styles.tabs}>
        <TabButton active={activeSection === "new"} onClick={() => setActiveSection("new")}>Nuevo trabajador</TabButton>
        <TabButton active={activeSection === "list"} onClick={() => setActiveSection("list")}>Listado trabajadores</TabButton>
        <TabButton active={activeSection === "record"} onClick={() => setActiveSection("record")}>Expediente</TabButton>
      </div>

      {activeSection === "new" && (
        <PageCard title="Nuevo trabajador" subtitle="Alta de datos personales, contacto, formación, representante y observaciones. El alta laboral se gestiona desde Contratación.">
          <EmployeeForm form={employeeForm} companies={companies} workCenters={workCenters} employees={employees} contracts={contracts} onChange={onEmployeeChange} onSubmit={onEmployeeSubmit} error={employeeError} success={employeeSuccess} submitting={employeeSubmitting} />
        </PageCard>
      )}

      {activeSection === "list" && (
        <PageCard title="Listado de trabajadores" subtitle="Consulta operativa con filtros por código, documento, empresa, centro y estado.">
          <div style={styles.reportActions}>
            <button type="button" style={styles.reportButton} onClick={() => openReportPreset({ category: "employee", reportId: "employees-active" })}>Informe trabajadores en alta</button>
            <button type="button" style={styles.reportButtonSecondary} onClick={() => openReportPreset({ category: "employee", reportId: "contracts-active" })}>Informe contratos activos</button>
          </div>

          <div style={styles.filters}>
            <div style={styles.filterGroupCode}>
              <label>Código trabajador</label>
              <input name="id" value={filters.id} onChange={handleFilterChange} style={styles.input} />
            </div>
            <div style={styles.filterGroupName}>
              <label>Nombre y apellidos</label>
              <input name="name" value={filters.name} onChange={handleFilterChange} style={styles.input} />
            </div>
            <div style={styles.filterGroupDni}>
              <label>Documento</label>
              <input name="dni" value={filters.dni} onChange={handleFilterChange} style={styles.input} />
            </div>
            <div style={styles.filterGroupSelect}>
              <label>Empresa</label>
              <select name="companyId" value={filters.companyId} onChange={handleFilterChange} style={styles.input}>
                <option value="">Todas</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </div>
            <div style={styles.filterGroupSelect}>
              <label>Centro</label>
              <select name="centerId" value={filters.centerId} onChange={handleFilterChange} style={styles.input} disabled={!filters.companyId}>
                <option value="">Todos</option>
                {availableFilterCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </select>
            </div>
            <div style={styles.filterGroupStatus}>
              <label>Estado</label>
              <select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}>
                <option value="">Todos</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
            <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar filtros</button>
          </div>

          <EmployeeTable loading={loading} employees={filteredEmployees} companies={companies} workCenters={workCenters} contracts={contracts} incidents={incidents} payrolls={payrolls} onUpdateEmployee={onUpdateEmployee} onDeleteEmployee={onDeleteEmployee} onOpenRecord={onOpenRecord} submitting={employeeSubmitting} />
        </PageCard>
      )}

      {activeSection === "record" && (
        <PageCard title="Expediente del trabajador" subtitle="Vista resumen del expediente personal, contratos, incidencias y nóminas asociadas.">
          <div style={styles.recordSelector}>
            <label>Trabajador</label>
            <select value={recordEmployeeId} onChange={(event) => setRecordEmployeeId(event.target.value)} style={styles.input}>
              <option value="">Seleccionar trabajador</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} {employee.second_last_name || ""} · {employee.dni}</option>
              ))}
            </select>
          </div>

          {!selectedRecordEmployee ? (
            <p style={styles.empty}>Selecciona un trabajador para consultar su expediente.</p>
          ) : (
            <div style={styles.recordGrid}>
              <div style={styles.recordPanel}>
                <h3 style={styles.panelTitle}>Datos personales</h3>
                <div style={styles.detailGrid}>
                  <div><span>Código</span><strong>{selectedRecordEmployee.employee_code || "-"}</strong></div>
                  <div><span>Documento</span><strong>{selectedRecordEmployee.dni || "-"}</strong></div>
                  <div><span>Nombre</span><strong>{selectedRecordEmployee.first_name} {selectedRecordEmployee.last_name} {selectedRecordEmployee.second_last_name || ""}</strong></div>
                  <div><span>Sexo</span><strong>{selectedRecordEmployee.sex || "-"}</strong></div>
                  <div><span>Nacimiento</span><strong>{selectedRecordEmployee.birth_date || "-"}</strong></div>
                  <div><span>Nacionalidad</span><strong>{selectedRecordEmployee.nationality || "-"}</strong></div>
                  <div><span>Empresa</span><strong>{companyMap[selectedRecordEmployee.company_id]?.name || "-"}</strong></div>
                  <div><span>Centro</span><strong>{centerMap[selectedRecordEmployee.center_id]?.name || "-"}</strong></div>
                </div>
              </div>

              <div style={styles.recordPanel}>
                <h3 style={styles.panelTitle}>Contacto</h3>
                <div style={styles.detailGrid}>
                  <div><span>Email</span><strong>{selectedRecordEmployee.email || "-"}</strong></div>
                  <div><span>Móvil</span><strong>{selectedRecordEmployee.mobile_phone || selectedRecordEmployee.phone || "-"}</strong></div>
                  <div><span>Fijo</span><strong>{selectedRecordEmployee.landline_phone || "-"}</strong></div>
                  <div><span>CP</span><strong>{selectedRecordEmployee.postal_code || "-"}</strong></div>
                  <div style={styles.detailWide}><span>Domicilio</span><strong>{selectedRecordEmployee.domicile || selectedRecordEmployee.address || "-"}</strong></div>
                </div>
              </div>

              <div style={styles.recordPanel}>
                <h3 style={styles.panelTitle}>Formación</h3>
                <div style={styles.detailGrid}>
                  <div><span>Nivel</span><strong>{selectedRecordEmployee.education_level || "-"}</strong></div>
                  <div><span>Título</span><strong>{selectedRecordEmployee.academic_title || "-"}</strong></div>
                  <div><span>Profesión</span><strong>{selectedRecordEmployee.main_profession || "-"}</strong></div>
                  <div><span>Idiomas</span><strong>{selectedRecordEmployee.languages || "-"}</strong></div>
                </div>
              </div>

              <div style={styles.recordPanel}>
                <h3 style={styles.panelTitle}>Resumen laboral</h3>
                <div style={styles.kpiRow}>
                  <div style={styles.kpiBox}><span>Contratos</span><strong>{selectedEmployeeContracts.length}</strong></div>
                  <div style={styles.kpiBox}><span>Incidencias</span><strong>{selectedEmployeeIncidents.length}</strong></div>
                  <div style={styles.kpiBox}><span>Nóminas</span><strong>{selectedEmployeePayrolls.length}</strong></div>
                </div>
              </div>

              <div style={styles.recordPanelWide}>
                <h3 style={styles.panelTitle}>Observaciones</h3>
                <p style={styles.observations}>{selectedRecordEmployee.observations || "Sin observaciones registradas."}</p>
              </div>
            </div>
          )}
        </PageCard>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  tabs: { display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px" },
  tabButton: { backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  tabButtonActive: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  reportActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "14px", flexWrap: "wrap" },
  reportButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  reportButtonSecondary: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  filters: { display: "flex", gap: "14px", alignItems: "end", flexWrap: "wrap", marginBottom: "18px" },
  filterGroupCode: { width: "180px", flex: "0 0 180px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupName: { width: "300px", flex: "0 0 300px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupDni: { width: "190px", flex: "0 0 190px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupSelect: { width: "230px", flex: "0 0 230px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupStatus: { width: "150px", flex: "0 0 150px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" },
  clearButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 700 },
  empty: { margin: 0, color: "#6b7280", fontSize: "14px" },
  recordSelector: { display: "flex", flexDirection: "column", gap: "6px", maxWidth: "520px", marginBottom: "18px" },
  recordGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  recordPanel: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  recordPanelWide: { gridColumn: "1 / -1", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  panelTitle: { margin: "0 0 12px", fontSize: "15px", fontWeight: 900, color: "#111827" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" },
  detailWide: { gridColumn: "1 / -1" },
  kpiRow: { display: "flex", gap: "12px", flexWrap: "wrap" },
  kpiBox: { flex: 1, minWidth: "120px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" },
  observations: { margin: 0, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap" },
};
