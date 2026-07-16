import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { fetchCollectiveAgreements } from "../../services/collectiveAgreementApi.js";
import { fetchCompanies } from "../../services/companyApi.js";
import { fetchAllEmployees } from "../../services/employeeApi.js";
import {
  addAffiliationMovements,
  createAffiliationDraft,
  fetchAffiliationCandidates,
  fetchAffiliationDraft,
  fetchAffiliationDrafts,
  generateAffiliationDraft,
  receiveAffiliationResponse,
  removeAffiliationMovement,
  sendAffiliationDraft,
} from "../../services/affiliationApi.js";
import "./affiliationRemittance.css";

const SELECTED_DRAFT_KEY = "aulanomina:affiliationDraftId";

function isoDate(date) {
  return date.toISOString().slice(0, 10);
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

function statusLabel(status) {
  return {
    DRAFT: "Borrador",
    VALIDATION_ERROR: "Error de validación",
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
    <div className="afi-table-wrap">
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
    <div className="afi-table-wrap afi-table-wrap--draft">
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

function ResponsePanel({ submission }) {
  if (!submission) return null;
  const messages = submission.messages || [];
  return (
    <section className="afi-response-panel">
      <div className="afi-response-summary">
        <div>
          <span>Respuesta SILTRA</span>
          <strong>{submission.submission_number}</strong>
        </div>
        <StatusPill status={submission.status} />
        <strong>{submission.response_code || "Pendiente"}</strong>
        <p>{submission.response_message || "El fichero se ha transmitido y está pendiente de procesamiento."}</p>
      </div>
      {messages.length > 0 && (
        <div className="afi-response-lines">
          {messages.map((message, index) => (
            <article key={`${message.code}-${index}`} className={`afi-response-line afi-response-line--${String(message.severity || "info").toLowerCase()}`}>
              <strong>{message.code}</strong>
              <div><span>{message.message}</span>{message.employee_name && <small>{message.employee_name}</small>}{message.recommendation && <small>{message.recommendation}</small>}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AffiliationWorkspace({ onClose }) {
  const [filters, setFilters] = useState(defaultFilters);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [selectedDraftId, setSelectedDraftId] = useState(() => window.sessionStorage.getItem(SELECTED_DRAFT_KEY) || "");
  const [draft, setDraft] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeEmployees = useMemo(
    () => employees.filter((employee) => !filters.company_id || String(employee.company_id) === String(filters.company_id)),
    [employees, filters.company_id]
  );

  const updateFilter = (field, value) => {
    setFilters((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "company_id" ? { employee_id: "" } : {}),
    }));
  };

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

  const loadDrafts = useCallback(async () => {
    try {
      const data = await fetchAffiliationDrafts({ limit: 200 });
      setDrafts(data?.items || []);
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
      if (data.latest_submission_id && data.latest_submission_status && !["SENT", "PROCESSING"].includes(data.latest_submission_status)) {
        setSubmission((current) => current?.id === data.latest_submission_id ? current : null);
      }
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir el borrador");
    }
  }, []);

  const searchCandidates = useCallback(async () => {
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
  }, [filters]);

  useEffect(() => {
    loadCatalogs();
    loadDrafts();
  }, [loadCatalogs, loadDrafts]);

  useEffect(() => {
    if (selectedDraftId) loadSelectedDraft(selectedDraftId);
  }, [loadSelectedDraft, selectedDraftId]);

  const selectDraft = (draftId) => {
    const value = String(draftId || "");
    setSelectedDraftId(value);
    setSubmission(null);
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
      setSubmission(null);
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
      setSubmission(null);
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
      setSubmission(null);
      setNotice(`Fichero ${updated.original_filename} generado y listo para enviar.`);
      await loadDrafts();
    } catch (requestError) {
      setError(requestError.message || "No se ha podido generar el fichero AFI");
    } finally {
      setBusy(false);
    }
  };

  const sendFile = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    setNotice("Transmitiendo el fichero a SILTRA simulado...");
    try {
      const sent = await sendAffiliationDraft(draft.id);
      setSubmission(sent.submission);
      setDraft((previous) => previous ? { ...previous, status: "SENT", latest_submission_id: sent.submission.id, latest_submission_status: "SENT" } : previous);
      setNotice("Fichero enviado. SILTRA está validando los movimientos y el estado de afiliación.");
      await new Promise((resolve) => window.setTimeout(resolve, sent.response_available_after_ms || 1600));
      const response = await receiveAffiliationResponse(sent.submission.id);
      setSubmission(response);
      setDraft((previous) => previous ? {
        ...previous,
        status: response.status,
        response_code: response.response_code,
        response_message: response.response_message,
        response_file_id: response.response_file_id,
        latest_submission_status: response.status,
      } : previous);
      setNotice(response.status === "ACCEPTED" ? "Respuesta recibida: todos los movimientos han sido aceptados." : "Respuesta recibida: la remesa contiene errores.");
      await loadDrafts();
      await loadSelectedDraft(draft.id);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido completar el envío");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="afi-window-layer" role="dialog" aria-modal="true" aria-label="Remesas de afiliación SILTRA">
      <section className="afi-window">
        <header className="afi-titlebar">
          <div><span>AFILIACIÓN · SILTRA SIMULADO</span><strong>Altas, modificaciones y bajas</strong></div>
          <button type="button" onClick={onClose}>Cerrar</button>
        </header>

        <div className="afi-educational-banner">Entorno educativo. No existe conexión con TGSS, Sistema RED ni SILTRA real.</div>

        <main className="afi-content">
          <section className="afi-panel">
            <div className="afi-panel-title"><span>1. Localizar movimientos laborales</span><button type="button" onClick={searchCandidates} disabled={loading || busy}>Buscar</button></div>
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
          </section>

          <section className="afi-panel">
            <div className="afi-panel-title"><span>2. Preparar fichero AFI</span><button type="button" onClick={loadDrafts} disabled={busy}>Actualizar borradores</button></div>
            <div className="afi-draft-toolbar">
              <label><span>Borrador</span><select value={selectedDraftId} onChange={(event) => selectDraft(event.target.value)}><option value="">Nuevo borrador</option>{drafts.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.movement_count} movimientos · {statusLabel(item.status)}</option>)}</select></label>
              {draft && <div className="afi-draft-facts"><StatusPill status={draft.status} /><span>{draft.movement_count} movimientos</span><span>{draft.company_count} empresas</span><span>{draft.ccc_count} CCC</span><span>{formatDate(draft.date_from)} – {formatDate(draft.date_to)}</span></div>}
            </div>
            <DraftMovements draft={draft} onRemove={removeMovement} busy={busy} />
            <div className="afi-file-actions">
              <div><span>Fichero preparado</span><strong>{draft?.original_filename || "Todavía no generado"}</strong></div>
              <button type="button" onClick={generateFile} disabled={busy || !draft || draft.movement_count === 0 || ["SENT", "PROCESSING"].includes(draft.status)}>Generar fichero AFI</button>
              <button type="button" className="afi-primary-button" onClick={sendFile} disabled={busy || !draft || !["GENERATED", "ACCEPTED", "REJECTED", "ACCEPTED_WITH_WARNINGS"].includes(draft.status)}>{busy ? "Procesando..." : "Enviar a SILTRA"}</button>
            </div>
          </section>

          <MessagePanel error={error} notice={notice} />
          <ResponsePanel submission={submission} />
        </main>
      </section>
    </div>
  );
}

export default function AffiliationRemittanceLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("aulanomina-open-affiliation-remittances", handleOpen);
    return () => window.removeEventListener("aulanomina-open-affiliation-remittances", handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="afi-global-launcher" onClick={() => setOpen(true)} title="Procesar remesas de afiliación en SILTRA simulado">
        <span>AFI</span>
        <strong>Altas y bajas</strong>
      </button>
      {open && createPortal(<AffiliationWorkspace onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
