import { useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import EmployeeForm from "../components/employees/EmployeeForm";
import EmployeeTable from "../components/employees/EmployeeTable";

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
  contracts,
  incidents,
  employeeForm,
  onEmployeeChange,
  onEmployeeSubmit,
  onUpdateEmployee,
  onDeleteEmployee,
  employeeError,
  employeeSuccess,
  employeeSubmitting,
}) {
  const [filters, setFilters] = useState({
    id: "",
    name: "",
    dni: "",
  });

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ id: "", name: "", dni: "" });
  };

  const filteredEmployees = useMemo(() => {
    const idFilter = normalizeText(filters.id);
    const nameFilter = normalizeText(filters.name);
    const dniFilter = normalizeText(filters.dni);

    return employees.filter((employee) => {
      const employeeId = normalizeText(employee.employee_code || employee.id);
      const fullName = normalizeText(`${employee.first_name} ${employee.last_name}`);
      const dni = normalizeText(employee.dni);

      const matchesId = !idFilter || employeeId.includes(idFilter) || String(employee.id).includes(idFilter);
      const matchesName = !nameFilter || fullName.includes(nameFilter);
      const matchesDni = !dniFilter || dni.includes(dniFilter);

      return matchesId && matchesName && matchesDni;
    });
  }, [employees, filters]);

  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Nuevo trabajador"
        subtitle="Crea un trabajador para vincularlo después a contratos, nóminas e incidencias."
      >
        <EmployeeForm
          form={employeeForm}
          companies={companies}
          onChange={onEmployeeChange}
          onSubmit={onEmployeeSubmit}
          error={employeeError}
          success={employeeSuccess}
          submitting={employeeSubmitting}
        />
      </PageCard>

      <PageCard
        title="Listado de trabajadores"
        subtitle="Trabajadores registrados actualmente en AulaNomina."
      >
        <div style={styles.filters}>
          <div style={styles.filterGroupCode}>
            <label>ID / Código</label>
            <input
              name="id"
              value={filters.id}
              onChange={handleFilterChange}
              placeholder="Ej. EMP006"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroupName}>
            <label>Nombre y apellidos</label>
            <input
              name="name"
              value={filters.name}
              onChange={handleFilterChange}
              placeholder="Ej. Alejandro Pérez"
              style={styles.input}
            />
          </div>

          <div style={styles.filterGroupDni}>
            <label>DNI</label>
            <input
              name="dni"
              value={filters.dni}
              onChange={handleFilterChange}
              placeholder="Ej. 35012145F"
              style={styles.input}
            />
          </div>

          <button type="button" onClick={clearFilters} style={styles.clearButton}>
            Limpiar filtros
          </button>
        </div>

        <EmployeeTable
          loading={loading}
          employees={filteredEmployees}
          companies={companies}
          contracts={contracts}
          incidents={incidents}
          onUpdateEmployee={onUpdateEmployee}
          onDeleteEmployee={onDeleteEmployee}
          submitting={employeeSubmitting}
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
    display: "flex",
    gap: "14px",
    alignItems: "end",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  filterGroupCode: {
    width: "220px",
    flex: "0 0 220px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  filterGroupName: {
    width: "360px",
    flex: "0 0 360px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  filterGroupDni: {
    width: "240px",
    flex: "0 0 240px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
  },
  clearButton: {
    backgroundColor: "#f3f4f6",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
};
