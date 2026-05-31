import { useEffect, useMemo, useState } from "react";

import { fetchCatalogs } from "../services/api";
import { getContractVisibleCode } from "../utils/visibleCodes";
import { getSortLabel, nextSortConfig, sortRows } from "../utils/tableSorting";
import { formatPaySchedule, PAY_SCHEDULE_OPTIONS } from "./ContractForm";
import ContractSalarySummaryPanel from "./ContractSalarySummaryPanel";

const TERMINATION_REASONS = [
  { value: "fin_contrato_temporal", label: "Fin de contrato temporal" },
  { value: "baja_voluntaria", label: "Baja voluntaria" },
  { value: "despido", label: "Despido" },
  { value: "no_supera_periodo_prueba", label: "No supera periodo de prueba" },
  { value: "fin_sustitucion", label: "Fin de sustitución" },
  { value: "otras_causas", label: "Otras causas" },
];

const DEFAULT_CATALOGS = {
  contracts: [],
  contribution_groups: [],
  situations: [],
  worker_collectives: [],
  unemployed_conditions: [],
  social_exclusion_victim_statuses: [],
  substitution_causes: [],
  inactivity_types: [],
  working_day_types: [],
  monthly_daily_contribution_types: [],
};

const EMPTY_FILTERS = {
  search: "",
  status: "",
  contractType: "",
  workingDayType: "",
  companyId: "",
  centerId: "",
  agreement: "",
  category: "",
  partialityBand: "",
  startFrom: "",
  startTo: "",
  minPartiality: "",
  maxPartiality: "",
  minSalary: "",
  maxSalary: "",
};

const EDIT_TABS = [
  { key: "summary", label: "Resumen" },
  { key: "contract", label: "Contrato" },
  { key: "workday", label: "Jornada" },
  { key: "salary", label: "Retribución" },
  { key: "ss", label: "Seguridad Social" },
];

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

function formatStatus(status) {
  const labels = { active: "Activo", ended: "Finalizado", deleted: "Baja administrativa" };
  return labels[status] || status || "-";
}

function formatContractType(value) {
  const labels = {
    indefinido: "Indefinido",
    temporal: "Temporal",
    practicas: "Prácticas",
    formacion: "Formación",
    sustitucion: "Sustitución",
    Sustitución: "Sustitución",
    Temporal: "Temporal",
    Indefinido: "Indefinido",
  };
  return labels[value] || value || "-";
}

function formatWorkingDayType(value) {
  const labels = {
    full_time: "Completa",
    part_time: "Parcial",
    fixed_discontinuous: "Fijo discontinuo",
  };
  return labels[value] || value || "-";
}

function formatSalary(value, decimals = 0) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return `${number.toLocaleString("es-ES", { maximumFractionDigits: 2 })}${suffix}`;
}

function catalogOrFallback(items, fallback) {
  return items?.length ? items : fallback;
}

function findLabel(items, code) {
  if (!code) return "-";
  const item = items.find((entry) => String(entry.code) === String(code));
  return item ? `${item.code} · ${item.description}` : code;
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
  return {
    monthly_hours: String(Math.round((weekly * 52 / 12) * 100) / 100),
    annual_hours: String(Math.round((weekly * 52) * 100) / 100),
  };
}

function getPartiality(contract) {
  const direct = Number(contract.partiality_coefficient);
  if (!Number.isNaN(direct) && direct > 0) return direct;
  const weekly = Number(contract.weekly_hours || 0);
  const fullTime = Number(contract.full_time_weekly_hours || 40);
  if (weekly > 0 && fullTime > 0) return Math.round((weekly / fullTime) * 10000) / 100;
  return contract.working_day_type === "part_time" ? 0 : 100;
}

function getMonthlySalaryEstimate(contract) {
  const salary = Number(contract.salary_base || 0);
  const ratio = getPartiality(contract) / 100;
  return salary * (ratio || 1);
}

function toEditForm(contract) {
  return {
    employee_id: contract.employee_id ? String(contract.employee_id) : "",
    company_id: contract.company_id ? String(contract.company_id) : "",
    center_id: contract.center_id ? String(contract.center_id) : "",
    contract_type: contract.contract_type || "",
    contract_code: contract.contract_code || "",
    contract_code_description: contract.contract_code_description || "",
    contract_family: contract.contract_family || "",
    start_date: contract.start_date || "",
    end_date: contract.end_date || "",
    salary_base: contract.salary_base || "",
    gross_annual_salary: contract.gross_annual_salary || contract.salary_base || "",
    pay_schedule: contract.pay_schedule || "not_prorated_14",
    status: contract.status || "active",
    contribution_group: contract.contribution_group || "",
    professional_category: contract.professional_category || "",
    job_position: contract.job_position || "",
    collective_agreement_code: contract.collective_agreement_code || "",
    collective_agreement_id: contract.collective_agreement_id ? String(contract.collective_agreement_id) : "",
    professional_category_id: contract.professional_category_id ? String(contract.professional_category_id) : "",
    salary_table_row_id: contract.salary_table_row_id ? String(contract.salary_table_row_id) : "",
    working_day_type: contract.working_day_type || "",
    weekly_hours: contract.weekly_hours ?? "",
    full_time_weekly_hours: contract.full_time_weekly_hours ?? "40",
    annual_agreement_hours: contract.annual_agreement_hours ?? "",
    monthly_hours: contract.monthly_hours ?? "",
    annual_hours: contract.annual_hours ?? "",
    partiality_coefficient: contract.partiality_coefficient ?? "",
    monthly_or_daily_contribution: contract.monthly_or_daily_contribution || "monthly",
    red_occupation_code: contract.red_occupation_code || "",
    red_reduction_code: contract.red_reduction_code || "",
  };
}

function toSocialSecurityForm(contract) {
  const ss = contract.ss_registration || {};
  return {
    situation_code: ss.situation_code || "1",
    situation_description: ss.situation_description || "Alta",
    registration_date: ss.registration_date || contract.start_date || "",
    contribution_group: ss.contribution_group || contract.contribution_group || "",
    monthly_or_daily_contribution: ss.monthly_or_daily_contribution || contract.monthly_or_daily_contribution || "monthly",
    disability_degree: ss.disability_degree ?? "",
    occupation_code: ss.occupation_code || contract.red_occupation_code || "",
    cno: ss.cno || "",
    worker_collective_code: ss.worker_collective_code || "",
    unemployed_condition_code: ss.unemployed_condition_code || "",
    social_exclusion_or_victim_status: ss.social_exclusion_or_victim_status || "none",
    is_replacement: Boolean(ss.is_replacement),
    replacement_cause_code: ss.replacement_cause_code || "",
    replaced_worker_naf: ss.replaced_worker_naf || "",
    inactivity_type_code: ss.inactivity_type_code || "",
    working_time_reduction: ss.working_time_reduction ?? "",
    initial_ctp: ss.initial_ctp ?? "",
    red_contract_key: ss.red_contract_key || contract.contract_code || "",
    red_occupation_code: ss.red_occupation_code || contract.red_occupation_code || "",
    red_contribution_group: ss.red_contribution_group || contract.contribution_group || "",
    red_reduction_code: ss.red_reduction_code || contract.red_reduction_code || "",
    red_special_relation: ss.red_special_relation || "",
  };
}

function toTerminationForm(contract) {
  return {
    end_date: contract.end_date || "",
    reason: "fin_contrato_temporal",
    severance_ready: false,
    settlement_ready: false,
    observations: "",
  };
}

function MetricCard({ label, value, detail }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      {detail && <span style={styles.metricDetail}>{detail}</span>}
    </div>
  );
}

function Field({ label, children, help }) {
  return (
    <div style={styles.formGroup}>
      <label>{label}</label>
      {children}
      {help && <small style={styles.helpText}>{help}</small>}
    </div>
  );
}

export default function ContractTable({ loading, contracts, employees, companies, workCenters = [], onUpdateContract, submitting }) {
  const [editingContract, setEditingContract] = useState(null);
  const [contractToTerminate, setContractToTerminate] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [ssEditForm, setSsEditForm] = useState(null);
  const [terminationForm, setTerminationForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [terminationError, setTerminationError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "code", direction: "asc" });
  const [catalogs, setCatalogs] = useState(DEFAULT_CATALOGS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [density, setDensity] = useState("comfortable");
  const [editTab, setEditTab] = useState("summary");

  useEffect(() => {
    let active = true;
    fetchCatalogs()
      .then((data) => {
        if (active) setCatalogs({ ...DEFAULT_CATALOGS, ...data });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const getEmployee = (contract) => employees.find((employee) => Number(employee.id) === Number(contract.employee_id));
  const getEmployeeName = (contract) => contract.employee_name || (() => {
    const emp = getEmployee(contract);
    return emp ? `${emp.first_name} ${emp.last_name}` : contract.employee_id;
  })();
  const getContractCode = (contract) => getContractVisibleCode(contract, employees, contracts);
  const getCompany = (contract) => companies.find((item) => Number(item.id) === Number(contract.company_id));
  const getCenter = (contract) => workCenters.find((item) => Number(item.id) === Number(contract.center_id));
  const getCompanyName = (contract) => contract.company_name || getCompany(contract)?.name || "-";
  const getCompanyAndCenterName = (contract) => {
    const companyName = getCompanyName(contract);
    const center = getCenter(contract);
    return center?.name ? `${companyName} · ${center.name}` : companyName;
  };
  const getAgreementText = (contract) => {
    if (contract.collective_agreement_name) return contract.collective_agreement_name;
    if (contract.collective_agreement_code) return contract.collective_agreement_code;
    return "-";
  };

  const filteredContracts = useMemo(() => {
    const search = normalizeText(filters.search);
    const agreement = normalizeText(filters.agreement);
    const category = normalizeText(filters.category);
    const minPartiality = filters.minPartiality === "" ? null : Number(filters.minPartiality);
    const maxPartiality = filters.maxPartiality === "" ? null : Number(filters.maxPartiality);
    const minSalary = filters.minSalary === "" ? null : Number(filters.minSalary);
    const maxSalary = filters.maxSalary === "" ? null : Number(filters.maxSalary);

    return contracts.filter((contract) => {
      const partiality = getPartiality(contract);
      const salary = Number(contract.salary_base || 0);
      const searchable = normalizeText([
        getContractCode(contract),
        getEmployeeName(contract),
        getCompanyAndCenterName(contract),
        getAgreementText(contract),
        contract.professional_category,
        contract.job_position,
        contract.contract_code,
        contract.contract_type,
        contract.status,
      ].join(" "));

      if (search && !searchable.includes(search)) return false;
      if (filters.status && contract.status !== filters.status) return false;
      if (filters.contractType && contract.contract_type !== filters.contractType) return false;
      if (filters.workingDayType && contract.working_day_type !== filters.workingDayType) return false;
      if (filters.companyId && String(contract.company_id || "") !== String(filters.companyId)) return false;
      if (filters.centerId && String(contract.center_id || "") !== String(filters.centerId)) return false;
      if (agreement && !normalizeText(getAgreementText(contract)).includes(agreement)) return false;
      if (category && !normalizeText(contract.professional_category).includes(category)) return false;
      if (filters.startFrom && contract.start_date && contract.start_date < filters.startFrom) return false;
      if (filters.startTo && contract.start_date && contract.start_date > filters.startTo) return false;
      if (minPartiality !== null && partiality < minPartiality) return false;
      if (maxPartiality !== null && partiality > maxPartiality) return false;
      if (minSalary !== null && salary < minSalary) return false;
      if (maxSalary !== null && salary > maxSalary) return false;
      if (filters.partialityBand === "full" && partiality !== 100) return false;
      if (filters.partialityBand === "partial" && !(partiality > 0 && partiality < 100)) return false;
      if (filters.partialityBand === "missing" && partiality > 0) return false;
      return true;
    });
  }, [contracts, employees, companies, workCenters, filters]);

  const sortedContracts = useMemo(() => sortRows(filteredContracts, sortConfig, {
    code: (contract) => getContractCode(contract),
    employee: (contract) => getEmployeeName(contract),
    company: (contract) => getCompanyAndCenterName(contract),
    agreement: (contract) => getAgreementText(contract),
    category: (contract) => contract.professional_category || "",
    type: (contract) => formatContractType(contract.contract_type),
    workday: (contract) => getPartiality(contract),
    start: (contract) => contract.start_date,
    end: (contract) => contract.end_date,
    status: (contract) => formatStatus(contract.status),
    salary: (contract) => Number(contract.salary_base || 0),
  }), [filteredContracts, employees, companies, workCenters, sortConfig]);

  const metrics = useMemo(() => {
    const active = contracts.filter((item) => item.status === "active").length;
    const ended = contracts.filter((item) => item.status === "ended").length;
    const partTime = contracts.filter((item) => getPartiality(item) > 0 && getPartiality(item) < 100).length;
    const avgPartiality = contracts.length ? contracts.reduce((sum, item) => sum + getPartiality(item), 0) / contracts.length : 0;
    const monthlyCost = contracts.reduce((sum, item) => sum + getMonthlySalaryEstimate(item), 0);
    return { active, ended, partTime, avgPartiality, monthlyCost };
  }, [contracts]);

  const handleSort = (key) => setSortConfig((current) => nextSortConfig(current, key));
  const sortHeader = (key, label, style) => (
    <th style={style}>
      <button type="button" onClick={() => handleSort(key)} style={styles.sortButton}>
        <span>{label}</span><span style={styles.sortIcon}>{getSortLabel(sortConfig, key)}</span>
      </button>
    </th>
  );

  const setFilter = (name, value) => setFilters((prev) => ({ ...prev, [name]: value }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const openEditModal = (contract) => {
    setEditingContract(contract);
    setEditForm(toEditForm(contract));
    setSsEditForm(toSocialSecurityForm(contract));
    setEditError("");
    setTerminationError("");
    setEditTab("summary");
  };

  const closeEditModal = () => {
    setEditingContract(null);
    setEditForm(null);
    setSsEditForm(null);
    setEditError("");
    setEditTab("summary");
  };

  const openTerminationModal = (contract) => {
    setContractToTerminate(contract);
    setTerminationForm(toTerminationForm(contract));
    setTerminationError("");
  };

  const closeTerminationModal = () => {
    setContractToTerminate(null);
    setTerminationForm(null);
    setTerminationError("");
  };

  const patchEditForm = (patch) => setEditForm((prev) => ({ ...prev, ...patch }));

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "weekly_hours" || name === "full_time_weekly_hours") {
        const calculated = calculatePartiality(next.weekly_hours, next.full_time_weekly_hours);
        if (calculated) next.partiality_coefficient = calculated;
        Object.assign(next, calculateHoursFromWeekly(next.weekly_hours));
      }
      if (name === "working_day_type" && value === "full_time") {
        next.weekly_hours = next.full_time_weekly_hours || "40";
        next.partiality_coefficient = "100";
        Object.assign(next, calculateHoursFromWeekly(next.weekly_hours));
      }
      return next;
    });
  };

  const applyWorkdayPreset = (percentage) => {
    const fullTimeHours = Number(editForm.full_time_weekly_hours || 40);
    const weeklyHours = Math.round((fullTimeHours * percentage / 100) * 100) / 100;
    patchEditForm({
      working_day_type: percentage === 100 ? "full_time" : "part_time",
      partiality_coefficient: String(percentage),
      weekly_hours: String(weeklyHours),
      ...calculateHoursFromWeekly(weeklyHours),
    });
  };

  const handleSsEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === "situation_code") {
      const selected = catalogs.situations.find((item) => String(item.code) === String(value));
      setSsEditForm((prev) => ({ ...prev, situation_code: value, situation_description: selected?.description || "" }));
      return;
    }
    setSsEditForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleTerminationChange = (event) => {
    const { name, value, type, checked } = event.target;
    setTerminationForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");
    try {
      await onUpdateContract(editingContract.id, editForm, ssEditForm);
      closeEditModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar contrato");
    }
  };

  const handleConfirmTermination = async () => {
    setTerminationError("");
    if (!terminationForm.end_date) {
      setTerminationError("Debes indicar la fecha fin de la baja.");
      return;
    }
    if (contractToTerminate.end_date && terminationForm.end_date !== contractToTerminate.end_date) {
      setTerminationError("La fecha de baja debe coincidir con la fecha fin indicada en el contrato.");
      return;
    }
    if (terminationForm.end_date < contractToTerminate.start_date) {
      setTerminationError("La fecha fin no puede ser anterior a la fecha de inicio del contrato.");
      return;
    }
    try {
      await onUpdateContract(
        contractToTerminate.id,
        { ...toEditForm(contractToTerminate), end_date: terminationForm.end_date, status: "ended" },
        toSocialSecurityForm(contractToTerminate)
      );
      closeTerminationModal();
      closeEditModal();
    } catch (err) {
      setTerminationError(err.message || "Error al tramitar la baja del contrato");
    }
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <>
      <div style={styles.dashboard}>
        <MetricCard label="Contratos activos" value={metrics.active} detail={`${metrics.ended} finalizados`} />
        <MetricCard label="Jornadas parciales" value={metrics.partTime} detail="Contratos con parcialidad < 100%" />
        <MetricCard label="Parcialidad media" value={formatNumber(metrics.avgPartiality, "%")} detail="Sobre contratos listados" />
        <MetricCard label="Retribución mensual estimada" value={formatSalary(metrics.monthlyCost, 0)} detail="Según salario base y jornada" />
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <label>Buscar</label>
          <input value={filters.search} onChange={(event) => setFilter("search", event.target.value)} placeholder="Trabajador, código, empresa, convenio..." style={styles.input} />
        </div>
        <div style={styles.toolbarGroup}>
          <label>Estado</label>
          <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)} style={styles.input}>
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="ended">Finalizados</option>
            <option value="deleted">Baja administrativa</option>
          </select>
        </div>
        <div style={styles.toolbarGroup}>
          <label>Jornada</label>
          <select value={filters.partialityBand} onChange={(event) => setFilter("partialityBand", event.target.value)} style={styles.input}>
            <option value="">Todas</option>
            <option value="full">100%</option>
            <option value="partial">Parcial</option>
            <option value="missing">Sin parcialidad</option>
          </select>
        </div>
        <div style={styles.toolbarButtons}>
          <button type="button" onClick={() => setShowAdvancedFilters((current) => !current)} style={styles.secondaryButton}>{showAdvancedFilters ? "Ocultar filtros" : "Más filtros"}</button>
          <button type="button" onClick={() => setDensity((current) => current === "comfortable" ? "compact" : "comfortable")} style={styles.secondaryButton}>{density === "comfortable" ? "Vista compacta" : "Vista amplia"}</button>
          <button type="button" onClick={clearFilters} style={styles.clearButton}>Limpiar</button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div style={styles.advancedFilters}>
          <Field label="Tipo contrato"><select value={filters.contractType} onChange={(event) => setFilter("contractType", event.target.value)} style={styles.input}><option value="">Todos</option><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="formacion">Formación</option><option value="sustitucion">Sustitución</option></select></Field>
          <Field label="Tipo jornada"><select value={filters.workingDayType} onChange={(event) => setFilter("workingDayType", event.target.value)} style={styles.input}><option value="">Todas</option><option value="full_time">Completa</option><option value="part_time">Parcial</option><option value="fixed_discontinuous">Fijo discontinuo</option></select></Field>
          <Field label="Empresa"><select value={filters.companyId} onChange={(event) => setFilter("companyId", event.target.value)} style={styles.input}><option value="">Todas</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
          <Field label="Centro"><select value={filters.centerId} onChange={(event) => setFilter("centerId", event.target.value)} style={styles.input}><option value="">Todos</option>{workCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></Field>
          <Field label="Convenio contiene"><input value={filters.agreement} onChange={(event) => setFilter("agreement", event.target.value)} style={styles.input} /></Field>
          <Field label="Categoría contiene"><input value={filters.category} onChange={(event) => setFilter("category", event.target.value)} style={styles.input} /></Field>
          <Field label="Inicio desde"><input type="date" value={filters.startFrom} onChange={(event) => setFilter("startFrom", event.target.value)} style={styles.input} /></Field>
          <Field label="Inicio hasta"><input type="date" value={filters.startTo} onChange={(event) => setFilter("startTo", event.target.value)} style={styles.input} /></Field>
          <Field label="Parcialidad mínima"><input type="number" value={filters.minPartiality} onChange={(event) => setFilter("minPartiality", event.target.value)} style={styles.input} /></Field>
          <Field label="Parcialidad máxima"><input type="number" value={filters.maxPartiality} onChange={(event) => setFilter("maxPartiality", event.target.value)} style={styles.input} /></Field>
          <Field label="Salario mínimo"><input type="number" value={filters.minSalary} onChange={(event) => setFilter("minSalary", event.target.value)} style={styles.input} /></Field>
          <Field label="Salario máximo"><input type="number" value={filters.maxSalary} onChange={(event) => setFilter("maxSalary", event.target.value)} style={styles.input} /></Field>
        </div>
      )}

      <div style={styles.resultBar}>
        <strong>{sortedContracts.length}</strong> contratos visibles de {contracts.length}.
        <span>Orden: {sortConfig.key} · {sortConfig.direction === "asc" ? "ascendente" : "descendente"}</span>
      </div>

      <div style={styles.tableWrapper}>
        <table style={density === "compact" ? { ...styles.table, ...styles.compactTable } : styles.table}>
          <thead>
            <tr>
              {sortHeader("code", "Código", styles.thCode)}
              {sortHeader("employee", "Trabajador", styles.thEmployee)}
              {sortHeader("company", "Empresa / centro", styles.thCompany)}
              {sortHeader("agreement", "Convenio", styles.thAgreement)}
              {sortHeader("category", "Categoría", styles.thCategory)}
              {sortHeader("type", "Contrato", styles.thType)}
              {sortHeader("workday", "Jornada", styles.thWorkday)}
              {sortHeader("start", "Inicio", styles.thDate)}
              {sortHeader("end", "Fin", styles.thDate)}
              {sortHeader("status", "Estado", styles.thStatus)}
              {sortHeader("salary", "Salario", styles.thSalary)}
              <th style={styles.thActions}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedContracts.map((contract) => {
              const partiality = getPartiality(contract);
              return (
                <tr key={contract.id} style={contract.status === "active" ? undefined : styles.inactiveRow}>
                  <td style={styles.tdCode}>{getContractCode(contract)}</td>
                  <td style={styles.td}><strong>{getEmployeeName(contract)}</strong><small style={styles.cellMeta}>{contract.job_position || "Sin puesto"}</small></td>
                  <td style={styles.td}>{getCompanyAndCenterName(contract)}</td>
                  <td style={styles.tdAgreement}>{getAgreementText(contract)}</td>
                  <td style={styles.tdCategory}>{contract.professional_category || "-"}</td>
                  <td style={styles.tdType}><strong>{contract.contract_code || "-"}</strong><small style={styles.cellMeta}>{formatContractType(contract.contract_type)}</small></td>
                  <td style={styles.tdWorkday}><span style={partiality === 100 ? styles.fullBadge : styles.partialBadge}>{formatNumber(partiality, "%")}</span><small style={styles.cellMeta}>{formatWorkingDayType(contract.working_day_type)} · {formatNumber(contract.weekly_hours, " h")}</small></td>
                  <td style={styles.tdDate}>{formatDate(contract.start_date)}</td>
                  <td style={styles.tdDate}>{formatDate(contract.end_date)}</td>
                  <td style={styles.tdStatus}><span style={contract.status === "active" ? styles.activeBadge : styles.inactiveBadge}>{formatStatus(contract.status)}</span></td>
                  <td style={styles.tdSalary}><strong>{formatSalary(contract.salary_base)}</strong><small style={styles.cellMeta}>aplic. {formatSalary(getMonthlySalaryEstimate(contract))}</small></td>
                  <td style={styles.tdActions}><button type="button" onClick={() => openEditModal(contract)} style={styles.editButton}>Editar</button></td>
                </tr>
              );
            })}
            {sortedContracts.length === 0 && <tr><td style={styles.td} colSpan="12">No hay contratos con los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>

      {editingContract && editForm && ssEditForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Editar contrato</h3>
                <p style={styles.modalSubtitle}>Contrato {getContractCode(editingContract)} · {getEmployeeName(editingContract)} · {formatPaySchedule(editingContract.pay_schedule)}</p>
              </div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <div style={styles.editShell}>
                <aside style={styles.editSidebar}>
                  <div style={styles.sideSummary}>
                    <span>Código</span><strong>{getContractCode(editingContract)}</strong>
                    <span>Jornada</span><strong>{formatNumber(editForm.partiality_coefficient || getPartiality(editingContract), "%")}</strong>
                    <span>Salario base</span><strong>{formatSalary(editForm.salary_base)}</strong>
                  </div>
                  {EDIT_TABS.map((tab) => <button key={tab.key} type="button" onClick={() => setEditTab(tab.key)} style={editTab === tab.key ? styles.tabButtonActive : styles.tabButton}>{tab.label}</button>)}
                  <button type="button" onClick={() => openTerminationModal(editingContract)} style={styles.deleteButton}>Tramitar baja</button>
                </aside>

                <main style={styles.editMain}>
                  {editTab === "summary" && (
                    <>
                      <section style={styles.sectionBox}>
                        <h4 style={styles.sectionTitle}>Resumen editable</h4>
                        <div style={styles.summaryGrid}>
                          <MetricCard label="Empresa / centro" value={getCompanyAndCenterName(editingContract)} />
                          <MetricCard label="Estado" value={formatStatus(editForm.status)} />
                          <MetricCard label="Jornada" value={formatNumber(editForm.partiality_coefficient || getPartiality(editingContract), "%")} detail={`${editForm.weekly_hours || "-"} h/semana`} />
                          <MetricCard label="Salario base" value={formatSalary(editForm.salary_base)} detail={`Aplicado aprox. ${formatSalary(Number(editForm.salary_base || 0) * Number(editForm.partiality_coefficient || 100) / 100)}`} />
                        </div>
                      </section>
                      <ContractSalarySummaryPanel contractId={editingContract.id} />
                    </>
                  )}

                  {editTab === "contract" && (
                    <section style={styles.sectionBox}>
                      <h4 style={styles.sectionTitle}>Datos contractuales</h4>
                      <div style={styles.formGrid}>
                        <Field label="Trabajador"><input value={getEmployeeName(editingContract)} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} /></Field>
                        <Field label="Empresa / centro"><input value={getCompanyAndCenterName(editingContract)} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} /></Field>
                        <Field label="Código contrato"><input name="contract_code" value={editForm.contract_code} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Tipo de contrato"><select name="contract_type" value={editForm.contract_type} onChange={handleEditChange} required style={styles.input}><option value="">Selecciona tipo</option><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="formacion">Formación</option><option value="sustitucion">Sustitución</option></select></Field>
                        <Field label="Sistema de pagas"><select name="pay_schedule" value={editForm.pay_schedule} onChange={handleEditChange} required style={styles.input}>{PAY_SCHEDULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                        <Field label="Fecha inicio"><input type="date" name="start_date" value={editForm.start_date} onChange={handleEditChange} required style={styles.input} /></Field>
                        <Field label="Fecha fin"><input type="date" name="end_date" value={editForm.end_date} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Estado"><select name="status" value={editForm.status} onChange={handleEditChange} style={styles.input}><option value="active">Activo</option><option value="ended">Finalizado</option></select></Field>
                      </div>
                    </section>
                  )}

                  {editTab === "workday" && (
                    <section style={styles.sectionBox}>
                      <div style={styles.sectionHeaderSplit}><h4 style={styles.sectionTitle}>Jornada y parcialidad</h4><div style={styles.presetButtons}><button type="button" onClick={() => applyWorkdayPreset(100)} style={styles.secondaryButton}>100%</button><button type="button" onClick={() => applyWorkdayPreset(75)} style={styles.secondaryButton}>75%</button><button type="button" onClick={() => applyWorkdayPreset(50)} style={styles.secondaryButton}>50%</button></div></div>
                      <div style={styles.formGrid}>
                        <Field label="Tipo jornada"><select name="working_day_type" value={editForm.working_day_type} onChange={handleEditChange} style={styles.input}><option value="">Sin definir</option>{catalogOrFallback(catalogs.working_day_types, [{ code: "full_time", description: "Jornada completa" }, { code: "part_time", description: "Jornada parcial" }, { code: "fixed_discontinuous", description: "Fijo discontinuo" }]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></Field>
                        <Field label="Horas semanales"><input type="number" name="weekly_hours" value={editForm.weekly_hours} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Jornada completa ref."><input type="number" name="full_time_weekly_hours" value={editForm.full_time_weekly_hours} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Coeficiente parcialidad"><input type="number" name="partiality_coefficient" value={editForm.partiality_coefficient} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Jornada anual convenio"><input type="number" name="annual_agreement_hours" value={editForm.annual_agreement_hours} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Horas mensuales"><input type="number" name="monthly_hours" value={editForm.monthly_hours} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Horas anuales"><input type="number" name="annual_hours" value={editForm.annual_hours} onChange={handleEditChange} style={styles.input} /></Field>
                      </div>
                      <div style={styles.infoBox}>Las horas mensuales/anuales se recalculan al modificar las horas semanales, pero puedes ajustarlas manualmente para casos prácticos.</div>
                    </section>
                  )}

                  {editTab === "salary" && (
                    <section style={styles.sectionBox}>
                      <h4 style={styles.sectionTitle}>Convenio, categoría y retribución</h4>
                      <div style={styles.formGrid}>
                        <Field label="Convenio"><input name="collective_agreement_code" value={editForm.collective_agreement_code} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Categoría profesional"><input name="professional_category" value={editForm.professional_category} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="Puesto"><input name="job_position" value={editForm.job_position} onChange={handleEditChange} style={styles.input} /></Field>
                        <Field label="ID convenio"><input name="collective_agreement_id" value={editForm.collective_agreement_id} onChange={handleEditChange} placeholder="Opcional" style={styles.input} /></Field>
                        <Field label="ID categoría convenio"><input name="professional_category_id" value={editForm.professional_category_id} onChange={handleEditChange} placeholder="Opcional" style={styles.input} /></Field>
                        <Field label="ID fila salarial"><input name="salary_table_row_id" value={editForm.salary_table_row_id} onChange={handleEditChange} placeholder="Opcional" style={styles.input} /></Field>
                        <Field label="Salario base"><input type="number" name="salary_base" value={editForm.salary_base} onChange={handleEditChange} style={styles.input} /></Field>
                      </div>
                    </section>
                  )}

                  {editTab === "ss" && (
                    <section style={styles.sectionBox}>
                      <h4 style={styles.sectionTitle}>Cotización, RED y alta SS simulada</h4>
                      <div style={styles.ssSummary}><div><span>Situación</span><strong>{findLabel(catalogs.situations, ssEditForm.situation_code)}</strong></div><div><span>Alta</span><strong>{formatDate(ssEditForm.registration_date)}</strong></div><div><span>Colectivo</span><strong>{findLabel(catalogs.worker_collectives, ssEditForm.worker_collective_code)}</strong></div></div>
                      <div style={styles.formGrid}>
                        <Field label="Grupo cotización"><select name="contribution_group" value={editForm.contribution_group} onChange={(e) => { handleEditChange(e); setSsEditForm((prev) => ({ ...prev, contribution_group: e.target.value, red_contribution_group: e.target.value })); }} style={styles.input}><option value="">Selecciona grupo</option>{catalogs.contribution_groups.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field>
                        <Field label="Ocupación RED"><input name="red_occupation_code" value={editForm.red_occupation_code} onChange={(e) => { handleEditChange(e); setSsEditForm((prev) => ({ ...prev, red_occupation_code: e.target.value, occupation_code: e.target.value })); }} style={styles.input} /></Field>
                        <Field label="Código reducción"><input name="red_reduction_code" value={editForm.red_reduction_code} onChange={(e) => { handleEditChange(e); setSsEditForm((prev) => ({ ...prev, red_reduction_code: e.target.value })); }} style={styles.input} /></Field>
                        <Field label="Indicador cotización"><select name="monthly_or_daily_contribution" value={editForm.monthly_or_daily_contribution} onChange={handleEditChange} style={styles.input}>{catalogOrFallback(catalogs.monthly_daily_contribution_types, [{ code: "monthly", description: "Cotización mensual" }, { code: "daily", description: "Cotización diaria" }]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></Field>
                        <Field label="Situación"><select name="situation_code" value={ssEditForm.situation_code} onChange={handleSsEditChange} style={styles.input}>{catalogOrFallback(catalogs.situations, [{ code: "1", description: "Alta" }]).map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field>
                        <Field label="Fecha alta"><input type="date" name="registration_date" value={ssEditForm.registration_date} onChange={handleSsEditChange} style={styles.input} /></Field>
                        <Field label="Discapacidad"><input type="number" name="disability_degree" value={ssEditForm.disability_degree} onChange={handleSsEditChange} style={styles.input} /></Field>
                        <Field label="Colectivo trabajador"><select name="worker_collective_code" value={ssEditForm.worker_collective_code} onChange={handleSsEditChange} style={styles.input}><option value="">No aplica</option>{catalogs.worker_collectives.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field>
                        <Field label="Condición desempleado"><select name="unemployed_condition_code" value={ssEditForm.unemployed_condition_code} onChange={handleSsEditChange} style={styles.input}><option value="">No aplica</option>{catalogs.unemployed_conditions.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field>
                        <Field label="Exclusión / víctimas"><select name="social_exclusion_or_victim_status" value={ssEditForm.social_exclusion_or_victim_status} onChange={handleSsEditChange} style={styles.input}>{catalogs.social_exclusion_victim_statuses.map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></Field>
                        <Field label="Tipo inactividad"><select name="inactivity_type_code" value={ssEditForm.inactivity_type_code} onChange={handleSsEditChange} style={styles.input}><option value="">No aplica</option>{catalogs.inactivity_types.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field>
                        <Field label="CNO"><input name="cno" value={ssEditForm.cno} onChange={handleSsEditChange} style={styles.input} /></Field>
                        <Field label="Relación especial RED"><input name="red_special_relation" value={ssEditForm.red_special_relation} onChange={handleSsEditChange} style={styles.input} /></Field>
                        <Field label="Reducción jornada"><input type="number" name="working_time_reduction" value={ssEditForm.working_time_reduction} onChange={handleSsEditChange} style={styles.input} /></Field>
                        <Field label="C.T.P. inicial"><input type="number" name="initial_ctp" value={ssEditForm.initial_ctp} onChange={handleSsEditChange} style={styles.input} /></Field>
                        <Field label="NAF sustituido"><input name="replaced_worker_naf" value={ssEditForm.replaced_worker_naf} onChange={handleSsEditChange} disabled={!ssEditForm.is_replacement} style={styles.input} /></Field>
                      </div>
                      <div style={styles.checkRow}><label style={styles.checkboxLabel}><input type="checkbox" name="is_replacement" checked={ssEditForm.is_replacement} onChange={handleSsEditChange} /> Sustitución / relevo</label></div>
                      {ssEditForm.is_replacement && <div style={styles.formGrid}><Field label="Causa sustitución"><select name="replacement_cause_code" value={ssEditForm.replacement_cause_code} onChange={handleSsEditChange} style={styles.input}><option value="">Selecciona causa</option>{catalogs.substitution_causes.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></Field></div>}
                    </section>
                  )}

                  {editError && <div style={styles.error}>{editError}</div>}
                </main>
              </div>

              <div style={styles.modalActionsSplit}>
                <button type="button" onClick={() => openTerminationModal(editingContract)} style={styles.deleteButton}>Tramitar baja</button>
                <div style={styles.modalActionsRight}>
                  <button type="button" onClick={closeEditModal} style={styles.cancelButton}>Cancelar</button>
                  <button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar cambios"}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {contractToTerminate && terminationForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModalWide}>
            <div style={styles.modalHeader}><div><h3 style={styles.modalTitle}>Tramitar baja</h3><p style={styles.modalSubtitle}>Contrato {getContractCode(contractToTerminate)} · {getEmployeeName(contractToTerminate)}</p></div><button type="button" onClick={closeTerminationModal} style={styles.closeButton}>×</button></div>
            <div style={styles.terminationSummary}><div><span>Inicio</span><strong>{formatDate(contractToTerminate.start_date)}</strong></div><div><span>Fecha fin actual</span><strong>{formatDate(contractToTerminate.end_date)}</strong></div><div><span>Estado actual</span><strong>{formatStatus(contractToTerminate.status)}</strong></div></div>
            <div style={styles.form}>
              <div style={styles.formRow}><Field label="Fecha fin / fecha de baja" help="Debe coincidir con la fecha fin indicada en el contrato si ya existe."><input type="date" name="end_date" value={terminationForm.end_date} onChange={handleTerminationChange} style={styles.input} required /></Field><Field label="Motivo de la baja"><select name="reason" value={terminationForm.reason} onChange={handleTerminationChange} style={styles.input}>{TERMINATION_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></Field></div>
              <div style={styles.checkRow}><label style={styles.checkboxLabel}><input type="checkbox" name="settlement_ready" checked={terminationForm.settlement_ready} onChange={handleTerminationChange} />Finiquito preparado</label><label style={styles.checkboxLabel}><input type="checkbox" name="severance_ready" checked={terminationForm.severance_ready} onChange={handleTerminationChange} />Indemnización revisada si procede</label></div>
              <div style={styles.formGroupFull}><label>Observaciones internas</label><textarea name="observations" value={terminationForm.observations} onChange={handleTerminationChange} rows="3" placeholder="Ej. pendiente carta de baja, documentación de finiquito o revisión docente del caso." style={styles.textarea} /></div>
            </div>
            {terminationError && <div style={styles.error}>{terminationError}</div>}
            <div style={styles.modalActions}><button type="button" onClick={closeTerminationModal} style={styles.cancelButton}>Cancelar</button><button type="button" onClick={handleConfirmTermination} disabled={submitting} style={styles.dangerButton}>{submitting ? "Tramitando..." : "Confirmar baja"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  dashboard: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginBottom: "14px" },
  metricCard: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #facc15", display: "flex", flexDirection: "column", gap: "4px" },
  metricLabel: { fontSize: "11px", fontWeight: 900, textTransform: "uppercase", color: "#6b7280" },
  metricValue: { fontSize: "20px", fontWeight: 900, color: "#111827" },
  metricDetail: { fontSize: "12px", fontWeight: 700, color: "#6b7280" },
  toolbar: { display: "grid", gridTemplateColumns: "minmax(300px, 1fr) 150px 150px auto", gap: "12px", alignItems: "end", marginBottom: "12px", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "12px", backgroundColor: "#f9fafb" },
  searchBox: { display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800 },
  toolbarGroup: { display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800 },
  toolbarButtons: { display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" },
  advancedFilters: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "12px", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "12px", backgroundColor: "#ffffff" },
  resultBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "10px", color: "#374151", fontSize: "13px", fontWeight: 800 },
  tableWrapper: { overflowX: "auto", width: "100%", border: "1px solid #e5e7eb", borderRadius: "12px" },
  table: { width: "100%", minWidth: "1540px", borderCollapse: "collapse", tableLayout: "fixed", backgroundColor: "#ffffff" },
  compactTable: { fontSize: "12px" },
  sortButton: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: 0, border: "none", backgroundColor: "transparent", color: "inherit", font: "inherit", fontWeight: 900, cursor: "pointer", textAlign: "left" },
  sortIcon: { color: "#6b7280", fontSize: "12px" },
  thEmployee: { width: "210px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thCompany: { width: "230px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thCode: { width: "86px", textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thAgreement: { width: "190px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thCategory: { width: "170px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thType: { width: "132px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thWorkday: { width: "132px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thDate: { width: "96px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thStatus: { width: "112px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thSalary: { width: "128px", textAlign: "right", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thActions: { width: "90px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "top" },
  tdCode: { width: "86px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 900, verticalAlign: "top" },
  tdAgreement: { width: "190px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "top" },
  tdCategory: { width: "170px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "top" },
  tdType: { width: "132px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", verticalAlign: "top" },
  tdWorkday: { width: "132px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", verticalAlign: "top" },
  tdDate: { width: "96px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", verticalAlign: "top" },
  tdStatus: { width: "112px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", verticalAlign: "top" },
  tdSalary: { width: "128px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", textAlign: "right", verticalAlign: "top" },
  tdActions: { width: "90px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", verticalAlign: "top" },
  cellMeta: { display: "block", marginTop: "3px", fontSize: "11px", color: "#6b7280", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" },
  inactiveRow: { backgroundColor: "#f9fafb", color: "#6b7280" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  fullBadge: { backgroundColor: "#e0f2fe", color: "#075985", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 },
  partialBadge: { backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700, fontSize: "12px" },
  secondaryButton: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 12px", cursor: "pointer", fontWeight: 800 },
  clearButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 12px", cursor: "pointer", fontWeight: 800 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 12px", cursor: "pointer", fontWeight: 800, width: "100%" },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(1180px, 100%)", maxHeight: "92vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  confirmModalWide: { width: "min(760px, 100%)", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  editShell: { display: "grid", gridTemplateColumns: "210px minmax(0, 1fr)", gap: "18px", alignItems: "start" },
  editSidebar: { position: "sticky", top: "0", display: "flex", flexDirection: "column", gap: "8px", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", backgroundColor: "#f9fafb" },
  sideSummary: { display: "grid", gridTemplateColumns: "1fr", gap: "3px", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", marginBottom: "4px", fontSize: "12px", color: "#6b7280", fontWeight: 800 },
  tabButton: { textAlign: "left", backgroundColor: "#ffffff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px", cursor: "pointer", fontWeight: 800 },
  tabButtonActive: { textAlign: "left", backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px", cursor: "pointer", fontWeight: 900 },
  editMain: { minWidth: 0, display: "flex", flexDirection: "column", gap: "14px" },
  sectionBox: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", backgroundColor: "#ffffff" },
  sectionHeaderSplit: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" },
  sectionTitle: { margin: "0 0 12px", fontSize: "14px", fontWeight: 900, color: "#111827" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  formGroup: { minWidth: "180px", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#374151" },
  formGroupFull: { display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", backgroundColor: "#ffffff", boxSizing: "border-box", width: "100%" },
  textarea: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", resize: "vertical", fontFamily: "inherit" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", fontWeight: 800 },
  helpText: { color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  infoBox: { marginTop: "12px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#fef3c7", color: "#111827", fontSize: "13px", fontWeight: 700 },
  presetButtons: { display: "flex", gap: "8px", flexWrap: "wrap" },
  terminationSummary: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "16px" },
  ssSummary: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "16px" },
  checkRow: { display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "12px" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#374151" },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px", borderTop: "1px solid #e5e7eb", paddingTop: "14px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
