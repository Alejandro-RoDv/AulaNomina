import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchCommunicationFiles,
  fetchCommunicationSubmission,
  fetchCommunicationSubmissions,
  submitCommunicationFile,
} from "../services/socialSecurityApi";
import { formatDateTime } from "../utils/socialSecuritySettlement";
import {
  SILTRA_PHASES,
  canSendCommunication,
  countAttemptsByFile,
  groupMessagesBySeverity,
  latestSubmissionByFile,
  sortSubmissionsNewestFirst,
  submissionCounts,
  submissionStatusLabel,
  submissionStatusTone,
} from "../utils/siltraSimulation";

const PHASE_DELAY = 280;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function StatusBadge({ status }) {
  const tone = submissionStatusTone(status);
  return <span style={{ ...styles.badge, ...styles[`badge_${tone}`] }}>{submissionStatusLabel(status)}</span>;
}

function MenuIcon({ children, tone = "neutral" }) {
  return <span style={{ ...styles.menuIcon, ...styles[`menuIcon_${tone}`] }}>{children}</span>;
}

function MenuAction({ icon, title, subtitle, onClick, disabled = false, tone = "neutral" }) {
  return (
    <button type="button" style={styles.menuAction} onClick={onClick} disabled={disabled}>
      <MenuIcon tone={tone}>{icon}</MenuIcon>
      <span style={styles.menuActionText}>
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </button>
  );
}

function SectionRail({ label }) {
  return <div style={styles.sectionRail}>{label}</div>;
}

function SiltraMainMenu({ onOpenOutbox, onOpenHistory }) {
  return (
    <div style={styles.classicGrid}>
      <section style={styles.classicColumn}>
        <div style={styles.classicBlockRow}>
          <SectionRail label="COTIZACIÓN" />
          <div style={styles.classicBlock}>
            <MenuAction
              icon="R"
              tone="red"
              title="Procesar remesas Cotización"
              subtitle="Seleccionar y transmitir ficheros de liquidación"
              onClick={onOpenOutbox}
            />
            <div style={styles.menuSubsection}>
              <strong style={styles.menuSubsectionTitle}>Impresión</strong>
              <span>Documentos RNT</span>
              <span>Documentos RLC</span>
              <span>Documentos DCL</span>
            </div>
          </div>
        </div>

        <div style={styles.classicBlockRow}>
          <SectionRail label="AFILIACIÓN · INSS" />
          <div style={styles.classicBlock}>
            <MenuAction icon="A" tone="red" title="Procesar remesas Afiliación" subtitle="Próximamente en AulaNomina" disabled />
            <MenuAction icon="I" tone="green" title="Procesar remesas INSS" subtitle="Próximamente en AulaNomina" disabled />
          </div>
        </div>

        <div style={styles.classicBlockRow}>
          <SectionRail label="CONFIG." />
          <div style={styles.classicBlock}>
            <MenuAction icon="⚙" title="Configuración" subtitle="Entorno educativo administrado por AulaNomina" disabled />
          </div>
        </div>
      </section>

      <section style={styles.classicColumn}>
        <div style={styles.classicBlockRow}>
          <SectionRail label="COMUNICACIONES" />
          <div style={styles.classicBlock}>
            <MenuAction icon="✉" tone="sand" title="Envío / Recepción" subtitle="Abrir bandeja de ficheros pendientes" onClick={onOpenOutbox} />
            <div style={styles.menuSubsection}>
              <button type="button" style={styles.textAction} onClick={onOpenHistory}>Consulta de envíos Cotización</button>
              <button type="button" style={styles.textAction} disabled>Consulta de envíos Afiliación/INSS</button>
              <button type="button" style={styles.textAction} onClick={onOpenHistory}>Seguimiento de liquidaciones</button>
            </div>
            <MenuAction icon="⇅" title="Buzón de Entrada / Salida" subtitle="Consultar respuestas e intentos" onClick={onOpenHistory} />
          </div>
        </div>

        <div style={styles.classicBlockRow}>
          <SectionRail label="UTILIDADES" />
          <div style={styles.classicBlock}>
            <MenuAction icon="↻" tone="red" title="Reconstrucción de seguimiento" subtitle="Recalcula la vista desde el historial conservado" onClick={onOpenHistory} />
            <MenuAction icon="□" title="Copias de seguridad" subtitle="No disponible en la simulación" disabled />
            <MenuAction icon="↓" tone="sand" title="Procesar mensajes descargados" subtitle="Las respuestas se generan internamente" onClick={onOpenHistory} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ProcessingPanel({ activePhase, error }) {
  return (
    <div style={styles.processingPanel}>
      <div style={styles.processingHeader}>
        <div>
          <strong>Procesamiento de remesa</strong>
          <span>Las fases son visuales; la validación se realiza íntegramente en el backend.</span>
        </div>
        <span style={styles.simulationChip}>TGSS SIMULADA</span>
      </div>
      <ol style={styles.phaseList}>
        {SILTRA_PHASES.map((phase, index) => {
          const completed = index < activePhase;
          const current = index === activePhase;
          return (
            <li key={phase} style={{ ...styles.phaseItem, ...(current ? styles.phaseCurrent : {}), ...(completed ? styles.phaseCompleted : {}) }}>
              <span style={styles.phaseNumber}>{completed ? "✓" : index + 1}</span>
              <strong>{phase}</strong>
            </li>
          );
        })}
      </ol>
      {error && <div style={styles.errorBanner}>{error}</div>}
    </div>
  );
}

function MessageGroup({ title, messages, tone }) {
  if (!messages.length) return null;
  return (
    <section style={styles.messageGroup}>
      <h4 style={{ ...styles.messageGroupTitle, ...styles[`messageTitle_${tone}`] }}>{title} ({messages.length})</h4>
      <div style={styles.messageList}>
        {messages.map((message, index) => (
          <article key={`${message.code}-${message.employee_id || "file"}-${index}`} style={{ ...styles.messageCard, ...styles[`messageCard_${tone}`] }}>
            <div style={styles.messageCodeRow}>
              <strong>{message.code} · {message.message}</strong>
              <span>{message.field || "Fichero"}</span>
            </div>
            {(message.employee_name || message.naf || message.payroll_id) && (
              <div style={styles.messageContext}>
                {message.employee_name && <span><strong>Trabajador:</strong> {message.employee_name}</span>}
                {message.naf && <span><strong>NAF:</strong> {message.naf}</span>}
                {message.payroll_id && <span><strong>Nómina:</strong> {message.payroll_id}</span>}
              </div>
            )}
            {message.recommendation && <p style={styles.recommendation}>{message.recommendation}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultPanel({ submission, onDownload, onOpenFile, onOpenSettlement, onBack }) {
  const grouped = groupMessagesBySeverity(submission?.messages || []);
  const source = submission?.source_file;
  if (!submission) return null;

  return (
    <div style={styles.resultPanel}>
      <div style={styles.resultHeader}>
        <div>
          <span style={styles.eyebrow}>Respuesta recibida</span>
          <h3 style={styles.resultTitle}>{submission.submission_number}</h3>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      <div style={styles.resultGrid}>
        <div><span>Intento</span><strong>{submission.attempt_number}</strong></div>
        <div><span>Fichero</span><strong>{source?.original_filename || "-"}</strong></div>
        <div><span>Empresa</span><strong>{submission.company_name || `Empresa ${submission.company_id}`}</strong></div>
        <div><span>CCC</span><strong>{source?.ccc_id || "-"}</strong></div>
        <div><span>Periodo</span><strong>{source?.period || "-"}</strong></div>
        <div><span>Procesado</span><strong>{formatDateTime(submission.processed_at)}</strong></div>
        <div><span>Código principal</span><strong>{submission.response_code || "-"}</strong></div>
        <div><span>Errores / advertencias</span><strong>{submission.error_count} / {submission.warning_count}</strong></div>
      </div>

      <div style={styles.mainResponseMessage}>
        <strong>{submission.response_code || "RESPUESTA"}</strong>
        <span>{submission.response_message || "Procesamiento completado."}</span>
      </div>

      <MessageGroup title="Errores" messages={grouped.errors} tone="danger" />
      <MessageGroup title="Advertencias" messages={grouped.warnings} tone="warning" />
      <MessageGroup title="Mensajes informativos" messages={grouped.information} tone="info" />

      <div style={styles.actionRow}>
        <button type="button" style={styles.primaryButton} disabled={!submission.response_file} onClick={() => onDownload(submission)}>Descargar respuesta</button>
        <button type="button" style={styles.secondaryButton} onClick={() => onOpenFile(source)}>Ver fichero original</button>
        <button type="button" style={styles.secondaryButton} disabled={!submission.settlement_id} onClick={() => onOpenSettlement(submission)}>Abrir liquidación</button>
        <button type="button" style={styles.secondaryButton} onClick={onBack}>Volver a la bandeja</button>
      </div>
    </div>
  );
}

export default function SiltraSimulatorPage({ companies = [], onNavigate }) {
  const [view, setView] = useState("menu");
  const [companyId, setCompanyId] = useState("");
  const [files, setFiles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [busyFileId, setBusyFileId] = useState(null);
  const [activePhase, setActivePhase] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active !== false),
    [companies]
  );

  useEffect(() => {
    const storedCompanyId = window.sessionStorage.getItem("aulanomina:siltraCompanyId");
    if (!companyId && storedCompanyId) setCompanyId(storedCompanyId);
    else if (!companyId && activeCompanies.length > 0) setCompanyId(String(activeCompanies[0].id));
  }, [activeCompanies, companyId]);

  const loadData = useCallback(async () => {
    if (!companyId) {
      setFiles([]);
      setSubmissions([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [fileData, submissionData] = await Promise.all([
        fetchCommunicationFiles({ company_id: Number(companyId), file_type: "SOCIAL_SECURITY_SETTLEMENT" }),
        fetchCommunicationSubmissions({ company_id: Number(companyId), limit: 500 }),
      ]);
      setFiles(fileData || []);
      setSubmissions(submissionData?.items || []);

      const requestedFileId = Number(window.sessionStorage.getItem("aulanomina:siltraFileId") || 0);
      if (requestedFileId) {
        const requestedFile = (fileData || []).find((file) => Number(file.id) === requestedFileId);
        if (requestedFile) {
          setSelectedFile(requestedFile);
          setView("outbox");
        }
        window.sessionStorage.removeItem("aulanomina:siltraFileId");
      }
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cargar SILTRA simulado");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const latestByFile = useMemo(() => latestSubmissionByFile(submissions), [submissions]);
  const attemptsByFile = useMemo(() => countAttemptsByFile(submissions), [submissions]);
  const orderedSubmissions = useMemo(() => sortSubmissionsNewestFirst(submissions), [submissions]);
  const stats = useMemo(() => submissionCounts(submissions), [submissions]);

  const refreshSubmission = async (submissionId) => {
    const detail = await fetchCommunicationSubmission(submissionId);
    setSelectedSubmission(detail);
    return detail;
  };

  const runVisualPhases = async () => {
    for (let index = 0; index < SILTRA_PHASES.length; index += 1) {
      setActivePhase(index);
      await wait(PHASE_DELAY);
    }
  };

  const handleSubmit = async (communication) => {
    if (!canSendCommunication(communication, busyFileId)) return;
    setSelectedFile(communication);
    setBusyFileId(communication.id);
    setSelectedSubmission(null);
    setError("");
    setView("processing");
    setActivePhase(0);

    try {
      const [result] = await Promise.all([
        submitCommunicationFile(communication.id),
        runVisualPhases(),
      ]);
      setSelectedSubmission(result);
      setView("result");
      await loadData();
    } catch (requestError) {
      setError(requestError.message || "No se ha podido completar el envío simulado");
      setView("processing");
    } finally {
      setBusyFileId(null);
    }
  };

  const handleOpenSubmission = async (submissionId) => {
    setLoading(true);
    setError("");
    try {
      await refreshSubmission(submissionId);
      setView("result");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir el intento");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResponse = (submission) => {
    const response = submission?.response_file;
    if (!response?.content) return;
    const blob = new Blob([response.content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.original_filename || `SILTRA-RESP-${submission.submission_number}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleOpenFile = (communication) => {
    if (!communication?.id) return;
    window.sessionStorage.setItem("aulanomina:socialSecurityCommunicationId", String(communication.id));
    window.location.hash = "";
    onNavigate?.("social-security-files");
  };

  const handleOpenSettlement = (submission) => {
    if (!submission?.settlement_id) return;
    window.sessionStorage.setItem("aulanomina:socialSecuritySettlementId", String(submission.settlement_id));
    window.location.hash = "";
    onNavigate?.("social-security-settlements");
  };

  const selectedCompany = activeCompanies.find((company) => String(company.id) === String(companyId));

  return (
    <div style={styles.page}>
      <div style={styles.educationalBanner}>
        <strong>SILTRA simulado · Entorno educativo</strong>
        <span>Sin conexión con TGSS, Sistema RED ni servicios públicos. No genera una presentación oficial.</span>
      </div>

      <div style={styles.windowFrame}>
        <div style={styles.windowTitleBar}>
          <div><span style={styles.appMark}>S</span><strong>AulaNomina SILTRA SIM 1.0</strong></div>
          <span>Empresa: {selectedCompany?.name || "sin seleccionar"}</span>
        </div>
        <nav style={styles.classicTabs}>
          {[
            ["menu", "Inicio"],
            ["outbox", "Cotización"],
            ["history", "Comunicaciones"],
          ].map(([id, label]) => (
            <button key={id} type="button" style={view === id ? styles.classicTabActive : styles.classicTab} onClick={() => setView(id)}>{label}</button>
          ))}
          <button type="button" style={styles.classicTab} disabled>Afiliación/INSS</button>
          <button type="button" style={styles.classicTab} disabled>Utilidades</button>
          <button type="button" style={styles.classicTab} disabled>Configuración</button>
          <button type="button" style={styles.classicTab} disabled>Acerca de</button>
        </nav>

        <div style={styles.classicBody}>
          {view === "menu" && <SiltraMainMenu onOpenOutbox={() => setView("outbox")} onOpenHistory={() => setView("history")} />}
          {view === "processing" && <ProcessingPanel activePhase={activePhase} error={error} />}
          {view === "result" && (
            <ResultPanel
              submission={selectedSubmission}
              onDownload={handleDownloadResponse}
              onOpenFile={handleOpenFile}
              onOpenSettlement={handleOpenSettlement}
              onBack={() => setView("outbox")}
            />
          )}
          {view === "outbox" && (
            <div style={styles.workspace}>
              <div style={styles.workspaceHeader}>
                <div>
                  <span style={styles.eyebrow}>Cotización</span>
                  <h2 style={styles.workspaceTitle}>Bandeja de salida</h2>
                  <p>Ficheros de liquidación disponibles para su transmisión educativa.</p>
                </div>
                <label style={styles.companyField}>
                  <span>Empresa</span>
                  <select
                    value={companyId}
                    onChange={(event) => {
                      setCompanyId(event.target.value);
                      window.sessionStorage.setItem("aulanomina:siltraCompanyId", event.target.value);
                    }}
                    style={styles.input}
                  >
                    <option value="">Selecciona empresa</option>
                    {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                </label>
              </div>

              {error && <div style={styles.errorBanner}>{error}</div>}
              {loading ? (
                <div style={styles.emptyState}>Cargando bandeja...</div>
              ) : files.length === 0 ? (
                <div style={styles.emptyState}>No hay ficheros de liquidación para la empresa seleccionada.</div>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={{ ...styles.table, minWidth: "1120px" }}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Sel.</th>
                        <th style={styles.th}>Nombre del fichero</th>
                        <th style={styles.th}>Empresa</th>
                        <th style={styles.th}>CCC</th>
                        <th style={styles.th}>Periodo</th>
                        <th style={styles.th}>Generación</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Intentos</th>
                        <th style={styles.th}>Último resultado</th>
                        <th style={styles.th}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file) => {
                        const latest = latestByFile[file.id];
                        return (
                          <tr key={file.id} style={Number(selectedFile?.id) === Number(file.id) ? styles.selectedRow : undefined}>
                            <td style={styles.td}><input type="radio" checked={Number(selectedFile?.id) === Number(file.id)} onChange={() => setSelectedFile(file)} /></td>
                            <td style={styles.tdStrong}>{file.original_filename || `Fichero ${file.id}`}</td>
                            <td style={styles.td}>{selectedCompany?.name || file.company_id}</td>
                            <td style={styles.td}>{file.ccc_id || "-"}</td>
                            <td style={styles.td}>{file.period}</td>
                            <td style={styles.td}>{formatDateTime(file.generated_at)}</td>
                            <td style={styles.td}><span style={styles.fileStatus}>{file.status}</span></td>
                            <td style={styles.td}>{attemptsByFile[file.id] || 0}</td>
                            <td style={styles.td}>{latest ? <StatusBadge status={latest.status} /> : "Sin envíos"}</td>
                            <td style={styles.td}>
                              <div style={styles.inlineActions}>
                                <button type="button" style={styles.tableButton} onClick={() => handleOpenFile(file)}>Ver fichero</button>
                                <button type="button" style={styles.sendButton} disabled={!canSendCommunication(file, busyFileId)} onClick={() => handleSubmit(file)}>
                                  {busyFileId === file.id ? "Enviando..." : latest ? "Reenviar" : "Enviar"}
                                </button>
                                <button type="button" style={styles.tableButton} onClick={() => setView("history")}>Historial</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {view === "history" && (
            <div style={styles.workspace}>
              <div style={styles.workspaceHeader}>
                <div>
                  <span style={styles.eyebrow}>Comunicaciones</span>
                  <h2 style={styles.workspaceTitle}>Historial de envíos</h2>
                  <p>Todos los intentos se conservan de forma independiente.</p>
                </div>
                <div style={styles.statsRow}>
                  <span>Aceptados <strong>{stats.accepted}</strong></span>
                  <span>Advertencias <strong>{stats.warnings}</strong></span>
                  <span>Rechazados <strong>{stats.rejected}</strong></span>
                </div>
              </div>
              {orderedSubmissions.length === 0 ? (
                <div style={styles.emptyState}>Todavía no se han realizado envíos para esta empresa.</div>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={{ ...styles.table, minWidth: "1160px" }}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Número de envío</th>
                        <th style={styles.th}>Fichero</th>
                        <th style={styles.th}>Intento</th>
                        <th style={styles.th}>CCC</th>
                        <th style={styles.th}>Periodo</th>
                        <th style={styles.th}>Envío</th>
                        <th style={styles.th}>Procesamiento</th>
                        <th style={styles.th}>Resultado</th>
                        <th style={styles.th}>Código</th>
                        <th style={styles.th}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedSubmissions.map((submission) => {
                        const file = files.find((item) => Number(item.id) === Number(submission.communication_file_id));
                        return (
                          <tr key={submission.id}>
                            <td style={styles.tdStrong}>{submission.submission_number}</td>
                            <td style={styles.td}>{file?.original_filename || `Fichero ${submission.communication_file_id}`}</td>
                            <td style={styles.td}>{submission.attempt_number}</td>
                            <td style={styles.td}>{file?.ccc_id || "-"}</td>
                            <td style={styles.td}>{file?.period || "-"}</td>
                            <td style={styles.td}>{formatDateTime(submission.submitted_at)}</td>
                            <td style={styles.td}>{formatDateTime(submission.processed_at)}</td>
                            <td style={styles.td}><StatusBadge status={submission.status} /></td>
                            <td style={styles.td}>{submission.response_code || "-"}</td>
                            <td style={styles.td}>
                              <div style={styles.inlineActions}>
                                <button type="button" style={styles.tableButton} onClick={() => handleOpenSubmission(submission.id)}>Ver detalle</button>
                                {file && <button type="button" style={styles.tableButton} disabled={!canSendCommunication(file, busyFileId)} onClick={() => handleSubmit(file)}>Reenviar</button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const baseButton = {
  borderRadius: "5px",
  padding: "8px 11px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: "12px",
};

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "16px" },
  educationalBanner: { border: "2px solid #111111", backgroundColor: "#fff8a6", padding: "12px 15px", display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", fontSize: "13px" },
  windowFrame: { border: "2px solid #8b8b8b", backgroundColor: "#eef2f6", boxShadow: "5px 5px 0 rgba(17,17,17,0.18)" },
  windowTitleBar: { minHeight: "34px", padding: "0 10px", backgroundColor: "#ffffff", borderBottom: "1px solid #9ca3af", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", fontSize: "12px" },
  appMark: { display: "inline-grid", placeItems: "center", width: "18px", height: "18px", marginRight: "7px", backgroundColor: "#dc2626", color: "#ffffff", fontWeight: 900 },
  classicTabs: { display: "flex", alignItems: "stretch", minHeight: "34px", backgroundColor: "#e5e7eb", borderBottom: "1px solid #9ca3af", overflowX: "auto" },
  classicTab: { border: 0, borderRight: "1px solid #b8bec7", backgroundColor: "linear-gradient(#ffffff, #dfe4ea)", color: "#111111", padding: "8px 16px", cursor: "pointer", whiteSpace: "nowrap", fontSize: "12px" },
  classicTabActive: { border: 0, borderRight: "1px solid #b8bec7", backgroundColor: "#ffffff", color: "#111111", padding: "8px 16px", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 900, boxShadow: "inset 0 -3px 0 #dc2626" },
  classicBody: { minHeight: "560px", padding: "14px", backgroundColor: "#edf2f7" },
  classicGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px", alignItems: "start" },
  classicColumn: { display: "flex", flexDirection: "column", gap: "14px" },
  classicBlockRow: { display: "grid", gridTemplateColumns: "34px 1fr", gap: "8px" },
  sectionRail: { borderRadius: "14px", backgroundColor: "#d9e2ef", color: "#0b67c2", fontSize: "11px", fontWeight: 900, letterSpacing: "0.05em", writingMode: "vertical-rl", transform: "rotate(180deg)", display: "grid", placeItems: "center", padding: "10px 6px", minHeight: "110px" },
  classicBlock: { borderRadius: "14px", backgroundColor: "rgba(255,255,255,0.72)", padding: "8px", display: "flex", flexDirection: "column", gap: "5px" },
  menuAction: { width: "100%", border: 0, backgroundColor: "transparent", padding: "7px", display: "grid", gridTemplateColumns: "70px 1fr", gap: "14px", alignItems: "center", textAlign: "left", cursor: "pointer", color: "#111827" },
  menuIcon: { width: "62px", height: "62px", borderRadius: "50%", display: "grid", placeItems: "center", border: "3px solid #ffffff", boxShadow: "0 0 0 1px #aab2bd", backgroundColor: "#d1d5db", color: "#374151", fontSize: "25px", fontWeight: 900 },
  menuIcon_red: { backgroundColor: "#f5eee4", color: "#dc2626" },
  menuIcon_green: { backgroundColor: "#eff6e7", color: "#4d8c28" },
  menuIcon_sand: { backgroundColor: "#f3f0d7", color: "#6b7280" },
  menuIcon_neutral: { backgroundColor: "#e5e7eb", color: "#4b5563" },
  menuActionText: { display: "flex", flexDirection: "column", gap: "3px", fontSize: "14px" },
  menuSubsection: { margin: "2px 0 7px 91px", display: "flex", flexDirection: "column", gap: "9px", fontSize: "13px" },
  menuSubsectionTitle: { fontStyle: "italic", fontSize: "16px" },
  textAction: { padding: 0, border: 0, backgroundColor: "transparent", textAlign: "left", cursor: "pointer", color: "#111827", fontSize: "13px" },
  workspace: { backgroundColor: "#ffffff", border: "1px solid #b8bec7", padding: "16px" },
  workspaceHeader: { display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "end", flexWrap: "wrap", marginBottom: "16px" },
  eyebrow: { color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" },
  workspaceTitle: { margin: "3px 0", fontSize: "21px" },
  companyField: { display: "flex", flexDirection: "column", gap: "5px", minWidth: "280px", fontSize: "12px", fontWeight: 800 },
  input: { minHeight: "38px", border: "1px solid #9ca3af", padding: "8px", backgroundColor: "#ffffff" },
  processingPanel: { backgroundColor: "#ffffff", border: "1px solid #9ca3af", maxWidth: "760px", margin: "32px auto", padding: "22px" },
  processingHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "start", borderBottom: "2px solid #111111", paddingBottom: "13px" },
  simulationChip: { border: "1px solid #92400e", backgroundColor: "#fef3c7", color: "#92400e", padding: "5px 8px", fontSize: "11px", fontWeight: 900 },
  phaseList: { listStyle: "none", padding: 0, margin: "18px 0", display: "flex", flexDirection: "column", gap: "8px" },
  phaseItem: { border: "1px solid #d1d5db", padding: "10px", display: "flex", alignItems: "center", gap: "10px", color: "#6b7280" },
  phaseCurrent: { border: "2px solid #111111", backgroundColor: "#fff8a6", color: "#111111" },
  phaseCompleted: { borderColor: "#86a98a", backgroundColor: "#f0fdf4", color: "#166534" },
  phaseNumber: { width: "24px", height: "24px", borderRadius: "50%", border: "1px solid currentColor", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 900 },
  resultPanel: { backgroundColor: "#ffffff", border: "1px solid #9ca3af", padding: "18px" },
  resultHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", borderBottom: "2px solid #111111", paddingBottom: "12px" },
  resultTitle: { margin: "3px 0 0", fontSize: "22px" },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "8px", margin: "14px 0" },
  mainResponseMessage: { border: "2px solid #111111", backgroundColor: "#f9fafb", padding: "12px", display: "flex", gap: "12px", alignItems: "center", marginBottom: "14px" },
  messageGroup: { marginTop: "14px" },
  messageGroupTitle: { margin: 0, padding: "8px 10px", border: "1px solid #d1d5db", fontSize: "13px" },
  messageTitle_danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  messageTitle_warning: { backgroundColor: "#fef3c7", color: "#92400e" },
  messageTitle_info: { backgroundColor: "#dbeafe", color: "#1e40af" },
  messageList: { display: "flex", flexDirection: "column", gap: "7px", marginTop: "7px" },
  messageCard: { borderLeft: "5px solid #9ca3af", backgroundColor: "#f9fafb", padding: "10px" },
  messageCard_danger: { borderLeftColor: "#dc2626" },
  messageCard_warning: { borderLeftColor: "#d97706" },
  messageCard_info: { borderLeftColor: "#2563eb" },
  messageCodeRow: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" },
  messageContext: { display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "6px", fontSize: "12px", color: "#4b5563" },
  recommendation: { margin: "8px 0 0", fontSize: "12px", color: "#374151" },
  actionRow: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #d1d5db" },
  primaryButton: { ...baseButton, backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827" },
  secondaryButton: { ...baseButton, backgroundColor: "#ffffff", color: "#111827", border: "1px solid #111827" },
  tableWrapper: { overflowX: "auto", border: "1px solid #b8bec7" },
  table: { width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff" },
  th: { padding: "9px", backgroundColor: "#f8f3b5", borderBottom: "2px solid #111111", textAlign: "left", fontSize: "11px", textTransform: "uppercase", whiteSpace: "nowrap" },
  td: { padding: "9px", borderBottom: "1px solid #e5e7eb", fontSize: "12px", verticalAlign: "top" },
  tdStrong: { padding: "9px", borderBottom: "1px solid #e5e7eb", fontSize: "12px", fontWeight: 900, verticalAlign: "top" },
  selectedRow: { backgroundColor: "#fffce0" },
  inlineActions: { display: "flex", gap: "5px", flexWrap: "wrap" },
  tableButton: { ...baseButton, padding: "6px 8px", backgroundColor: "#ffffff", color: "#111827", border: "1px solid #111827" },
  sendButton: { ...baseButton, padding: "6px 8px", backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827" },
  badge: { display: "inline-flex", padding: "4px 7px", borderRadius: "999px", fontSize: "11px", fontWeight: 900, whiteSpace: "nowrap" },
  badge_success: { backgroundColor: "#dcfce7", color: "#166534" },
  badge_warning: { backgroundColor: "#fef3c7", color: "#92400e" },
  badge_danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  badge_info: { backgroundColor: "#dbeafe", color: "#1e40af" },
  badge_neutral: { backgroundColor: "#e5e7eb", color: "#374151" },
  fileStatus: { fontWeight: 800, fontSize: "11px" },
  statsRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  emptyState: { padding: "28px", textAlign: "center", color: "#6b7280", backgroundColor: "#f9fafb", border: "1px dashed #9ca3af", fontWeight: 700 },
  errorBanner: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800, marginBottom: "12px" },
};
