import { useMemo, useState } from "react";

import { createCompany } from "../services/companyApi";
import { getSortLabel, nextSortConfig, sortRows } from "../utils/tableSorting";

const MUTUALS = [
  "UMIVALE ACTIVA - (nº 003)",
  "ASEPEYO - (nº 151)",
  "EGARSAT - (nº 276)",
  "FRATERNIDAD - MUPRESPA - (nº 275)",
  "FREMAP - (nº 061)",
  "IBERMUTUA - (nº 274)",
  "MAC, MUTUA DE ACCIDENTES DE CANARIAS - (nº 272)",
  "MAZ, MUTUA DE ACCIDENTES DE ZARAGOZA - (nº 011)",
  "MUTUA BALEAR - (nº 183)",
  "MUTUA DE ANDALUCÍA Y CEUTA - CESMA - (nº 115)",
  "MUTUA INTERCOMARCAL - (nº 039)",
  "MUTUA MONTAÑESA - (nº 007)",
  "MUTUA NAVARRA - (nº 021)",
  "MUTUA UNIVERSAL, MUGENAT - (nº 010)",
  "MC MUTUAL - (nº 001)",
  "MUTUALIA - (nº 002)",
  "SOLIMAT - (nº 072)",
  "UNION DE MUTUAS, UNIMAT - (nº 267)",
];

const initialFilters = {
  search: "",
  status: "",
  company_type: "",
  province: "",
};

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function emptyToNull(value) {
  return value === "" ? null : value;
}

function formatStatus(status) {
  if (status === "baja_temporal") return "Baja temporal";
  if (status === "baja_definitiva") return "Baja definitiva";
  return "Alta";
}

function toEditForm(company) {
  return {
    name: company.name || "",
    cif: company.cif || "",
    ccc_regime: company.ccc_regime || "",
    ccc_code: company.ccc_code || "",
    address: company.address || "",
    city: company.city || "",
    province: company.province || "",
    company_phone: company.company_phone || "",
    company_email: company.company_email || "",
    company_website: company.company_website || "",
    company_contact_person: company.company_contact_person || "",
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
    professional_contingencies_mutual: company.professional_contingencies_mutual || "",
    professional_contingencies_policy: company.professional_contingencies_policy || "",
    professional_contingencies_effective_date: company.professional_contingencies_effective_date || "",
    common_it_mutual: company.common_it_mutual || "",
    common_it_policy: company.common_it_policy || "",
    common_it_effective_date: company.common_it_effective_date || "",
    collective_insurance_enabled: !!company.collective_insurance_enabled,
    collective_insurance_company: company.collective_insurance_company || "",
    collective_insurance_policy: company.collective_insurance_policy || "",
    collective_insurance_capital: company.collective_insurance_capital || "",
    pension_plan_enabled: !!company.pension_plan_enabled,
    pension_manager_key: company.pension_manager_key || "",
    pension_manager_entity_number: company.pension_manager_entity_number || "",
    pension_plan_name: company.pension_plan_name || "",
    work_calendar_mode: company.work_calendar_mode || "new",
    work_calendar_name: company.work_calendar_name || "",
    work_calendar_data: company.work_calendar_data || null,
    bank_iban: company.bank_iban || "",
    fiscal_regime: company.fiscal_regime || "plan_general_contable",
    is_active: company.is_active !== false,
  };
}

function buildUpdatePayload(form) {
  return {
    ...form,
    ccc: [form.ccc_regime, form.ccc_code].filter(Boolean).join("/") || null,
    registration_date: emptyToNull(form.registration_date),
    deregistration_date: emptyToNull(form.deregistration_date),
    professional_contingencies_effective_date: emptyToNull(form.professional_contingencies_effective_date),
    common_it_effective_date: emptyToNull(form.common_it_effective_date),
  };
}

function buildDuplicatePayload(source, duplicateForm) {
  return {
    ...source,
    id: undefined,
    created_at: undefined,
    is_active: true,
    name: duplicateForm.name,
    cif: duplicateForm.cif,
    ccc: [duplicateForm.ccc_regime, duplicateForm.ccc_code].filter(Boolean).join("/") || null,
    ccc_regime: duplicateForm.ccc_regime || null,
    ccc_code: duplicateForm.ccc_code || null,
    status: "alta",
    deregistration_date: null,
  };
}

function MutualSelect({ name, value, onChange }) {
  return (
    <select name={name} value={value || ""} onChange={onChange} style={styles.input}>
      <option value="">Seleccionar mutua</option>
      {MUTUALS.map((mutual) => <option key={mutual} value={mutual}>{mutual}</option>)}
    </select>
  );
}

export default function CompanyTable({
  loading,
  companies,
  onUpdateCompany,
  onDeleteCompany,
  onOpenPreferences,
  submitting,
}) {
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [companyToDuplicate, setCompanyToDuplicate] = useState(null);
  const [duplicateForm, setDuplicateForm] = useState({ name: "", cif: "", ccc_regime: "0111", ccc_code: "" });
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [duplicateError, setDuplicateError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });
  const [filters, setFilters] = useState(initialFilters);

  const filterOptions = useMemo(() => ({
    types: [...new Set(companies.map((company) => company.company_type).filter(Boolean))].sort(),
    provinces: [...new Set(companies.map((company) => company.province).filter(Boolean))].sort(),
  }), [companies]);

  const filteredCompanies = useMemo(() => {
    const search = normalizeText(filters.search);
    return companies.filter((company) => {
      const matchesSearch = !search || [
        company.name,
        company.cif,
        company.ccc,
        company.city,
        company.province,
        company.main_collective_agreement,
        company.professional_contingencies_mutual,
        company.common_it_mutual,
      ].some((value) => normalizeText(value).includes(search));

      return matchesSearch
        && (!filters.status || company.status === filters.status)
        && (!filters.company_type || company.company_type === filters.company_type)
        && (!filters.province || company.province === filters.province);
    });
  }, [companies, filters]);

  const sortedCompanies = useMemo(() => sortRows(filteredCompanies, sortConfig, {
    id: (company) => company.id,
    name: (company) => company.name,
    cif: (company) => company.cif,
    ccc: (company) => company.ccc,
    status: (company) => company.status,
    company_type: (company) => company.company_type,
    province: (company) => company.province,
  }), [filteredCompanies, sortConfig]);

  if (loading) return <p>Cargando...</p>;

  const handleEditChange = (event) => {
    const { name, value, checked, type } = event.target;
    setEditForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

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

  const openDuplicateModal = (company) => {
    setCompanyToDuplicate(company);
    setDuplicateForm({
      name: `${company.name || "Empresa"} copia`,
      cif: "",
      ccc_regime: company.ccc_regime || "0111",
      ccc_code: "",
    });
    setDuplicateError("");
  };

  const handleDuplicateSubmit = async (event) => {
    event.preventDefault();
    setDuplicateError("");
    if (!duplicateForm.name || !duplicateForm.cif) {
      setDuplicateError("Indica nombre y CIF para duplicar la empresa.");
      return;
    }
    try {
      await createCompany(buildDuplicatePayload(companyToDuplicate, duplicateForm));
      setCompanyToDuplicate(null);
      window.location.reload();
    } catch (err) {
      setDuplicateError(err.message || "Error al duplicar empresa");
    }
  };

  const input = (name, label, props = {}) => (
    <label style={props.wide ? styles.formGroupWide : styles.formGroup}>
      <span>{label}</span>
      <input name={name} value={editForm?.[name] || ""} onChange={handleEditChange} style={styles.input} {...props} />
    </label>
  );

  const sortHeader = (key, label) => (
    <th style={styles.th}>
      <button type="button" onClick={() => setSortConfig((current) => nextSortConfig(current, key))} style={styles.sortButton}>
        <span>{label}</span><span style={styles.sortIcon}>{getSortLabel(sortConfig, key)}</span>
      </button>
    </th>
  );

  return (
    <>
      <div style={styles.filterPanel}>
        <div style={styles.filterHeader}>
          <strong>Filtros</strong>
          <span style={styles.counter}>Mostrando {sortedCompanies.length} de {companies.length} empresas</span>
        </div>
        <div style={styles.filterGrid}>
          <label style={styles.filterGroup}>Buscar<input name="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Empresa, CIF, CCC, convenio, mutua..." style={styles.input} /></label>
          <label style={styles.filterGroup}>Estado<select name="status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} style={styles.input}><option value="">Todos</option><option value="alta">Alta</option><option value="baja_temporal">Baja temporal</option><option value="baja_definitiva">Baja definitiva</option></select></label>
          <label style={styles.filterGroup}>Tipo<select name="company_type" value={filters.company_type} onChange={(event) => setFilters((current) => ({ ...current, company_type: event.target.value }))} style={styles.input}><option value="">Todos</option>{filterOptions.types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label style={styles.filterGroup}>Provincia<select name="province" value={filters.province} onChange={(event) => setFilters((current) => ({ ...current, province: event.target.value }))} style={styles.input}><option value="">Todas</option>{filterOptions.provinces.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
        </div>
        <button type="button" onClick={() => setFilters(initialFilters)} style={styles.clearFiltersButton}>Limpiar filtros</button>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead><tr>{sortHeader("id", "ID")}{sortHeader("name", "Nombre")}{sortHeader("cif", "CIF")}{sortHeader("status", "Estado")}{sortHeader("company_type", "Tipo")}{sortHeader("ccc", "CCC")}<th style={styles.th}>Convenio</th><th style={styles.th}>Mutua</th><th style={styles.th}>Acciones</th></tr></thead>
          <tbody>
            {sortedCompanies.map((company) => (
              <tr key={company.id}>
                <td style={styles.td}>{company.id}</td>
                <td style={styles.td}>{company.name}</td>
                <td style={styles.td}>{company.cif}</td>
                <td style={styles.td}>{formatStatus(company.status)}</td>
                <td style={styles.td}>{company.company_type || "-"}</td>
                <td style={styles.td}>{company.ccc || "-"}</td>
                <td style={styles.td}>{company.main_collective_agreement || "-"}</td>
                <td style={styles.td}>{company.professional_contingencies_mutual || company.common_it_mutual || "-"}</td>
                <td style={styles.td}>
                  <div style={styles.actionGroup}>
                    <button type="button" onClick={() => openEditModal(company)} style={styles.editButton}>Editar</button>
                    <button type="button" onClick={() => onOpenPreferences?.(company)} style={styles.preferencesButton}>Preferencias</button>
                    <button type="button" onClick={() => openDuplicateModal(company)} style={styles.duplicateButton}>Duplicar</button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedCompanies.length === 0 && <tr><td colSpan="9" style={styles.emptyCell}>No hay empresas que coincidan con los filtros.</td></tr>}
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
              <section style={styles.block}>
                <h4 style={styles.blockTitle}>Identificación y estado</h4>
                <div style={styles.formRow}>{input("name", "Nombre", { required: true })}{input("cif", "CIF", { required: true })}<label style={styles.formGroup}><span>Estado</span><select name="status" value={editForm.status} onChange={handleEditChange} style={styles.input}><option value="alta">Alta</option><option value="baja_temporal">Baja temporal</option><option value="baja_definitiva">Baja definitiva</option></select></label></div>
                <div style={styles.formRow}>{input("registration_date", "Fecha de alta", { type: "date" })}{input("deregistration_date", "Fecha de baja", { type: "date" })}{input("main_collective_agreement", "Convenio principal")}</div>
                <div style={styles.formRow}>{input("ccc_regime", "CCC régimen")}{input("ccc_code", "CCC código")}<label style={styles.formGroup}><span>Tipo de empresa</span><select name="company_type" value={editForm.company_type} onChange={handleEditChange} style={styles.input}><option value="privada">Privada</option><option value="publica">Pública</option><option value="privada_sin_lucro">Privada sin lucro</option><option value="corporaciones">Corporaciones</option><option value="ett">ETT</option><option value="sociedad_laboral_privada">Sociedad laboral privada</option></select></label></div>
                <div style={styles.checkboxRow}><label><input type="checkbox" name="is_cooperative" checked={editForm.is_cooperative} onChange={handleEditChange} /> Sociedad cooperativa</label><label><input type="checkbox" name="special_work_income_withholding" checked={editForm.special_work_income_withholding} onChange={handleEditChange} /> Cálculo especial de retenciones</label><label><input type="checkbox" name="is_active" checked={editForm.is_active} onChange={handleEditChange} /> Activa</label></div>
              </section>

              <section style={styles.block}>
                <h4 style={styles.blockTitle}>Domicilio social y contacto</h4>
                <div style={styles.formRow}>{input("address", "Domicilio social", { wide: true })}</div>
                <div style={styles.formRow}>{input("city", "Localidad")}{input("province", "Provincia")}{input("company_phone", "Teléfono")}</div>
                <div style={styles.formRow}>{input("company_email", "Correo electrónico", { type: "email" })}{input("company_website", "Sitio web")}{input("company_contact_person", "Persona de contacto")}</div>
              </section>

              <section style={styles.block}>
                <h4 style={styles.blockTitle}>Representante legal y CNAE</h4>
                <div style={styles.formRow}>{input("legal_representative_name", "Nombre y apellidos")}{input("legal_representative_dni", "DNI")}{input("legal_representative_position", "Puesto")}</div>
                <div style={styles.formRow}>{input("cnae_2009_code", "CNAE 2009 código")}{input("cnae_2009_name", "CNAE 2009 denominación")}</div>
                <div style={styles.formRow}>{input("cnae_2025_code", "CNAE 2025 código")}{input("cnae_2025_name", "CNAE 2025 denominación")}</div>
              </section>

              <section style={styles.block}>
                <h4 style={styles.blockTitle}>Mutuas y seguros</h4>
                <div style={styles.formRow}><label style={styles.formGroup}><span>Contingencias profesionales</span><MutualSelect name="professional_contingencies_mutual" value={editForm.professional_contingencies_mutual} onChange={handleEditChange} /></label>{input("professional_contingencies_policy", "Nº póliza CP")}{input("professional_contingencies_effective_date", "Fecha efecto CP", { type: "date" })}</div>
                <div style={styles.formRow}><label style={styles.formGroup}><span>Incapacidad temporal</span><MutualSelect name="common_it_mutual" value={editForm.common_it_mutual} onChange={handleEditChange} /></label>{input("common_it_policy", "Nº póliza IT")}{input("common_it_effective_date", "Fecha efecto IT", { type: "date" })}</div>
                <label style={styles.inlineCheck}><input type="checkbox" name="collective_insurance_enabled" checked={editForm.collective_insurance_enabled} onChange={handleEditChange} /> Seguro colectivo de convenio</label>
                {editForm.collective_insurance_enabled && <div style={styles.formRow}>{input("collective_insurance_company", "Compañía aseguradora")}{input("collective_insurance_policy", "Nº póliza")}{input("collective_insurance_capital", "Capital asegurado")}</div>}
              </section>

              <section style={styles.block}>
                <div style={styles.headerRow}><h4 style={styles.blockTitle}>Plan de pensiones</h4><label style={styles.inlineCheck}><input type="checkbox" name="pension_plan_enabled" checked={editForm.pension_plan_enabled} onChange={handleEditChange} /> Activado</label></div>
                {editForm.pension_plan_enabled && <div style={styles.formRow}>{input("pension_manager_key", "Clave entidad gestora")}{input("pension_manager_entity_number", "Número entidad gestora")}{input("pension_plan_name", "Denominación del plan")}</div>}
              </section>

              <section style={styles.block}>
                <h4 style={styles.blockTitle}>Calendario y datos financieros</h4>
                <div style={styles.formRow}><label style={styles.formGroup}><span>Calendario de trabajo</span><select name="work_calendar_mode" value={editForm.work_calendar_mode} onChange={handleEditChange} style={styles.input}><option value="new">Crear o usar calendario propio</option><option value="existing">Elegir calendario existente</option></select></label>{input("work_calendar_name", "Nombre del calendario")}</div>
                <div style={styles.formRow}>{input("bank_iban", "IBAN")}<label style={styles.formGroup}><span>Régimen fiscal</span><select name="fiscal_regime" value={editForm.fiscal_regime} onChange={handleEditChange} style={styles.input}><option value="estimacion_directa">Estimación directa</option><option value="modulos">Módulos</option><option value="plan_general_contable">Plan general contable</option></select></label></div>
                <p style={styles.preferenceNotice}>SILTRA, retenciones, cálculo de nóminas, impresión e imagen corporativa se gestionan desde Preferencias.</p>
              </section>

              {editError && <div style={styles.error}>{editError}</div>}
              <div style={styles.modalActionsSplit}><button type="button" onClick={() => setCompanyToDelete(editingCompany)} style={styles.deleteButton}>Eliminar empresa</button><div style={styles.modalActionsRight}><button type="button" onClick={closeEditModal} style={styles.cancelButton}>Cancelar</button><button type="submit" disabled={submitting} style={styles.saveButton}>{submitting ? "Guardando..." : "Guardar cambios"}</button></div></div>
            </form>
          </div>
        </div>
      )}

      {companyToDuplicate && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}><div><h3 style={styles.modalTitle}>Duplicar empresa</h3><p style={styles.modalSubtitle}>Origen: {companyToDuplicate.name}</p></div><button type="button" onClick={() => setCompanyToDuplicate(null)} style={styles.closeButton}>×</button></div>
            <form onSubmit={handleDuplicateSubmit} style={styles.form}>
              <div style={styles.formRow}><label style={styles.formGroup}><span>Nuevo nombre</span><input name="name" value={duplicateForm.name} onChange={(event) => setDuplicateForm((current) => ({ ...current, name: event.target.value }))} required style={styles.input} /></label><label style={styles.formGroup}><span>Nuevo CIF</span><input name="cif" value={duplicateForm.cif} onChange={(event) => setDuplicateForm((current) => ({ ...current, cif: event.target.value }))} required style={styles.input} /></label></div>
              <div style={styles.formRow}><label style={styles.formGroup}><span>CCC régimen</span><input name="ccc_regime" value={duplicateForm.ccc_regime} onChange={(event) => setDuplicateForm((current) => ({ ...current, ccc_regime: event.target.value }))} style={styles.input} /></label><label style={styles.formGroup}><span>CCC código</span><input name="ccc_code" value={duplicateForm.ccc_code} onChange={(event) => setDuplicateForm((current) => ({ ...current, ccc_code: event.target.value }))} style={styles.input} /></label></div>
              {duplicateError && <div style={styles.error}>{duplicateError}</div>}
              <div style={styles.modalActions}><button type="button" onClick={() => setCompanyToDuplicate(null)} style={styles.cancelButton}>Cancelar</button><button type="submit" style={styles.saveButton}>Crear duplicado</button></div>
            </form>
          </div>
        </div>
      )}

      {companyToDelete && (
        <div style={styles.modalBackdrop}>
          <div style={styles.confirmModal}>
            <div style={styles.modalHeader}><div><h3 style={styles.modalTitle}>Eliminar empresa</h3><p style={styles.modalSubtitle}>Esta acción desactivará la empresa.</p></div><button type="button" onClick={() => setCompanyToDelete(null)} style={styles.closeButton}>×</button></div>
            <p style={styles.confirmText}>¿Seguro que quieres eliminar o desactivar {companyToDelete.name}?</p>
            {deleteError && <div style={styles.error}>{deleteError}</div>}
            <div style={styles.modalActions}><button type="button" onClick={() => setCompanyToDelete(null)} style={styles.cancelButton}>Cancelar</button><button type="button" onClick={handleConfirmDelete} disabled={submitting} style={styles.dangerButton}>{submitting ? "Eliminando..." : "Confirmar eliminación"}</button></div>
          </div>
        </div>
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
  actionGroup: { display: "flex", gap: "7px" },
  editButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontWeight: 800 },
  preferencesButton: { backgroundColor: "#facc15", color: "#111827", border: "1px solid #eab308", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontWeight: 900 },
  duplicateButton: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "7px 10px", cursor: "pointer", fontWeight: 800 },
  deleteButton: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "24px" },
  modal: { width: "min(1080px, 100%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "12px", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "22px" },
  confirmModal: { width: "min(620px, 100%)", backgroundColor: "#ffffff", border: "1px solid #d1d5db", borderRadius: "12px", boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)", padding: "22px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", marginBottom: "18px", borderBottom: "1px solid #e5e7eb", paddingBottom: "14px" },
  modalTitle: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  modalSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  closeButton: { border: "none", backgroundColor: "transparent", fontSize: "28px", lineHeight: 1, cursor: "pointer", color: "#111827" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  block: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "12px", backgroundColor: "#ffffff" },
  blockTitle: { margin: 0, fontSize: "14px", fontWeight: 900, color: "#111827" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  formRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  checkboxRow: { display: "flex", gap: "18px", flexWrap: "wrap", fontWeight: 800, color: "#111827" },
  inlineCheck: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#111827" },
  formGroup: { flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700, color: "#374151" },
  formGroupWide: { flex: 1, minWidth: "100%", display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700, color: "#374151" },
  input: { padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", backgroundColor: "#fff", boxSizing: "border-box" },
  preferenceNotice: { margin: 0, padding: "10px 12px", borderRadius: "8px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontWeight: 700, fontSize: "13px" },
  confirmText: { margin: "0 0 16px", color: "#374151", lineHeight: 1.5 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" },
  modalActionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" },
  modalActionsRight: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  saveButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  dangerButton: { backgroundColor: "#991b1b", color: "#ffffff", border: "1px solid #991b1b", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
};
