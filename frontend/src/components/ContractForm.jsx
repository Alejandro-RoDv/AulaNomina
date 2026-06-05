import { useEffect, useMemo, useState } from "react";

import { fetchCatalogs } from "../services/api";
import { fetchCollectiveAgreement } from "../services/collectiveAgreementApi";
import { consumeLastCreatedEmployee } from "../services/employeeApi";
import { getEmployeeVisibleCode } from "../utils/visibleCodes";

export const PAY_SCHEDULE_OPTIONS = [
  { value: "prorated_12", label: "Nómina prorrateada 12 pagas" },
  { value: "not_prorated_14", label: "Nómina no prorrateada 14 pagas" },
];

const EMPTY_EXTRA = {
  contract_code: "",
  contract_code_description: "",
  contract_family: "",
  seniority_date: "",
  seniority_criterion: "start_date",
  termination_reason: "",
  transformation_from_contract_id: "",
  transformation_date: "",
  transformation_reason: "",
  bonus_type: "",
  bonus_start_date: "",
  bonus_end_date: "",
  bonus_fixed_fee: "",
  bonus_observations: "",
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
  annual_agreement_hours: "",
  monthly_hours: "173.33",
  annual_hours: "2080",
  partiality_coefficient: "100",
  ordinary_hours: "40",
  ordinary_hours_period: "week",
  comparison_reference_type: "comparable_full_time_worker",
  comparison_hours: "40",
  work_distribution: "",
  pay_accrual_mode: "workday_percentage",
  contribution_hours_mode: "workday_percentage",
  legal_workday_reduction_cause: "none",
  legal_workday_reduction_start: "",
  legal_workday_reduction_end: "",
  legal_workday_reduction_percentage: "",
  inactivity_start_date: "",
  inactivity_return_date: "",
  inactivity_start_communication_date: "",
  inactivity_return_communication_date: "",
  works_holidays: false,
  holiday_scope: "",
  holiday_only_service_days: false,
  schedule_notes: "",
  health_card_number: "",
  subrogation: false,
  subrogation_company_origin: "",
  subrogation_date: "",
  recognized_seniority_date: "",
  affects_extra_payments: false,
  relation_type: "employee",
  representation_type: "none",
  relation_subtype: "",
  registration_number: "",
  authorization_number: "",
  red_key: "",
  red_cont: "",
  cno_code: "",
  cno_description: "",
  company_cnae: "",
  occupation: "",
  it_rate: "0.800",
  ims_rate: "0.700",
  function_description: "",
  section: "",
  group_name: "",
  contract_registry_number: "",
  contract_registry_date: "",
  contract_registry_office: "",
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

const BONUS_OPTIONS = [
  ["", "Sin bonificación"],
  ["reincorporada_maternidad", "Reincorporada maternidad"],
  ["riesgo_embarazo", "Cambio de puesto por riesgo durante el embarazo"],
  ["enfermedad_profesional", "Cambio de puesto por enfermedad profesional"],
  ["descanso_nacimiento", "15 días descanso antes de nacimiento y cuidado menor"],
  ["otra", "Otra bonificación"],
];

const REDUCTION_OPTIONS = [
  ["none", "Ninguna"],
  ["guarda_legal_menor", "Guarda legal por menor"],
  ["guarda_legal_discapacidad", "Guarda legal discapacidad"],
  ["guarda_legal_familiar", "Guarda legal familiar"],
  ["lactancia", "Reducción jornada por lactancia"],
  ["violencia", "Reducción jornada por violencia"],
  ["hijo_prematuro", "Reducción jornada por hijo prematuro"],
  ["menor_enfermedad_grave", "Reducción jornada por menor enfermedad grave"],
  ["menor_enfermedad_grave_otra", "Menor enfermedad grave + otra reducción"],
];

const RELATION_OPTIONS = [
  ["employee", "Por cuenta ajena"],
  ["autonomo", "Autónomo"],
  ["autonomo_deduce_cuotas", "Autónomo deduce cuotas"],
  ["especial", "Especial"],
  ["administrador_sin_des_fog", "Administrador sin Des/FOG"],
  ["solo_accidentes", "Solo cotiza accidentes de trabajo"],
  ["sin_desempleo_hijo_autonomo", "Sin desempleo / Hijo Autónomo"],
  ["autonomo_clave_e_consejero", "Autónomo Clave E / Consejero"],
  ["jubilado_cotizacion_especial", "Jubilado cotización especial"],
  ["representante_comercio", "Representante de comercio"],
  ["exento_des_fog_fp", "Exento desempleo / FOGASA / FP"],
  ["exento_fogasa_cooperativa", "Exento FOGASA Cooperativa"],
];

export function formatPaySchedule(value) {
  return PAY_SCHEDULE_OPTIONS.find((option) => option.value === value)?.label || "Nómina no prorrateada 14 pagas";
}

function mergeEmployees(baseEmployees, extraEmployees) {
  const employeeMap = new Map();
  [...baseEmployees, ...extraEmployees].forEach((employee) => {
    if (employee?.id) employeeMap.set(String(employee.id), employee);
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

function calculateHoursFromWeekly(weeklyHours) {
  const weekly = Number(weeklyHours || 0);
  if (!weekly) return { monthly_hours: "", annual_hours: "" };
  return { monthly_hours: String(Math.round((weekly * 52 / 12) * 100) / 100), annual_hours: String(Math.round((weekly * 52) * 100) / 100) };
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

export default function ContractForm({ form, employees, companies, workCenters, contracts = [], collectiveAgreements = [], onChange, onSubmit, error, success, submitting }) {
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
    fetchCatalogs().then((data) => {
      if (!active) return;
      setCatalogs({ ...DEFAULT_CATALOGS, ...data });
      setCatalogError("");
    }).catch((err) => {
      if (active) setCatalogError(err.message || "No se pudieron cargar los catálogos laborales");
    });
    return () => { active = false; };
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
    fetchCollectiveAgreement(extraForm.collective_agreement_id).then((data) => {
      if (active) setAgreementDetail(data);
    }).catch(() => {
      if (active) setAgreementDetail(null);
    }).finally(() => {
      if (active) setAgreementLoading(false);
    });
    return () => { active = false; };
  }, [extraForm.collective_agreement_id]);

  const availableEmployees = useMemo(() => mergeEmployees(employees, localEmployees).filter((employee) => employee.is_active !== false), [employees, localEmployees]);
  const selectedEmployee = availableEmployees.find((emp) => String(emp.id) === String(form.employee_id));
  const selectedCompany = companies.find((company) => String(company.id) === String(form.company_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(form.center_id));
  const getEmployeeCode = (employee) => getEmployeeVisibleCode(employee, availableEmployees, contracts);
  const workerContracts = contracts.filter((contract) => String(contract.employee_id) === String(form.employee_id));
  const activeOtherContracts = workerContracts.filter((contract) => contract.status === "active");
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
    if (name === "start_date") {
      if (!ssForm.registration_date) updateSs({ registration_date: value });
      if (extraForm.seniority_criterion === "start_date") updateExtra({ seniority_date: value });
    }
  };

  const handleAgreementChange = (event) => {
    const agreementId = event.target.value;
    const selected = collectiveAgreements.find((agreement) => String(agreement.id) === String(agreementId));
    updateExtra({ collective_agreement_id: agreementId, collective_agreement_code: selected?.agreement_code || "", professional_category_id: "", salary_table_row_id: "", professional_category: "" });
  };

  const handleCategoryChange = (event) => {
    const categoryId = event.target.value;
    const selected = agreementCategories.find((category) => String(category.id) === String(categoryId));
    updateExtra({ professional_category_id: categoryId, professional_category: selected?.name || "", salary_table_row_id: "" });
  };

  const handleSalaryRowChange = (event) => {
    const rowId = event.target.value;
    const row = salaryRows.find((item) => String(item.id) === String(rowId));
    updateExtra({ salary_table_row_id: rowId, professional_category_id: row?.professional_category_id ? String(row.professional_category_id) : extraForm.professional_category_id, professional_category: row?.category_name || extraForm.professional_category });
    if (row?.base_salary && !form.salary_base) onChange({ target: { name: "salary_base", value: String(row.base_salary) } });
  };

  const handleExtraChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (name === "contract_code") {
      const selected = catalogs.contracts.find((item) => item.contract_code === value);
      const nextWorkingDay = value.startsWith("5") ? "part_time" : value.startsWith("3") ? "fixed_discontinuous" : value.startsWith("4") || value.startsWith("1") ? "full_time" : extraForm.working_day_type;
      const nextPartiality = nextWorkingDay === "full_time" ? "100" : extraForm.partiality_coefficient;
      const nextWeeklyHours = nextWorkingDay === "full_time" ? (extraForm.full_time_weekly_hours || "40") : extraForm.weekly_hours;
      updateExtra({ contract_code: value, contract_code_description: selected?.contract_code_description || "", contract_family: selected?.contract_family || "", working_day_type: nextWorkingDay, weekly_hours: nextWeeklyHours, partiality_coefficient: nextPartiality, red_key: value, ...calculateHoursFromWeekly(nextWeeklyHours) });
      updateSs({ red_contract_key: value });
      if (selected?.contract_family) onChange({ target: { name: "contract_type", value: inferContractType(selected.contract_family) } });
      return;
    }

    if (name === "working_day_type") {
      const patch = { working_day_type: value };
      if (value === "full_time") {
        patch.weekly_hours = extraForm.full_time_weekly_hours || "40";
        patch.partiality_coefficient = "100";
        Object.assign(patch, calculateHoursFromWeekly(patch.weekly_hours));
      }
      updateExtra(patch);
      return;
    }

    if (name === "weekly_hours" || name === "full_time_weekly_hours" || name === "ordinary_hours" || name === "comparison_hours") {
      const next = { ...extraForm, [name]: value };
      const calculated = calculatePartiality(next.weekly_hours, next.full_time_weekly_hours);
      if (calculated) next.partiality_coefficient = calculated;
      Object.assign(next, calculateHoursFromWeekly(next.weekly_hours));
      updateExtra(next);
      return;
    }

    if (name === "seniority_criterion") {
      updateExtra({ seniority_criterion: value, seniority_date: value === "start_date" ? form.start_date : extraForm.seniority_date });
      return;
    }

    updateExtra({ [name]: nextValue });
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
    onSubmit(event, { contractExtra: extraForm, socialSecurity: buildSsPayload(ssForm, form, extraForm) });
  };

  return (
    <>
      <form onSubmit={handleSubmit} style={styles.form}>
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
                  {selectedEmployee && <div style={styles.selectorMeta}>Vida laboral de: {selectedEmployee.first_name} {selectedEmployee.last_name} · Código {getEmployeeCode(selectedEmployee)} · DNI {selectedEmployee.dni || "-"} · NAF {selectedEmployee.naf || "-"}</div>}
                </div>
                <button type="button" onClick={() => setEmployeeModalOpen(true)} style={styles.secondaryButton}>Buscar</button>
              </div>
              <input type="hidden" name="employee_id" value={form.employee_id} required />
            </div>
            <div style={styles.formGroupWide}>
              <label>Empresa y centro</label>
              <div style={styles.readOnlyBox}><div style={styles.readOnlyMain}>{selectedCompany?.name || "Se completará al seleccionar trabajador"}</div><div style={styles.readOnlyMeta}>{selectedCenter?.name || "Centro pendiente"}{selectedCompany?.ccc ? ` · CCC ${selectedCompany.ccc}` : ""}</div></div>
              <input type="hidden" name="company_id" value={form.company_id} required />
              <input type="hidden" name="center_id" value={form.center_id || ""} />
            </div>
          </div>
          {activeOtherContracts.length > 0 && <OtherContractsCard contracts={activeOtherContracts} companies={companies} workCenters={workCenters} />}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Datos contractuales</h3>
          <div style={styles.formGrid}>
            <Field label="Código contrato"><select name="contract_code" value={extraForm.contract_code} onChange={handleExtraChange} style={styles.input}><option value="">Selecciona código</option>{catalogs.contracts.map((item) => <option key={item.contract_code} value={item.contract_code}>{item.contract_code} · {item.contract_code_description}</option>)}</select></Field>
            <Field label="Tipo de contrato"><select name="contract_type" value={form.contract_type} onChange={handleBaseChange} required style={styles.input}><option value="">Selecciona tipo</option><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="formacion">Formación</option><option value="sustitucion">Sustitución</option></select></Field>
            <Field label="Fecha de alta"><input type="date" name="start_date" value={form.start_date} onChange={handleBaseChange} required style={styles.input} /></Field>
            <Field label="Criterio antigüedad"><select name="seniority_criterion" value={extraForm.seniority_criterion} onChange={handleExtraChange} style={styles.input}><option value="start_date">Tomar fecha de alta</option><option value="previous">Respetar antigüedad anterior</option><option value="manual">Introducir fecha manual</option></select></Field>
            <Field label="Fecha antigüedad"><input type="date" name="seniority_date" value={extraForm.seniority_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Fecha baja"><input type="date" name="end_date" value={form.end_date} onChange={handleBaseChange} style={styles.input} /></Field>
            <Field label="Causa baja"><input name="termination_reason" value={extraForm.termination_reason} onChange={handleExtraChange} placeholder="Ej. fin sustitución" style={styles.input} /></Field>
            <Field label="Estado"><select name="status" value={form.status} onChange={handleBaseChange} style={styles.input}><option value="active">Activo</option><option value="ended">Finalizado</option><option value="transformed">Transformado</option><option value="replaced">Sustituido</option><option value="cancelled">Anulado</option></select></Field>
          </div>
          {extraForm.contract_code_description && <div style={styles.infoBox}>{extraForm.contract_code_description}</div>}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Transformación de contrato</h3>
          <div style={styles.formGrid}>
            <Field label="Contrato origen"><select name="transformation_from_contract_id" value={extraForm.transformation_from_contract_id} onChange={handleExtraChange} style={styles.input}><option value="">Sin transformación</option>{workerContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_code || contract.contract_type} · alta {contract.start_date}</option>)}</select></Field>
            <Field label="Fecha transformación"><input type="date" name="transformation_date" value={extraForm.transformation_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Motivo / observaciones"><input name="transformation_reason" value={extraForm.transformation_reason} onChange={handleExtraChange} placeholder="Transformación a indefinido, cambio modalidad..." style={styles.input} /></Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Bonificación</h3>
          <div style={styles.formGrid}>
            <Field label="Tipo bonificación"><select name="bonus_type" value={extraForm.bonus_type} onChange={handleExtraChange} style={styles.input}>{BONUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Fecha inicio"><input type="date" name="bonus_start_date" value={extraForm.bonus_start_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Fecha fin"><input type="date" name="bonus_end_date" value={extraForm.bonus_end_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Cuota fija"><input type="number" step="0.01" name="bonus_fixed_fee" value={extraForm.bonus_fixed_fee} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Observaciones"><input name="bonus_observations" value={extraForm.bonus_observations} onChange={handleExtraChange} style={styles.input} /></Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Convenio, categoría y funciones</h3>
          <div style={styles.formGrid}>
            <Field label="Convenio colectivo"><select value={extraForm.collective_agreement_id} onChange={handleAgreementChange} style={styles.input}><option value="">Sin convenio</option>{collectiveAgreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.agreement_code || "sin código"}</option>)}</select></Field>
            <Field label="Categoría convenio"><select value={extraForm.professional_category_id} onChange={handleCategoryChange} disabled={!agreementDetail} style={styles.input}><option value="">Seleccionar categoría</option>{agreementCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.level ? ` · ${category.level}` : ""}</option>)}</select></Field>
            <Field label="Fila salarial"><select value={extraForm.salary_table_row_id} onChange={handleSalaryRowChange} disabled={!agreementDetail} style={styles.input}><option value="">Sin fila salarial</option>{salaryRows.filter((row) => !extraForm.professional_category_id || String(row.professional_category_id) === String(extraForm.professional_category_id)).map((row) => <option key={row.id} value={row.id}>{row.table_name} · {row.category_name || "Categoría"} · {money(row.base_salary)}</option>)}</select></Field>
            <Field label="Código convenio"><input name="collective_agreement_code" value={extraForm.collective_agreement_code} onChange={handleExtraChange} placeholder="Código oficial o interno" style={styles.input} /></Field>
            <Field label="Categoría manual"><input name="professional_category" value={extraForm.professional_category} onChange={handleExtraChange} placeholder="Ej. Oficial administrativo" style={styles.input} /></Field>
            <Field label="Puesto"><input name="job_position" value={extraForm.job_position} onChange={handleExtraChange} placeholder="Ej. Técnico de RRHH" style={styles.input} /></Field>
            <Field label="Sección"><input name="section" value={extraForm.section} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Grupo"><input name="group_name" value={extraForm.group_name} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Descripción funciones"><textarea name="function_description" value={extraForm.function_description} onChange={handleExtraChange} style={styles.textarea} /></Field>
          </div>
          {agreementLoading && <div style={styles.infoBox}>Cargando detalle del convenio...</div>}
          {selectedSalaryRow && <div style={styles.infoBox}>Salario base mínimo propuesto: {money(selectedSalaryRow.base_salary)}. El alumno puede modificarlo manualmente.</div>}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Jornada, parcialidad y horario</h3>
          <div style={styles.formGrid}>
            <Field label="Tipo jornada"><select name="working_day_type" value={extraForm.working_day_type} onChange={handleExtraChange} style={styles.input}>{catalogOrFallback(catalogs.working_day_types, [{ code: "full_time", description: "Jornada completa" }, { code: "part_time", description: "Jornada parcial" }, { code: "fixed_discontinuous", description: "Fijo discontinuo" }]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></Field>
            <Field label="Jornada ordinaria"><input type="number" name="ordinary_hours" value={extraForm.ordinary_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Periodo"><select name="ordinary_hours_period" value={extraForm.ordinary_hours_period} onChange={handleExtraChange} style={styles.input}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option><option value="year">Año</option></select></Field>
            <Field label="Inferior a"><select name="comparison_reference_type" value={extraForm.comparison_reference_type} onChange={handleExtraChange} style={styles.input}><option value="comparable_full_time_worker">Trabajador a tiempo completo comparable</option><option value="collective_agreement_full_time">Jornada completa del convenio colectivo</option><option value="legal_maximum">Jornada máxima legal</option></select></Field>
            <Field label="Jornada ref."><input type="number" name="comparison_hours" value={extraForm.comparison_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Horas semanales"><input type="number" name="weekly_hours" value={extraForm.weekly_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Jornada completa ref."><input type="number" name="full_time_weekly_hours" value={extraForm.full_time_weekly_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Coeficiente parcialidad"><input type="number" name="partiality_coefficient" value={extraForm.partiality_coefficient} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Jornada anual convenio"><input type="number" name="annual_agreement_hours" value={extraForm.annual_agreement_hours} onChange={handleExtraChange} placeholder="Ej. 1780" style={styles.input} /></Field>
            <Field label="Horas mensuales"><input type="number" name="monthly_hours" value={extraForm.monthly_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Horas anuales"><input type="number" name="annual_hours" value={extraForm.annual_hours} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Pago devengos"><select name="pay_accrual_mode" value={extraForm.pay_accrual_mode} onChange={handleExtraChange} style={styles.input}><option value="workday_percentage">Porcentaje jornada</option><option value="hour_value">Valor hora</option><option value="manual_amount">Importe manual</option></select></Field>
            <Field label="Cotización"><select name="contribution_hours_mode" value={extraForm.contribution_hours_mode} onChange={handleExtraChange} style={styles.input}><option value="hours_number">Nº horas</option><option value="real_hours">Horas reales</option><option value="workday_percentage">Porcentaje jornada</option></select></Field>
            <Field label="Distribución del tiempo"><textarea name="work_distribution" value={extraForm.work_distribution} onChange={handleExtraChange} placeholder="Ej. lunes a viernes de 9:00 a 13:00" style={styles.textarea} /></Field>
            <Field label="Horario / notas"><textarea name="schedule_notes" value={extraForm.schedule_notes} onChange={handleExtraChange} style={styles.textarea} /></Field>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Reducción, inactividad y festivos</h3>
          <div style={styles.formGrid}>
            <Field label="Causa reducción"><select name="legal_workday_reduction_cause" value={extraForm.legal_workday_reduction_cause} onChange={handleExtraChange} style={styles.input}>{REDUCTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Inicio reducción"><input type="date" name="legal_workday_reduction_start" value={extraForm.legal_workday_reduction_start} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Fin reducción"><input type="date" name="legal_workday_reduction_end" value={extraForm.legal_workday_reduction_end} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="% reducción"><input type="number" name="legal_workday_reduction_percentage" value={extraForm.legal_workday_reduction_percentage} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Inicio inactividad"><input type="date" name="inactivity_start_date" value={extraForm.inactivity_start_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Vuelta inactividad"><input type="date" name="inactivity_return_date" value={extraForm.inactivity_return_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Comunicación inicio"><input type="date" name="inactivity_start_communication_date" value={extraForm.inactivity_start_communication_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Comunicación vuelta"><input type="date" name="inactivity_return_communication_date" value={extraForm.inactivity_return_communication_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Ámbito festivos"><input name="holiday_scope" value={extraForm.holiday_scope} onChange={handleExtraChange} placeholder="Nacionales, autonómicos, locales..." style={styles.input} /></Field>
          </div>
          <div style={styles.checkboxRow}><label style={styles.checkboxLabel}><input type="checkbox" name="works_holidays" checked={extraForm.works_holidays} onChange={handleExtraChange} /> Trabaja festivos</label><label style={styles.checkboxLabel}><input type="checkbox" name="holiday_only_service_days" checked={extraForm.holiday_only_service_days} onChange={handleExtraChange} /> Solo festivos que coincidan con días de prestación</label></div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Afiliación, subrogación y relación especial</h3>
          <div style={styles.formGrid}>
            <Field label="NIF trabajador"><input value={selectedEmployee?.dni || ""} readOnly style={styles.input} /></Field>
            <Field label="NAF trabajador"><input value={selectedEmployee?.naf || ""} readOnly style={styles.input} /></Field>
            <Field label="Nº tarjeta sanitaria"><input name="health_card_number" value={extraForm.health_card_number} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Tipo relación"><select name="relation_type" value={extraForm.relation_type} onChange={handleExtraChange} style={styles.input}>{RELATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            {extraForm.relation_type === "employee" && <Field label="Representación"><select name="representation_type" value={extraForm.representation_type} onChange={handleExtraChange} style={styles.input}><option value="none">Ninguno</option><option value="comite_empresa_personal">Comité empresa del personal</option><option value="comite_seguridad">Comité de seguridad</option></select></Field>}
            {extraForm.relation_type === "sin_desempleo_hijo_autonomo" && <Field label="Subtipo relación"><select name="relation_subtype" value={extraForm.relation_subtype} onChange={handleExtraChange} style={styles.input}><option value="familiar_no_asalariado">Familiar no asalariado</option><option value="extranjero_permiso_trabajo">Extranjero permiso de trabajo</option><option value="hijo_titular_explotacion">Hijo del titular de la explotación</option><option value="familiar_hasta_segundo_grado">Familiar hasta 2º grado</option><option value="hijo_menor_20">Hijo menor de 20 años</option><option value="familiar_menor_45">Familiar menor de 45 años</option></select></Field>}
            <Field label="Empresa origen subrogación"><input name="subrogation_company_origin" value={extraForm.subrogation_company_origin} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Fecha subrogación"><input type="date" name="subrogation_date" value={extraForm.subrogation_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Antigüedad reconocida"><input type="date" name="recognized_seniority_date" value={extraForm.recognized_seniority_date} onChange={handleExtraChange} style={styles.input} /></Field>
          </div>
          <div style={styles.checkboxRow}><label style={styles.checkboxLabel}><input type="checkbox" name="subrogation" checked={extraForm.subrogation} onChange={handleExtraChange} /> Subrogación contrato</label><label style={styles.checkboxLabel}><input type="checkbox" name="affects_extra_payments" checked={extraForm.affects_extra_payments} onChange={handleExtraChange} /> Afecta pagas extra</label></div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Datos RED / administrativos</h3>
          <div style={styles.formGrid}>
            <Field label="Grupo cotización"><select name="contribution_group" value={extraForm.contribution_group} onChange={(event) => { handleExtraChange(event); updateSs({ contribution_group: event.target.value, red_contribution_group: event.target.value }); }} style={styles.input}><option value="">Selecciona grupo</option>{catalogs.contribution_groups.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field>
            <Field label="Indicador cotización"><select name="monthly_or_daily_contribution" value={extraForm.monthly_or_daily_contribution} onChange={(event) => { handleExtraChange(event); updateSs({ monthly_or_daily_contribution: event.target.value }); }} style={styles.input}>{catalogOrFallback(catalogs.monthly_daily_contribution_types, [{ code: "monthly", description: "Cotización mensual" }, { code: "daily", description: "Cotización diaria" }]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></Field>
            <Field label="Nº matrícula"><input name="registration_number" value={extraForm.registration_number} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Nº autorización"><input name="authorization_number" value={extraForm.authorization_number} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Clave"><input name="red_key" value={extraForm.red_key} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Cont"><input name="red_cont" value={extraForm.red_cont} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="CNO"><input name="cno_code" value={extraForm.cno_code} onChange={handleExtraChange} placeholder="Código" style={styles.input} /></Field>
            <Field label="Descripción CNO"><input name="cno_description" value={extraForm.cno_description} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="CNAE empresa"><input name="company_cnae" value={extraForm.company_cnae} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Ocupación"><input name="occupation" value={extraForm.occupation} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="IT"><input type="number" step="0.001" name="it_rate" value={extraForm.it_rate} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="IMS"><input type="number" step="0.001" name="ims_rate" value={extraForm.ims_rate} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Ocupación RED"><input name="red_occupation_code" value={extraForm.red_occupation_code} onChange={(event) => { handleExtraChange(event); updateSs({ red_occupation_code: event.target.value }); }} style={styles.input} /></Field>
            <Field label="Código reducción RED"><input name="red_reduction_code" value={extraForm.red_reduction_code} onChange={(event) => { handleExtraChange(event); updateSs({ red_reduction_code: event.target.value }); }} style={styles.input} /></Field>
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
          <h3 style={styles.sectionTitle}>Retribución y registro</h3>
          <div style={styles.formGrid}>
            <Field label="Salario base / mínimo convenio"><input type="number" name="salary_base" value={form.salary_base} onChange={handleBaseChange} placeholder="Ej. 1525" style={styles.input} /></Field>
            <Field label="Sistema de pagas"><select name="pay_schedule" value={form.pay_schedule || "not_prorated_14"} onChange={handleBaseChange} required style={styles.input}>{PAY_SCHEDULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
            <Field label="Nº registro contrato"><input name="contract_registry_number" value={extraForm.contract_registry_number} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Fecha registro"><input type="date" name="contract_registry_date" value={extraForm.contract_registry_date} onChange={handleExtraChange} style={styles.input} /></Field>
            <Field label="Oficina registro"><input name="contract_registry_office" value={extraForm.contract_registry_office} onChange={handleExtraChange} style={styles.input} /></Field>
          </div>
        </section>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}
        <button type="submit" disabled={submitting} style={styles.button}>{submitting ? "Guardando..." : "Crear contrato y alta SS"}</button>
      </form>

      {employeeModalOpen && <EmployeeModal employees={filteredEmployees} companies={companies} workCenters={workCenters} employeeFilters={employeeFilters} onFilterChange={(event) => setEmployeeFilters((prev) => ({ ...prev, [event.target.name]: event.target.value }))} onSelect={selectEmployee} onClose={() => setEmployeeModalOpen(false)} getEmployeeCode={getEmployeeCode} />}
    </>
  );
}

function DidacticRulesPanel() {
  return <section style={styles.rulesPanel}><div><h3 style={styles.rulesTitle}>Reglas didácticas activas</h3><p style={styles.rulesText}>El convenio es una guía de consulta. El cálculo final sigue siendo manual.</p></div><ul style={styles.rulesList}>{DIDACTIC_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul></section>;
}

function OtherContractsCard({ contracts, companies, workCenters }) {
  return <div style={styles.infoBox}><strong>Trabajador en otros centros o contratos activos:</strong>{contracts.map((contract) => { const company = companies.find((item) => Number(item.id) === Number(contract.company_id)); const center = workCenters.find((item) => Number(item.id) === Number(contract.center_id)); return <div key={contract.id}>Contrato {contract.contract_code || contract.contract_type} · {company?.name || "Empresa"}{center?.name ? ` · ${center.name}` : ""} · alta {contract.start_date}</div>; })}</div>;
}

function Field({ label, children }) {
  return <div style={styles.formGroup}><label>{label}</label>{children}</div>;
}

function EmployeeModal({ employees, companies, workCenters, employeeFilters, onFilterChange, onSelect, onClose, getEmployeeCode }) {
  return (
    <div style={styles.modalOverlay}><div style={styles.modal}><div style={styles.modalHeader}><div><h3 style={styles.modalTitle}>Seleccionar trabajador</h3><p style={styles.modalSubtitle}>Filtra por código visible, nombre o DNI.</p></div><button type="button" onClick={onClose} style={styles.closeButton}>Cerrar</button></div><div style={styles.filterRow}><div style={styles.filterGroupId}><label>Código</label><input name="id" value={employeeFilters.id} onChange={onFilterChange} placeholder="Ej. 1.2" style={styles.input} /></div><div style={styles.filterGroupName}><label>Nombre y apellidos</label><input name="name" value={employeeFilters.name} onChange={onFilterChange} placeholder="Nombre o apellidos" style={styles.input} /></div><div style={styles.filterGroupDni}><label>DNI</label><input name="dni" value={employeeFilters.dni} onChange={onFilterChange} placeholder="DNI" style={styles.input} /></div></div><div style={styles.modalTableWrapper}><table style={styles.table}><thead><tr><th style={styles.th}>Código</th><th style={styles.th}>Trabajador</th><th style={styles.th}>DNI</th><th style={styles.th}>Empresa / centro</th><th style={styles.th}></th></tr></thead><tbody>{employees.map((emp) => { const employeeCompany = companies.find((company) => Number(company.id) === Number(emp.company_id)); const employeeCenter = workCenters.find((center) => Number(center.id) === Number(emp.center_id)); return <tr key={emp.id}><td style={styles.td}>{getEmployeeCode(emp)}</td><td style={styles.td}>{emp.first_name} {emp.last_name}</td><td style={styles.td}>{emp.dni || "-"}</td><td style={styles.td}>{employeeCompany?.name || "-"}{employeeCenter?.name ? ` · ${employeeCenter.name}` : ""}</td><td style={styles.tdRight}><button type="button" onClick={() => onSelect(emp)} style={styles.smallButton}>Seleccionar</button></td></tr>; })}{employees.length === 0 && <tr><td style={styles.td} colSpan="5">No hay trabajadores con esos filtros.</td></tr>}</tbody></table></div></div></div>
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
  textarea: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", backgroundColor: "white", minHeight: "74px" },
  selectorBox: { minHeight: "42px", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  selectorValue: { fontSize: "14px", color: "#111827", fontWeight: 700 },
  selectorMeta: { marginTop: "2px", fontSize: "12px", color: "#6b7280" },
  readOnlyBox: { minHeight: "42px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "#f9fafb" },
  readOnlyMain: { fontSize: "14px", color: "#111827", fontWeight: 800 },
  readOnlyMeta: { marginTop: "2px", fontSize: "12px", color: "#6b7280", fontWeight: 600 },
  infoBox: { marginTop: "12px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#fef3c7", color: "#111827", fontSize: "13px", fontWeight: 700 },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px" },
  checkboxRow: { marginTop: "14px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", display: "flex", gap: "18px", flexWrap: "wrap" },
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
