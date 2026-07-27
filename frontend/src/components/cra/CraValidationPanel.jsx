import { useEffect, useMemo, useState } from "react";

import PageCard from "../layout/PageCard";
import { createCraSubstitute, fetchCraFiles, sendCraFile } from "../../services/craApi";
import {
  getSelectedCompanyId,
  setSelectedCompanyId,
  subscribeSelectedCompany,
} from "../../utils/companyContext";
import "./craValidationPanel.css";

const FINAL_STATUSES = new Set(["ACCEPTED", "ACCEPTED_WITH_WARNINGS", "REJECTED"]);

const STATUS_LABELS = {
  GENERATED: "Pendiente de envío",
  SENT: "Enviado",
  PROCESSING: "Procesando",
  ACCEPTED: "Aceptado",
  ACCEPTED_WITH_WARNINGS: "Aceptado con avisos",
  REJECTED: "Rechazado",
};

const SCENARIOS = [
  {
    value: "AUTO",
    label: "Validación automática",
    help: "El resultado depende del contenido, los datos y los envíos anteriores.",
  },
  {
    value: "WARNINGS",
    label: "Práctica: aceptación con avisos",
    help: "Añade un aviso didáctico cuando no existen errores bloqueantes.",
  },
  {
    value: "REJECTED",
    label: "Práctica: rechazo",
    help: "Fuerza un rechazo para practicar la corrección y el reenvío.",
  },
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function statusTone(status) {
  if (status === "ACCEPTED") return "success";
  if (status === "ACCEPTED_WITH_WARNINGS") return "warning";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

function messageTone(severity) {
  if (severity === "ERROR") return "danger";
  if (severity === "WARNING") return "warning";
  return "info";
}

function fileMessages(file) {
  return Array.isArray(file?.validation_errors) ? file.validation_errors : [];
}

function countMessages(file, severity) {
  return fileMessages(file).filter((item) => item.severity === severity).length;
}

function replacementLabel(file) {
  const metadata = file?.metadata || {};
  if (metadata.replacement_of_file_id) {
    const action = metadata.action_mode || "M";
    return `Correctora de #${metadata.replacement_of_file_id} · actuación ${action}`;
  }
  if (metadata.superseded_by_file_id) return `Sustituido por #${metadata.superseded_by_file_id}`;
  return "Comunicación original";
}

function SummaryCard({ label, value, tone = "neutral" }) {
  return (
    <div className={`cra-validation-summary cra-validation-summary--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function CraValidationPanel({
  companies = [],
  refreshToken = 0,
  onNewFile = null,
}) {
  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active !== false),
    [companies]
  );
  const [companyId, setCompanyId] = useState(() => getSelectedCompanyId());
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [scenario, setScenario] = useState("AUTO");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [busyFileId, setBusyFileId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showXml, setShowXml] = useState(false);

  useEffect(() => subscribeSelectedCompany(setCompanyId), []);

  useEffect(() => {
    if (!companyId && activeCompanies.length) setSelectedCompanyId(activeCompanies[0].id);
  }, [activeCompanies, companyId]);

  async function loadFiles(targetCompanyId = companyId, preferredFileId = null) {
    if (!targetCompanyId) {
      setFiles([]);
      setSelectedFileId(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchCraFiles({ company_id: Number(targetCompanyId) });
      const nextFiles = data || [];
      setFiles(nextFiles);
      setSelectedFileId((current) => {
        const candidate = preferredFileId || current;
        return nextFiles.some((file) => file.id === candidate) ? candidate : nextFiles[0]?.id || null;
      });
    } catch (requestError) {
      setError(requestError.message || "No se pudieron cargar las comunicaciones CRA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMessage("");
    setShowXml(false);
    loadFiles();
  }, [companyId, refreshToken]);

  const filteredFiles = useMemo(
    () => files.filter((file) => statusFilter === "ALL" || file.status === statusFilter),
    [files, statusFilter]
  );
  const selectedFile = files.find((file) => file.id === selectedFileId) || null;
  const selectedScenario = SCENARIOS.find((item) => item.value === scenario) || SCENARIOS[0];
  const counts = useMemo(() => ({
    generated: files.filter((file) => file.status === "GENERATED").length,
    accepted: files.filter((file) => file.status === "ACCEPTED").length,
    warnings: files.filter((file) => file.status === "ACCEPTED_WITH_WARNINGS").length,
    rejected: files.filter((file) => file.status === "REJECTED").length,
    correctors: files.filter((file) => file.metadata?.replacement_of_file_id).length,
  }), [files]);

  async function handleSend(file) {
    setBusyFileId(file.id);
    setMessage("");
    setError("");
    try {
      const result = await sendCraFile(file.id, null, scenario);
      setMessage(`${result.submission_number}: ${result.response_message}`);
      await loadFiles(companyId, file.id);
    } catch (requestError) {
      setError(requestError.message || "No se pudo validar y enviar el fichero CRA.");
    } finally {
      setBusyFileId(null);
    }
  }

  async function handleSubstitute(file) {
    setBusyFileId(file.id);
    setMessage("");
    setError("");
    try {
      const result = await createCraSubstitute(file.id);
      const actionText = result.action_mode === "M"
        ? "modificación sustitutiva"
        : "nueva alta corregida";
      setMessage(`Se ha generado ${result.file.original_filename} como ${actionText}.`);
      await loadFiles(companyId, result.file.id);
    } catch (requestError) {
      setError(requestError.message || "No se pudo crear la comunicación correctora.");
    } finally {
      setBusyFileId(null);
    }
  }

  function downloadFile(file) {
    if (!file?.content) {
      setError("El fichero no contiene XML disponible para descargar.");
      return;
    }
    const blob = new Blob([file.content], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.original_filename || `CRA_${file.period || "fichero"}.xml`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <PageCard
      title="Ficheros, respuestas y rectificaciones"
      subtitle="Único punto de envío CRA: valida el XML, recibe la respuesta RCA y genera una comunicación correctora cuando sea necesario."
    >
      {error && <div className="cra-validation-banner cra-validation-banner--danger">{error}</div>}
      {message && <div className="cra-validation-banner cra-validation-banner--success">{message}</div>}

      <div className="cra-validation-flow" aria-label="Flujo de validación CRA">
        <span>1. Fichero generado</span>
        <strong>→</strong>
        <span>2. Validar y enviar</span>
        <strong>→</strong>
        <span>3. Respuesta RCA</span>
        <strong>→</strong>
        <span>4. Correctora y reenvío</span>
      </div>

      <div className="cra-validation-toolbar">
        <label>
          <span>Empresa</span>
          <select value={companyId} onChange={(event) => setSelectedCompanyId(event.target.value)}>
            <option value="">Seleccionar empresa</option>
            {activeCompanies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Escenario de práctica</span>
          <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
            {SCENARIOS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <small>{selectedScenario.help}</small>
        </label>
        <label>
          <span>Filtrar por estado</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">Todos</option>
            <option value="GENERATED">Pendientes de envío</option>
            <option value="ACCEPTED">Aceptados</option>
            <option value="ACCEPTED_WITH_WARNINGS">Con avisos</option>
            <option value="REJECTED">Rechazados</option>
          </select>
        </label>
        <div className="cra-validation-toolbar__actions">
          <button type="button" onClick={() => loadFiles()} disabled={loading || !companyId}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
          {onNewFile && (
            <button type="button" className="cra-validation-primary" onClick={onNewFile}>
              Nuevo fichero
            </button>
          )}
        </div>
      </div>

      <div className="cra-validation-summary-grid">
        <SummaryCard label="Pendientes" value={counts.generated} />
        <SummaryCard label="Aceptados" value={counts.accepted} tone="success" />
        <SummaryCard label="Con avisos" value={counts.warnings} tone="warning" />
        <SummaryCard label="Rechazados" value={counts.rejected} tone="danger" />
        <SummaryCard label="Correctoras" value={counts.correctors} tone="info" />
      </div>

      <div className="cra-validation-layout">
        <div className="cra-validation-table-wrap">
          <table className="cra-validation-table">
            <thead>
              <tr>
                <th>Fichero</th>
                <th>Periodo / CCC</th>
                <th>Estado</th>
                <th>Resultado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => {
                const errors = countMessages(file, "ERROR");
                const warnings = countMessages(file, "WARNING");
                const canCorrect = FINAL_STATUSES.has(file.status) && !file.metadata?.superseded_by_file_id;
                return (
                  <tr
                    key={file.id}
                    className={selectedFileId === file.id ? "is-selected" : ""}
                    onClick={() => {
                      setSelectedFileId(file.id);
                      setShowXml(false);
                    }}
                  >
                    <td>
                      <strong>{file.original_filename}</strong>
                      <small>#{file.id} · {replacementLabel(file)}</small>
                    </td>
                    <td>
                      <strong>{file.period}</strong>
                      <small>{file.ccc_id}</small>
                    </td>
                    <td>
                      <span className={`cra-validation-status cra-validation-status--${statusTone(file.status)}`}>
                        {STATUS_LABELS[file.status] || file.status}
                      </span>
                      <small>{formatDate(file.processed_at || file.generated_at)}</small>
                    </td>
                    <td>
                      <strong>{file.response_code || "Pendiente"}</strong>
                      <small>{errors} error(es) · {warnings} aviso(s)</small>
                    </td>
                    <td>
                      {file.status === "GENERATED" && (
                        <button
                          type="button"
                          className="cra-validation-primary"
                          disabled={busyFileId === file.id}
                          onClick={(event) => { event.stopPropagation(); handleSend(file); }}
                        >
                          {busyFileId === file.id ? "Procesando..." : "Validar y enviar"}
                        </button>
                      )}
                      {canCorrect && (
                        <button
                          type="button"
                          className="cra-validation-secondary"
                          disabled={busyFileId === file.id}
                          onClick={(event) => { event.stopPropagation(); handleSubstitute(file); }}
                        >
                          {busyFileId === file.id ? "Generando..." : "Crear correctora"}
                        </button>
                      )}
                      {file.metadata?.superseded_by_file_id && (
                        <span className="cra-validation-linked">Rectificado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredFiles.length && (
                <tr><td colSpan="5" className="cra-validation-empty">No hay ficheros CRA para el filtro seleccionado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="cra-validation-detail">
          {!selectedFile ? (
            <div className="cra-validation-empty">Selecciona un fichero para consultar su contenido y respuesta.</div>
          ) : (
            <>
              <div className="cra-validation-detail-header">
                <div>
                  <span>Detalle de comunicación</span>
                  <strong>{selectedFile.original_filename}</strong>
                </div>
                <span className={`cra-validation-status cra-validation-status--${statusTone(selectedFile.status)}`}>
                  {STATUS_LABELS[selectedFile.status] || selectedFile.status}
                </span>
              </div>

              <dl className="cra-validation-data">
                <div><dt>Respuesta</dt><dd>{selectedFile.response_code || "Pendiente"}</dd></div>
                <div><dt>Relación</dt><dd>{replacementLabel(selectedFile)}</dd></div>
                <div><dt>Enviado</dt><dd>{formatDate(selectedFile.submitted_at)}</dd></div>
                <div><dt>Procesado</dt><dd>{formatDate(selectedFile.processed_at)}</dd></div>
              </dl>

              <div className="cra-validation-file-actions">
                <button type="button" className="cra-validation-secondary" onClick={() => downloadFile(selectedFile)}>
                  Descargar XML
                </button>
                <button type="button" className="cra-validation-secondary" onClick={() => setShowXml((value) => !value)}>
                  {showXml ? "Ocultar XML" : "Ver XML"}
                </button>
                {selectedFile.status === "GENERATED" && (
                  <button type="button" className="cra-validation-primary" disabled={busyFileId === selectedFile.id} onClick={() => handleSend(selectedFile)}>
                    {busyFileId === selectedFile.id ? "Procesando..." : "Validar y enviar a SILTRA"}
                  </button>
                )}
              </div>

              {showXml && (
                <pre className="cra-validation-xml">{selectedFile.content || "XML no disponible."}</pre>
              )}

              {selectedFile.response_message && (
                <div className={`cra-validation-response cra-validation-response--${statusTone(selectedFile.status)}`}>
                  {selectedFile.response_message}
                </div>
              )}

              <div className="cra-validation-messages">
                <h4>Mensajes de validación</h4>
                {fileMessages(selectedFile).map((item, index) => (
                  <article key={`${item.code}-${index}`} className={`cra-validation-message cra-validation-message--${messageTone(item.severity)}`}>
                    <header><strong>{item.code}</strong><span>{item.severity}</span></header>
                    <p>{item.message}</p>
                    {(item.employee_name || item.employee_id || item.cra_code) && (
                      <small>
                        {item.employee_name || `Trabajador ${item.employee_id || "-"}`}
                        {item.cra_code ? ` · CRA ${item.cra_code}` : ""}
                      </small>
                    )}
                  </article>
                ))}
                {!fileMessages(selectedFile).length && (
                  <div className="cra-validation-empty">El fichero todavía no ha sido validado o no contiene incidencias.</div>
                )}
              </div>

              {FINAL_STATUSES.has(selectedFile.status) && (
                <div className="cra-validation-correction-help">
                  <strong>Comunicación correctora</strong>
                  <p>
                    Tras un rechazo se genera una nueva alta corregida. Tras una aceptación o aceptación con avisos,
                    la correctora utiliza actuación M para sustituir lo comunicado anteriormente.
                  </p>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </PageCard>
  );
}
