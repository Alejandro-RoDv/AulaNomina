import { useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";

import {
  Badge,
  Button,
  DataTable,
  DataTableFilter,
  DataTableSearch,
  DataTableSummary,
  DataTableToolbar,
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableIconButton,
  TablePrimaryCell,
  TableRow,
} from "../ui";
import { createCompany } from "../../services/companyApi";
import { nextSortConfig, sortRows } from "../../utils/tableSorting";
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

function statusTone(status) {
  if (status === "baja_temporal") return "warning";
  if (status === "baja_definitiva") return "neutral";
  return "success";
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
      const matchesSearch = !search || [
        company.name,
        company.cif,
        company.ccc,
        company.city,
        company.province,
        company.main_collective_agreement,
      ].some((value) => normalizeText(value).includes(search));

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

  const sortDirection = (key) => sortConfig.key === key ? sortConfig.direction : null;
  const sortBy = (key) => setSortConfig((current) => nextSortConfig(current, key));

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

  return (
    <>
      <DataTable>
        <DataTableToolbar
          actions={activeFilters > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              Limpiar filtros ({activeFilters})
            </Button>
          ) : null}
        >
          <DataTableSearch
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Buscar por empresa, CIF, CCC o convenio"
          />
          <DataTableFilter
            label="Filtrar por estado"
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="">Todos los estados</option>
            <option value="alta">Alta</option>
            <option value="baja_temporal">Baja temporal</option>
            <option value="baja_definitiva">Baja definitiva</option>
          </DataTableFilter>
          <DataTableFilter
            label="Filtrar por tipo de empresa"
            value={filters.company_type}
            onChange={(event) => setFilters((current) => ({ ...current, company_type: event.target.value }))}
          >
            <option value="">Todos los tipos</option>
            {options.types.map((type) => <option key={type} value={type}>{type}</option>)}
          </DataTableFilter>
          <DataTableFilter
            label="Filtrar por provincia"
            value={filters.province}
            onChange={(event) => setFilters((current) => ({ ...current, province: event.target.value }))}
          >
            <option value="">Todas las provincias</option>
            {options.provinces.map((province) => <option key={province} value={province}>{province}</option>)}
          </DataTableFilter>
        </DataTableToolbar>

        <DataTableSummary
          label="Empresas registradas"
          count={filtered.length}
          total={companies.length}
        />

        <Table aria-label="Empresas registradas" minWidth="66rem">
          <TableHead>
            <TableRow>
              <TableHeaderCell
                sortable
                direction={sortDirection("name")}
                onSort={() => sortBy("name")}
                style={{ width: "24%" }}
              >
                Empresa
              </TableHeaderCell>
              <TableHeaderCell
                sortable
                direction={sortDirection("status")}
                onSort={() => sortBy("status")}
                style={{ width: "11%" }}
              >
                Estado
              </TableHeaderCell>
              <TableHeaderCell
                sortable
                direction={sortDirection("company_type")}
                onSort={() => sortBy("company_type")}
                style={{ width: "12%" }}
              >
                Tipo
              </TableHeaderCell>
              <TableHeaderCell
                sortable
                direction={sortDirection("ccc")}
                onSort={() => sortBy("ccc")}
                style={{ width: "15%" }}
              >
                CCC principal
              </TableHeaderCell>
              <TableHeaderCell
                sortable
                direction={sortDirection("agreement")}
                onSort={() => sortBy("agreement")}
                style={{ width: "21%" }}
              >
                Convenio
              </TableHeaderCell>
              <TableHeaderCell
                sortable
                direction={sortDirection("centers")}
                onSort={() => sortBy("centers")}
                align="center"
                style={{ width: "7%" }}
              >
                Centros
              </TableHeaderCell>
              <TableHeaderCell align="right" style={{ width: "10%" }}>Acciones</TableHeaderCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading && (
              <TableEmpty
                colSpan={7}
                title="Cargando empresas"
                description="Los datos aparecerán en cuanto finalice la consulta."
              />
            )}

            {!loading && filtered.map((company) => (
              <TableRow key={company.id} interactive>
                <TableCell label="Empresa">
                  <TablePrimaryCell
                    title={company.name}
                    meta={`CIF ${company.cif || "sin informar"} · Código EMP-${String(company.id).padStart(4, "0")}`}
                    onClick={() => onOpenCompany(company)}
                  />
                </TableCell>
                <TableCell label="Estado">
                  <Badge tone={statusTone(company.status)} dot>{formatStatus(company.status)}</Badge>
                </TableCell>
                <TableCell label="Tipo">{company.company_type || "Sin definir"}</TableCell>
                <TableCell label="CCC principal">{company.ccc || "Sin informar"}</TableCell>
                <TableCell label="Convenio">{company.main_collective_agreement || "Sin asignar"}</TableCell>
                <TableCell label="Centros" align="center">{centerCounts[String(company.id)] || 0}</TableCell>
                <TableCell label="Acciones" align="right">
                  <TableActions>
                    <Button variant="secondary" size="sm" onClick={() => onOpenCompany(company)}>
                      Abrir
                    </Button>
                    <div className="company-menu-container">
                      <TableIconButton
                        label={`Más acciones para ${company.name}`}
                        aria-expanded={openMenuId === company.id}
                        onClick={() => setOpenMenuId((current) => current === company.id ? null : company.id)}
                      >
                        <MoreVertical aria-hidden="true" />
                      </TableIconButton>
                      {openMenuId === company.id && (
                        <div className="company-menu">
                          <button type="button" onClick={() => onOpenCompany(company)}>Editar datos generales</button>
                          <button type="button" onClick={() => openDuplicate(company)}>Duplicar empresa</button>
                          <button
                            type="button"
                            className="company-menu-danger"
                            onClick={() => {
                              setOpenMenuId(null);
                              setDeleteCompany(company);
                              setError("");
                            }}
                          >
                            Eliminar empresa
                          </button>
                        </div>
                      )}
                    </div>
                  </TableActions>
                </TableCell>
              </TableRow>
            ))}

            {!loading && !filtered.length && (
              <TableEmpty
                colSpan={7}
                title="No hay empresas coincidentes"
                description="Modifica la búsqueda o elimina alguno de los filtros aplicados."
              />
            )}
          </TableBody>
        </Table>
      </DataTable>

      {duplicateCompany && (
        <div className="company-modal-backdrop">
          <div className="company-confirm-modal">
            <div className="company-modal-header">
              <div><h3>Duplicar empresa</h3><p>Origen: {duplicateCompany.name}</p></div>
              <button type="button" onClick={() => setDuplicateCompany(null)}>×</button>
            </div>
            <form onSubmit={submitDuplicate} className="company-modal-form">
              <label>Nuevo nombre<input value={duplicateForm.name} onChange={(event) => setDuplicateForm((current) => ({ ...current, name: event.target.value }))} required /></label>
              <label>Nuevo CIF<input value={duplicateForm.cif} onChange={(event) => setDuplicateForm((current) => ({ ...current, cif: event.target.value }))} required /></label>
              <label>CCC régimen<input value={duplicateForm.ccc_regime} onChange={(event) => setDuplicateForm((current) => ({ ...current, ccc_regime: event.target.value }))} /></label>
              <label>CCC código<input value={duplicateForm.ccc_code} onChange={(event) => setDuplicateForm((current) => ({ ...current, ccc_code: event.target.value }))} /></label>
              {error && <div className="company-form-error">{error}</div>}
              <div className="company-modal-actions">
                <button type="button" className="company-button-ghost" onClick={() => setDuplicateCompany(null)}>Cancelar</button>
                <button type="submit" className="company-button-primary" disabled={submitting}>{submitting ? "Creando..." : "Crear duplicado"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteCompany && (
        <div className="company-modal-backdrop">
          <div className="company-confirm-modal">
            <div className="company-modal-header">
              <div><h3>Eliminar empresa</h3><p>{deleteCompany.name}</p></div>
              <button type="button" onClick={() => setDeleteCompany(null)}>×</button>
            </div>
            <p>Se eliminarán también las relaciones bancarias vinculadas. Esta acción requiere confirmación.</p>
            {error && <div className="company-form-error">{error}</div>}
            <div className="company-modal-actions">
              <button type="button" className="company-button-ghost" onClick={() => setDeleteCompany(null)}>Cancelar</button>
              <button type="button" className="company-button-danger" onClick={confirmDelete} disabled={submitting}>{submitting ? "Eliminando..." : "Confirmar eliminación"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
