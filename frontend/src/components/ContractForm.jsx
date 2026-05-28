import { useEffect, useMemo, useState } from "react";

import { fetchCatalogs } from "../services/api";
import { fetchCollectiveAgreement } from "../services/collectiveAgreementApi";
import { consumeLastCreatedEmployee } from "../services/employeeApi";
import { buildContractPayload } from "../utils/contractPayloads";
import { getEmployeeVisibleCode } from "../utils/visibleCodes";

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
  collective_agreement_id: "",
  professional_category_id: "",
  salary_table_row_id: "",
  working_day_type: "full_time",
  weekly_hours: "40",
  full_time_weekly_hours: "40",
  partiality_coefficient: "100",
  monthly_or_daily_contribution: "monthly",
  red_occupation_code: "",
  red_reduction_code: "",
  gross_annual_salary: "",
};

const EMPTY_SS = {
  situation_code: "1",
  situation_description: "Alta",
  registration_date: "",
  contribution_group: "",
  monthly_or_daily_contribution: "monthly",
  red_contract_key: "",
  red_occupation_code: "",
  red_contribution_group: "",
  red_reduction_code: "",
  is_replacement: false,
  replacement_cause_code: "",
  replaced_worker_naf: "",
};

const DEFAULT_CATALOGS = {
  contracts: [],
  contribution_groups: [],
  working_day_types: [],
  monthly_daily_contribution_types: [],
  situations: [],
  substitution_causes: [],
};

const DIDACTIC_RULES = [
  "El convenio solo propone salario base mínimo. No calcula nóminas ni complementos.",
  "Contratos 4xx: jornada completa. Contratos 5xx: jornada parcial.",
  "La categoría profesional puede elegirse desde convenio o introducirse manualmente.",
  "El alumno debe calcular manualmente vacaciones, IT, pagas extra y regularizaciones.",
];

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

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function catalogOrFallback(items, fallback) {
  return items?.length ? items : fallback;
}

function buildSsPayload(ssForm, form, extraForm) {
  return {
    ...ssForm,
    registration_date: ssForm.registration_date || form.start_date,
    contribution_group: ssForm.contribution_group || extraForm.contribution_group,
    monthly_or_daily_contribution: ssForm.monthly_or_daily_contribution || extraForm.monthly_or_daily_contribution,
    red_contract_key: ssForm.red_contract_key || extraForm.contract_code,
    red_occupation_code: ssForm.red_occupation_code || extraForm.red_occupation_code,
    red_contribution_group: ssForm.red_contribution_group || extraForm.contribution_group,
    red_reduction_code: ssForm.red_reduction_code || extraForm.red_reduction_code,
  };
}

export default function ContractForm({
  form,
  employees,
  companies,
  workCenters,
  contracts = [],
  collectiveAgreements = [],
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
  const [ssForm, setSsForm] = useState(EMPTY_SS);
  const [agreementDetail, setAgreementDetail] = useState(null);
  const [agreementLoading, setAgreementLoading] = useState(false);

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
      setSsForm(EMPTY_SS);
      setAgreementDetail(null);
    }
  }, [success]);

  useEffect(() => {
    if (!extraForm.collective_agreement_id) {
      setAgreementDetail(null);
      return;
    }

    let active = true;
    setAgreementLoading(true);
    fetchCollectiveAgreement(extraForm.collective_agreement_id)
      .then((data) => {
        if (!active) return;
        setAgreementDetail(data);
      })
      .catch(() => {
        if (!active) return;
        setAgreementDetail(null);
      })
      .finally(() => {
        if (active) setAgreementLoading(false);
      });

    return () => {
      active = false;
    };
  }, [extraForm.collective_agreement_id]);

  const availableEmployees = useMemo(
    () => mergeEmployees(employees, localEmployees).filter((employee) => employee.is_active !== false),
    [employees, localEmployees]
  );

  const selectedEmployee = availableEmployees.find((emp) => String(emp.id) === String(form.employee_id));
  const selectedCompany = companies.find((company) => String(company.id) === String(form.company_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(form.center_id));
  const getEmployeeCode = (employee) => getEmployeeVisibleCode(employee, availableEmployees, contracts);

  const agreementCategories = agreementDetail?.professional_categories || [];
  const salaryTables = agreementDetail?.salary_tables || [];
  const salaryRows = salaryTables.flatMap((table) => (table.rows || []).map((row) => ({ ...row, table_name: table.name })));
  const selectedSalaryRow = salaryRows.find((row) => String(row.id) === String(extraForm.salary_table_row_id));

  const filteredEmployees = useMemo(() => {
    const nameFilter = employeeFilters.name.trim().toLowerCase();
    const dniFilter = employeeFilters.dni.trim().toLowerCase();
    const idFilter = employeeFilters.id.trim().toLowerCase();

    return availableEmployees.filter((emp) => {
      const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
      const dni = `${emp.dni || ""}`.toLowerCase();
      const employeeCode = `${emp.employee_code || ""}`.toLowerCase();
      const visibleCode = getEmployeeVisibleCode(emp, availableEmployees, contracts).toLowerCase();
      return (!nameFilter || fullName.includes(nameFilter)) && (!dniFilter || dni.includes(dniFilter)) && (!idFilter || employeeCode.includes(idFilter) || visibleCode.includes(idFilter));
    });
  }, [availableEmployees, contracts, employeeFilters]);

  const updateExtra = (patch) => setExtraForm((prev) => ({ ...prev, ...patch }));
  const updateSs = (patch) => setSsForm((prev) => ({ ...prev, ...patch }));

  const handleBaseChange = (event) => {
    const { name, value } = event.target;
    onChange(event);
    if (name === "salary_base") updateExtra({ gross_annual_salary: value });
    if (name === "start_date" && !ssForm.registration_date) updateSs({ registration_date: value });
  };

  const handleAgreementChange = (event) => {
    const agreementId = event.target.value;
    const selected = collectiveAgreements.find((agreement) => String(agreement.id) === String(agreementId));
    updateExtra({
      collective_agreement_id: agreementId,
      collective_agreement_code: selected?.agreement_code || "",
      professional_category_id: "",
      salary_table_row_id: "",
      professional_category: "",
    });
  };

  const handleCategoryChange = (event) => {
    const categoryId = event.target.value;
    const selected = agreementCategories.find((category) => String(category.id) === String(categoryId));
    updateExtra({
      professional_category_id: categoryId,
      professional_category: selected?.name || "",
      salary_table_row_id: "",
    });
  };

  const handleSalaryRowChange = (event) => {
    const rowId = event.target.value;
    const row = salaryRows.find((item) => String(item.id) === String(rowId));
    updateExtra({
      salary_table_row_id: rowId,
      professional_category_id: row?.professional_category_id ? String(row.professional_category_id) : extraForm.professional_category_id,
      professional_category: row?.category_name || extraForm.professional_category,
    });
    if (row?.base_salary && !form.salary_base) {
      onChange({ target: { name: "salary_base", value: String(row.base_salary) } });
    }
  };

  const handleExtraChange = (event) => {
    const { name, value } = event.target;

    if (name === "contract_code") {
      const selected = catalogs.contracts.find((item) => item.contract_code === value);
      const nextWorkingDay = value.startsWith("5") ? "part_time" : value === "300" ? "fixed_discontinuous" : value.startsWith("4") ? "full_time" : extraForm.working_day_type;
      const nextPartiality = nextWorkingDay === "full_time" ? "100" : extraForm.partiality_coefficient;
      updateExtra({ contract_code: value, contract_code_description: selected?.contract_code_description || "", contract_family: selected?.contract_family || "", working_day_type: nextWorkingDay, partiality_coefficient: nextPartiality });
      updateSs({ red_contract_key: value });
      if (selected?.contract_family) onChange({ target: { name: "contract_type", value: inferContractType(selected.contract_family) } });
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
      if (next.working_day_type === "part_time") next.partiality_coefficient = calculatePartiality(next.weekly_hours, next.full_time_weekly_hours);
      updateExtra(next);
      return;
    }

    updateExtra({ [name]: value });
  };

  const handleSsChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (name === "situation_code") {
      const selected = catalogs.situations.find((item) => item.code === value);
      updateSs({ situation_code: value, situation_description: selected?.description || "" });
      return;
    }

    updateSs({ [name]: nextValue });
  };

  const selectEmployee = (employee) => {
    onChange({ target: { name: "employee_id", value: String(employee.id) } });
    onChange({ target: { name: "company_id", value: employee.company_id ? String(employee.company_id) : "" } });
    onChange({ target: { name: "center_id", value: employee.center_id ? String(employee.center_id) : "" } });
    setEmployeeModalOpen(false);
  };

  const handleSubmit = (event) => {
    onSubmit(event, {
      contractExtra: buildContractPayload({}, extraForm),
      socialSecurity: buildSsPayload(ssForm, form, extraForm),
    });
  };

  const contractExtraForSubmit = extraForm;

  return (
    <>
      <form onSubmit={(event) => onSubmit(event, { contractExtra: contractExtraForSubmit, socialSecurity: buildSsPayload(ssForm, form, extraForm) })} style={styles.form}>
        {catalogError && <div style={styles.warning}>{catalogError}</div>}
        <DidacticRulesPanel />

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Trabajador y empresa</h3>
          <div style={styles.formRow}>
            <div style={styles.formGroupWide}>
              <label>Trabajador</label>
              <div style={styles.selectorBox}>
                <div>
                  <div style={styles.selectorValue}>{selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : "Selecciona un trabajador"}</div>
                  {selectedEmployee && <div style={styles.selectorMeta}>Código {getEmployeeCode(selectedEmployee)} · DNI {selectedEmployee.dni || "-"}</div>}
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
            <Field label="Código contrato"><select name="contract_code" value={extraForm.contract_code} onChange={handleExtraChange} style={styles.input}><option value="">Selecciona código</option>{catalogs.contracts.map((item) => <option key={item.contract_code} value={item.contract_code}>{item.contract_code} · {item.contract_code_description}</option>)}</select></Field>
            <Field label="Tipo de contrato"><select name="contract_type" value={form.contract_type} onChange={handleBaseChange} required style={styles.input}><option value="">Selecciona tipo</option><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="formacion">Formación</option><option value="sustitucion">Sustitución</option></select></Field>
            <Field label="Fecha inicio"><input type="date" name="start_date" value={form.start_date} onChange={handleBaseChange} required style={styles.input} /></Field>
            <Field label="Fecha fin"><input type="date" name="end_date" value={form.end_date} onChange={handleBaseChange} style={styles.input} /></Field>
            <Field label="Estado"><select name="status" value={form.status} onChange={handleBaseChange} style={styles.input}><option value="active">Activo</option><option value="ended">Finalizado</option></select></Field>
          </div>
          {extraForm.contract_code_description && <div style={styles.infoBox}>{extraForm.contract_code_description}</div>}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Convenio y salario mínimo</h3>
          <div style={styles.formGrid}>
            <Field label="Convenio colectivo"><select value={extraForm.collective_agreement_id} onChange={handleAgreementChange} style={styles.input}><option value="">Sin convenio</option>{collectiveAgreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.agreement_code || "sin código"}</option>)}</select></Field>
            <Field label="Categoría convenio"><select value={extraForm.professional_category_id} onChange={handleCategoryChange} disabled={!agreementDetail} style={styles.input}><option value="">Seleccionar categoría</option>{agreementCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.level ? ` · ${category.level}` : ""}</option>)}</select></Field>
            <Field label="Fila salarial"><select value={extraForm.salary_table_row_id} onChange={handleSalaryRowChange} disabled={!agreementDetail} style={styles.input}><option value="">Sin fila salarial</option>{salaryRows.filter((row) => !extraForm.professional_category_id || String(row.professional_category_id) === String(extraForm.professional_category_id)).map((row) => <option key={row.id} value={row.id}>{row.table_name} · {row.category_name || "Categoría"} · {money(row.base_salary)}</option>)}</select></Field>
            <Field label="Código convenio"><input name="collective_agreement_code" value={extraForm.collective_agreement_code} onChange={handleExtraChange} placeholder="Código oficial o interno" style={styles.input} /></Field>
            <Field label="Categoría manual"><input name="professional_category" value={extraForm.professional_category} onChange={handleExtraChange} placeholder="Ej. Oficial administrativo" style={styles.input} /></Field>
            <Field label="Puesto"><input name="job_position" value={extraForm.job_position} onChange={handleExtraChange} placeholder="Ej. Técnico de RRHH" style={styles.input} /></Field>
          </div>
          {agreementLoading && <div style={styles.infoBox}>Cargando detalle del convenio...</div>}
          {selectedSalaryRow && <div style={styles.infoBox}>Salario base mínimo propuesto: {money(selectedSalaryRow.base_salary)}. El alumno puede modificarlo manualmente.</div>}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Jornada</h3>
          <div style={styles.formGrid}>
            <Field label="Tipo jornada"><select name="working_day_type" value={extraForm.working_day_type} onChange={handleExtraChange} style={styles.input}>{catalogOrFallback(catalogs.working_day_types, [{ code: "full_time", description: "Jornada completa" }, { code: "part_time", description: "Jornada parcial" }, { code: "fixed_discontinuous", description: "Fijo discontinuo" }]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></Field>
            <Field label="Horas semanales"><input type="number" name="weekly_hours" value={extraForm.weekly_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Jornada completa ref."><input type="number" name="full_time_weekly_hours" value={extraForm.full_time_weekly_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Coeficiente parcialidad"><input type="number" name="partiality_coefficient" value={extraForm.partiality_coefficient} onChange={handleExtraChange} style={styles.input} /></Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Cotización / RED simulado</h3>
          <div style={styles.formGrid}>
            <Field label="Grupo cotización"><select name="contribution_group" value={extraForm.contribution_group} onChange={(event) => { handleExtraChange(event); updateSs({ contribution_group: event.target.value, red_contribution_group: event.target.value }); }} style={styles.input}><option value="">Selecciona grupo</option>{catalogs.contribution_groups.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field>
            <Field label="Indicador cotización"><select name="monthly_or_daily_contribution" value={extraForm.monthly_or_daily_contribution} onChange={(event) => { handleExtraChange(event); updateSs({ monthly_or_daily_contribution: event.target.value }); }} style={styles.input}>{catalogOrFallback(catalogs.monthly_daily_contribution_types, [{ code: "monthly", description: "Cotización mensual" }, { code: "daily", description: "Cotización diaria" }]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></Field>
            <Field label="Ocupación RED"><input name="red_occupation_code" value={extraForm.red_occupation_code} onChange={(event) => { handleExtraChange(event); updateSs({ red_occupation_code: event.target.value }); }} placeholder="Código ocupación" style={styles.input} /></Field>
            <Field label="Código reducción"><input name="red_reduction_code" value={extraForm.red_reduction_code} onChange={(event) => { handleExtraChange(event); updateSs({ red_reduction_code: event.target.value }); }} placeholder="Opcional" style={styles.input} /></Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Alta Seguridad Social simulada</h3>
          <div style={styles.formGrid}>
            <Field label="Situación"><select name="situation_code" value={ssForm.situation_code} onChange={handleSsChange} style={styles.input}>{catalogOrFallback(catalogs.situations, [{ code: "1", description: "Alta" }]).map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field>
            <Field label="Fecha de alta"><input type="date" name="registration_date" value={ssForm.registration_date || form.start_date} onChange={handleSsChange} style={styles.input} /></Field>
          </div>
          <div style={styles.checkboxRow}><label style={styles.checkboxLabel}><input type="checkbox" name="is_replacement" checked={ssForm.is_replacement} onChange={handleSsChange} /> Marcar sustitución / relevo</label></div>
          {ssForm.is_replacement && <div style={styles.formGrid}><Field label="Causa sustitución"><select name="replacement_cause_code" value={ssForm.replacement_cause_code} onChange={handleSsChange} style={styles.input}><option value="">Selecciona causa</option>{catalogs.substitution_causes.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field><Field label="NAF sustituido"><input name="replaced_worker_naf" value={ssForm.replaced_worker_naf} onChange={handleSsChange} placeholder="NAF de la persona sustituida" style={styles.input} /></Field></div>}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Retribución</h3>
          <div style={styles.formGrid}>
            <Field label="Salario base / mínimo convenio"><input type="number" name="salary_base" value={form.salary_base} onChange={handleBaseChange} placeholder="Ej. 1525" style={styles.input} /></Field>
            <Field label="Sistema de pagas"><select name="pay_schedule" value={form.pay_schedule || "not_prorated_14"} onChange={handleBaseChange} required style={styles.input}>{PAY_SCHEDULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          </div>
        </section>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}
        <button type="submit" disabled={submitting} style={styles.button}>{submitting ? "Guardando..." : "Crear contrato y alta SS"}</button>
      </form>

      {employeeModalOpen && (
        <EmployeeModal
          employees={filteredEmployees}
          companies={companies}
          workCenters={workCenters}
          employeeFilters={employeeFilters}
          onFilterChange={(event) => setEmployeeFilters((prev) => ({ ...prev, [event.target.name]: event.target.value }))}
          onSelect={selectEmployee}
          onClose={() => setEmployeeModalOpen(false)}
          getEmployeeCode={getEmployeeCode}
        />
      )}
    </>
  );
}

function DidacticRulesPanel() {
  return (
    <section style={styles.rulesPanel}>
      <div>
        <h3 style={styles.rulesTitle}>Reglas didácticas activas</h3>
        <p style={styles.rulesText}>El convenio es una guía de consulta. El cálculo final sigue siendo manual.</p>
      </div>
      <ul style={styles.rulesList}>{DIDACTIC_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
    </section>
  );
}

function Field({ label, children }) {
  return <div style={styles.formGroup}><label>{label}</label>{children}</div>;
}

function EmployeeModal({ employees, companies, workCenters, employeeFilters, onFilterChange, onSelect, onClose, getEmployeeCode }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div><h3 style={styles.modalTitle}>Seleccionar trabajador</h3><p style={styles.modalSubtitle}>Filtra por código visible, nombre o DNI.</p></div>
          <button type="button" onClick={onClose} style={styles.closeButton}>Cerrar</button>
        </div>
        <div style={styles.filterRow}>
          <div style={styles.filterGroupId}><label>Código</label><input name="id" value={employeeFilters.id} onChange={onFilterChange} placeholder="Ej. 1.2" style={styles.input} /></div>
          <div style={styles.filterGroupName}><label>Nombre y apellidos</label><input name="name" value={employeeFilters.name} onChange={onFilterChange} placeholder="Nombre o apellidos" style={styles.input} /></div>
          <div style={styles.filterGroupDni}><label>DNI</label><input name="dni" value={employeeFilters.dni} onChange={onFilterChange} placeholder="DNI" style={styles.input} /></div>
        </div>
        <div style={styles.modalTableWrapper}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Código</th><th style={styles.th}>Trabajador</th><th style={styles.th}>DNI</th><th style={styles.th}>Empresa / centro</th><th style={styles.th}></th></tr></thead>
            <tbody>
              {employees.map((emp) => {
                const employeeCompany = companies.find((company) => Number(company.id) === Number(emp.company_id));
                const employeeCenter = workCenters.find((center) => Number(center.id) === Number(emp.center_id));
                return <tr key={emp.id}><td style={styles.td}>{getEmployeeCode(emp)}</td><td style={styles.td}>{emp.first_name} {emp.last_name}</td><td style={styles.td}>{emp.dni || "-"}</td><td style={styles.td}>{employeeCompany?.name || "-"}{employeeCenter?.name ? ` · ${employeeCenter.name}` : ""}</td><td style={styles.tdRight}><button type="button" onClick={() => onSelect(emp)} style={styles.smallButton}>Seleccionar</button></td></tr>;
              })}
              {employees.length === 0 && <tr><td style={styles.td} colSpan="5">No hay trabajadores con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  section: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: "0 0 14px 0", fontSize: "15px", color: "#111827", fontWeight: 800 },
  rulesPanel: { border: "1px solid #facc15", borderRadius: "12px", padding: "14px 16px", backgroundColor: "#fffbeb", display: "grid", gridTemplateColumns: "minmax(220px, 0.7fr) minmax(260px, 1.3fr)", gap: "14px", alignItems: "start" },
  rulesTitle: { margin: 0, fontSize: "14px", fontWeight: 900, color: "#111827" },
  rulesText: { margin: "4px 0 0", color: "#713f12", fontSize: "13px", fontWeight: 650 },
  rulesList: { margin: 0, paddingLeft: "18px", color: "#713f12", fontSize: "12px", fontWeight: 700, lineHeight: 1.5 },
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
  checkboxRow: { marginTop: "14px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px" },
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
