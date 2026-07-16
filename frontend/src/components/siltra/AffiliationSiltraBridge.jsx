import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  fetchAffiliationDraft,
  fetchAffiliationDrafts,
  receiveAffiliationResponse,
  sendAffiliationDraft,
} from "../../services/affiliationApi.js";
import "./affiliationSiltraBridge.css";

const OPEN_EVENT = "aulanomina-open-siltra-affiliation";
const SENDABLE_STATUSES = new Set(["GENERATED", "ACCEPTED", "ACCEPTED_WITH_WARNINGS", "REJECTED"]);

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

function StatusPill({ status }) {
  const tone = status === "ACCEPTED"
    ? "ok"
    : status === "REJECTED" || status === "VALIDATION_ERROR"
      ? "error"
      : status === "SENT" || status === "PROCESSING"
        ? "pending"
        : "neutral";
  return <span className={`siltra-afi-status siltra-afi-status--${tone}`}>{statusLabel(status)}</span>;
}

function AffiliationSiltraWorkspace({ initialDraftId }) {
  const [files, setFiles] = useState([]);
  const [selectedId, setSelectedId] = useState(initialDraftId ? String(initialDraftId) : "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const generatedFiles = useMemo(
    () => files.filter((item) => Boolean(item.original_filename && item.content)),
    [files]
  );

  const loadFiles = useCallback(async (preferredId = null) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAffiliationDrafts({ limit: 300 });
      const items = data?.items || [];
      setFiles(items);
      const candidateId = preferredId || items.find((item) => item.original_filename && item.content)?.id;
      if (candidateId) setSelectedId(String(candidateId));
    } catch (requestError) {
      setError(requestError.message || "No se han podido cargar los ficheros AFI");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelected = useCallback(async (fileId) => {
    if (!fileId) {
      setSelectedFile(null);
      return;
    }
    try {
      const detail = await fetchAffiliationDraft(fileId);
      setSelectedFile(detail);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir el fichero AFI");
    }
  }, []);

  useEffect(() => {
    setSelectedId(initialDraftId ? String(initialDraftId) : "");
    setSubmission(null);
    loadFiles(initialDraftId || null);
  }, [initialDraftId, loadFiles]);

  useEffect(() => {
    loadSelected(selectedId);
  }, [loadSelected, selectedId]);

  const sendFile = async () => {
    if (!selectedFile || !SENDABLE_STATUSES.has(selectedFile.status)) {
      setError("Seleccione un fichero AFI generado antes de transmitirlo.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("Conectando con la TGSS simulada y transmitiendo el fichero AFI...");
    try {
      const sent = await sendAffiliationDraft(selectedFile.id);
      setSubmission(sent.submission);
      setSelectedFile((previous) => previous ? { ...previous, status: "SENT", latest_submission_status: "SENT" } : previous);
      setNotice("Fichero transmitido. SILTRA está validando los movimientos y el estado externo de afiliación.");

      await new Promise((resolve) => window.setTimeout(resolve, sent.response_available_after_ms || 1600));
      const response = await receiveAffiliationResponse(sent.submission.id);
      setSubmission(response);
      setSelectedFile((previous) => previous ? {
        ...previous,
        status: response.status,
        response_code: response.response_code,
        response_message: response.response_message,
        response_file_id: response.response_file_id,
        latest_submission_status: response.status,
      } : previous);
      setNotice(response.status === "ACCEPTED"
        ? "Respuesta recibida: todos los movimientos han sido aceptados."
        : "Respuesta recibida: el fichero contiene errores de afiliación.");
      await loadFiles(selectedFile.id);
      await loadSelected(selectedFile.id);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido completar la transmisión AFI");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="siltra-afi-workspace">
      <div className="siltra-workspace-heading">Validación y envío de remesas de afiliación</div>

      <section className="siltra-afi-panel">
        <div className="siltra-afi-panel-title">
          <span>Ficheros AFI generados en AulaNomina</span>
          <button type="button" className="siltra-classic-button" onClick={() => loadFiles(selectedId || null)} disabled={loading || busy}>Actualizar</button>
        </div>
        <div className="siltra-table-wrap siltra-afi-table-wrap">
          <table className="siltra-table">
            <thead><tr><th></th><th>Nombre fichero</th><th>Fechas</th><th>Movimientos</th><th>Empresas</th><th>CCC</th><th>Estado</th><th>Respuesta</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="8" className="siltra-empty-cell">Cargando ficheros AFI...</td></tr>}
              {!loading && generatedFiles.length === 0 && <tr><td colSpan="8" className="siltra-empty-cell">No existen ficheros AFI generados.</td></tr>}
              {!loading && generatedFiles.map((file) => (
                <tr key={file.id} className={String(file.id) === String(selectedId) ? "is-selected" : ""}>
                  <td><input type="radio" name="siltra-afi-file" checked={String(file.id) === String(selectedId)} onChange={() => { setSelectedId(String(file.id)); setSubmission(null); setError(""); }} /></td>
                  <td><strong>{file.original_filename}</strong><small>{formatDateTime(file.generated_at || file.updated_at)}</small></td>
                  <td>{formatDate(file.date_from)} – {formatDate(file.date_to)}</td>
                  <td>{file.movement_count}</td>
                  <td>{file.company_count}</td>
                  <td>{file.ccc_count}</td>
                  <td><StatusPill status={file.status} /></td>
                  <td>{file.response_code || "Sin presentar"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="siltra-afi-panel">
        <div className="siltra-afi-panel-title"><span>Fichero seleccionado</span></div>
        {!selectedFile ? (
          <div className="siltra-empty-cell siltra-afi-empty">Seleccione un fichero AFI generado.</div>
        ) : (
          <>
            <div className="siltra-afi-facts">
              <div><span>Nombre</span><strong>{selectedFile.original_filename}</strong></div>
              <div><span>Estado</span><StatusPill status={selectedFile.status} /></div>
              <div><span>Movimientos</span><strong>{selectedFile.movement_count}</strong></div>
              <div><span>Empresas</span><strong>{selectedFile.company_count}</strong></div>
              <div><span>CCC</span><strong>{selectedFile.ccc_count}</strong></div>
              <div><span>Periodo</span><strong>{formatDate(selectedFile.date_from)} – {formatDate(selectedFile.date_to)}</strong></div>
            </div>
            <pre className="siltra-afi-preview">{selectedFile.content || "El fichero no contiene información."}</pre>
          </>
        )}
      </section>

      {error && <div className="siltra-message siltra-message--error">{error}</div>}
      {notice && <div className="siltra-message siltra-message--info">{notice}</div>}

      {submission && (
        <section className="siltra-afi-panel">
          <div className="siltra-afi-panel-title"><span>Respuesta de afiliación</span></div>
          <div className="siltra-afi-response-summary">
            <StatusPill status={submission.status} />
            <strong>{submission.response_code || submission.submission_number}</strong>
            <span>{submission.response_message || "Procesamiento pendiente"}</span>
          </div>
          {(submission.messages || []).length > 0 && (
            <div className="siltra-response-list siltra-afi-response-list">
              {submission.messages.map((message, index) => (
                <div key={`${message.code}-${index}`} className={`siltra-response-line siltra-response-line--${String(message.severity || "info").toLowerCase()}`}>
                  <strong>{message.code}</strong>
                  <span>{message.message}</span>
                  {message.employee_name && <small>{message.employee_name}</small>}
                  {message.recommendation && <small>{message.recommendation}</small>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="siltra-workspace-actions">
        <button type="button" className="siltra-classic-button" onClick={() => loadFiles(selectedId || null)} disabled={loading || busy}>Reconstruir seguimiento</button>
        <button type="button" className="siltra-classic-button siltra-classic-button--primary" onClick={sendFile} disabled={busy || !selectedFile || !SENDABLE_STATUSES.has(selectedFile.status)}>
          {busy ? "Procesando..." : "Enviar fichero AFI seleccionado"}
        </button>
      </div>
    </div>
  );
}

export default function AffiliationSiltraBridge() {
  const [request, setRequest] = useState(null);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const syncTarget = () => {
      const nextTarget = document.querySelector(".siltra-window-content");
      setTarget((current) => current === nextTarget ? current : nextTarget);
    };
    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleOpen = (event) => {
      const draftId = event.detail?.draftId || null;
      setRequest({ draftId, token: Date.now() });
      if (!document.querySelector(".siltra-window") && !document.querySelector(".siltra-minimized-window")) {
        document.querySelector(".siltra-global-launcher")?.click();
      }
    };
    window.addEventListener(OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!request || !target) return;
    const affiliationMenu = Array.from(document.querySelectorAll(".siltra-main-menu button"))
      .find((button) => button.title === "Afiliación/INSS");
    if (affiliationMenu && !affiliationMenu.classList.contains("is-active")) affiliationMenu.click();
  }, [request, target]);

  useEffect(() => {
    const handleNavigation = (event) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!button) return;
      if (button.closest(".siltra-main-menu") && button.title !== "Afiliación/INSS") setRequest(null);
      if (button.closest(".siltra-window-controls") || button.classList.contains("siltra-exit-button")) setRequest(null);
    };
    document.addEventListener("click", handleNavigation, true);
    return () => document.removeEventListener("click", handleNavigation, true);
  }, []);

  if (!request || !target) return null;
  return createPortal(<AffiliationSiltraWorkspace key={request.token} initialDraftId={request.draftId} />, target);
}
