import { useMemo, useState } from "react";

import { createCompany } from "../../services/companyApi";
import { getSortLabel, nextSortConfig, sortRows } from "../../utils/tableSorting";
import "./companyWorkspace.css";

const EMPTY_FILTERS = { search: "", status: "", company_type: "", province: "" };

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatStatus(status) {
  if (status === "baja_temporal") return "Baja temporal";
  if (status === "baja_definitiva") return "Baja definitiva";
  return "Alta";
}

function statusClass(status) {
  if (status === "baja_temporal") return "company-status company-status-warning";
  if (status === "baja_definitiva") return "company-status company-status-inactive";
  return "company-status company-status-active";
}

function buildDuplicatePayload(source, form) {
  const payload = { ...source };
  delete payload.id;
  delete payload.created_at;
  payload.name = form.name;
  payload.cif = form.cif;
  payload.ccc_regime = form.ccc_regime || null;
  payload.ccc_code = form.ccc_code || null;
  payload.ccc = [form.ccc_regime, form.ccc_code].filter(Boolean).join("/") || null;
  payload.status = "alta";
  payload.is_active = true;
  payload.deregistration_date = null;
  return payload;
}

export default function CompanyDirectory({ companies, workCenters, loading, onOpenCompany, onDeleteCompany, onCreated }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [duplicateCompany, setDuplicateCompany] = useState(null);
  const [deleteCompany, setDeleteCompany] = useState(null);
  const [duplicateForm, setDuplicateForm] = useState({ name: "", cif: "", ccc_regime: "0111", ccc_code: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const options = useMemo(() => ({
    types: [...new Set(companies.map((company) => company.company_type).filter(Boolean))].sort(),
    provinces: [...new Set(companies.map((company) => company.province).filter(Boolean))].sort(),
  }), [companies]);

  const centerCounts = useMemo(() => {
    const counts = {};
    workCenters.forEach((center) => {
      if (center.is_active === false) return;
      counts[String(center.company_id)] = (counts[String(center.company_id)] || 0) + 1;
    });
    return counts;
  }, [workCenters]);

  const filtered = useMemo(() => {
    const search = normalizeText(filters.search);
    const rows = companies.filter((company) => {
      const matchesSearch = !search || [company.name, company.cif, company.ccc, company.city, company.province, company.main_collective_agreement]
        .some((value) => normalizeText(value).includes(search));
      return matchesSearch
        && (!filters.status || company.status === filters.status)
        && (!filters.company_type || company.company_type === filters.company_type)
        && (!filters.province || company.province === filters.province);
    });
    return sortRows(rows, sortConfig, {
      name: (company) => company.name,
      cif: (company) => company.cif,
      status: (company) => company.status,
      company_type: (company) => company.company_type,
      ccc: (company) => company.ccc,
      agreement: (company) => company.main_collective_agreement,
      centers: (company) => centerCounts[String(company.id)] || 0,
    });
  }, [companies, filters, sortConfig, centerCounts]);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  const sortHeader = (key, label) => (
    <th>
      <button type="button" className="company-sort" onClick={() => setSortConfig((current) => nextSortConfig(current, key))}>
        <span>{label}</span><span>{getSortLabel(sortConfig, key)}</span>
      </button>
    </th>
  );

  const openDuplicate = (company) => {
    setOpenMenuId(null);
    setDuplicateCompany(company);
    setDuplicateForm({
      name: `${company.name || "Empresa"} copia`,
      cif: "",
      ccc_regime: company.ccc_regime || "0111",
      ccc_code: "",
    });
    setError("");
  };

  const submitDuplicate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createCompany(buildDuplicatePayload(duplicateCompany, duplicateForm));
      setDuplicateCompany(null);
      onCreated?.();
    } catch (err) {
      setError(err.message || "No se pudo duplicar la empresa");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    setSubmitting(true);
    setError("");
    try {
      await onDeleteCompany(deleteCompany.id);
      setDeleteCompany(null);
    } catch (err) {
      setError(err.message || "No se pudo eliminar la empresa");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="company-empty-state">Cargando empresas...</div>;

  return (
    <>
      <div className="company-filter-bar">
        <div className="company-search-field">
          <span aria-hidden="true">⌕</span>
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Buscar por empresa, CIF, CCC o convenio" />
        </div>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">Estado: todos</option>
          <option value="alta">Alta</option>
          <option value="baja_temporal">Baja temporal</option>
          <option value="baja_definitiva">Baja definitiva</option>
        </select>
        <select value={filters.company_type} onChange={(event) => setFilters((current) => ({ ...current, company_type: event.target.value }))}>
          <option value="">Tipo: todos</option>
          {options.types.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select value={filters.province} onChange={(event) => setFilters((current) => ({ ...current, province: event.target.value }))}>
          <option value="">Provincia: todas</option>
          {options.provinces.map((province) => <option key={province} value={province}>{province}</option>)}
        </select>
        {activeFilters > 0 && <button type="button" className="company-button-ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar ({activeFilters})</button>}
      </div>

      <div className="company-results-heading">
        <strong>Empresas registradas</strong>
        <span>{filtered.length} de {companies.length} resultados</span>
      </div>

      <div className="company-table-wrap">
        <table className="company-directory-table">
          <thead><tr>{sortHeader("name", "Empresa")}{sortHeader("status", "Estado")}{sortHeader("company_type", "Tipo")}{sortHeader("ccc", "CCC principal")}{sortHeader("agreement", "Convenio")}{sortHeader("centers", "Centros")}<th>Acciones</th></tr></thead>
          <tbody>
            {filtered.map((company) => (
              <tr key={company.id}>
                <td>
                  <button type="button" className="company-name-link" onClick={() => onOpenCompany(company)}>{company.name}</button>
                  <small>CIF {company.cif || "sin informar"} · Código EMP-{String(company.id).padStart(4, "0")}</small>
                </td>
                <td><span className={statusClass(company.status)}>{formatStatus(company.status)}</span></td>
                <td>{company.company_type || "Sin definir"}</td>
                <td>{company.ccc || "Sin informar"}</td>
                <td>{company.main_collective_agreement || "Sin asignar"}</td>
                <td>{centerCounts[String(company.id)] || 0}</td>
                <td>
                  <div className="company-row-actions">
                    <button type="button" className="company-button-open" onClick={() => onOpenCompany(company)}>Abrir</button>
                    <div className="company-menu-container">
                      <button type="button" className="company-menu-trigger" aria-label={`Más acciones para ${company.name}`} onClick={() => setOpenMenuId((current) => current === company.id ? null : company.id)}>⋮</button>
                      {openMenuId === company.id && (
                        <div className="company-menu">
                          <button type="button" onClick={() => onOpenCompany(company)}>Editar datos generales</button>
                          <button type="button" onClick={() => openDuplicate(company)}>Duplicar empresa</button>
                          <button type="button" className="company-menu-danger" onClick={() => { setOpenMenuId(null); setDeleteCompany(company); setError(""); }}>Eliminar empresa</button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan="7" className="company-empty-cell">No hay empresas que coincidan con los filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {duplicateCompany && (
        <div className="company-modal-backdrop">
          <div className="company-confirm-modal">
            <div className="company-modal-header"><div><h3>Duplicar empresa</h3><p>Origen: {duplicateCompany.name}</p></div><button type="button" onClick={() => setDuplicateCompany(null)}>×</button></div>
            <form onSubmit={submitDuplicate} className="company-modal-form">
              <label>Nuevo nombre<input value={duplicateForm.name} onChange={(event) => setDuplicateForm((current) => ({ ...current, name: event.target.value }))} required /></label>
              <label>Nuevo CIF<input value={duplicateForm.cif} onChange={(event) => setDuplicateForm((current) => ({ ...current, cif: event.target.value }))} required /></label>
              <label>CCC régimen<input value={duplicateForm.ccc_regime} onChange={(event) => setDuplicateForm((current) => ({ ...current, ccc_regime: event.target.value }))} /></label>
              <label>CCC código<input value={duplicateForm.ccc_code} onChange={(event) => setDuplicateForm((current) => ({ ...current, ccc_code: event.target.value }))} /></label>
              {error && <div className="company-form-error">{error}</div>}
              <div className="company-modal-actions"><button type="button" className="company-button-ghost" onClick={() => setDuplicateCompany(null)}>Cancelar</button><button type="submit" className="company-button-primary" disabled={submitting}>{submitting ? "Creando..." : "Crear duplicado"}</button></div>
            </form>
          </div>
        </div>
      )}

      {deleteCompany && (
        <div className="company-modal-backdrop">
          <div className="company-confirm-modal">
            <div className="company-modal-header"><div><h3>Eliminar empresa</h3><p>{deleteCompany.name}</p></div><button type="button" onClick={() => setDeleteCompany(null)}>×</button></div>
            <p>Se eliminarán también las relaciones bancarias vinculadas. Esta acción requiere confirmación.</p>
            {error && <div className="company-form-error">{error}</div>}
            <div className="company-modal-actions"><button type="button" className="company-button-ghost" onClick={() => setDeleteCompany(null)}>Cancelar</button><button type="button" className="company-button-danger" onClick={confirmDelete} disabled={submitting}>{submitting ? "Eliminando..." : "Confirmar eliminación"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
