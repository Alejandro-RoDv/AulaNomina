import { useMemo, useState } from "react";

export default function ContractForm({
  form,
  employees,
  companies,
  onChange,
  onSubmit,
  error,
  success,
  submitting,
}) {
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeFilters, setEmployeeFilters] = useState({ name: "", dni: "", id: "" });

  const selectedEmployee = employees.find((emp) => String(emp.id) === String(form.employee_id));

  const filteredEmployees = useMemo(() => {
    const nameFilter = employeeFilters.name.trim().toLowerCase();
    const dniFilter = employeeFilters.dni.trim().toLowerCase();
    const idFilter = employeeFilters.id.trim();

    return employees.filter((emp) => {
      const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
      const dni = `${emp.dni || ""}`.toLowerCase();
      const id = String(emp.id);

      return (
        (!nameFilter || fullName.includes(nameFilter)) &&
        (!dniFilter || dni.includes(dniFilter)) &&
        (!idFilter || id.includes(idFilter))
      );
    });
  }, [employees, employeeFilters]);

  const handleEmployeeFilterChange = (event) => {
    const { name, value } = event.target;
    setEmployeeFilters((prev) => ({ ...prev, [name]: value }));
  };

  const selectEmployee = (employee) => {
    onChange({ target: { name: "employee_id", value: String(employee.id) } });
    setEmployeeModalOpen(false);
  };

  return (
    <>
      <form onSubmit={onSubmit} style={styles.form}>
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Empleado</label>
            <div style={styles.selectorBox}>
              <div>
                <div style={styles.selectorValue}>
                  {selectedEmployee
                    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
                    : "Selecciona un empleado"}
                </div>
                {selectedEmployee && (
                  <div style={styles.selectorMeta}>
                    ID {selectedEmployee.id} · DNI {selectedEmployee.dni || "-"}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEmployeeModalOpen(true)}
                style={styles.secondaryButton}
              >
                Buscar
              </button>
            </div>
            <input type="hidden" name="employee_id" value={form.employee_id} required />
          </div>

          <div style={styles.formGroup}>
            <label>Empresa / centro</label>
            <select
              name="company_id"
              value={form.company_id}
              onChange={onChange}
              required
              style={styles.input}
            >
              <option value="">Selecciona una empresa o centro</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} {company.ccc ? `· CCC ${company.ccc}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Tipo de contrato</label>
            <select
              name="contract_type"
              value={form.contract_type}
              onChange={onChange}
              required
              style={styles.input}
            >
              <option value="">Selecciona tipo</option>
              <option value="indefinido">Indefinido</option>
              <option value="temporal">Temporal</option>
              <option value="practicas">Prácticas</option>
              <option value="formacion">Formación</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label>Fecha inicio</label>
            <input
              type="date"
              name="start_date"
              value={form.start_date}
              onChange={onChange}
              required
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Fecha fin</label>
            <input
              type="date"
              name="end_date"
              value={form.end_date}
              onChange={onChange}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label>Salario base</label>
            <input
              type="number"
              name="salary_base"
              value={form.salary_base}
              onChange={onChange}
              placeholder="Ej. 18000"
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Estado</label>
            <select
              name="status"
              value={form.status}
              onChange={onChange}
              style={styles.input}
            >
              <option value="active">Activo</option>
              <option value="ended">Finalizado</option>
            </select>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <button type="submit" disabled={submitting} style={styles.button}>
          {submitting ? "Guardando..." : "Crear contrato"}
        </button>
      </form>

      {employeeModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Seleccionar trabajador</h3>
                <p style={styles.modalSubtitle}>Filtra por nombre, DNI o ID.</p>
              </div>
              <button
                type="button"
                onClick={() => setEmployeeModalOpen(false)}
                style={styles.closeButton}
              >
                Cerrar
              </button>
            </div>

            <div style={styles.filterRow}>
              <input
                name="name"
                value={employeeFilters.name}
                onChange={handleEmployeeFilterChange}
                placeholder="Nombre o apellidos"
                style={styles.input}
              />
              <input
                name="dni"
                value={employeeFilters.dni}
                onChange={handleEmployeeFilterChange}
                placeholder="DNI"
                style={styles.input}
              />
              <input
                name="id"
                value={employeeFilters.id}
                onChange={handleEmployeeFilterChange}
                placeholder="ID"
                style={styles.input}
              />
            </div>

            <div style={styles.modalTableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Trabajador</th>
                    <th style={styles.th}>DNI</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td style={styles.td}>{emp.id}</td>
                      <td style={styles.td}>{emp.first_name} {emp.last_name}</td>
                      <td style={styles.td}>{emp.dni || "-"}</td>
                      <td style={styles.tdRight}>
                        <button
                          type="button"
                          onClick={() => selectEmployee(emp)}
                          style={styles.smallButton}
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td style={styles.td} colSpan="4">No hay trabajadores con esos filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formRow: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
  },
  formGroup: {
    flex: 1,
    minWidth: "220px",
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
  selectorBox: {
    minHeight: "42px",
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  selectorValue: {
    fontSize: "14px",
    color: "#111827",
  },
  selectorMeta: {
    marginTop: "2px",
    fontSize: "12px",
    color: "#6b7280",
  },
  button: {
    backgroundColor: "#111827",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "12px 18px",
    fontSize: "14px",
    cursor: "pointer",
    width: "fit-content",
  },
  secondaryButton: {
    backgroundColor: "#f3f4f6",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 600,
  },
  smallButton: {
    backgroundColor: "#111827",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: "12px",
  },
  closeButton: {
    backgroundColor: "white",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "8px 12px",
    cursor: "pointer",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: "10px 12px",
    borderRadius: "8px",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    padding: "10px 12px",
    borderRadius: "8px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: "24px",
  },
  modal: {
    width: "min(900px, 100%)",
    maxHeight: "82vh",
    backgroundColor: "white",
    borderRadius: "12px",
    border: "1px solid #111827",
    padding: "20px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  modalTitle: {
    margin: 0,
    fontSize: "18px",
  },
  modalSubtitle: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: "13px",
  },
  filterRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: "12px",
  },
  modalTableWrapper: {
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px",
    borderBottom: "1px solid #ddd",
    backgroundColor: "#f9fafb",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid #eee",
  },
  tdRight: {
    padding: "10px",
    borderBottom: "1px solid #eee",
    textAlign: "right",
  },
};
