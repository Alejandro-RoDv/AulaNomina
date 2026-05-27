import { useEffect, useMemo, useState } from "react";
import { fetchCatalogs } from "../services/api";
import { formatPaySchedule, PAY_SCHEDULE_OPTIONS } from "./ContractForm";
import { getContractVisibleCode } from "../utils/visibleCodes";
import { getSortLabel, nextSortConfig, sortRows } from "../utils/tableSorting";

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

function formatSalary(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
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
    working_day_type: contract.working_day_type || "",
    weekly_hours: contract.weekly_hours ?? "",
    full_time_weekly_hours: contract.full_time_weekly_hours ?? "40",
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
  return { end_date: contract.end_date || "", reason: "fin_contrato_temporal", severance_ready: false, settlement_ready: false, observations: "" };
}

function findLabel(items, code) {
  if (!code) return "-";
  const item = items.find((entry) => String(entry.code) === String(code));
  return item ? `${item.code} · ${item.description}` : code;
}

function catalogOrFallback(items, fallback) {
  return items?.length ? items : fallback;
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

  useEffect(() => {
    let active = true;
    fetchCatalogs().then((data) => {
      if (active) setCatalogs({ ...DEFAULT_CATALOGS, ...data });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const getEmployee = (contract) => employees.find((employee) => Number(employee.id) === Number(contract.employee_id));
  const getEmployeeName = (contract) => contract.employee_name || (() => { const emp = getEmployee(contract); return emp ? `${emp.first_name} ${emp.last_name}` : contract.employee_id; })();
  const getContractCode = (contract) => getContractVisibleCode(contract, employees, contracts);
  const getCompany = (contract) => companies.find((item) => Number(item.id) === Number(contract.company_id));
  const getCenter = (contract) => workCenters.find((item) => Number(item.id) === Number(contract.center_id));
  const getCompanyName = (contract) => contract.company_name || getCompany(contract)?.name || "-";
  const getCompanyAndCenterName = (contract) => {
    const companyName = getCompanyName(contract);
    const center = getCenter(contract);
    return center?.name ? `${companyName} · ${center.name}` : companyName;
  };
  const getCompanyCcc = (contract) => getCompany(contract)?.ccc || "-";

  const sortedContracts = useMemo(() => sortRows(contracts, sortConfig, {
    code: (contract) => getContractCode(contract),
    employee: (contract) => getEmployeeName(contract),
    company: (contract) => getCompanyAndCenterName(contract),
    ccc: (contract) => getCompanyCcc(contract),
    type: (contract) => formatContractType(contract.contract_type),
    start: (contract) => contract.start_date,
    end: (contract) => contract.end_date,
    status: (contract) => formatStatus(contract.status),
    salary: (contract) => contract.salary_base,
  }), [contracts, employees, companies, workCenters, sortConfig]);

  const handleSort = (key) => setSortConfig((current) => nextSortConfig(current, key));
  const sortHeader = (key, label, style) => (
    <th style={style}><button type="button" onClick={() => handleSort(key)} style={styles.sortButton}><span>{label}</span><span style={styles.sortIcon}>{getSortLabel(sortConfig, key)}</span></button></th>
  );

  const openEditModal = (contract) => {
    setEditingContract(contract);
    setEditForm(toEditForm(contract));
    setSsEditForm(toSocialSecurityForm(contract));
    setEditError("");
    setTerminationError("");
  };

  const closeEditModal = () => {
    setEditingContract(null);
    setEditForm(null);
    setSsEditForm(null);
    setEditError("");
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

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
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
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead><tr>{sortHeader("code", "Código", styles.thCode)}{sortHeader("employee", "Trabajador", styles.thEmployee)}{sortHeader("company", "Empresa / centro", styles.thCompany)}{sortHeader("ccc", "CCC", styles.thCcc)}{sortHeader("type", "Tipo", styles.thType)}{sortHeader("start", "Inicio", styles.thDate)}{sortHeader("end", "Fin", styles.thDate)}{sortHeader("status", "Estado", styles.thStatus)}{sortHeader("salary", "Salario", styles.thSalary)}<th style={styles.thActions}>Acciones</th></tr></thead>
          <tbody>
            {sortedContracts.map((contract) => (
              <tr key={contract.id}>
                <td style={styles.tdCode}>{getContractCode(contract)}</td>
                <td style={styles.td}>{getEmployeeName(contract)}</td>
                <td style={styles.td}>{getCompanyAndCenterName(contract)}</td>
                <td style={styles.tdCcc}>{getCompanyCcc(contract)}</td>
                <td style={styles.tdType}>{contract.contract_code ? `${contract.contract_code} · ${formatContractType(contract.contract_type)}` : formatContractType(contract.contract_type)}</td>
                <td style={styles.tdDate}>{formatDate(contract.start_date)}</td>
                <td style={styles.tdDate}>{formatDate(contract.end_date)}</td>
                <td style={styles.tdStatus}><span style={contract.status === "active" ? styles.activeBadge : styles.inactiveBadge}>{formatStatus(contract.status)}</span></td>
                <td style={styles.tdSalary}>{formatSalary(contract.salary_base)}</td>
                <td style={styles.tdActions}><button type="button" onClick={() => openEditModal(contract)} style={styles.editButton}>Detalles</button></td>
              </tr>
            ))}
            {contracts.length === 0 && <tr><td style={styles.td} colSpan="10">No hay contratos registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      {editingContract && editForm && ssEditForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div><h3 style={styles.modalTitle}>Detalle y edición de contrato</h3><p style={styles.modalSubtitle}>Contrato {getContractCode(editingContract)} · {getEmployeeName(editingContract)} · {formatPaySchedule(editingContract.pay_schedule)}</p></div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <section style={styles.sectionBox}>
                <h4 style={styles.sectionTitle}>Datos contractuales</h4>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Trabajador</label><input value={getEmployeeName(editingContract)} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} /></div><div style={styles.formGroup}><label>Empresa / centro</label><input value={getCompanyAndCenterName(editingContract)} readOnly disabled style={{ ...styles.input, ...styles.readOnlyInput }} /></div></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Código contrato</label><input name="contract_code" value={editForm.contract_code} onChange={handleEditChange} style={styles.input} /></div><div style={styles.formGroup}><label>Tipo de contrato</label><select name="contract_type" value={editForm.contract_type} onChange={handleEditChange} required style={styles.input}><option value="">Selecciona tipo</option><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="formacion">Formación</option><option value="sustitucion">Sustitución</option></select></div><div style={styles.formGroup}><label>Sistema de pagas</label><select name="pay_schedule" value={editForm.pay_schedule} onChange={handleEditChange} required style={styles.input}>{PAY_SCHEDULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Fecha inicio</label><input type="date" name="start_date" value={editForm.start_date} onChange={handleEditChange} required style={styles.input} /></div><div style={styles.formGroup}><label>Fecha fin</label><input type="date" name="end_date" value={editForm.end_date} onChange={handleEditChange} style={styles.input} /></div><div style={styles.formGroup}><label>Estado</label><select name="status" value={editForm.status} onChange={handleEditChange} style={styles.input}><option value="active">Activo</option><option value="ended">Finalizado</option></select></div></div>
              </section>

              <section style={styles.sectionBox}>
                <h4 style={styles.sectionTitle}>Jornada, cotización y RED</h4>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Grupo cotización</label><select name="contribution_group" value={editForm.contribution_group} onChange={(e) => { handleEditChange(e); setSsEditForm((prev) => ({ ...prev, contribution_group: e.target.value, red_contribution_group: e.target.value })); }} style={styles.input}><option value="">Selecciona grupo</option>{catalogs.contribution_groups.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></div><div style={styles.formGroup}><label>Tipo jornada</label><select name="working_day_type" value={editForm.working_day_type} onChange={handleEditChange} style={styles.input}><option value="">Sin definir</option>{catalogOrFallback(catalogs.working_day_types, [{ code: "full_time", description: "Jornada completa" }, { code: "part_time", description: "Jornada parcial" }, { code: "fixed_discontinuous", description: "Fijo discontinuo" }]).map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></div><div style={styles.formGroup}><label>Coeficiente parcialidad</label><input type="number" name="partiality_coefficient" value={editForm.partiality_coefficient} onChange={handleEditChange} style={styles.input} /></div></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Categoría profesional</label><input name="professional_category" value={editForm.professional_category} onChange={handleEditChange} style={styles.input} /></div><div style={styles.formGroup}><label>Puesto</label><input name="job_position" value={editForm.job_position} onChange={handleEditChange} style={styles.input} /></div><div style={styles.formGroup}><label>Convenio colectivo</label><input name="collective_agreement_code" value={editForm.collective_agreement_code} onChange={handleEditChange} style={styles.input} /></div></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Ocupación RED</label><input name="red_occupation_code" value={editForm.red_occupation_code} onChange={(e) => { handleEditChange(e); setSsEditForm((prev) => ({ ...prev, red_occupation_code: e.target.value, occupation_code: e.target.value })); }} style={styles.input} /></div><div style={styles.formGroup}><label>Código reducción</label><input name="red_reduction_code" value={editForm.red_reduction_code} onChange={(e) => { handleEditChange(e); setSsEditForm((prev) => ({ ...prev, red_reduction_code: e.target.value })); }} style={styles.input} /></div><div style={styles.formGroup}><label>Salario bruto anual</label><input type="number" name="salary_base" value={editForm.salary_base} onChange={handleEditChange} style={styles.input} /></div></div>
              </section>

              <section style={styles.sectionBox}>
                <h4 style={styles.sectionTitle}>Alta SS simulada</h4>
                <div style={styles.ssSummary}><div><span>Situación</span><strong>{findLabel(catalogs.situations, ssEditForm.situation_code)}</strong></div><div><span>Alta</span><strong>{formatDate(ssEditForm.registration_date)}</strong></div><div><span>Colectivo</span><strong>{findLabel(catalogs.worker_collectives, ssEditForm.worker_collective_code)}</strong></div></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Situación</label><select name="situation_code" value={ssEditForm.situation_code} onChange={handleSsEditChange} style={styles.input}>{catalogOrFallback(catalogs.situations, [{ code: "1", description: "Alta" }]).map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></div><div style={styles.formGroup}><label>Fecha alta</label><input type="date" name="registration_date" value={ssEditForm.registration_date} onChange={handleSsEditChange} style={styles.input} /></div><div style={styles.formGroup}><label>Discapacidad</label><input type="number" name="disability_degree" value={ssEditForm.disability_degree} onChange={handleSsEditChange} style={styles.input} /></div></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Colectivo trabajador</label><select name="worker_collective_code" value={ssEditForm.worker_collective_code} onChange={handleSsEditChange} style={styles.input}><option value="">No aplica</option>{catalogs.worker_collectives.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></div><div style={styles.formGroup}><label>Condición desempleado</label><select name="unemployed_condition_code" value={ssEditForm.unemployed_condition_code} onChange={handleSsEditChange} style={styles.input}><option value="">No aplica</option>{catalogs.unemployed_conditions.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></div><div style={styles.formGroup}><label>Exclusión / víctimas</label><select name="social_exclusion_or_victim_status" value={ssEditForm.social_exclusion_or_victim_status} onChange={handleSsEditChange} style={styles.input}>{catalogs.social_exclusion_victim_statuses.map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}</select></div></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Tipo inactividad</label><select name="inactivity_type_code" value={ssEditForm.inactivity_type_code} onChange={handleSsEditChange} style={styles.input}><option value="">No aplica</option>{catalogs.inactivity_types.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></div><div style={styles.formGroup}><label>CNO</label><input name="cno" value={ssEditForm.cno} onChange={handleSsEditChange} style={styles.input} /></div><div style={styles.formGroup}><label>Relación especial RED</label><input name="red_special_relation" value={ssEditForm.red_special_relation} onChange={handleSsEditChange} style={styles.input} /></div></div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Reducción jornada</label><input type="number" name="working_time_reduction" value={ssEditForm.working_time_reduction} onChange={handleSsEditChange} style={styles.input} /></div><div style={styles.formGroup}><label>C.T.P. inicial</label><input type="number" name="initial_ctp" value={ssEditForm.initial_ctp} onChange={handleSsEditChange} style={styles.input} /></div><div style={styles.formGroup}><label>NAF sustituido</label><input name="replaced_worker_naf" value={ssEditForm.replaced_worker_naf} onChange={handleSsEditChange} disabled={!ssEditForm.is_replacement} style={styles.input} /></div></div>
                <div style={styles.checkRow}><label style={styles.checkboxLabel}><input type="checkbox" name="is_replacement" checked={ssEditForm.is_replacement} onChange={handleSsEditChange} /> Sustitución / relevo</label></div>
                {ssEditForm.is_replacement && <div style={styles.formRow}><div style={styles.formGroup}><label>Causa sustitución</label><select name="replacement_cause_code" value={ssEditForm.replacement_cause_code} onChange={handleSsEditChange} style={styles.input}><option value="">Selecciona causa</option>{catalogs.substitution_causes.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></div></div>}
              </section>

              {editError && <div style={styles.error}>{editError}</div>}
              <div style={styles.modalActionsSplit}><button type="button" onClick={() => openTerminationModal(editingContract)} style={styles.deleteButton}>Tramitar baja</button><div style={styles.modalActionsRight}><button type="button" onClick={closeEditModal} style={styles.cancelButton}>Cancelar</button><button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar contrato y SS"}</button></div></div>
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
              <div style={styles.formRow}><div style={styles.formGroup}><label>Fecha fin / fecha de baja</label><input type="date" name="end_date" value={terminationForm.end_date} onChange={handleTerminationChange} style={styles.input} required /><small style={styles.helpText}>Debe coincidir con la fecha fin indicada en el contrato si ya existe.</small></div><div style={styles.formGroup}><label>Motivo de la baja</label><select name="reason" value={terminationForm.reason} onChange={handleTerminationChange} style={styles.input}>{TERMINATION_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></div></div>
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
  tableWrapper: { overflowX: "auto", width: "100%" },
  table: { width: "100%", minWidth: "1120px", borderCollapse: "collapse", tableLayout: "fixed" },
  sortButton: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: 0, border: "none", backgroundColor: "transparent", color: "inherit", font: "inherit", fontWeight: 900, cursor: "pointer", textAlign: "left" },
  sortIcon: { color: "#6b7280", fontSize: "12px" },
  thEmployee: { width: "230px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thCompany: { width: "260px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thCode: { width: "90px", textAlign: "left", padding: "12px 8px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thCcc: { width: "110px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thType: { width: "124px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thDate: { width: "104px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thStatus: { width: "104px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thSalary: { width: "98px", textAlign: "right", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thActions: { width: "86px", textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdCode: { width: "90px", padding: "12px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 900 },
  tdCcc: { width: "110px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdType: { width: "124px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  tdDate: { width: "104px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  tdStatus: { width: "104px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  tdSalary: { width: "98px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", textAlign: "right" },
  tdActions: { width: "86px", padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  activeBadge: { backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  inactiveBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700, fontSize: "12px" },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(1040px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  confirmModalWide: { width: "min(760px, 100%)", backgroundColor: "#ffffff", border: "3px solid #111111", borderRadius: "12px", boxShadow: "8px 8px 0 #e6d85c", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  sectionBox: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: "0 0 12px", fontSize: "14px", fontWeight: 900, color: "#111827" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupFull: { display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  textarea: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", resize: "vertical", fontFamily: "inherit" },
  readOnlyInput: { backgroundColor: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", fontWeight: 800 },
  helpText: { color: "#6b7280", fontSize: "12px", fontWeight: 700 },
  terminationSummary: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "16px" },
  ssSummary: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "16px" },
  checkRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#374151" },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
