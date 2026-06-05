import { useEffect, useMemo, useState } from "react";

import { fetchCatalogs } from "../services/api";
import { fetchCollectiveAgreement } from "../services/collectiveAgreementApi";
import { getEmployeeVisibleCode } from "../utils/visibleCodes";

export const PAY_SCHEDULE_OPTIONS = [
  { value: "prorated_12", label: "12 pagas prorrateadas" },
  { value: "not_prorated_14", label: "14 pagas" },
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
  return PAY_SCHEDULE_OPTIONS.find((option) => option.value === value)?.label || "14 pagas";
}

function inferContractType(contractFamily) {
  if (contractFamily === "indefinite" || contractFamily === "fixed_discontinuous") return "indefinido";
  if (contractFamily === "training") return "formacion";
  if (contractFamily === "replacement") return "sustitucion";
  return "temporal";
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isNaN(number) ? 0 : number;
}

function calculateHoursFromWeekly(weeklyHours) {
  const weekly = toNumber(weeklyHours);
  if (!weekly) return { monthly_hours: "", annual_hours: "" };
  return {
    monthly_hours: String(Math.round((weekly * 52 / 12) * 100) / 100),
    annual_hours: String(Math.round((weekly * 52) * 100) / 100),
  };
}

function calculatePartiality(weeklyHours, fullTimeWeeklyHours) {
  const weekly = toNumber(weeklyHours);
  const fullTime = toNumber(fullTimeWeeklyHours || 40);
  if (!weekly || !fullTime) return "";
  return String(Math.round((weekly / fullTime) * 10000) / 100);
}

function money(value) {
  return `${toNumber(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
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

function getRowBaseSalary(row) {
  return row?.base_salary ?? row?.monthly_salary ?? row?.salary ?? "";
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
  const [catalogs, setCatalogs] = useState(DEFAULT_CATALOGS);
  const [catalogError, setCatalogError] = useState("");
  const [extraForm, setExtraForm] = useState(EMPTY_EXTRA);
  const [ssForm, setSsForm] = useState(EMPTY_SS);
  const [agreementDetail, setAgreementDetail] = useState(null);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [salaryLines, setSalaryLines] = useState([]);

  useEffect(() => {
    let active = true;
    fetchCatalogs()
      .then((data) => {
        if (!active) return;
        setCatalogs({ ...DEFAULT_CATALOGS, ...data });
        setCatalogError("");
      })
      .catch((err) => {
        if (active) setCatalogError(err.message || "No se pudieron cargar los catálogos laborales");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!extraForm.collective_agreement_id) {
      setAgreementDetail(null);
      return;
    }
    let active = true;
    setAgreementLoading(true);
    fetchCollectiveAgreement(extraForm.collective_agreement_id)
      .then((data) => { if (active) setAgreementDetail(data); })
      .catch(() => { if (active) setAgreementDetail(null); })
      .finally(() => { if (active) setAgreementLoading(false); });
    return () => { active = false; };
  }, [extraForm.collective_agreement_id]);

  useEffect(() => {
    if (success) {
      setExtraForm(EMPTY_EXTRA);
      setSsForm(EMPTY_SS);
      setAgreementDetail(null);
      setSalaryLines([]);
      setActiveModal(null);
    }
  }, [success]);

  const selectedEmployee = employees.find((employee) => String(employee.id) === String(form.employee_id));
  const selectedCompany = companies.find((company) => String(company.id) === String(form.company_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(form.center_id));
  const workerContracts = contracts.filter((contract) => String(contract.employee_id) === String(form.employee_id));
  const activeOtherContracts = workerContracts.filter((contract) => contract.status === "active");
  const agreementCategories = agreementDetail?.professional_categories || [];
  const salaryTables = agreementDetail?.salary_tables || [];
  const salaryRows = salaryTables.flatMap((table) => (table.rows || []).map((row) => ({ ...row, table_name: table.name })));
  const selectedSalaryRow = salaryRows.find((row) => String(row.id) === String(extraForm.salary_table_row_id));
  const isPartialContract = extraForm.working_day_type === "part_time" || String(extraForm.contract_code || "").startsWith("5");
  const baseMonthly = toNumber(form.salary_base || getRowBaseSalary(selectedSalaryRow));
  const supplementsMonthly = salaryLines.reduce((sum, line) => sum + toNumber(line.amount), 0);
  const totalMonthly = baseMonthly + supplementsMonthly;
  const payMonths = form.pay_schedule === "prorated_12" ? 12 : 14;
  const totalAnnual = totalMonthly * payMonths;

  const updateExtra = (patch) => setExtraForm((prev) => ({ ...prev, ...patch }));
  const updateSs = (patch) => setSsForm((prev) => ({ ...prev, ...patch }));

  const handleBaseChange = (event) => {
    const { name, value } = event.target;
    onChange(event);
    if (name === "start_date") {
      if (!ssForm.registration_date) updateSs({ registration_date: value });
      if (extraForm.seniority_criterion === "start_date") updateExtra({ seniority_date: value });
    }
  };

  const handleEmployeeChange = (event) => {
    const employee = employees.find((item) => String(item.id) === String(event.target.value));
    onChange({ target: { name: "employee_id", value: event.target.value } });
    onChange({ target: { name: "company_id", value: employee?.company_id ? String(employee.company_id) : "" } });
    onChange({ target: { name: "center_id", value: employee?.center_id ? String(employee.center_id) : "" } });
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
    const proposedSalary = getRowBaseSalary(row);
    if (proposedSalary !== "") onChange({ target: { name: "salary_base", value: String(proposedSalary) } });
  };

  const handleExtraChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (name === "contract_code") {
      const selected = catalogs.contracts.find((item) => item.contract_code === value);
      const nextWorkingDay = value.startsWith("5") ? "part_time" : value.startsWith("3") ? "fixed_discontinuous" : value.startsWith("4") || value.startsWith("1") ? "full_time" : extraForm.working_day_type;
      const nextWeeklyHours = nextWorkingDay === "full_time" ? (extraForm.full_time_weekly_hours || "40") : extraForm.weekly_hours;
      const nextPartiality = nextWorkingDay === "full_time" ? "100" : calculatePartiality(nextWeeklyHours, extraForm.full_time_weekly_hours);
      updateExtra({ contract_code: value, contract_code_description: selected?.contract_code_description || "", contract_family: selected?.contract_family || "", working_day_type: nextWorkingDay, weekly_hours: nextWeeklyHours, partiality_coefficient: nextPartiality, red_key: value, ...calculateHoursFromWeekly(nextWeeklyHours) });
      updateSs({ red_contract_key: value });
      if (selected?.contract_family) onChange({ target: { name: "contract_type", value: inferContractType(selected.contract_family) } });
      return;
    }

    if (["weekly_hours", "full_time_weekly_hours", "ordinary_hours", "comparison_hours"].includes(name)) {
      const next = { ...extraForm, [name]: value };
      const calculated = calculatePartiality(next.weekly_hours, next.full_time_weekly_hours);
      if (calculated) next.partiality_coefficient = calculated;
      Object.assign(next, calculateHoursFromWeekly(next.weekly_hours));
      setExtraForm(next);
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

  const addSalaryLine = () => {
    setSalaryLines((prev) => [...prev, { id: Date.now(), name: "Plus", amount: "0", type: "complement" }]);
  };

  const updateSalaryLine = (id, patch) => {
    setSalaryLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const removeSalaryLine = (id) => {
    setSalaryLines((prev) => prev.filter((line) => line.id !== id));
  };

  const handleSubmit = (event) => {
    onSubmit(event, {
      contractExtra: {
        ...extraForm,
        gross_annual_salary: String(Math.round(totalAnnual * 100) / 100),
        bonus_observations: [extraForm.bonus_observations, salaryLines.length ? `Complementos: ${salaryLines.map((line) => `${line.name} ${line.amount}`).join("; ")}` : ""].filter(Boolean).join(" | "),
      },
      socialSecurity: buildSsPayload(ssForm, form, extraForm),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {catalogError && <div style={styles.warning}>{catalogError}</div>}

      <Section title="Datos principales">
        <div style={styles.formGrid}>
          <Field label="Trabajador"><select name="employee_id" value={form.employee_id} onChange={handleEmployeeChange} required style={styles.input}><option value="">Selecciona trabajador</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{getEmployeeVisibleCode(employee, employees, contracts)} · {employee.first_name} {employee.last_name} · {employee.dni || "sin DNI"}</option>)}</select></Field>
          <Field label="Código contrato"><select name="contract_code" value={extraForm.contract_code} onChange={handleExtraChange} style={styles.input}><option value="">Selecciona código</option>{catalogs.contracts.map((item) => <option key={item.contract_code} value={item.contract_code}>{item.contract_code} · {item.contract_code_description}</option>)}</select></Field>
          <Field label="Tipo"><select name="contract_type" value={form.contract_type} onChange={handleBaseChange} required style={styles.input}><option value="">Selecciona tipo</option><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="formacion">Formación</option><option value="sustitucion">Sustitución</option></select></Field>
          <Field label="Fecha alta"><input type="date" name="start_date" value={form.start_date} onChange={handleBaseChange} required style={styles.input} /></Field>
          <Field label="Fecha baja"><input type="date" name="end_date" value={form.end_date} onChange={handleBaseChange} style={styles.input} /></Field>
          <Field label="Causa baja"><input name="termination_reason" value={extraForm.termination_reason} onChange={handleExtraChange} style={styles.input} /></Field>
          <Field label="Estado"><select name="status" value={form.status} onChange={handleBaseChange} style={styles.input}><option value="active">Activo</option><option value="ended">Finalizado</option><option value="transformed">Transformado</option><option value="replaced">Sustituido</option><option value="cancelled">Anulado</option></select></Field>
          <Field label="Antigüedad"><input type="date" name="seniority_date" value={extraForm.seniority_date} onChange={handleExtraChange} style={styles.input} /></Field>
        </div>
        <div style={styles.summaryRow}>
          <SummaryCard title="Empresa" value={selectedCompany?.name || "Pendiente"} meta={selectedCenter?.name || "Sin centro"} />
          <SummaryCard title="Trabajador" value={selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : "Sin seleccionar"} meta={`DNI ${selectedEmployee?.dni || "-"} · NAF ${selectedEmployee?.naf || "-"}`} />
          <SummaryCard title="Contrato" value={extraForm.contract_code || "Sin código"} meta={extraForm.contract_code_description || "Sin modalidad"} />
        </div>
        {activeOtherContracts.length > 0 && <OtherContractsCard contracts={activeOtherContracts} companies={companies} workCenters={workCenters} />}
      </Section>

      <Section title="Retribución">
        <div style={styles.formGrid}>
          <Field label="Convenio"><select value={extraForm.collective_agreement_id} onChange={handleAgreementChange} style={styles.input}><option value="">Sin convenio</option>{collectiveAgreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.agreement_code || "sin código"}</option>)}</select></Field>
          <Field label="Categoría profesional"><select value={extraForm.professional_category_id} onChange={handleCategoryChange} disabled={!agreementDetail} style={styles.input}><option value="">Seleccionar categoría</option>{agreementCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.level ? ` · ${category.level}` : ""}</option>)}</select></Field>
          <Field label="Tabla salarial"><select value={extraForm.salary_table_row_id} onChange={handleSalaryRowChange} disabled={!agreementDetail} style={styles.input}><option value="">Sin fila salarial</option>{salaryRows.map((row) => <option key={row.id} value={row.id}>{row.table_name} · {row.category_name || "Categoría"} · {money(getRowBaseSalary(row))}</option>)}</select></Field>
          <Field label="Salario base editable"><input type="number" step="0.01" name="salary_base" value={form.salary_base} onChange={handleBaseChange} placeholder="Selecciona categoría o introduce importe" style={styles.input} /></Field>
          <Field label="Sistema de pagas"><select name="pay_schedule" value={form.pay_schedule || "not_prorated_14"} onChange={handleBaseChange} required style={styles.input}>{PAY_SCHEDULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="Categoría manual"><input name="professional_category" value={extraForm.professional_category} onChange={handleExtraChange} style={styles.input} /></Field>
          <Field label="Puesto"><input name="job_position" value={extraForm.job_position} onChange={handleExtraChange} style={styles.input} /></Field>
        </div>
        {agreementLoading && <div style={styles.infoBox}>Cargando detalle del convenio...</div>}
        <div style={styles.salaryPanel}>
          <div style={styles.salaryHeader}>
            <div><strong>Complementos y pluses</strong><div style={styles.muted}>Se suman al salario base mensual para obtener la retribución estimada.</div></div>
            <button type="button" onClick={addSalaryLine} style={styles.secondaryButton}>Añadir plus</button>
          </div>
          {salaryLines.length === 0 && <div style={styles.emptyLine}>Sin complementos añadidos.</div>}
          {salaryLines.map((line) => <div key={line.id} style={styles.salaryLine}><input value={line.name} onChange={(event) => updateSalaryLine(line.id, { name: event.target.value })} style={styles.input} /><select value={line.type} onChange={(event) => updateSalaryLine(line.id, { type: event.target.value })} style={styles.input}><option value="complement">Complemento</option><option value="plus">Plus</option><option value="improvement">Mejora voluntaria</option></select><input type="number" step="0.01" value={line.amount} onChange={(event) => updateSalaryLine(line.id, { amount: event.target.value })} style={styles.input} /><button type="button" onClick={() => removeSalaryLine(line.id)} style={styles.dangerButton}>Quitar</button></div>)}
          <div style={styles.salaryTotals}><span>Base: {money(baseMonthly)}</span><span>Complementos: {money(supplementsMonthly)}</span><strong>Total mensual: {money(totalMonthly)}</strong><strong>Total anual: {money(totalAnnual)}</strong></div>
        </div>
      </Section>

      <Section title="Opciones avanzadas">
        <div style={styles.actionGrid}>
          <ActionCard title="Transformación" text={extraForm.transformation_from_contract_id ? "Transformación configurada" : "Sin transformación"} onClick={() => setActiveModal("transformation")} />
          <ActionCard title="Parcialidad" text={isPartialContract ? `${extraForm.weekly_hours || 0} h/sem · ${extraForm.partiality_coefficient || 0}%` : "Solo disponible para contratos parciales"} disabled={!isPartialContract} onClick={() => setActiveModal("partiality")} />
          <ActionCard title="Reducción / Subrogación / Relación" text="Situaciones especiales" onClick={() => setActiveModal("special")} />
          <ActionCard title="Bonificación" text={extraForm.bonus_type ? "Bonificación configurada" : "Sin bonificación"} onClick={() => setActiveModal("bonus")} />
          <ActionCard title="Datos RED y registro" text="Afiliación, CNO, CNAE, registro" onClick={() => setActiveModal("red")} />
        </div>
      </Section>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}
      <button type="submit" disabled={submitting} style={styles.button}>{submitting ? "Guardando..." : "Crear contrato"}</button>

      {activeModal === "transformation" && <Modal title="Transformación de contrato" onClose={() => setActiveModal(null)}><div style={styles.formGrid}><Field label="Contrato origen"><select name="transformation_from_contract_id" value={extraForm.transformation_from_contract_id} onChange={handleExtraChange} style={styles.input}><option value="">Sin transformación</option>{workerContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contract_code || contract.contract_type} · alta {contract.start_date}</option>)}</select></Field><Field label="Fecha transformación"><input type="date" name="transformation_date" value={extraForm.transformation_date} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Motivo"><input name="transformation_reason" value={extraForm.transformation_reason} onChange={handleExtraChange} style={styles.input} /></Field></div></Modal>}

      {activeModal === "partiality" && <Modal title="Tiempo parcial" onClose={() => setActiveModal(null)}><div style={styles.formGrid}><Field label="Horas ordinarias"><input type="number" name="ordinary_hours" value={extraForm.ordinary_hours} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Periodo"><select name="ordinary_hours_period" value={extraForm.ordinary_hours_period} onChange={handleExtraChange} style={styles.input}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option><option value="year">Año</option></select></Field><Field label="Inferior a"><select name="comparison_reference_type" value={extraForm.comparison_reference_type} onChange={handleExtraChange} style={styles.input}><option value="comparable_full_time_worker">Trabajador comparable</option><option value="collective_agreement_full_time">Jornada convenio</option><option value="legal_maximum">Jornada máxima legal</option></select></Field><Field label="Horas referencia"><input type="number" name="comparison_hours" value={extraForm.comparison_hours} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Horas semanales"><input type="number" name="weekly_hours" value={extraForm.weekly_hours} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Jornada completa ref."><input type="number" name="full_time_weekly_hours" value={extraForm.full_time_weekly_hours} onChange={handleExtraChange} style={styles.input} /></Field><Field label="% jornada"><input type="number" name="partiality_coefficient" value={extraForm.partiality_coefficient} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Distribución"><textarea name="work_distribution" value={extraForm.work_distribution} onChange={handleExtraChange} style={styles.textarea} /></Field><Field label="Pago devengos"><select name="pay_accrual_mode" value={extraForm.pay_accrual_mode} onChange={handleExtraChange} style={styles.input}><option value="workday_percentage">Porcentaje jornada</option><option value="hour_value">Valor hora</option><option value="manual_amount">Importe manual</option></select></Field><Field label="Cotización"><select name="contribution_hours_mode" value={extraForm.contribution_hours_mode} onChange={handleExtraChange} style={styles.input}><option value="hours_number">Nº horas</option><option value="real_hours">Horas reales</option><option value="workday_percentage">Porcentaje jornada</option></select></Field></div></Modal>}

      {activeModal === "special" && <Modal title="Reducción, subrogación y relación especial" onClose={() => setActiveModal(null)}><div style={styles.formGrid}><Field label="Causa reducción"><select name="legal_workday_reduction_cause" value={extraForm.legal_workday_reduction_cause} onChange={handleExtraChange} style={styles.input}>{REDUCTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Inicio reducción"><input type="date" name="legal_workday_reduction_start" value={extraForm.legal_workday_reduction_start} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Fin reducción"><input type="date" name="legal_workday_reduction_end" value={extraForm.legal_workday_reduction_end} onChange={handleExtraChange} style={styles.input} /></Field><Field label="% reducción"><input type="number" name="legal_workday_reduction_percentage" value={extraForm.legal_workday_reduction_percentage} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Tipo relación"><select name="relation_type" value={extraForm.relation_type} onChange={handleExtraChange} style={styles.input}>{RELATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Representación"><select name="representation_type" value={extraForm.representation_type} onChange={handleExtraChange} style={styles.input}><option value="none">Ninguno</option><option value="comite_empresa_personal">Comité empresa del personal</option><option value="comite_seguridad">Comité de seguridad</option></select></Field><Field label="Subtipo relación"><input name="relation_subtype" value={extraForm.relation_subtype} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Empresa origen"><input name="subrogation_company_origin" value={extraForm.subrogation_company_origin} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Fecha subrogación"><input type="date" name="subrogation_date" value={extraForm.subrogation_date} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Antigüedad reconocida"><input type="date" name="recognized_seniority_date" value={extraForm.recognized_seniority_date} onChange={handleExtraChange} style={styles.input} /></Field></div><div style={styles.checkboxRow}><label style={styles.checkboxLabel}><input type="checkbox" name="subrogation" checked={extraForm.subrogation} onChange={handleExtraChange} /> Subrogación</label><label style={styles.checkboxLabel}><input type="checkbox" name="affects_extra_payments" checked={extraForm.affects_extra_payments} onChange={handleExtraChange} /> Afecta pagas extra</label></div></Modal>}

      {activeModal === "bonus" && <Modal title="Bonificación" onClose={() => setActiveModal(null)}><div style={styles.formGrid}><Field label="Tipo bonificación"><select name="bonus_type" value={extraForm.bonus_type} onChange={handleExtraChange} style={styles.input}>{BONUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Inicio"><input type="date" name="bonus_start_date" value={extraForm.bonus_start_date} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Fin"><input type="date" name="bonus_end_date" value={extraForm.bonus_end_date} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Cuota fija"><input type="number" step="0.01" name="bonus_fixed_fee" value={extraForm.bonus_fixed_fee} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Observaciones"><textarea name="bonus_observations" value={extraForm.bonus_observations} onChange={handleExtraChange} style={styles.textarea} /></Field></div></Modal>}

      {activeModal === "red" && <Modal title="Datos RED y registro" onClose={() => setActiveModal(null)}><div style={styles.formGrid}><Field label="Grupo cotización"><select name="contribution_group" value={extraForm.contribution_group} onChange={(event) => { handleExtraChange(event); updateSs({ contribution_group: event.target.value, red_contribution_group: event.target.value }); }} style={styles.input}><option value="">Selecciona grupo</option>{catalogs.contribution_groups.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field><Field label="Indicador cotización"><select name="monthly_or_daily_contribution" value={extraForm.monthly_or_daily_contribution} onChange={(event) => { handleExtraChange(event); updateSs({ monthly_or_daily_contribution: event.target.value }); }} style={styles.input}>{catalogOrFallback(catalogs.monthly_daily_contribution_types, [{ code: "monthly", description: "Cotización mensual" }, { code: "daily", description: "Cotización diaria" }]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></Field><Field label="CNO"><input name="cno_code" value={extraForm.cno_code} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Descripción CNO"><input name="cno_description" value={extraForm.cno_description} onChange={handleExtraChange} style={styles.input} /></Field><Field label="CNAE"><input name="company_cnae" value={extraForm.company_cnae} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Ocupación"><input name="occupation" value={extraForm.occupation} onChange={handleExtraChange} style={styles.input} /></Field><Field label="IT"><input type="number" step="0.001" name="it_rate" value={extraForm.it_rate} onChange={handleExtraChange} style={styles.input} /></Field><Field label="IMS"><input type="number" step="0.001" name="ims_rate" value={extraForm.ims_rate} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Nº registro contrato"><input name="contract_registry_number" value={extraForm.contract_registry_number} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Fecha registro"><input type="date" name="contract_registry_date" value={extraForm.contract_registry_date} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Oficina registro"><input name="contract_registry_office" value={extraForm.contract_registry_office} onChange={handleExtraChange} style={styles.input} /></Field><Field label="Situación SS"><select name="situation_code" value={ssForm.situation_code} onChange={handleSsChange} style={styles.input}>{catalogOrFallback(catalogs.situations, [{ code: "1", description: "Alta" }]).map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field></div></Modal>}
    </form>
  );
}

function Section({ title, children }) {
  return <section style={styles.section}><h3 style={styles.sectionTitle}>{title}</h3>{children}</section>;
}

function Field({ label, children }) {
  return <div style={styles.formGroup}><label>{label}</label>{children}</div>;
}

function SummaryCard({ title, value, meta }) {
  return <div style={styles.summaryCard}><span>{title}</span><strong>{value}</strong><small>{meta}</small></div>;
}

function ActionCard({ title, text, onClick, disabled }) {
  return <button type="button" disabled={disabled} onClick={onClick} style={{ ...styles.actionCard, ...(disabled ? styles.actionCardDisabled : {}) }}><strong>{title}</strong><span>{text}</span></button>;
}

function OtherContractsCard({ contracts, companies, workCenters }) {
  return <div style={styles.infoBox}><strong>Trabajador en otros centros o contratos activos:</strong>{contracts.map((contract) => { const company = companies.find((item) => Number(item.id) === Number(contract.company_id)); const center = workCenters.find((item) => Number(item.id) === Number(contract.center_id)); return <div key={contract.id}>Contrato {contract.contract_code || contract.contract_type} · {company?.name || "Empresa"}{center?.name ? ` · ${center.name}` : ""} · alta {contract.start_date}</div>; })}</div>;
}

function Modal({ title, children, onClose }) {
  return <div style={styles.modalOverlay}><div style={styles.modal}><div style={styles.modalHeader}><h3>{title}</h3><button type="button" onClick={onClose} style={styles.closeButton}>Cerrar</button></div>{children}</div></div>;
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  section: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: "0 0 14px 0", fontSize: "15px", color: "#111827", fontWeight: 800 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  formGroup: { minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", backgroundColor: "white" },
  textarea: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", backgroundColor: "white", minHeight: "74px" },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "14px" },
  summaryCard: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px" },
  salaryPanel: { marginTop: "14px", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb" },
  salaryHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "10px" },
  salaryLine: { display: "grid", gridTemplateColumns: "1fr 180px 140px 90px", gap: "10px", marginTop: "8px" },
  salaryTotals: { marginTop: "12px", display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px" },
  emptyLine: { color: "#6b7280", fontSize: "13px" },
  muted: { color: "#6b7280", fontSize: "12px", marginTop: "2px" },
  actionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  actionCard: { textAlign: "left", border: "1px solid #d1d5db", borderRadius: "10px", padding: "12px", backgroundColor: "#ffffff", cursor: "pointer", display: "flex", flexDirection: "column", gap: "5px" },
  actionCardDisabled: { opacity: 0.45, cursor: "not-allowed", backgroundColor: "#f3f4f6" },
  infoBox: { marginTop: "12px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#fef3c7", color: "#111827", fontSize: "13px", fontWeight: 700 },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px" },
  checkboxRow: { marginTop: "14px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", display: "flex", gap: "18px", flexWrap: "wrap" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "12px 18px", fontSize: "14px", cursor: "pointer", width: "fit-content" },
  secondaryButton: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 700 },
  dangerButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", cursor: "pointer", fontWeight: 700 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "24px" },
  modal: { width: "min(980px, 96vw)", maxHeight: "86vh", overflow: "auto", backgroundColor: "white", borderRadius: "14px", padding: "18px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", marginBottom: "14px" },
  closeButton: { backgroundColor: "white", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 12px", cursor: "pointer" },
};
