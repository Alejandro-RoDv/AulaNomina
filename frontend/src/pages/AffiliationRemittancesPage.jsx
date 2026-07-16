import { useCallback, useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import { fetchCollectiveAgreements } from "../services/collectiveAgreementApi.js";
import { fetchCompanies } from "../services/companyApi.js";
import { fetchAllEmployees } from "../services/employeeApi.js";
import {
  addAffiliationMovements,
  createAffiliationDraft,
  fetchAffiliationCandidates,
  fetchAffiliationDraft,
  fetchAffiliationDrafts,
  generateAffiliationDraft,
  removeAffiliationMovement,
} from "../services/affiliationApi.js";
import "../components/affiliation/affiliationRemittance.css";
import "./affiliationRemittancesPage.css";

const SELECTED_DRAFT_KEY = "aulanomina:affiliationDraftId";
const SILTRA_AFFILIATION_EVENT = "aulanomina-open-siltra-affiliation";
const SENDABLE_STATUSES = new Set(["GENERATED", "ACCEPTED", "ACCEPTED_WITH_WARNINGS", "REJECTED"]);

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

function defaultFilters() {
  const today = new Date();
  return {
    date_from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    date_to: isoDate(today),
    movement_type: "",
    company_id: "",
    collective_agreement_id: "",
    employee_id: "",
  };
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(status) {
  return {
    DRAFT: "Borrador",
    VALIDATING: "Validando",
    VALIDATION_ERROR: "Error de validación",
    READY: "Preparado",
    GENERATED: "Generado",
    SENT: "Enviado",
    PROCESSING: "Procesando",
    ACCEPTED: "Aceptado",
    ACCEPTED_WITH_WARNINGS: "Aceptado con avisos",
    REJECTED: "Rechazado",
    CANCELLED: "Cancelado",
  }[status] || status || "-";
}

function movementLabel(type) {
  return { ALTA: "Alta", MODIFICACION: "Modificación", BAJA: "Baja" }[type] || type;
}

function StatusPill({ status }) {
  const tone = status === "ACCEPTED"
    ? "ok"
    : status === "REJECTED" || status === "VALIDATION_ERROR"
      ? "error"
      : status === "SENT" || status === "PROCESSING"
        ? "pending"
        : "neutral";
  return <span className={`afi-status afi-status--${tone}`}>{statusLabel(status)}</span>;
}

function MessagePanel({ error, notice }) {
  if (error) return <div className="afi-message afi-message--error">{error}</div>;
  if (notice) return <div className="afi-message afi-message--info">{notice}</div>;
  return null;
}

function CandidateTable({ items, selectedKeys, onToggle, loading }) {
  return (
    <div className="afi-table-wrap afi-page-table-wrap">
      <table className="afi-table">
        <thead>
          <tr>
            <th />
            <th>Movimiento</th>
            <th>Fecha</th>
            <th>Trabajador</th>
            <th>Empresa</th>
            <th>CCC</th>
            <th>Estado SILTRA</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan="7" className="afi-empty">Buscando movimientos...</td></tr>}
          {!loading && items.length === 0 && <tr><td colSpan="7" className="afi-empty">No hay movimientos para los filtros seleccionados.</td></tr>}
          {!loading && items.map((item) => (
            <tr key={item.movement_key}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedKeys.has(item.movement_key)}
                  onChange={() => onToggle(item.movement_key)}
                  aria-label={`Seleccionar ${movementLabel(item.movement_type)} de ${item.employee_name}`}
                />
              </td>
              <td><span className={`afi-movement afi-movement--${item.movement_type.toLowerCase()}`}>{movementLabel(item.movement_type)}</span></td>
              <td>{formatDate(item.effective_date)}</td>
              <td><strong>{item.employee_name}</strong><small>{item.dni || "Sin DNI"} · NAF {item.naf || "pendiente"}</small></td>
              <td><strong>{item.company_name}</strong><small>{item.collective_agreement_name || "Sin convenio asociado"}</small></td>
              <td>{item.ccc || "Pendiente"}</td>
              <td>{item.current_external_status === "ACTIVE" ? "De alta" : "No consta de alta"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DraftMovements({ draft, onRemove, busy }) {
  if (!draft) return <div className="afi-empty afi-empty--panel">Seleccione un borrador o cree uno con los movimientos marcados.</div>;
  return (
    <div className="afi-table-wrap afi-page-table-wrap">
      <table className="afi-table">
        <thead><tr><th>Tipo</th><th>Fecha</th><th>Trabajador</th><th>Empresa / CCC</th><th /></tr></thead>
        <tbody>
          {(draft.movements || []).length === 0 && <tr><td colSpan="5" className="afi-empty">El borrador está vacío.</td></tr>}
          {(draft.movements || []).map((item) => (
            <tr key={item.movement_key}>
              <td><span className={`afi-movement afi-movement--${item.movement_type.toLowerCase()}`}>{movementLabel(item.movement_type)}</span></td>
              <td>{formatDate(item.effective_date)}</td>
              <td><strong>{item.employee_name}</strong><small>{item.dni || "Sin DNI"} · {item.naf || "Sin NAF"}</small></td>
              <td><strong>{item.company_name}</strong><small>{item.ccc || "Sin CCC"}</small></td>
              <td><button type="button" className="afi-link-button" onClick={() => onRemove(item.movement_key)} disabled={busy || ["SENT", "PROCESSING"].includes(draft.status)}>Retirar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadDraft(draft) {
  if (!draft?.content) return;
  const blob = new Blob([draft.content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = draft.original_filename || `AFI-${draft.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AffiliationRemittancesPage({ initialSection = "movements" }) {
  const [section, setSection] = useState(initialSection);
  const [filters, setFilters] = useState(defaultFilters);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [selectedDraftId, setSelectedDraftId] = useState(() => window.sessionStorage.getItem(SELECTED_DRAFT_KEY) || "");
  const [draft, setDraft] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeEmployees = useMemo(
    () => employees.filter((employee) => !filters.company_id || String(employee.company_id) === String(filters.company_id)),
    [employees, filters.company_id]
  );

  const generatedFiles = useMemo(
    () => drafts.filter((item) => Boolean(item.original_filename && item.content)),
    [drafts]
  );

  const navigateSection = useCallback((target) => {
    const page = target === "files" ? "affiliation-files" : "affiliations";
    window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page } }));
  }, []);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const loadCatalogs = useCallback(async () => {
    try {
      const [companyRows, employeeRows, agreementRows] = await Promise.all([
        fetchCompanies(),
        fetchAllEmployees(),
        fetchCollectiveAgreements(),
      ]);
      setCompanies((companyRows || []).filter((company) => company.is_active !== false));
      setEmployees(employeeRows || []);
      setAgreements((agreementRows || []).filter((agreement) => agreement.is_active !== false));
    } catch (requestError) {
      setError(requestError.message || "No se han podido cargar los filtros");
    }
  }, []);

  const loadDrafts = useCallback(async (preferredId = null) => {
    try {
      const data = await fetchAffiliationDrafts({ limit: 300 });
      const items = data?.items || [];
      setDrafts(items);
      if (preferredId) {
        const found = items.find((item) => Number(item.id) === Number(preferredId));
        if (found?.content) setSelectedFile(found);
      }
    } catch (requestError) {
      setError(requestError.message || "No se han podido cargar los borradores");
    }
  }, []);

  const loadSelectedDraft = useCallback(async (draftId) => {
    if (!draftId) {
      setDraft(null);
      return;
    }
    try {
      const data = await fetchAffiliationDraft(draftId);
      setDraft(data);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir el borrador");
    }
  }, []);

  useEffect(() => {
    loadCatalogs();
    loadDrafts();
  }, [loadCatalogs, loadDrafts]);

  useEffect(() => {
    if (selectedDraftId) loadSelectedDraft(selectedDraftId);
    else setDraft(null);
  }, [loadSelectedDraft, selectedDraftId]);

  const updateFilter = (field, value) => {
    setFilters((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "company_id" ? { employee_id: "" } : {}),
    }));
  };

  const searchCandidates = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchAffiliationCandidates(filters);
      setCandidates(data?.items || []);
      setSelectedKeys(new Set());
    } catch (requestError) {
      setError(requestError.message || "No se han podido localizar movimientos");
    } finally {
      setLoading(false);
    }
  };

  const selectDraft = (draftId) => {
    const value = String(draftId || "");
    setSelectedDraftId(value);
    if (value) window.sessionStorage.setItem(SELECTED_DRAFT_KEY, value);
    else window.sessionStorage.removeItem(SELECTED_DRAFT_KEY);
  };

  const toggleCandidate = (movementKey) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(movementKey)) next.delete(movementKey);
      else next.add(movementKey);
      return next;
    });
  };

  const loadSelectedMovements = async () => {
    const keys = Array.from(selectedKeys);
    if (keys.length === 0) {
      setError("Seleccione al menos un alta, modificación o baja.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = selectedDraftId
        ? await addAffiliationMovements(selectedDraftId, keys)
        : await createAffiliationDraft(keys);
      selectDraft(updated.id);
      setDraft(updated);
      setSelectedKeys(new Set());
      setNotice(`${keys.length} movimiento${keys.length === 1 ? "" : "s"} cargado${keys.length === 1 ? "" : "s"} en el borrador.`);
      await loadDrafts();
    } catch (requestError) {
      setError(requestError.message || "No se han podido cargar los movimientos");
    } finally {
      setBusy(false);
    }
  };

  const removeMovement = async (movementKey) => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const updated = await removeAffiliationMovement(draft.id, movementKey);
      setDraft(updated);
      setNotice("Movimiento retirado del borrador.");
      await loadDrafts();
    } catch (requestError) {
      setError(requestError.message || "No se ha podido retirar el movimiento");
    } finally {
      setBusy(false);
    }
  };

  const generateFile = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const updated = await generateAffiliationDraft(draft.id);
      setDraft(updated);
      setSelectedFile(updated);
      setNotice(`Fichero ${updated.original_filename} generado. Ya está disponible en Ficheros AFI.`);
      await loadDrafts(updated.id);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido generar el fichero AFI");
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (fileId) => {
    setBusy(true);
    setError("");
    try {
      const fullFile = await fetchAffiliationDraft(fileId);
      setSelectedFile(fullFile);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir el fichero AFI");
    } finally {
      setBusy(false);
    }
  };

  const openInSiltra = (file) => {
    if (!file?.id || !SENDABLE_STATUSES.has(file.status) || !file.content) {
      setError("Genere el fichero AFI antes de abrirlo en SILTRA.");
      return;
    }
    window.dispatchEvent(new CustomEvent(SILTRA_AFFILIATION_EVENT, {
      detail: { draftId: file.id },
    }));
  };

  return (
    <div className="afi-page">
      <div className="afi-page-tabs">
        <button type="button" className={section === "movements" ? "is-active" : ""} onClick={() => navigateSection("movements")}>Altas y bajas</button>
        <button type="button" className={section === "files" ? "is-active" : ""} onClick={() => navigateSection("files")}>Ficheros AFI</button>
      </div>

      <MessagePanel error={error} notice={notice} />

      {section === "movements" && (
        <>
          <PageCard title="Localizar movimientos de afiliación" subtitle="Selecciona altas, modificaciones y bajas por fecha, empresa, convenio o trabajador y cárgalas progresivamente en un borrador.">
            <div className="afi-panel afi-page-panel">
              <div className="afi-panel-title"><span>1. Buscar movimientos</span><button type="button" onClick={searchCandidates} disabled={loading || busy}>Buscar</button></div>
              <div className="afi-filters">
                <label><span>Desde</span><input type="date" value={filters.date_from} onChange={(event) => updateFilter("date_from", event.target.value)} /></label>
                <label><span>Hasta</span><input type="date" value={filters.date_to} onChange={(event) => updateFilter("date_to", event.target.value)} /></label>
                <label><span>Movimiento</span><select value={filters.movement_type} onChange={(event) => updateFilter("movement_type", event.target.value)}><option value="">Todos</option><option value="ALTA">Altas</option><option value="MODIFICACION">Modificaciones</option><option value="BAJA">Bajas</option></select></label>
                <label><span>Empresa</span><select value={filters.company_id} onChange={(event) => updateFilter("company_id", event.target.value)}><option value="">Todas las empresas</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
                <label><span>Convenio</span><select value={filters.collective_agreement_id} onChange={(event) => updateFilter("collective_agreement_id", event.target.value)}><option value="">Todos los convenios</option>{agreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name}</option>)}</select></label>
                <label><span>Trabajador</span><select value={filters.employee_id} onChange={(event) => updateFilter("employee_id", event.target.value)}><option value="">Todos los trabajadores</option>{activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} · {employee.dni}</option>)}</select></label>
              </div>
              <CandidateTable items={candidates} selectedKeys={selectedKeys} onToggle={toggleCandidate} loading={loading} />
              <div className="afi-selection-actions">
                <span>{selectedKeys.size} movimiento{selectedKeys.size === 1 ? "" : "s"} seleccionado{selectedKeys.size === 1 ? "" : "s"}</span>
                <button type="button" onClick={loadSelectedMovements} disabled={busy || selectedKeys.size === 0}>{selectedDraftId ? "Añadir al borrador actual" : "Crear borrador con selección"}</button>
              </div>
            </div>
          </PageCard>

          <PageCard title="Preparar fichero AFI" subtitle="Revisa la selección, retira movimientos si es necesario y genera el fichero que posteriormente se presentará desde SILTRA.">
            <div className="afi-panel afi-page-panel">
              <div className="afi-panel-title"><span>2. Borrador de afiliación</span><button type="button" onClick={() => loadDrafts()} disabled={busy}>Actualizar borradores</button></div>
              <div className="afi-draft-toolbar">
                <label><span>Borrador</span><select value={selectedDraftId} onChange={(event) => selectDraft(event.target.value)}><option value="">Nuevo borrador</option>{drafts.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.movement_count} movimientos · {statusLabel(item.status)}</option>)}</select></label>
                {draft && <div className="afi-draft-facts"><StatusPill status={draft.status} /><span>{draft.movement_count} movimientos</span><span>{draft.company_count} empresas</span><span>{draft.ccc_count} CCC</span><span>{formatDate(draft.date_from)} – {formatDate(draft.date_to)}</span></div>}
              </div>
              <DraftMovements draft={draft} onRemove={removeMovement} busy={busy} />
              <div className="afi-file-actions">
                <div><span>Fichero preparado</span><strong>{draft?.original_filename || "Todavía no generado"}</strong></div>
                <button type="button" onClick={generateFile} disabled={busy || !draft || draft.movement_count === 0 || ["SENT", "PROCESSING"].includes(draft.status)}>{busy ? "Procesando..." : "Generar fichero AFI"}</button>
                <button type="button" className="afi-primary-button" onClick={() => navigateSection("files")} disabled={!draft?.content}>Abrir Ficheros AFI</button>
              </div>
            </div>
          </PageCard>
        </>
      )}

      {section === "files" && (
        <>
          <PageCard title="Ficheros AFI generados" subtitle="Repositorio de ficheros de altas, modificaciones y bajas. La transmisión se realiza desde el SILTRA simulado.">
            <div className="afi-files-toolbar">
              <div><strong>{generatedFiles.length}</strong><span>ficheros disponibles</span></div>
              <button type="button" onClick={() => loadDrafts()} disabled={busy}>Actualizar</button>
            </div>
            {generatedFiles.length === 0 ? (
              <div className="afi-empty afi-files-empty">No hay ficheros AFI generados. Prepare un borrador y pulse Generar fichero AFI.</div>
            ) : (
              <div className="afi-table-wrap afi-page-table-wrap">
                <table className="afi-table afi-files-table">
                  <thead><tr><th>Nombre</th><th>Fechas</th><th>Movimientos</th><th>Empresas</th><th>CCC</th><th>Estado</th><th>Última respuesta</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {generatedFiles.map((file) => (
                      <tr key={file.id} className={selectedFile?.id === file.id ? "is-selected" : ""}>
                        <td><strong>{file.original_filename}</strong><small>Generado {formatDateTime(file.generated_at || file.updated_at)}</small></td>
                        <td>{formatDate(file.date_from)} – {formatDate(file.date_to)}</td>
                        <td>{file.movement_count}</td>
                        <td>{file.company_count}</td>
                        <td>{file.ccc_count}</td>
                        <td><StatusPill status={file.status} /></td>
                        <td>{file.response_code ? <><strong>{file.response_code}</strong><small>{file.response_message || statusLabel(file.latest_submission_status)}</small></> : "Sin presentar"}</td>
                        <td>
                          <div className="afi-files-actions">
                            <button type="button" onClick={() => openFile(file.id)}>Ver</button>
                            <button type="button" onClick={() => downloadDraft(file)}>Descargar</button>
                            <button type="button" className="afi-files-upload" onClick={() => openInSiltra(file)} disabled={!SENDABLE_STATUSES.has(file.status)}>Subir a SILTRA</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageCard>

          {selectedFile && (
            <PageCard title={selectedFile.original_filename || `Fichero AFI ${selectedFile.id}`} subtitle={`${selectedFile.movement_count} movimientos · ${selectedFile.company_count} empresas · ${selectedFile.ccc_count} CCC`}>
              <div className="afi-file-detail-header">
                <div><StatusPill status={selectedFile.status} /><span>{formatDate(selectedFile.date_from)} – {formatDate(selectedFile.date_to)}</span></div>
                <div className="afi-files-actions">
                  <button type="button" onClick={() => downloadDraft(selectedFile)}>Descargar</button>
                  <button type="button" className="afi-files-upload" onClick={() => openInSiltra(selectedFile)} disabled={!SENDABLE_STATUSES.has(selectedFile.status)}>Subir a SILTRA</button>
                </div>
              </div>
              <pre className="afi-file-preview">{selectedFile.content || "El fichero no contiene información."}</pre>
            </PageCard>
          )}
        </>
      )}
    </div>
  );
}
