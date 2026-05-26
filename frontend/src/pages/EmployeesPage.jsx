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
  const [filters, setFilters] = useState({ id: "", name: "", dni: "" });

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => setFilters({ id: "", name: "", dni: "" });

  const filteredEmployees = useMemo(() => {
    const idFilter = normalizeText(filters.id);
    const nameFilter = normalizeText(filters.name);
    const dniFilter = normalizeText(filters.dni);

    return employees.filter((employee) => {
      const employeeId = normalizeText(employee.employee_code || employee.id);
      const fullName = normalizeText(`${employee.first_name} ${employee.last_name}`);
      const dni = normalizeText(employee.dni);

      return (
        (!idFilter || employeeId.includes(idFilter) || String(employee.id).includes(idFilter)) &&
        (!nameFilter || fullName.includes(nameFilter)) &&
        (!dniFilter || dni.includes(dniFilter))
      );
    });
  }, [employees, filters]);

  return (
    <div style={styles.wrapper}>
      <PageCard title="Trabajadores" subtitle="Crea un trabajador con empresa y centro. El alta laboral se gestionará desde Contratación.">
        <EmployeeForm form={employeeForm} companies={companies} workCenters={workCenters} employees={employees} contracts={contracts} onChange={onEmployeeChange} onSubmit={onEmployeeSubmit} error={employeeError} success={employeeSuccess} submitting={employeeSubmitting} />
      </PageCard>

      <PageCard title="Listado de trabajadores" subtitle="Listado operativo de trabajadores. El expediente queda como sección en desarrollo.">
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
            <label>DNI</label>
            <input name="dni" value={filters.dni} onChange={handleFilterChange} style={styles.input} />
          </div>
          <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar filtros</button>
        </div>

        <EmployeeTable loading={loading} employees={filteredEmployees} companies={companies} workCenters={workCenters} contracts={contracts} incidents={incidents} payrolls={payrolls} onUpdateEmployee={onUpdateEmployee} onDeleteEmployee={onDeleteEmployee} onOpenRecord={onOpenRecord} submitting={employeeSubmitting} />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  reportActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "14px" },
  reportButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  reportButtonSecondary: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  filters: { display: "flex", gap: "14px", alignItems: "end", flexWrap: "wrap", marginBottom: "18px" },
  filterGroupCode: { width: "220px", flex: "0 0 220px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupName: { width: "360px", flex: "0 0 360px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupDni: { width: "240px", flex: "0 0 240px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  clearButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 700 },
};