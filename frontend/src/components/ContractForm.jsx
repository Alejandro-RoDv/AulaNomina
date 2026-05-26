import { useMemo, useState } from "react";
import { getEmployeeVisibleCode } from "../utils/visibleCodes";

export const PAY_SCHEDULE_OPTIONS = [
  { value: "prorated_12", label: "Nómina prorrateada 12 pagas" },
  { value: "not_prorated_14", label: "Nómina no prorrateada 14 pagas" },
];

export function formatPaySchedule(value) {
  return PAY_SCHEDULE_OPTIONS.find((option) => option.value === value)?.label || "Nómina no prorrateada 14 pagas";
}

export default function ContractForm({
  form,
  employees,
  companies,
  workCenters,
  contracts = [],
  onChange,
  onSubmit,
  error,
  success,
  submitting,
}) {
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeFilters, setEmployeeFilters] = useState({ name: "", dni: "", id: "" });

  const selectedEmployee = employees.find((emp) => String(emp.id) === String(form.employee_id));
  const selectedCompany = companies.find((company) => String(company.id) === String(form.company_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(form.center_id));
  const getEmployeeCode = (employee) => getEmployeeVisibleCode(employee, employees, contracts);

  const filteredEmployees = useMemo(() => {
    const nameFilter = employeeFilters.name.trim().toLowerCase();
    const dniFilter = employeeFilters.dni.trim().toLowerCase();
    const idFilter = employeeFilters.id.trim().toLowerCase();

    return employees.filter((emp) => {
      const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
      const dni = `${emp.dni || ""}`.toLowerCase();
      const employeeCode = `${emp.employee_code || ""}`.toLowerCase();
      const visibleCode = getEmployeeVisibleCode(emp, employees, contracts).toLowerCase();

      return (
        (!nameFilter || fullName.includes(nameFilter)) &&
        (!dniFilter || dni.includes(dniFilter)) &&
        (!idFilter || employeeCode.includes(idFilter) || visibleCode.includes(idFilter))
      );
    });
  }, [employees, contracts, employeeFilters]);

  const handleEmployeeFilterChange = (event) => {
    const { name, value } = event.target;
    setEmployeeFilters((prev) => ({ ...prev, [name]: value }));
  };

  const selectEmployee = (employee) => {
    onChange({ target: { name: "employee_id", value: String(employee.id) } });
    onChange({ target: { name: "company_id", value: employee.company_id ? String(employee.company_id) : "" } });
    onChange({ target: { name: "center_id", value: employee.center_id ? String(employee.center_id) : "" } });
    setEmployeeModalOpen(false);
  };

  return (
    <>
      <form onSubmit={onSubmit} style={styles.form}>
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Trabajador</label>
            <div style={styles.selectorBox}>
              <div>
                <div style={styles.selectorValue}>
                  {selectedEmployee
                    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
                    : "Selecciona un trabajador"}
                </div>
                {selectedEmployee && (
                  <div style={styles.selectorMeta}>
                    Código {getEmployeeCode(selectedEmployee)} · DNI {selectedEmployee.dni || "-"}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setEmployeeModalOpen(true)} style={styles.secondaryButton}>
                Buscar
              </button>
            </div>
            <input type="hidden" name="employee_id" value={form.employee_id} required />
          </div>

          <div style={styles.formGroup}>
            <label>Empresa y centro asignados</label>
            <div style={styles.readOnlyBox}>
              <div style={styles.readOnlyMain}>
                {selectedCompany?.name || "Se completará al seleccionar trabajador"}
              </div>
              <div style={styles.readOnlyMeta}>
                {selectedCenter?.name || "Centro pendiente"}
                {selectedCompany?.ccc ? ` · CCC ${selectedCompany.ccc}` : ""}
              </div>
            </div>
            <input type="hidden" name="company_id" value={form.company_id} required />
            <input type="hidden" name="center_id" value={form.center_id || ""} />
            <small style={styles.helpText}>La empresa y el centro se heredan del trabajador seleccionado.</small>
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Tipo de contrato</label>
            <select name="contract_type" value={form.contract_type} onChange={onChange} required style={styles.input}>
              <option value="">Selecciona tipo</option>
              <option value="indefinido">Indefinido</option>
              <option value="temporal">Temporal</option>
              <option value="practicas">Prácticas</option>
              <option value="formacion">Formación</option>
              <option value="sustitucion">Sustitución</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label>Sistema de pagas</label>
            <select name="pay_schedule" value={form.pay_schedule || "not_prorated_14"} onChange={onChange} required style={styles.input}>
              {PAY_SCHEDULE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Fecha inicio</label>
            <input type="date" name="start_date" value={form.start_date} onChange={onChange} required style={styles.input} />
          </div>

          <div style={styles.formGroup}>
            <label>Fecha fin</label>
            <input type="date" name="end_date" value={form.end_date} onChange={onChange} style={styles.input} />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label>Salario bruto anual pactado</label>
            <input type="number" name="salary_base" value={form.salary_base} onChange={onChange} placeholder="Ej. 30000" style={styles.input} />
            <small style={styles.helpText}>Importe bruto anual. El sistema lo reparte en 12 pagas prorrateadas o 14 pagas según el contrato.</small>
          </div>

          <div style={styles.formGroup}>
            <label>Estado</label>
            <select name="status" value={form.status} onChange={onChange} style={styles.input}>
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
                <p style={styles.modalSubtitle}>Filtra por código visible, nombre o DNI.</p>
              </div>
              <button type="button" onClick={() => setEmployeeModalOpen(false)} style={styles.closeButton}>Cerrar</button>
            </div>

            <div style={styles.filterRow}>
              <div style={styles.filterGroupId}><label>Código</label><input name="id" value={employeeFilters.id} onChange={handleEmployeeFilterChange} placeholder="Ej. 1.2" style={styles.input} /></div>
              <div style={styles.filterGroupName}><label>Nombre y apellidos</label><input name="name" value={employeeFilters.name} onChange={handleEmployeeFilterChange} placeholder="Nombre o apellidos" style={styles.input} /></div>
              <div style={styles.filterGroupDni}><label>DNI</label><input name="dni" value={employeeFilters.dni} onChange={handleEmployeeFilterChange} placeholder="DNI" style={styles.input} /></div>
            </div>

            <div style={styles.modalTableWrapper}>
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>Código</th><th style={styles.th}>Trabajador</th><th style={styles.th}>DNI</th><th style={styles.th}>Empresa / centro</th><th style={styles.th}></th></tr></thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const employeeCompany = companies.find((company) => Number(company.id) === Number(emp.company_id));
                    const employeeCenter = workCenters.find((center) => Number(center.id) === Number(emp.center_id));
                    return (
                      <tr key={emp.id}>
                        <td style={styles.td}>{getEmployeeCode(emp)}</td>
                        <td style={styles.td}>{emp.first_name} {emp.last_name}</td>
                        <td style={styles.td}>{emp.dni || "-"}</td>
                        <td style={styles.td}>{employeeCompany?.name || "-"}{employeeCenter?.name ? ` · ${employeeCenter.name}` : ""}</td>
                        <td style={styles.tdRight}><button type="button" onClick={() => selectEmployee(emp)} style={styles.smallButton}>Seleccionar</button></td>
                      </tr>
                    );
                  })}
                  {filteredEmployees.length === 0 && <tr><td style={styles.td} colSpan="5">No hay trabajadores con esos filtros.</td></tr>}
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
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  selectorBox: { minHeight: "42px", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  selectorValue: { fontSize: "14px", color: "#111827", fontWeight: 700 },
  selectorMeta: { marginTop: "2px", fontSize: "12px", color: "#6b7280" },
  readOnlyBox: { minHeight: "42px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "#f9fafb" },
  readOnlyMain: { fontSize: "14px", color: "#111827", fontWeight: 800 },
  readOnlyMeta: { marginTop: "2px", fontSize: "12px", color: "#6b7280", fontWeight: 600 },
  helpText: { color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", fontSize: "14px", cursor: "pointer", width: "fit-content" },
  secondaryButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 600 },
  smallButton: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", fontSize: "12px" },
  closeButton: { backgroundColor: "white", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 12px", cursor: "pointer" },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "24px" },
  modal: { width: "min(980px, 100%)", maxHeight: "82vh", backgroundColor: "white", borderRadius: "12px", border: "1px solid #111827", padding: "20px", overflow: "hidden", display: "flex", flexDirection: "column", gap: "16px" },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" },
  modalTitle: { margin: 0, fontSize: "18px" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px" },
  filterRow: { display: "flex", gap: "12px", alignItems: "end", flexWrap: "wrap" },
  filterGroupId: { width: "140px", flex: "0 0 140px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupName: { width: "430px", flex: "1 1 430px", display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupDni: { width: "210px", flex: "0 0 210px", display: "flex", flexDirection: "column", gap: "6px" },
  modalTableWrapper: { overflow: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb" },
  td: { padding: "10px", borderBottom: "1px solid #eee" },
  tdRight: { padding: "10px", borderBottom: "1px solid #eee", textAlign: "right" },
};