import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import siltraLogo from "../../assets/siltra-access.svg";
import { fetchCompanies } from "../../services/companyApi";
import {
  fetchCompanyCccOptions,
  fetchCommunicationFiles,
  fetchCommunicationSubmission,
  fetchCommunicationSubmissions,
  importCommunicationFile,
  submitCommunicationFile,
} from "../../services/socialSecurityApi";
import {
  FINAL_SUBMISSION_STATUSES,
  SENDABLE_COMMUNICATION_STATUSES,
  filePreview,
  formatFileSize,
  getFileExtension,
  validateSiltraUpload,
} from "../../utils/siltraSimulation";
import "./siltraWindow.css";
import "./siltraWindowEnhancements.css";

const CONFIG_STORAGE_KEY = "aulanomina:siltraDesktopConfig";
const LAST_SCREEN_KEY = "aulanomina:siltraLastScreen";
const COMPANY_KEY = "aulanomina:siltraCompanyId";
const SELECTED_FILE_KEY = "aulanomina:siltraSelectedFileId";

const DEFAULT_CONFIG = {
  authorizationNumber: "00009999",
  authorizationDate: "08-08-2019",
  officeName: "AulaNomina - Entorno educativo",
  principalUser: "Usuario principal de la autorización",
  applicationUser: "Usuario demo docente",
  cotizacionMode: "validate",
  affiliationMode: "validate-adapt",
  backupCotizacion: true,
  practiceEnvironment: true,
  compressFiles: true,
  backupAffiliation: false,
  backupCra: true,
  directConnection: true,
  proxyServer: "",
  proxyPort: "",
  proxyUser: "",
  proxyPassword: "",
  logLevel: "Informativos",
  printer: "PDF Creator",
};

const DIRECTORY_ROWS = [
  ["CARPETA DE INSTALACIÓN", "C:\\SILTRA"],
  ["FICHEROS DE COTIZACIÓN", "C:\\SILTRA\\XECR"],
  ["COPIAS DE FICHEROS DE COTIZACIÓN", "C:\\SILTRA\\XECR\\Copias-XECR"],
  ["RECIBOS DE LIQUIDACIÓN", "C:\\SILTRA\\XDCR\\RLC"],
  ["RELACIÓN NOMINAL DE TRABAJADORES", "C:\\SILTRA\\XDCR\\RNT"],
  ["DOCUMENTOS DE CÁLCULO", "C:\\SILTRA\\XDCR\\DCL"],
  ["FICHEROS DE AFILIACIÓN", "C:\\SILTRA\\RED\\VIPTC2\\AFI"],
  ["FICHEROS DEL INSS", "C:\\SILTRA\\RED\\INSS"],
  ["MENSAJES A ENVIAR", "C:\\SILTRA\\SVA\\MENV"],
  ["MENSAJES RECIBIDOS", "C:\\SILTRA\\SVA\\MREC"],
];

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(window.localStorage.getItem(CONFIG_STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function initialScreen() {
  const stored = window.sessionStorage.getItem(LAST_SCREEN_KEY);
  return ["home", "cotizacion", "communications", "config", "documents", "affiliation", "inss", "utilities", "about"].includes(stored)
    ? stored
    : "home";
}

function initialRemittanceState() {
  return {
    companyId: window.sessionStorage.getItem(COMPANY_KEY) || "",
    selectedFileId: window.sessionStorage.getItem(SELECTED_FILE_KEY) || "",
    upload: {
      ccc_id: "",
      period: new Date().toISOString().slice(0, 7),
      file: null,
      content: "",
      warning: "",
      validatedFileId: null,
    },
  };
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(status) {
  return {
    DRAFT: "Borrador",
    VALIDATING: "Validando",
    VALIDATION_ERROR: "Error validación",
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

function StatusPill({ status }) {
  const tone = status === "ACCEPTED"
    ? "ok"
    : status === "ACCEPTED_WITH_WARNINGS" || status === "READY"
      ? "warning"
      : status === "REJECTED" || status === "VALIDATION_ERROR"
        ? "error"
        : "neutral";
  return <span className={`siltra-status siltra-status--${tone}`}>{statusLabel(status)}</span>;
}

function IconSlot() {
  return <span className="siltra-icon-slot" aria-hidden="true"><span /></span>;
}

function HomeAction({ title, children, onClick, disabled = false }) {
  return (
    <button type="button" className="siltra-home-action" onClick={onClick} disabled={disabled}>
      <IconSlot />
      <span className="siltra-home-action__copy">
        <strong>{title}</strong>
        {children && <small>{children}</small>}
      </span>
    </button>
  );
}

function VerticalSection({ label, children, compact = false }) {
  return (
    <section className={`siltra-vertical-section ${compact ? "siltra-vertical-section--compact" : ""}`}>
      <div className="siltra-vertical-section__rail">{label}</div>
      <div className="siltra-vertical-section__content">{children}</div>
    </section>
  );
}

function ClassicPanel({ title, children, actions }) {
  return (
    <section className="siltra-classic-panel">
      <div className="siltra-classic-panel__title">
        <span>{title}</span>
        {actions && <div>{actions}</div>}
      </div>
      <div className="siltra-classic-panel__body">{children}</div>
    </section>
  );
}

function FileFacts({ data, title = "Datos del fichero" }) {
  if (!data) return null;
  return (
    <div className="siltra-file-facts" aria-label={title}>
      <div><span>Nombre</span><strong>{data.name || "-"}</strong></div>
      <div><span>Tipo</span><strong>{data.type || "-"}</strong></div>
      <div><span>Tamaño</span><strong>{data.size || "-"}</strong></div>
      <div><span>Empresa</span><strong>{data.company || "-"}</strong></div>
      <div><span>CCC</span><strong>{data.ccc || "-"}</strong></div>
      <div><span>Periodo</span><strong>{data.period || "-"}</strong></div>
    </div>
  );
}

function SiltraHome({ onNavigate, onDocument }) {
  return (
    <div className="siltra-home-grid">
      <div className="siltra-home-column">
        <VerticalSection label="COTIZACIÓN">
          <HomeAction title="Procesar remesas Cotización" onClick={() => onNavigate("cotizacion")}>
            Validación, adaptación y envío de ficheros
          </HomeAction>
          <div className="siltra-print-block">
            <IconSlot />
            <div>
              <strong>Impresión</strong>
              <button type="button" onClick={() => onDocument("RNT")}>Documentos RNT</button>
              <button type="button" onClick={() => onDocument("RLC")}>Documentos RLC</button>
              <button type="button" onClick={() => onDocument("DCL")}>Documentos DCL</button>
            </div>
          </div>
        </VerticalSection>

        <VerticalSection label="AFILIACIÓN - INSS" compact>
          <HomeAction title="Procesar remesas Afiliación" onClick={() => onNavigate("affiliation")}>
            Validación simulada de ficheros AFI
          </HomeAction>
          <HomeAction title="Procesar remesas INSS" onClick={() => onNavigate("inss")}>
            Validación simulada de ficheros FDI/FIE
          </HomeAction>
        </VerticalSection>

        <VerticalSection label="" compact>
          <HomeAction title="Configuración" onClick={() => onNavigate("config")}>
            Autorizado, aplicación, comunicaciones y directorios
          </HomeAction>
        </VerticalSection>
      </div>

      <div className="siltra-home-column">
        <VerticalSection label="COMUNICACIONES">
          <HomeAction title="Envío/Recepción" onClick={() => onNavigate("communications")}>
            Conexión con la TGSS simulada
          </HomeAction>
          <div className="siltra-link-list siltra-link-list--spaced">
            <button type="button" onClick={() => onNavigate("communications")}>Consulta de Envíos Cotización</button>
            <button type="button" onClick={() => onNavigate("affiliation")}>Consulta de Envíos Afiliación/INSS</button>
            <button type="button" onClick={() => onNavigate("communications")}>Seguimiento de Liquidaciones</button>
          </div>
          <div className="siltra-inbox-block">
            <IconSlot />
            <div className="siltra-link-list">
              <button type="button" onClick={() => onNavigate("communications")}>Buzón de Entrada</button>
              <button type="button" onClick={() => onNavigate("communications")}>Buzón de Salida</button>
              <button type="button" onClick={() => onNavigate("communications")}>Reconstrucción Buzón de Entrada</button>
            </div>
          </div>
        </VerticalSection>

        <VerticalSection label="UTILIDADES" compact>
          <HomeAction title="Reconstrucción de Seguimiento" onClick={() => onNavigate("communications")}>
            Reconstruye la vista desde el historial conservado
          </HomeAction>
          <HomeAction title="Copias de Seguridad" disabled>
            Función visual sin acceso al sistema de archivos
          </HomeAction>
          <HomeAction title="Procesar Mensajes descargados Web" onClick={() => onNavigate("communications")}>
            Importación educativa de respuestas
          </HomeAction>
        </VerticalSection>
      </div>
    </div>
  );
}

function RemittanceWorkspace({ companies, config, remittanceState, setRemittanceState, onDirtyChange, onOpenCommunications }) {
  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active !== false), [companies]);
  const { companyId, selectedFileId, upload } = remittanceState;
  const [cccOptions, setCccOptions] = useState([]);
  const [files, setFiles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const updateState = useCallback((patch) => {
    setRemittanceState((previous) => ({ ...previous, ...patch }));
  }, [setRemittanceState]);

  const updateUpload = useCallback((patch) => {
    setRemittanceState((previous) => ({
      ...previous,
      upload: { ...previous.upload, ...patch },
    }));
  }, [setRemittanceState]);

  useEffect(() => {
    if (!companyId && activeCompanies.length > 0) {
      const nextCompanyId = String(activeCompanies[0].id);
      window.sessionStorage.setItem(COMPANY_KEY, nextCompanyId);
      updateState({ companyId: nextCompanyId });
    }
  }, [activeCompanies, companyId, updateState]);

  const loadData = useCallback(async () => {
    if (!companyId) {
      setFiles([]);
      setSubmissions([]);
      setCccOptions([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [communicationFiles, submissionData, cccData] = await Promise.all([
        fetchCommunicationFiles({ company_id: Number(companyId), file_type: "SOCIAL_SECURITY_SETTLEMENT" }),
        fetchCommunicationSubmissions({ company_id: Number(companyId), limit: 500 }),
        fetchCompanyCccOptions(Number(companyId)),
      ]);
      setFiles(communicationFiles || []);
      setSubmissions(submissionData?.items || []);
      setCccOptions(cccData || []);
      if (!upload.ccc_id && cccData?.length) updateUpload({ ccc_id: cccData[0].ccc_id });
    } catch (requestError) {
      setError(requestError.message || "No se han podido cargar las remesas");
    } finally {
      setLoading(false);
    }
  }, [companyId, updateUpload, upload.ccc_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const latestSubmissionByFile = useMemo(() => submissions.reduce((lookup, item) => {
    const current = lookup[item.communication_file_id];
    if (!current || Number(item.attempt_number) > Number(current.attempt_number)) lookup[item.communication_file_id] = item;
    return lookup;
  }, {}), [submissions]);

  const selectedFile = files.find((file) => String(file.id) === String(selectedFileId));
  const selectedCompany = activeCompanies.find((company) => String(company.id) === String(companyId));
  const generatedPreview = selectedFile ? {
    name: selectedFile.original_filename || `Fichero ${selectedFile.id}`,
    type: getFileExtension(selectedFile.original_filename || "")?.toUpperCase() || "JSON",
    size: formatFileSize(new Blob([selectedFile.content || ""]).size),
    company: selectedCompany?.name || `Empresa ${selectedFile.company_id}`,
    ccc: selectedFile.ccc_id || "Sin CCC",
    period: selectedFile.period || "Sin periodo",
  } : null;
  const localPreview = filePreview(upload.file, selectedCompany?.name, upload.ccc_id, upload.period);

  const selectGeneratedFile = (fileId) => {
    const value = String(fileId);
    window.sessionStorage.setItem(SELECTED_FILE_KEY, value);
    updateState({ selectedFileId: value });
    setResult(null);
    setError("");
  };

  const handleCompanyChange = (value) => {
    window.sessionStorage.setItem(COMPANY_KEY, value);
    window.sessionStorage.removeItem(SELECTED_FILE_KEY);
    setRemittanceState((previous) => ({
      ...previous,
      companyId: value,
      selectedFileId: "",
      upload: { ...previous.upload, ccc_id: "", validatedFileId: null },
    }));
    setResult(null);
  };

  const clearUpload = () => {
    updateUpload({ file: null, content: "", warning: "", validatedFileId: null });
    onDirtyChange(false);
    setNotice("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    const validation = validateSiltraUpload(file, files);
    if (!validation.valid) {
      clearUpload();
      setError(validation.error);
      return;
    }
    try {
      const content = await file.text();
      updateUpload({ file, content, warning: validation.warning, validatedFileId: null });
      onDirtyChange(true);
      setNotice(`Fichero seleccionado: ${file.name}`);
      setError("");
    } catch {
      clearUpload();
      setError("No se ha podido leer el fichero seleccionado.");
    }
  };

  const handleImport = async () => {
    if (!companyId || !upload.ccc_id || !upload.period || !upload.file || !upload.content) {
      setError("Seleccione empresa, CCC, periodo y fichero antes de validar y adaptar.");
      return;
    }
    const validation = validateSiltraUpload(upload.file, files);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    if (validation.warning.includes("mismo nombre") && !window.confirm(`${validation.warning}\n\n¿Desea continuar?`)) return;

    setBusy(true);
    setError("");
    setNotice("Validando y adaptando el fichero...");
    try {
      const imported = await importCommunicationFile({
        company_id: Number(companyId),
        ccc_id: upload.ccc_id,
        period: upload.period,
        file_type: "SOCIAL_SECURITY_SETTLEMENT",
        original_filename: upload.file.name,
        content: upload.content,
        metadata: {
          source: "SILTRA_SIMULATED_UPLOAD",
          imported_from_local_file: true,
          educational_simulation: true,
          source_size_bytes: upload.file.size,
          source_extension: getFileExtension(upload.file.name),
          source_last_modified: upload.file.lastModified || null,
        },
      });
      if (imported.status === "VALIDATION_ERROR") {
        const details = (imported.validation_errors || []).map((item) => item.message).join(" ");
        setError(details || "El fichero contiene errores de validación.");
        return;
      }

      selectGeneratedFile(imported.id);
      updateUpload({ validatedFileId: imported.id, warning: validation.warning });
      onDirtyChange(false);
      setNotice(`Fichero ${imported.original_filename} validado, adaptado y almacenado.`);
      await loadData();

      if (config.cotizacionMode === "auto") {
        const response = await submitCommunicationFile(imported.id);
        setResult(response);
        setNotice("Validación, adaptación y envío completados.");
        await loadData();
      }
    } catch (requestError) {
      setError(requestError.message || "No se ha podido importar el fichero");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!selectedFile || !SENDABLE_COMMUNICATION_STATUSES.has(selectedFile.status) || !selectedFile.content) {
      setError("Seleccione un fichero validado y generado antes de enviarlo.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("Conectando con TGSS simulada y transmitiendo fichero...");
    try {
      const response = await submitCommunicationFile(selectedFile.id);
      setResult(response);
      setNotice(`Respuesta recibida: ${response.response_code || response.status}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || "No se ha podido transmitir el fichero");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="siltra-workspace">
      <div className="siltra-workspace-heading">Validación y adaptación de ficheros de cotización</div>
      <ClassicPanel title="Selección de autorizado y origen del fichero" actions={<button type="button" className="siltra-classic-button" onClick={loadData}>Actualizar</button>}>
        <div className="siltra-form-grid siltra-form-grid--three">
          <label>
            <span>Empresa / autorizado:</span>
            <select value={companyId} onChange={(event) => handleCompanyChange(event.target.value)}>
              <option value="">Seleccione empresa</option>
              {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label>
            <span>CCC:</span>
            <select value={upload.ccc_id} onChange={(event) => updateUpload({ ccc_id: event.target.value, validatedFileId: null })}>
              <option value="">Seleccione CCC</option>
              {cccOptions.map((option) => <option key={option.ccc_id} value={option.ccc_id}>{option.ccc_id}{option.label ? ` - ${option.label}` : ""}</option>)}
            </select>
          </label>
          <label>
            <span>Periodo de liquidación:</span>
            <input type="month" value={upload.period} onChange={(event) => updateUpload({ period: event.target.value, validatedFileId: null })} />
          </label>
        </div>
      </ClassicPanel>

      <ClassicPanel title="Ficheros generados en AulaNomina">
        <div className="siltra-table-wrap">
          <table className="siltra-table">
            <thead><tr><th></th><th>Nombre fichero</th><th>CCC</th><th>Periodo</th><th>Estado</th><th>Última respuesta</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="6" className="siltra-empty-cell">Cargando ficheros...</td></tr>}
              {!loading && files.length === 0 && <tr><td colSpan="6" className="siltra-empty-cell">No existen ficheros generados para la empresa seleccionada.</td></tr>}
              {!loading && files.map((file) => {
                const latest = latestSubmissionByFile[file.id];
                return (
                  <tr key={file.id} className={String(file.id) === String(selectedFileId) ? "is-selected" : ""}>
                    <td><input type="radio" name="siltra-file" checked={String(file.id) === String(selectedFileId)} onChange={() => selectGeneratedFile(file.id)} /></td>
                    <td>{file.original_filename || `Fichero ${file.id}`}</td>
                    <td>{file.ccc_id || "-"}</td>
                    <td>{file.period}</td>
                    <td><StatusPill status={file.status} /></td>
                    <td>{latest ? <StatusPill status={latest.status} /> : "Sin envíos"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <FileFacts data={generatedPreview} title="Fichero generado seleccionado" />
      </ClassicPanel>

      <ClassicPanel title="Ficheros del equipo">
        <div className="siltra-file-picker">
          <input ref={fileInputRef} type="file" accept=".json,.xml,.txt,application/json,text/plain,text/xml,application/xml" onChange={handleFileSelection} hidden />
          <input type="text" value={upload.file?.name || ""} readOnly placeholder="Seleccione un fichero JSON, XML o TXT" />
          <button type="button" className="siltra-classic-button" onClick={() => fileInputRef.current?.click()}>Examinar...</button>
          <button type="button" className="siltra-classic-button" onClick={clearUpload} disabled={!upload.file || busy}>Limpiar</button>
          <button type="button" className="siltra-classic-button" onClick={handleImport} disabled={busy || !upload.file}>Validar y Adaptar</button>
        </div>
        <p className="siltra-help-text">Límite: 5 MB. JSON es el formato funcional del MVP. XML y TXT se admiten para prácticas y requieren una estructura compatible.</p>
        <FileFacts data={localPreview} title="Previsualización del fichero local" />
        {upload.warning && <div className="siltra-message siltra-message--warning">{upload.warning}</div>}
      </ClassicPanel>

      {error && <div className="siltra-message siltra-message--error">{error}</div>}
      {notice && <div className="siltra-message siltra-message--info">{notice}</div>}

      {result && (
        <ClassicPanel title="Resultado del procesamiento">
          <div className="siltra-result-summary">
            <StatusPill status={result.status} />
            <strong>{result.response_code || "RESPUESTA"}</strong>
            <span>{result.response_message || "Procesamiento completado"}</span>
          </div>
          {(result.messages || []).length > 0 && (
            <div className="siltra-response-list">
              {result.messages.map((message, index) => (
                <div key={`${message.code}-${index}`} className={`siltra-response-line siltra-response-line--${String(message.severity || "info").toLowerCase()}`}>
                  <strong>{message.code}</strong><span>{message.message}</span>{message.employee_name && <small>{message.employee_name}</small>}
                </div>
              ))}
            </div>
          )}
        </ClassicPanel>
      )}

      <div className="siltra-workspace-actions">
        <button type="button" className="siltra-classic-button" onClick={onOpenCommunications}>Envío / Recepción</button>
        <button type="button" className="siltra-classic-button siltra-classic-button--primary" onClick={handleSend} disabled={busy || !selectedFile || !SENDABLE_COMMUNICATION_STATUSES.has(selectedFile.status) || !selectedFile.content}>
          {busy ? "Procesando..." : "Enviar fichero seleccionado"}
        </button>
      </div>
    </div>
  );
}

function CommunicationsWorkspace({ companies }) {
  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active !== false), [companies]);
  const [companyId, setCompanyId] = useState(() => window.sessionStorage.getItem(COMPANY_KEY) || "");
  const [files, setFiles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mailbox, setMailbox] = useState("out");

  useEffect(() => {
    if (!companyId && activeCompanies.length > 0) setCompanyId(String(activeCompanies[0].id));
  }, [activeCompanies, companyId]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");
    try {
      const [communicationFiles, submissionData] = await Promise.all([
        fetchCommunicationFiles({ company_id: Number(companyId), file_type: "SOCIAL_SECURITY_SETTLEMENT" }),
        fetchCommunicationSubmissions({ company_id: Number(companyId), limit: 500 }),
      ]);
      setFiles(communicationFiles || []);
      setSubmissions(submissionData?.items || []);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido reconstruir el buzón");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filesById = useMemo(() => Object.fromEntries(files.map((file) => [file.id, file])), [files]);
  const rows = mailbox === "out" ? submissions : submissions.filter((submission) => FINAL_SUBMISSION_STATUSES.has(submission.status));

  const openDetail = async (submissionId) => {
    setError("");
    try {
      setDetail(await fetchCommunicationSubmission(submissionId));
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir el mensaje");
    }
  };

  return (
    <div className="siltra-workspace">
      <div className="siltra-workspace-heading">Envío / Recepción de ficheros</div>
      <div className="siltra-communications-toolbar">
        <label><span>Autorizado:</span><select value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Seleccione empresa</option>{activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <button type="button" className="siltra-classic-button" onClick={loadData}>Reconstruir seguimiento</button>
      </div>
      <div className="siltra-mailbox-tabs">
        <button type="button" className={mailbox === "out" ? "is-active" : ""} onClick={() => setMailbox("out")}>Buzón de Salida</button>
        <button type="button" className={mailbox === "in" ? "is-active" : ""} onClick={() => setMailbox("in")}>Buzón de Entrada</button>
      </div>
      <div className="siltra-table-wrap siltra-table-wrap--mailbox">
        <table className="siltra-table">
          <thead><tr><th>Número envío</th><th>Fichero</th><th>Intento</th><th>Fecha</th><th>Resultado</th><th>Código</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="siltra-empty-cell">Conectando...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan="7" className="siltra-empty-cell">El buzón no contiene mensajes.</td></tr>}
            {!loading && rows.map((submission) => (
              <tr key={submission.id}>
                <td>{submission.submission_number}</td><td>{filesById[submission.communication_file_id]?.original_filename || submission.communication_file_id}</td><td>{submission.attempt_number}</td><td>{formatDateTime(submission.processed_at || submission.submitted_at || submission.created_at)}</td><td><StatusPill status={submission.status} /></td><td>{submission.response_code || "-"}</td><td><button type="button" className="siltra-link-button" onClick={() => openDetail(submission.id)}>Abrir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className="siltra-message siltra-message--error">{error}</div>}
      {detail && (
        <div className="siltra-subdialog-layer">
          <ClassicPanel title={`Mensaje ${detail.submission_number}`} actions={<button type="button" className="siltra-classic-button" onClick={() => setDetail(null)}>Cerrar mensaje</button>}>
            <div className="siltra-detail-grid">
              <div><span>Fichero:</span><strong>{detail.source_file?.original_filename || "-"}</strong></div><div><span>CCC:</span><strong>{detail.source_file?.ccc_id || "-"}</strong></div><div><span>Periodo:</span><strong>{detail.source_file?.period || "-"}</strong></div><div><span>Estado:</span><StatusPill status={detail.status} /></div>
            </div>
            <div className="siltra-response-list">
              {(detail.messages || []).length === 0 && <div className="siltra-empty-cell">El mensaje no contiene incidencias.</div>}
              {(detail.messages || []).map((message, index) => <div key={`${message.code}-${index}`} className={`siltra-response-line siltra-response-line--${String(message.severity || "info").toLowerCase()}`}><strong>{message.code}</strong><span>{message.message}</span>{message.recommendation && <small>{message.recommendation}</small>}</div>)}
            </div>
          </ClassicPanel>
        </div>
      )}
    </div>
  );
}

function ConfigurationWorkspace({ config, setConfig, onSave }) {
  const [tab, setTab] = useState("authorized");
  const update = (field, value) => setConfig((previous) => ({ ...previous, [field]: value }));

  return (
    <div className="siltra-workspace siltra-config-workspace">
      <div className="siltra-workspace-heading siltra-workspace-heading--with-action"><span>Opciones de configuración SILTRA</span><button type="button" className="siltra-classic-button" onClick={onSave}>Guardar</button></div>
      <div className="siltra-config-tabs">
        {[["authorized", "Autorizado"], ["application", "Aplicación"], ["communications", "Comunicaciones"], ["directories", "Localización de ficheros"], ["printer", "Impresora"]].map(([id, label]) => <button key={id} type="button" className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === "authorized" && <ClassicPanel title="Claves"><div className="siltra-form-grid siltra-form-grid--two"><label><span>Número de Autorización:</span><input value={config.authorizationNumber} onChange={(event) => update("authorizationNumber", event.target.value)} /></label><label><span>Despacho o Empresa:</span><input value={config.officeName} onChange={(event) => update("officeName", event.target.value)} /></label><label><span>Fecha de Autorización:</span><input value={config.authorizationDate} onChange={(event) => update("authorizationDate", event.target.value)} /></label><label><span>Usuario Principal:</span><input value={config.principalUser} onChange={(event) => update("principalUser", event.target.value)} /></label><label className="siltra-form-grid__wide"><span>Usuario de la Aplicación:</span><input value={config.applicationUser} onChange={(event) => update("applicationUser", event.target.value)} /></label></div></ClassicPanel>}

      {tab === "application" && <div className="siltra-config-columns"><ClassicPanel title="Proceso de remesas Cotización"><fieldset className="siltra-fieldset"><legend>Reglas de validación</legend><label><input type="radio" name="cot-mode" checked={config.cotizacionMode === "validate"} onChange={() => update("cotizacionMode", "validate")} /> Validación y Adaptación</label><label><input type="radio" name="cot-mode" checked={config.cotizacionMode === "auto"} onChange={() => update("cotizacionMode", "auto")} /> Validación, Adaptación y Envío</label></fieldset><fieldset className="siltra-fieldset"><legend>Indicadores</legend><label><input type="checkbox" checked={config.backupCotizacion} onChange={(event) => update("backupCotizacion", event.target.checked)} /> Copias de seguridad de envíos</label><label><input type="checkbox" checked={config.practiceEnvironment} onChange={(event) => update("practiceEnvironment", event.target.checked)} /> Entorno Prácticas</label></fieldset></ClassicPanel><ClassicPanel title="Proceso de remesas Afiliación/INSS"><fieldset className="siltra-fieldset"><legend>Reglas de validación</legend><label><input type="radio" name="afi-mode" checked={config.affiliationMode === "validate"} onChange={() => update("affiliationMode", "validate")} /> Validación</label><label><input type="radio" name="afi-mode" checked={config.affiliationMode === "validate-adapt"} onChange={() => update("affiliationMode", "validate-adapt")} /> Validación y Adaptación</label><label><input type="radio" name="afi-mode" checked={config.affiliationMode === "auto"} onChange={() => update("affiliationMode", "auto")} /> Validación, Adaptación y Envío</label></fieldset><label className="siltra-inline-field"><span>Nivel de log:</span><select value={config.logLevel} onChange={(event) => update("logLevel", event.target.value)}><option>Informativos</option><option>Detalle</option><option>Avisos</option><option>Errores</option><option>Errores graves</option></select></label></ClassicPanel></div>}

      {tab === "communications" && <div className="siltra-config-columns"><ClassicPanel title="Tipo conexión Internet"><fieldset className="siltra-fieldset"><label><input type="radio" name="connection" checked={config.directConnection} onChange={() => update("directConnection", true)} /> Conexión directa sin Proxy</label><label><input type="radio" name="connection" checked={!config.directConnection} onChange={() => update("directConnection", false)} /> A través de red local mediante Proxy</label></fieldset><div className="siltra-form-grid"><label><span>Servidor:</span><input disabled={config.directConnection} value={config.proxyServer} onChange={(event) => update("proxyServer", event.target.value)} /></label><label><span>Puerto:</span><input disabled={config.directConnection} value={config.proxyPort} onChange={(event) => update("proxyPort", event.target.value)} /></label><label><span>Usuario:</span><input disabled={config.directConnection} value={config.proxyUser} onChange={(event) => update("proxyUser", event.target.value)} /></label><label><span>Password:</span><input type="password" disabled={config.directConnection} value={config.proxyPassword} onChange={(event) => update("proxyPassword", event.target.value)} /></label></div></ClassicPanel><ClassicPanel title="Parámetros SSL"><div className="siltra-form-grid"><label><span>Servidor:</span><input disabled value="red.seg-social.es:443" /></label><label><span>Protocolo:</span><input disabled value="https://" /></label><label><span>Versión HTTP:</span><input disabled value="HTTP/1.0" /></label><label><span>Recurso de acceso:</span><input disabled value="/RedAcceso/Login" /></label></div></ClassicPanel></div>}

      {tab === "directories" && <ClassicPanel title="Directorios en SILTRA"><div className="siltra-table-wrap siltra-directory-table"><table className="siltra-table"><thead><tr><th>Tipo de fichero</th><th>Ruta asociada</th><th></th></tr></thead><tbody>{DIRECTORY_ROWS.map(([name, path]) => <tr key={name}><td>{name}</td><td>{path}</td><td><button type="button" className="siltra-folder-button" title="Ruta virtual">▣</button></td></tr>)}</tbody></table></div><button type="button" className="siltra-classic-button">Cargar directorios por defecto</button></ClassicPanel>}

      {tab === "printer" && <ClassicPanel title="Información de impresora predeterminada"><div className="siltra-printer-grid"><pre>{`ORIENTATION = 0\npdf-name = AulaNomina-SILTRA\npaper-size = A4\nprintable-area = 210 x 297 mm`}</pre><div className="siltra-printer-list">{["PDF Creator", "Microsoft Print to PDF", "Fax", "Enviar a OneNote"].map((printer) => <label key={printer} className={config.printer === printer ? "is-selected" : ""}><input type="radio" name="printer" checked={config.printer === printer} onChange={() => update("printer", printer)} />{printer}</label>)}</div></div></ClassicPanel>}
    </div>
  );
}

function PlaceholderWorkspace({ title, text }) {
  return <div className="siltra-workspace"><div className="siltra-workspace-heading">{title}</div><ClassicPanel title="Módulo preparado para ampliación"><div className="siltra-placeholder-workspace"><IconSlot /><div><strong>{title}</strong><p>{text}</p><p>La ventana y navegación ya reproducen la estructura de SILTRA. La lógica se conectará con los futuros ficheros de AulaNomina.</p></div></div></ClassicPanel></div>;
}

function DocumentsWorkspace({ documentType }) {
  return <div className="siltra-workspace"><div className="siltra-workspace-heading">Impresión de documentos {documentType}</div><ClassicPanel title={`Documentos ${documentType}`}><div className="siltra-placeholder-workspace"><IconSlot /><div><strong>Bandeja de impresión simulada</strong><p>Este espacio queda reservado para los documentos {documentType} que se generen o reciban durante la práctica.</p></div></div></ClassicPanel></div>;
}

function SiltraDesktopWindow({ onClose }) {
  const [screen, setScreen] = useState(initialScreen);
  const [documentType, setDocumentType] = useState("RNT");
  const [companies, setCompanies] = useState([]);
  const [companiesError, setCompaniesError] = useState("");
  const [config, setConfig] = useState(loadConfig);
  const [configSaved, setConfigSaved] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [dirtyUpload, setDirtyUpload] = useState(false);
  const [remittanceState, setRemittanceState] = useState(initialRemittanceState);

  const requestClose = useCallback(() => {
    if (dirtyUpload && !window.confirm("Existe un fichero local seleccionado que todavía no se ha validado. ¿Desea cerrar SILTRA y descartarlo?")) return;
    onClose();
  }, [dirtyUpload, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [requestClose]);

  useEffect(() => {
    fetchCompanies().then((data) => setCompanies(data || [])).catch((error) => setCompaniesError(error.message || "No se han podido cargar las empresas"));
  }, []);

  const navigate = (target) => {
    setConfigSaved(false);
    setScreen(target);
    window.sessionStorage.setItem(LAST_SCREEN_KEY, target);
  };

  const openDocument = (type) => {
    setDocumentType(type);
    navigate("documents");
  };

  const saveConfig = () => {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    setConfigSaved(true);
    window.setTimeout(() => setConfigSaved(false), 1800);
  };

  const navItems = [["home", "⌂", "Inicio"], ["cotizacion", "Cotización", "Cotización"], ["affiliation", "Afiliación/INSS", "Afiliación/INSS"], ["communications", "Comunicaciones", "Comunicaciones"], ["utilities", "Utilidades", "Utilidades"], ["config", "Configuración", "Configuración"], ["about", "Acerca de", "Acerca de"]];

  if (minimized) {
    return (
      <div className="siltra-modal-overlay siltra-modal-overlay--minimized" role="presentation">
        <section className="siltra-minimized-window" role="dialog" aria-label="SILTRA simulado minimizado">
          <div><img src={siltraLogo} alt="" /><strong>SILTRA Versión 2.2.0</strong><span>Entorno educativo</span></div>
          <button type="button" onClick={() => setMinimized(false)}>Restaurar</button>
          <button type="button" onClick={requestClose}>×</button>
        </section>
      </div>
    );
  }

  return (
    <div className="siltra-modal-overlay" role="presentation">
      <section className={`siltra-window ${maximized ? "siltra-window--maximized" : ""}`} role="dialog" aria-modal="true" aria-label="SILTRA simulado">
        <div className="siltra-window-titlebar">
          <div className="siltra-window-titlebar__title"><img src={siltraLogo} alt="" /> SILTRA Versión 2.2.0 - AulaNomina</div>
          <div className="siltra-window-controls"><button type="button" onClick={() => setMinimized(true)} aria-label="Minimizar">—</button><button type="button" onClick={() => setMaximized((value) => !value)} aria-label={maximized ? "Restaurar tamaño" : "Maximizar"}>{maximized ? "❐" : "□"}</button><button type="button" onClick={requestClose} aria-label="Cerrar">×</button></div>
        </div>
        <nav className="siltra-main-menu" aria-label="Menú SILTRA">{navItems.map(([id, label, title]) => <button key={id} type="button" title={title} className={screen === id || (id === "cotizacion" && screen === "documents") ? "is-active" : ""} onClick={() => navigate(id)}>{label}</button>)}</nav>
        <div className="siltra-education-strip"><strong>SILTRA SIMULADO · ENTORNO EDUCATIVO</strong><span>Sin conexión con TGSS, Sistema RED ni servicios públicos.</span></div>
        <div className="siltra-window-content">
          {companiesError && <div className="siltra-message siltra-message--error">{companiesError}</div>}
          {screen === "home" && <SiltraHome onNavigate={navigate} onDocument={openDocument} />}
          {screen === "cotizacion" && <RemittanceWorkspace companies={companies} config={config} remittanceState={remittanceState} setRemittanceState={setRemittanceState} onDirtyChange={setDirtyUpload} onOpenCommunications={() => navigate("communications")} />}
          {screen === "communications" && <CommunicationsWorkspace companies={companies} />}
          {screen === "config" && <ConfigurationWorkspace config={config} setConfig={setConfig} onSave={saveConfig} />}
          {screen === "documents" && <DocumentsWorkspace documentType={documentType} />}
          {screen === "affiliation" && <PlaceholderWorkspace title="Procesar remesas Afiliación" text="Espacio reservado para AFI, altas, bajas, variaciones y respuestas de afiliación." />}
          {screen === "inss" && <PlaceholderWorkspace title="Procesar remesas INSS" text="Espacio reservado para ficheros FDI, FIE y comunicaciones de prestaciones." />}
          {screen === "utilities" && <PlaceholderWorkspace title="Utilidades" text="Reconstrucción de seguimiento, copias de seguridad y procesamiento de mensajes." />}
          {screen === "about" && <PlaceholderWorkspace title="Acerca de SILTRA simulado" text="Reproducción educativa integrada en AulaNomina. No conecta con TGSS ni realiza presentaciones oficiales." />}
        </div>
        <div className="siltra-window-statusbar"><div className="siltra-status-logo"><img src={siltraLogo} alt="" /><span>Entorno de prácticas AulaNomina · Sin conexión con TGSS</span></div><div className="siltra-status-progress"><span style={{ width: screen === "config" ? "80%" : "100%" }} /></div>{configSaved && <strong>Configuración guardada</strong>}<button type="button" className="siltra-exit-button" onClick={requestClose} title="Cerrar SILTRA">×</button></div>
      </section>
    </div>
  );
}

export default function SiltraGlobalLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="siltra-global-launcher" title="Abrir SILTRA simulado" aria-label="Abrir SILTRA simulado" onClick={() => setOpen(true)}>
        <img src={siltraLogo} alt="" aria-hidden="true" /><span>SILTRA</span>
      </button>
      {open && createPortal(<SiltraDesktopWindow onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
