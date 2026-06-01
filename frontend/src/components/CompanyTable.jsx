import { useMemo, useState } from "react";
import { getSortLabel, nextSortConfig, sortRows } from "../utils/tableSorting";

const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const SILTRA_FLAGS = [
  ["exclusion_irpf", "Exclusión IRPF"],
  ["exclusion_fogasa", "Exclusión FOGASA"],
  ["exclusion_integrated_officials", "Exclusión funcionarios integrados"],
  ["resolution_2010_05_25", "Resolución 25/05/2010"],
  ["ceuta_melilla_bonus", "Bonificación Ceuta/Melilla"],
  ["local_police_extra_suspension", "Suspensión extra Navidad Policías Locales"],
];

const SECTOR_FLAGS = [
  ["textile", "Industrial textil"],
  ["leather_goods", "Marroquinería"],
  ["furniture", "Mueble"],
  ["toy", "Juguetería"],
  ["tourism", "Turismo"],
  ["research", "Investigación"],
  ["sports_club", "Club deportivo"],
];

const initialFilters = {
  search: "",
  status: "",
  company_type: "",
  province: "",
  siltra: "",
};

function createEmptySchedule() {
  return WEEK_DAYS.reduce((acc, day) => {
    acc[day] = { morning: "", afternoon: "", total: "" };
    return acc;
  }, {});
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
}

function parseCalendarData(company) {
  if (!company.work_calendar_data) {
    return {
      calendar_period_type: "todo_el_ano",
      winter_period: "",
      summer_period: "",
      rest_type: "semanal",
      rest_days: "Sábado y domingo",
      schedule: createEmptySchedule(),
      shifts_enabled: false,
      shift_1: "",
      shift_2: "",
      shift_3: "",
      shift_4: "",
    };
  }

  try {
    const parsed = JSON.parse(company.work_calendar_data);
    const shifts = parsed.shifts || [];
    return {
      calendar_period_type: parsed.period_type || "todo_el_ano",
      winter_period: parsed.winter_period || "",
      summer_period: parsed.summer_period || "",
      rest_type: parsed.rest_type || "semanal",
      rest_days: parsed.rest_days || "Sábado y domingo",
      schedule: { ...createEmptySchedule(), ...(parsed.schedule || {}) },
      shifts_enabled: !!parsed.shifts_enabled,
      shift_1: shifts[0] || "",
      shift_2: shifts[1] || "",
      shift_3: shifts[2] || "",
      shift_4: shifts[3] || "",
    };
  } catch {
    return {
      calendar_period_type: "todo_el_ano",
      winter_period: "",
      summer_period: "",
      rest_type: "semanal",
      rest_days: "Sábado y domingo",
      schedule: createEmptySchedule(),
      shifts_enabled: false,
      shift_1: "",
      shift_2: "",
      shift_3: "",
      shift_4: "",
    };
  }
}

function toEditForm(company) {
  return {
    name: company.name || "",
    cif: company.cif || "",
    ccc: company.ccc || "",
    ccc_regime: company.ccc_regime || "",
    ccc_code: company.ccc_code || "",
    address: company.address || "",
    city: company.city || "",
    province: company.province || "",
    status: company.status || "alta",
    registration_date: company.registration_date || "",
    deregistration_date: company.deregistration_date || "",
    main_collective_agreement: company.main_collective_agreement || "",
    is_cooperative: !!company.is_cooperative,
    special_work_income_withholding: !!company.special_work_income_withholding,
    company_type: company.company_type || "privada",
    legal_representative_name: company.legal_representative_name || "",
    legal_representative_dni: company.legal_representative_dni || "",
    legal_representative_position: company.legal_representative_position || "",
    cnae_2009_code: company.cnae_2009_code || "",
    cnae_2009_name: company.cnae_2009_name || "",
    cnae_2025_code: company.cnae_2025_code || "",
    cnae_2025_name: company.cnae_2025_name || "",
    pension_plan_enabled: !!company.pension_plan_enabled,
    pension_manager_key: company.pension_manager_key || "",
    pension_manager_entity_number: company.pension_manager_entity_number || "",
    pension_plan_name: company.pension_plan_name || "",
    work_calendar_mode: company.work_calendar_mode || "",
    work_calendar_name: company.work_calendar_name || "",
    ...parseCalendarData(company),
    bank_iban: company.bank_iban || "",
    model_111: company.model_111 || "trimestral",
    fiscal_regime: company.fiscal_regime || "plan_general_contable",
    complement_computation: company.complement_computation || "segun_convenio",
    siltra_enabled: !!company.siltra_enabled,
    siltra_payment_mode: company.siltra_payment_mode || "cargo_cuenta",
    siltra_flags: parseJsonObject(company.siltra_options),
    sector_flags: parseJsonObject(company.sector_bonuses),
    grouped_withholding_company: company.grouped_withholding_company || "",
    is_active: company.is_active !== false,
  };
}

function formatStatus(status) {
  if (status === "baja_temporal") return "Baja temporal";
  if (status === "baja_definitiva") return "Baja definitiva";
  return "Alta";
}

function buildCalendarData(form) {
  return JSON.stringify({
    period_type: form.calendar_period_type,
    winter_period: form.winter_period,
    summer_period: form.summer_period,
    rest_type: form.rest_type,
    rest_days: form.rest_days,
    schedule: form.schedule,
    shifts_enabled: form.shifts_enabled,
    shifts: [form.shift_1, form.shift_2, form.shift_3, form.shift_4].filter(Boolean),
  });
}

function buildUpdatePayload(form) {
  const ccc = form.ccc || [form.ccc_regime, form.ccc_code].filter(Boolean).join("/") || null;
  const {
    calendar_period_type,
    winter_period,
    summer_period,
    rest_type,
    rest_days,
    schedule,
    shifts_enabled,
    shift_1,
    shift_2,
    shift_3,
    shift_4,
    siltra_flags,
    sector_flags,
    ...baseForm
  } = form;

  return {
    ...baseForm,
    ccc,
    work_calendar_data: form.work_calendar_mode ? buildCalendarData(form) : null,
    siltra_options: JSON.stringify(siltra_flags || {}),
    sector_bonuses: JSON.stringify(sector_flags || {}),
    registration_date: form.registration_date || null,
    deregistration_date: form.deregistration_date || null,
  };
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function CompanyTable({ loading, companies, onUpdateCompany, onDeleteCompany, submitting }) {
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });
  const [filters, setFilters] = useState(initialFilters);

  const filterOptions = useMemo(() => {
    const types = [...new Set(companies.map((company) => company.company_type).filter(Boolean))].sort();
    const provinces = [...new Set(companies.map((company) => company.province).filter(Boolean))].sort();
    return { types, provinces };
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const search = normalizeText(filters.search);
    return companies.filter((company) => {
      const matchesSearch = !search || [company.name, company.cif, company.ccc, company.city, company.province, company.main_collective_agreement]
        .some((value) => normalizeText(value).includes(search));
      const matchesStatus = !filters.status || company.status === filters.status;
      const matchesType = !filters.company_type || company.company_type === filters.company_type;
      const matchesProvince = !filters.province || company.province === filters.province;
      const matchesSiltra = !filters.siltra || String(!!company.siltra_enabled) === filters.siltra;
      return matchesSearch && matchesStatus && matchesType && matchesProvince && matchesSiltra;
    });
  }, [companies, filters]);

  const sortedCompanies = useMemo(() => sortRows(filteredCompanies, sortConfig, {
    id: (company) => company.id,
    name: (company) => company.name,
    cif: (company) => company.cif,
    ccc: (company) => company.ccc,
    status: (company) => company.status,
    company_type: (company) => company.company_type,
    city: (company) => company.city,
    province: (company) => company.province,
  }), [filteredCompanies, sortConfig]);

  if (loading) return <p>Cargando...</p>;

  const handleSort = (key) => setSortConfig((current) => nextSortConfig(current, key));

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const sortHeader = (key, label, style = styles.th) => (
    <th style={style}>
      <button type="button" onClick={() => handleSort(key)} style={styles.sortButton}>
        <span>{label}</span>
        <span style={styles.sortIcon}>{getSortLabel(sortConfig, key)}</span>
      </button>
    </th>
  );

  const openEditModal = (company) => {
    setEditingCompany(company);
    setEditForm(toEditForm(company));
    setEditError("");
    setDeleteError("");
  };

  const closeEditModal = () => {
    setEditingCompany(null);
    setEditForm(null);
    setEditError("");
  };

  const handleEditChange = (event) => {
    const { name, value, checked, type } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleFlagChange = (group, key, checked) => {
    setEditForm((prev) => ({
      ...prev,
      [group]: { ...(prev[group] || {}), [key]: checked },
    }));
  };

  const handleScheduleChange = (day, field, value) => {
    setEditForm((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: { ...prev.schedule[day], [field]: value },
      },
    }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError("");
    try {
      await onUpdateCompany(editingCompany.id, buildUpdatePayload(editForm));
      closeEditModal();
    } catch (err) {
      setEditError(err.message || "Error al actualizar empresa");
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError("");
    try {
      await onDeleteCompany(companyToDelete.id);
      setCompanyToDelete(null);
      closeEditModal();
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar empresa");
    }
  };

  const input = (name, label, props = {}) => (
    <div style={props.wide ? styles.formGroupWide : styles.formGroup}>
      <label>{label}</label>
      <input name={name} value={editForm[name] || ""} onChange={handleEditChange} style={styles.input} {...props} />
    </div>
  );

  return (
    <>
      <div style={styles.filterPanel}>
        <div style={styles.filterHeader}>
          <strong>Filtros</strong>
          <span style={styles.counter}>Mostrando {sortedCompanies.length} de {companies.length} empresas</span>
        </div>
        <div style={styles.filterGrid}>
          <label style={styles.filterGroup}>Buscar<input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Empresa, CIF, CCC, convenio..." style={styles.input} /></label>
          <label style={styles.filterGroup}>Estado<select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option><option value="alta">Alta</option><option value="baja_temporal">Baja temporal</option><option value="baja_definitiva">Baja definitiva</option></select></label>
          <label style={styles.filterGroup}>Tipo<select name="company_type" value={filters.company_type} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option>{filterOptions.types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label style={styles.filterGroup}>Provincia<select name="province" value={filters.province} onChange={handleFilterChange} style={styles.input}><option value="">Todas</option>{filterOptions.provinces.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
          <label style={styles.filterGroup}>SILTRA<select name="siltra" value={filters.siltra} onChange={handleFilterChange} style={styles.input}><option value="">Todas</option><option value="true">Sí</option><option value="false">No</option></select></label>
        </div>
        <button type="button" onClick={() => setFilters(initialFilters)} style={styles.clearFiltersButton}>Limpiar filtros</button>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead><tr>{sortHeader("id", "ID")}{sortHeader("name", "Nombre")}{sortHeader("cif", "CIF")}{sortHeader("status", "Estado")}{sortHeader("company_type", "Tipo")}{sortHeader("ccc", "CCC")}<th style={styles.th}>Convenio</th><th style={styles.th}>Modelo 111</th><th style={styles.th}>SILTRA</th>{sortHeader("city", "Ciudad")}<th style={styles.th}>Acciones</th></tr></thead>
          <tbody>
            {sortedCompanies.map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>{c.id}</td><td style={styles.td}>{c.name}</td><td style={styles.td}>{c.cif}</td><td style={styles.td}>{formatStatus(c.status)}</td><td style={styles.td}>{c.company_type || "-"}</td><td style={styles.td}>{c.ccc || "-"}</td><td style={styles.td}>{c.main_collective_agreement || "-"}</td><td style={styles.td}>{c.model_111 || "-"}</td><td style={styles.td}>{c.siltra_enabled ? "Sí" : "No"}</td><td style={styles.td}>{c.city || "-"}</td>
                <td style={styles.td}><button type="button" onClick={() => openEditModal(c)} style={styles.editButton}>Editar</button></td>
              </tr>
            ))}
            {sortedCompanies.length === 0 && <tr><td colSpan="11" style={styles.emptyCell}>No hay empresas que coincidan con los filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {editingCompany && editForm && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div><h3 style={styles.modalTitle}>Editar empresa</h3><p style={styles.modalSubtitle}>ID {editingCompany.id} · {editingCompany.name}</p></div>
              <button type="button" onClick={closeEditModal} style={styles.closeButton}>×</button>
            </div>

            <form onSubmit={handleEditSubmit} style={styles.form}>
              <section style={styles.block}><h4 style={styles.blockTitle}>Identificación</h4>
                <div style={styles.formRow}>{input("name", "Nombre", { required: true })}{input("cif", "CIF", { required: true })}<div style={styles.formGroup}><label>Estado</label><select name="status" value={editForm.status} onChange={handleEditChange} style={styles.input}><option value="alta">Alta</option><option value="baja_temporal">Baja temporal</option><option value="baja_definitiva">Baja definitiva</option></select></div></div>
                <div style={styles.formRow}>{input("registration_date", "Fecha alta", { type: "date" })}{input("deregistration_date", "Fecha baja", { type: "date" })}{input("main_collective_agreement", "Convenio principal")}</div>
                <div style={styles.formRow}>{input("ccc_regime", "CCC régimen")}{input("ccc_code", "CCC código")}{input("ccc", "CCC completo")}</div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Tipo empresa</label><select name="company_type" value={editForm.company_type} onChange={handleEditChange} style={styles.input}><option value="privada">Privada</option><option value="publica">Pública</option><option value="privada_sin_lucro">Privada sin lucro</option><option value="corporaciones">Corporaciones</option><option value="ett">ETT</option><option value="sociedad_laboral_privada">Sociedad laboral privada</option></select></div>{input("address", "Domicilio social")}{input("city", "Ciudad")}{input("province", "Provincia")}</div>
                <div style={styles.checkboxRow}><label><input type="checkbox" name="is_cooperative" checked={editForm.is_cooperative} onChange={handleEditChange} /> Sociedad cooperativa</label><label><input type="checkbox" name="special_work_income_withholding" checked={editForm.special_work_income_withholding} onChange={handleEditChange} /> Cálculo especial retenciones trabajo</label><label><input type="checkbox" name="is_active" checked={editForm.is_active} onChange={handleEditChange} /> Activa</label></div>
              </section>

              <section style={styles.block}><h4 style={styles.blockTitle}>Representante legal y CNAE</h4>
                <div style={styles.formRow}>{input("legal_representative_name", "Nombre representante")}{input("legal_representative_dni", "DNI representante")}{input("legal_representative_position", "Puesto representante")}</div>
                <div style={styles.formRow}>{input("cnae_2009_code", "CNAE 2009 código")}{input("cnae_2009_name", "CNAE 2009 nombre")}{input("cnae_2025_code", "CNAE 2025 código")}{input("cnae_2025_name", "CNAE 2025 nombre")}</div>
              </section>

              <section style={styles.block}><div style={styles.headerRow}><h4 style={styles.blockTitle}>Plan de pensiones</h4><label style={styles.inlineCheck}><input type="checkbox" name="pension_plan_enabled" checked={editForm.pension_plan_enabled} onChange={handleEditChange} /> Activado</label></div>
                {editForm.pension_plan_enabled && <div style={styles.formRow}>{input("pension_manager_key", "Clave entidad gestora")}{input("pension_manager_entity_number", "Número entidad gestora")}{input("pension_plan_name", "Denominación plan")}</div>}
              </section>

              <section style={styles.block}><h4 style={styles.blockTitle}>Calendario de trabajo</h4>
                <div style={styles.formRow}>{input("work_calendar_mode", "Modo calendario")}{input("work_calendar_name", "Nombre calendario")}</div>
                <div style={styles.formRow}><div style={styles.formGroup}><label>Periodo</label><select name="calendar_period_type" value={editForm.calendar_period_type} onChange={handleEditChange} style={styles.input}><option value="todo_el_ano">Todo el año</option><option value="verano_invierno">Verano e invierno</option></select></div><div style={styles.formGroup}><label>Descanso y vacaciones</label><select name="rest_type" value={editForm.rest_type} onChange={handleEditChange} style={styles.input}><option value="semanal">Semanal</option><option value="intermedio">Intermedio</option></select></div>{input("rest_days", "Días de descanso")}</div>
                {editForm.calendar_period_type === "verano_invierno" && <div style={styles.formRow}>{input("winter_period", "Periodo invierno")}{input("summer_period", "Periodo verano")}</div>}
                <div style={styles.scheduleWrapper}><table style={styles.scheduleTable}><thead><tr><th>Día</th><th>Horario mañana</th><th>Horario tarde</th><th>Total horas</th></tr></thead><tbody>{WEEK_DAYS.map((day) => <tr key={day}><td>{day}</td><td><input value={editForm.schedule[day].morning} onChange={(event) => handleScheduleChange(day, "morning", event.target.value)} style={styles.input} /></td><td><input value={editForm.schedule[day].afternoon} onChange={(event) => handleScheduleChange(day, "afternoon", event.target.value)} style={styles.input} /></td><td><input value={editForm.schedule[day].total} onChange={(event) => handleScheduleChange(day, "total", event.target.value)} style={styles.input} /></td></tr>)}</tbody></table></div>
                <label style={styles.inlineCheck}><input type="checkbox" name="shifts_enabled" checked={editForm.shifts_enabled} onChange={handleEditChange} /> Activar turnos</label>
                {editForm.shifts_enabled && <div style={styles.formRow}>{input("shift_1", "Turno 1")}{input("shift_2", "Turno 2")}{input("shift_3", "Turno 3")}{input("shift_4", "Turno 4")}</div>}
              </section>

              <section style={styles.block}><h4 style={styles.blockTitle}>Fiscalidad, pagos y SILTRA</h4>
                <div style={styles.formRow}>{input("bank_iban", "IBAN")}<div style={styles.formGroup}><label>Modelo 111</label><select name="model_111" value={editForm.model_111} onChange={handleEditChange} style={styles.input}><option value="trimestral">Trimestral</option><option value="mensual">Mensual</option><option value="no_confecciona">No confecciona</option><option value="solo_mod216">Solo mod. 216</option></select></div><div style={styles.formGroup}><label>Régimen fiscal</label><select name="fiscal_regime" value={editForm.fiscal_regime} onChange={handleEditChange} style={styles.input}><option value="estimacion_directa">Estimación directa</option><option value="modulos">Módulos</option><option value="plan_general_contable">Plan general contable</option></select></div><div style={styles.formGroup}><label>Cómputo complementos</label><select name="complement_computation" value={editForm.complement_computation} onChange={handleEditChange} style={styles.input}><option value="segun_convenio">Según convenio</option><option value="calendario_laboral">Por calendario laboral</option></select></div></div>
                <div style={styles.formRow}>{input("grouped_withholding_company", "Retenciones 111/190 agrupadas con")}</div>
                <label style={styles.inlineCheck}><input type="checkbox" name="siltra_enabled" checked={editForm.siltra_enabled} onChange={handleEditChange} /> Cotización SILTRA</label>
                {editForm.siltra_enabled && <><div style={styles.formRow}><div style={styles.formGroup}><label>Forma de pago SILTRA</label><select name="siltra_payment_mode" value={editForm.siltra_payment_mode} onChange={handleEditChange} style={styles.input}><option value="cargo_cuenta">Cargo en cuenta</option><option value="pago_electronico">Pago electrónico</option><option value="retribucion_contable">Retribución contable</option></select></div></div><h5 style={styles.miniTitle}>Opciones y exclusiones SILTRA</h5><div style={styles.flagGrid}>{SILTRA_FLAGS.map(([key, label]) => <label key={key}><input type="checkbox" checked={!!editForm.siltra_flags[key]} onChange={(event) => handleFlagChange("siltra_flags", key, event.target.checked)} /> {label}</label>)}</div><h5 style={styles.miniTitle}>Bonificación sectorial</h5><div style={styles.flagGrid}>{SECTOR_FLAGS.map(([key, label]) => <label key={key}><input type="checkbox" checked={!!editForm.sector_flags[key]} onChange={(event) => handleFlagChange("sector_flags", key, event.target.checked)} /> {label}</label>)}</div></>}
              </section>

              {editError && <div style={styles.error}>{editError}</div>}
              <div style={styles.modalActionsSplit}><button type="button" onClick={() => setCompanyToDelete(editingCompany)} style={styles.deleteButton}>Eliminar empresa</button><div style={styles.modalActionsRight}><button type="button" onClick={closeEditModal} style={styles.cancelButton}>Cancelar</button><button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar cambios"}</button></div></div>
            </form>
          </div>
        </div>
      )}

      {companyToDelete && (
        <div style={styles.modalBackdrop}><div style={styles.confirmModal}><div style={styles.modalHeader}><div><h3 style={styles.modalTitle}>Eliminar empresa</h3><p style={styles.modalSubtitle}>Esta acción desactivará la empresa.</p></div><button type="button" onClick={() => setCompanyToDelete(null)} style={styles.closeButton}>×</button></div><p style={styles.confirmText}>¿Seguro que quieres eliminar/desactivar {companyToDelete.name}?</p>{deleteError && <div style={styles.error}>{deleteError}</div>}<div style={styles.modalActions}><button type="button" onClick={() => setCompanyToDelete(null)} style={styles.cancelButton}>Cancelar</button><button type="button" onClick={handleConfirmDelete} disabled={submitting} style={styles.dangerButton}>{submitting ? "Eliminando..." : "Confirmar eliminación"}</button></div></div></div>
      )}
    </>
  );
}

const styles = {
  filterPanel: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", marginBottom: "14px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "12px" },
  filterHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", color: "#111827" },
  counter: { fontSize: "13px", color: "#6b7280", fontWeight: 800 },
  filterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "6px", fontWeight: 800, color: "#111827" },
  clearFiltersButton: { alignSelf: "flex-start", backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 900 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  sortButton: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: 0, border: "none", backgroundColor: "transparent", color: "inherit", font: "inherit", fontWeight: 900, cursor: "pointer", textAlign: "left" },
  sortIcon: { color: "#6b7280", fontSize: "12px" },
  td: { padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  emptyCell: { padding: "18px", color: "#6b7280", textAlign: "center", borderBottom: "1px solid #eee" },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: 700 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(1120px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "12px", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "22px" },
  confirmModal: { width: "min(560px, 100%)", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "12px", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  block: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "12px", backgroundColor: "#ffffff" },
  blockTitle: { margin: 0, fontSize: "14px", fontWeight: 900, color: "#111827" },
  miniTitle: { margin: "4px 0 0", fontSize: "13px", fontWeight: 900, color: "#374151" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  checkboxRow: { display: "flex", gap: "18px", flexWrap: "wrap", fontWeight: 800, color: "#111827" },
  inlineCheck: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#111827" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "190px", flex: "0 0 190px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  scheduleWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#ffffff" },
  scheduleTable: { width: "100%", borderCollapse: "collapse" },
  flagGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", fontWeight: 700, color: "#111827" },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
