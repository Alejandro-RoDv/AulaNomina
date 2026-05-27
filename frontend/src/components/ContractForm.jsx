import { useEffect, useMemo, useState } from "react";
import { getEmployeeVisibleCode } from "../utils/visibleCodes";
import { consumeLastCreatedEmployee } from "../services/employeeApi";
import { fetchCatalogs } from "../services/api";

export const PAY_SCHEDULE_OPTIONS = [
  { value: "prorated_12", label: "Nómina prorrateada 12 pagas" },
  { value: "not_prorated_14", label: "Nómina no prorrateada 14 pagas" },
];

const EMPTY_EXTRA = {
  contract_code: "",
  contract_code_description: "",
  contract_family: "",
  contribution_group: "",
  professional_category: "",
  job_position: "",
  collective_agreement_code: "",
  working_day_type: "full_time",
  weekly_hours: "40",
  full_time_weekly_hours: "40",
  partiality_coefficient: "100",
  monthly_or_daily_contribution: "monthly",
  red_occupation_code: "",
  red_reduction_code: "",
  gross_annual_salary: "",
};

const DEFAULT_CATALOGS = {
  contracts: [],
  contribution_groups: [],
  working_day_types: [],
  monthly_daily_contribution_types: [],
};

export function formatPaySchedule(value) {
  return PAY_SCHEDULE_OPTIONS.find((option) => option.value === value)?.label || "Nómina no prorrateada 14 pagas";
}

function mergeEmployees(baseEmployees, extraEmployees) {
  const employeeMap = new Map();

  [...baseEmployees, ...extraEmployees].forEach((employee) => {
    if (!employee?.id) return;
    employeeMap.set(String(employee.id), employee);
  });

  return Array.from(employeeMap.values());
}

function inferContractType(contractFamily) {
  if (contractFamily === "indefinite" || contractFamily === "fixed_discontinuous") return "indefinido";
  if (contractFamily === "training") return "formacion";
  if (contractFamily === "replacement") return "sustitucion";
  return "temporal";
}

function calculatePartiality(weeklyHours, fullTimeWeeklyHours) {
  const weekly = Number(weeklyHours || 0);
  const fullTime = Number(fullTimeWeeklyHours || 40);
  if (!weekly || !fullTime) return "";
  return String(Math.round((weekly / fullTime) * 10000) / 100);
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
  const [localEmployees, setLocalEmployees] = useState([]);
  const [catalogs, setCatalogs] = useState(DEFAULT_CATALOGS);
  const [catalogError, setCatalogError] = useState("");
  const [extraForm, setExtraForm] = useState(EMPTY_EXTRA);

  useEffect(() => {
    const addEmployee = (employee) => {
      if (!employee?.id || employee.is_active === false) return;
      setLocalEmployees((prev) => mergeEmployees(prev, [employee]));
    };

    const storedEmployee = consumeLastCreatedEmployee();
    if (storedEmployee) addEmployee(storedEmployee);

    const handleEmployeeCreated = (event) => addEmployee(event.detail);
    window.addEventListener("aulanomina:employee-created", handleEmployeeCreated);

    return () => window.removeEventListener("aulanomina:employee-created", handleEmployeeCreated);
  }, []);

  useEffect(() => {
    let active = true;
    fetchCatalogs()
      .then((data) => {
        if (!active) return;
        setCatalogs({ ...DEFAULT_CATALOGS, ...data });
        setCatalogError("");
      })
      .catch((err) => {
        if (!active) return;
        setCatalogError(err.message || "No se pudieron cargar los catálogos laborales");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (success) {
      setExtraForm(EMPTY_EXTRA);
      window.__aulanominaContractForm = EMPTY_EXTRA;
    }
  }, [success]);

  useEffect(() => {
    window.__aulanominaContractForm = extraForm;
  }, [extraForm]);

  const availableEmployees = useMemo(
    () => mergeEmployees(employees, localEmployees).filter((employee) => employee.is_active !== false),
    [employees, localEmployees]
  );

  const selectedEmployee = availableEmployees.find((emp) => String(emp.id) === String(form.employee_id));
  const selectedCompany = companies.find((company) => String(company.id) === String(form.company_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(form.center_id));
  const getEmployeeCode = (employee) => getEmployeeVisibleCode(employee, availableEmployees, contracts);

  const filteredEmployees = useMemo(() => {
    const nameFilter = employeeFilters.name.trim().toLowerCase();
    const dniFilter = employeeFilters.dni.trim().toLowerCase();
    const idFilter = employeeFilters.id.trim().toLowerCase();

    return availableEmployees.filter((emp) => {
      const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
      const dni = `${emp.dni || ""}`.toLowerCase();
      const employeeCode = `${emp.employee_code || ""}`.toLowerCase();
      const visibleCode = getEmployeeVisibleCode(emp, availableEmployees, contracts).toLowerCase();

      return (
        (!nameFilter || fullName.includes(nameFilter)) &&
        (!dniFilter || dni.includes(dniFilter)) &&
        (!idFilter || employeeCode.includes(idFilter) || visibleCode.includes(idFilter))
      );
    });
  }, [availableEmployees, contracts, employeeFilters]);

  const updateExtra = (patch) => {
    setExtraForm((prev) => {
      const next = { ...prev, ...patch };
      window.__aulanominaContractForm = next;
      return next;
    });
  };

  const handleBaseChange = (event) => {
    const { name, value } = event.target;
    onChange(event);

    if (name === "salary_base") {
      updateExtra({ gross_annual_salary: value });
    }
  };

  const handleExtraChange = (event) => {
    const { name, value } = event.target;

    if (name === "contract_code") {
      const selected = catalogs.contracts.find((item) => item.contract_code === value);
      const nextWorkingDay = value.startsWith("5") ? "part_time" : value === "300" ? "fixed_discontinuous" : value.startsWith("4") ? "full_time" : extraForm.working_day_type;
      const nextPartiality = nextWorkingDay === "full_time" ? "100" : extraForm.partiality_coefficient;

      updateExtra({
        contract_code: value,
        contract_code_description: selected?.contract_code_description || "",
        contract_family: selected?.contract_family || "",
        working_day_type: nextWorkingDay,
        partiality_coefficient: nextPartiality,
      });

      if (selected?.contract_family) {
        onChange({ target: { name: "contract_type", value: inferContractType(selected.contract_family) } });
      }
      return;
    }

    if (name === "working_day_type") {
      const patch = { working_day_type: value };
      if (value === "full_time") {
        patch.weekly_hours = extraForm.full_time_weekly_hours || "40";
        patch.partiality_coefficient = "100";
      }
      updateExtra(patch);
      return;
    }

    if (name === "weekly_hours" || name === "full_time_weekly_hours") {
      const next = { ...extraForm, [name]: value };
      if (next.working_day_type === "part_time") {
        next.partiality_coefficient = calculatePartiality(next.weekly_hours, next.full_time_weekly_hours);
      }
      updateExtra(next);
      return;
    }

    updateExtra({ [name]: value });
  };

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

  const handleSubmit = (event) => {
    window.__aulanominaContractForm = extraForm;
    onSubmit(event);
  };

  return (
    <>
      <form onSubmit={handleSubmit} style={styles.form}>
        {catalogError && <div style={styles.warning}>{catalogError}</div>}

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Trabajador y empresa</h3>
          <div style={styles.formRow}>
            <div style={styles.formGroupWide}>
              <label>Trabajador</label>
              <div style={styles.selectorBox}>
                <div>
                  <div style={styles.selectorValue}>
                    {selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : "Selecciona un trabajador"}
                  </div>
                  {selectedEmployee && (
                    <div style={styles.selectorMeta}>Código {getEmployeeCode(selectedEmployee)} · DNI {selectedEmployee.dni || "-"}</div>
                  )}
                </div>
                <button type="button" onClick={() => setEmployeeModalOpen(true)} style={styles.secondaryButton}>Buscar</button>
              </div>
              <input type="hidden" name="employee_id" value={form.employee_id} required />
            </div>

            <div style={styles.formGroupWide}>
              <label>Empresa y centro</label>
              <div style={styles.readOnlyBox}>
                <div style={styles.readOnlyMain}>{selectedCompany?.name || "Se completará al seleccionar trabajador"}</div>
                <div style={styles.readOnlyMeta}>{selectedCenter?.name || "Centro pendiente"}{selectedCompany?.ccc ? ` · CCC ${selectedCompany.ccc}` : ""}</div>
              </div>
              <input type="hidden" name="company_id" value={form.company_id} required />
              <input type="hidden" name="center_id" value={form.center_id || ""} />
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Datos contractuales</h3>
          <div style={styles.formGrid}>
            <Field label="Código contrato">
              <select name="contract_code" value={extraForm.contract_code} onChange={handleExtraChange} style={styles.input}>
                <option value="">Selecciona código</option>
                {catalogs.contracts.map((item) => (
                  <option key={item.contract_code} value={item.contract_code}>{item.contract_code} · {item.contract_code_description}</option>
                ))}
              </select>
            </Field>

            <Field label="Tipo de contrato">
              <select name="contract_type" value={form.contract_type} onChange={handleBaseChange} required style={styles.input}>
                <option value="">Selecciona tipo</option>
                <option value="indefinido">Indefinido</option>
                <option value="temporal">Temporal</option>
                <option value="practicas">Prácticas</option>
                <option value="formacion">Formación</option>
                <option value="sustitucion">Sustitución</option>
              </select>
            </Field>

            <Field label="Fecha inicio"><input type="date" name="start_date" value={form.start_date} onChange={handleBaseChange} required style={styles.input} /></Field>
            <Field label="Fecha fin"><input type="date" name="end_date" value={form.end_date} onChange={handleBaseChange} style={styles.input} /></Field>
            <Field label="Estado">
              <select name="status" value={form.status} onChange={handleBaseChange} style={styles.input}>
                <option value="active">Activo</option>
                <option value="ended">Finalizado</option>
              </select>
            </Field>
            <Field label="Convenio colectivo"><input name="collective_agreement_code" value={extraForm.collective_agreement_code} onChange={handleExtraChange} placeholder="Ej. 99008725011994" style={styles.input} /></Field>
          </div>
          {extraForm.contract_code_description && <div style={styles.infoBox}>{extraForm.contract_code_description}</div>}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Jornada</h3>
          <div style={styles.formGrid}>
            <Field label="Tipo jornada">
              <select name="working_day_type" value={extraForm.working_day_type} onChange={handleExtraChange} style={styles.input}>
                {(catalogs.working_day_types.length ? catalogs.working_day_types : [
                  { code: "full_time", description: "Jornada completa" },
                  { code: "part_time", description: "Jornada parcial" },
                  { code: "fixed_discontinuous", description: "Fijo discontinuo" },
                ]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}
              </select>
            </Field>
            <Field label="Horas semanales"><input type="number" name="weekly_hours" value={extraForm.weekly_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Jornada completa ref."><input type="number" name="full_time_weekly_hours" value={extraForm.full_time_weekly_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Coeficiente parcialidad"><input type="number" name="partiality_coefficient" value={extraForm.partiality_coefficient} onChange={handleExtraChange} style={styles.input} /></Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Cotización / RED simulado</h3>
          <div style={styles.formGrid}>
            <Field label="Grupo cotización">
              <select name="contribution_group" value={extraForm.contribution_group} onChange={handleExtraChange} style={styles.input}>
                <option value="">Selecciona grupo</option>
                {catalogs.contribution_groups.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}
              </select>
            </Field>
            <Field label="Indicador cotización">
              <select name="monthly_or_daily_contribution" value={extraForm.monthly_or_daily_contribution} onChange={handleExtraChange} style={styles.input}>
                {(catalogs.monthly_daily_contribution_types.length ? catalogs.monthly_daily_contribution_types : [
                  { code: "monthly", description: "Cotización mensual" },
                  { code: "daily", description: "Cotización diaria" },
                ]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}
              </select>
            </Field>
            <Field label="Categoría profesional"><input name="professional_category" value={extraForm.professional_category} onChange={handleExtraChange} placeholder="Ej. Oficial administrativo" style={styles.input} /></Field>
            <Field label="Puesto"><input name="job_position" value={extraForm.job_position} onChange={handleExtraChange} placeholder="Ej. Técnico de RRHH" style={styles.input} /></Field>
            <Field label="Ocupación RED"><input name="red_occupation_code" value={extraForm.red_occupation_code} onChange={handleExtraChange} placeholder="Código ocupación" style={styles.input} /></Field>
            <Field label="Código reducción"><input name="red_reduction_code" value={extraForm.red_reduction_code} onChange={handleExtraChange} placeholder="Opcional" style={styles.input} /></Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Retribución</h3>
          <div style={styles.formGrid}>
            <Field label="Salario bruto anual pactado">
              <input type="number" name="salary_base" value={form.salary_base} onChange={handleBaseChange} placeholder="Ej. 30000" style={styles.input} />
            </Field>
            <Field label="Sistema de pagas">
              <select name="pay_schedule" value={form.pay_schedule || "not_prorated_14"} onChange={handleBaseChange} required style={styles.input}>
                {PAY_SCHEDULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
        </section>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <button type="submit" disabled={submitting} style={styles.button}>{submitting ? "Guardando..." : "Crear contrato"}</button>
      </form>

      {employeeModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div><h3 style={styles.modalTitle}>Seleccionar trabajador</h3><p style={styles.modalSubtitle}>Filtra por código visible, nombre o DNI.</p></div>
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

function Field({ label, children }) {
  return <div style={styles.formGroup}><label>{label}</label>{children}</div>;
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  section: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: "0 0 14px 0", fontSize: "15px", color: "#111827", fontWeight: 800 },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  formGroup: { minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "320px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", backgroundColor: "white" },
  selectorBox: { minHeight: "42px", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  selectorValue: { fontSize: "14px", color: "#111827", fontWeight: 700 },
  selectorMeta: { marginTop: "2px", fontSize: "12px", color: "#6b7280" },
  readOnlyBox: { minHeight: "42px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "#f9fafb" },
  readOnlyMain: { fontSize: "14px", color: "#111827", fontWeight: 800 },
  readOnlyMeta: { marginTop: "2px", fontSize: "12px", color: "#6b7280", fontWeight: 600 },
  infoBox: { marginTop: "12px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#fef3c7", color: "#111827", fontSize: "13px", fontWeight: 700 },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", fontSize: "14px", cursor: "pointer", width: "fit-content" },
  secondaryButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 600 },
  smallButton: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", fontSize: "12px" },
  closeButton: { backgroundColor: "white", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 12px", cursor: "pointer" },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "24px" },
  modal: { width: "min(960px, 96vw)", maxHeight: "86vh", overflow: "hidden", backgroundColor: "white", borderRadius: "14px", padding: "18px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "18px" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px" },
  filterRow: { display: "grid", gridTemplateColumns: "120px 1fr 180px", gap: "12px", marginBottom: "14px" },
  filterGroupId: { display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupName: { display: "flex", flexDirection: "column", gap: "6px" },
  filterGroupDni: { display: "flex", flexDirection: "column", gap: "6px" },
  modalTableWrapper: { maxHeight: "56vh", overflow: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { padding: "10px", textAlign: "left", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "10px", borderBottom: "1px solid #f3f4f6" },
  tdRight: { padding: "10px", borderBottom: "1px solid #f3f4f6", textAlign: "right" },
};
