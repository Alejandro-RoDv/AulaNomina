import { Fragment, useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import {
  confirmSocialSecuritySettlement,
  fetchCommunicationFile,
  fetchCommunicationFiles,
  fetchCompanyCccOptions,
  fetchSocialSecuritySettlement,
  fetchSocialSecuritySettlements,
  generateSocialSecuritySettlement,
  prepareSocialSecuritySettlement,
} from "../services/socialSecurityApi";
import {
  canConfirmSettlement,
  canGenerateSettlement,
  communicationStatusLabel,
  countSettlementIssues,
  downloadCommunicationContent,
  formatDateTime,
  formatMoney,
  formatPeriod,
  getSettlementIssues,
  settlementStatusLabel,
} from "../utils/socialSecuritySettlement";

const currentDate = new Date();
const DEFAULT_MONTH = String(currentDate.getMonth() + 1);
const DEFAULT_YEAR = String(currentDate.getFullYear());

function StatusBadge({ status, communication = false }) {
  const palette = {
    DRAFT: ["#f1f5f9", "#475569"],
    VALIDATING: ["#eef4ff", "#2458c5"],
    VALIDATION_ERROR: ["#fff1f2", "#b42318"],
    READY: ["#fff8e7", "#9a6700"],
    CONFIRMED: ["#eef4ff", "#2458c5"],
    GENERATED: ["#edf8f1", "#18794e"],
    SENT: ["#eef4ff", "#2458c5"],
    PROCESSING: ["#eef4ff", "#2458c5"],
    ACCEPTED: ["#edf8f1", "#18794e"],
    ACCEPTED_WITH_WARNINGS: ["#fff8e7", "#9a6700"],
    REJECTED: ["#fff1f2", "#b42318"],
    CANCELLED: ["#f1f5f9", "#64748b"],
  };
  const [backgroundColor, color] = palette[status] || palette.DRAFT;
  const label = communication ? communicationStatusLabel(status) : settlementStatusLabel(status);
  return <span style={{ ...styles.badge, backgroundColor, color }}>{label}</span>;
}

function SummaryCard({ label, value, accent = false }) {
  return (
    <div style={{ ...styles.summaryCard, ...(accent ? styles.summaryCardAccent : {}) }}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={{ ...styles.summaryValue, ...(accent ? styles.summaryValueAccent : {}) }}>{value}</strong>
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={styles.emptyState}>{children}</div>;
}

function SettlementIssuePanel({ settlement }) {
  const issues = getSettlementIssues(settlement);
  if (!issues.length) {
    return <div style={styles.successPanel}>Sin incidencias de validación. La liquidación está preparada para continuar.</div>;
  }

  const orderedIssues = [...issues].sort((left, right) => {
    const leftWarning = String(left.severity || "ERROR").toUpperCase() === "WARNING";
    const rightWarning = String(right.severity || "ERROR").toUpperCase() === "WARNING";
    if (leftWarning !== rightWarning) return leftWarning ? 1 : -1;
    return String(left.employee_name || "").localeCompare(String(right.employee_name || ""));
  });
  const errors = issues.filter((issue) => String(issue.severity || "ERROR").toUpperCase() !== "WARNING").length;
  const warnings = issues.length - errors;
  const affectedWorkers = new Set(
    issues.map((issue) => issue.employee_name || issue.payroll_id).filter(Boolean)
  ).size;

  return (
    <section style={styles.issuePanel}>
      <div style={styles.validationHeader}>
        <div>
          <h3 style={styles.sectionTitle}>Validaciones</h3>
          <p style={styles.sectionHint}>Corrige los errores antes de confirmar. Las advertencias no bloquean el proceso.</p>
        </div>
        <div style={styles.issueSummary}>
          <span><strong>{errors}</strong> errores</span>
          <span><strong>{warnings}</strong> avisos</span>
          <span><strong>{affectedWorkers}</strong> trabajadores afectados</span>
        </div>
      </div>

      <div style={styles.issueTable}>
        <div style={styles.issueTableHeader}>
          <span>Tipo</span>
          <span>Trabajador</span>
          <span>Validación</span>
          <span>Descripción</span>
        </div>
        {orderedIssues.map((issue, index) => {
          const warning = String(issue.severity || "ERROR").toUpperCase() === "WARNING";
          return (
            <div key={`${issue.code || "issue"}-${issue.payroll_id || "general"}-${index}`} style={styles.issueRow}>
              <span style={warning ? styles.issueSeverityWarning : styles.issueSeverityError}>
                {warning ? "Aviso" : "Error"}
              </span>
              <strong style={styles.issueWorker}>{issue.employee_name || `Nómina ${issue.payroll_id || "general"}`}</strong>
              <span style={styles.issueCode}>{issue.code || "VALIDATION"}</span>
              <span style={styles.issueMessage}>{issue.message || "Validación sin descripción"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SettlementLinesTable({ settlement }) {
  const [expanded, setExpanded] = useState({});
  const lines = settlement?.lines || [];

  if (!lines.length) return <EmptyState>No hay trabajadores incluidos en esta liquidación.</EmptyState>;

  return (
    <div style={styles.tableWrapper}>
      <table style={{ ...styles.table, minWidth: "1080px" }}>
        <thead>
          <tr>
            <th style={styles.th}>Trabajador</th>
            <th style={styles.th}>NAF</th>
            <th style={styles.th}>Grupo</th>
            <th style={styles.thRight}>Días</th>
            <th style={styles.thRight}>Base CC</th>
            <th style={styles.thRight}>Base CP</th>
            <th style={styles.thRight}>Cuota trabajador</th>
            <th style={styles.thRight}>Cuota empresa</th>
            <th style={styles.thRight}>Total</th>
            <th style={styles.th}>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const isExpanded = Boolean(expanded[line.id]);
            const lineIssues = Array.isArray(line.validation_errors) ? line.validation_errors : [];
            const hasError = lineIssues.some((item) => String(item.severity || "ERROR").toUpperCase() === "ERROR");
            const employeeSecondary = [line.employee_code, line.document].filter(Boolean).join(" · ") || "Sin documento";
            return (
              <Fragment key={line.id}>
                <tr>
                  <td style={{ ...styles.tdStrong, ...(hasError ? styles.tdIssueMarker : {}) }}>
                    {line.employee_name}
                    <small style={styles.cellSecondary}>{employeeSecondary}</small>
                  </td>
                  <td style={styles.td}>{line.naf || <span style={styles.missingValue}>Falta NAF</span>}</td>
                  <td style={styles.td}>{line.contribution_group || <span style={styles.missingValue}>Sin grupo</span>}</td>
                  <td style={styles.tdRight}>{line.contribution_days}</td>
                  <td style={styles.tdRight}>{formatMoney(line.common_contingencies_base)} €</td>
                  <td style={styles.tdRight}>{formatMoney(line.professional_contingencies_base)} €</td>
                  <td style={styles.tdRight}>{formatMoney(line.employee_total)} €</td>
                  <td style={styles.tdRight}>{formatMoney(line.company_total)} €</td>
                  <td style={styles.tdRightStrong}>{formatMoney(line.total_due)} €</td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.tableButton}
                      onClick={() => setExpanded((previous) => ({ ...previous, [line.id]: !previous[line.id] }))}
                    >
                      {isExpanded ? "Cerrar" : "Detalle"}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan="10" style={styles.detailCell}>
                      <div style={styles.detailGrid}>
                        <div><span>Base desempleo</span><strong>{formatMoney(line.unemployment_training_fogasa_base)} €</strong></div>
                        <div><span>Bonif. / reducciones</span><strong>{formatMoney(Number(line.bonuses || 0) + Number(line.reductions || 0))} €</strong></div>
                        <div><span>Horas extraordinarias</span><strong>{formatMoney(line.overtime_base)} €</strong></div>
                        <div><span>Trabajador CC</span><strong>{formatMoney(line.employee_common_contingencies)} €</strong></div>
                        <div><span>Trabajador desempleo</span><strong>{formatMoney(line.employee_unemployment)} €</strong></div>
                        <div><span>Trabajador formación</span><strong>{formatMoney(line.employee_training)} €</strong></div>
                        <div><span>Trabajador MEI</span><strong>{formatMoney(line.employee_mei)} €</strong></div>
                        <div><span>Empresa CC</span><strong>{formatMoney(line.company_common_contingencies)} €</strong></div>
                        <div><span>Empresa desempleo</span><strong>{formatMoney(line.company_unemployment)} €</strong></div>
                        <div><span>FOGASA</span><strong>{formatMoney(line.company_fogasa)} €</strong></div>
                        <div><span>Formación empresa</span><strong>{formatMoney(line.company_training)} €</strong></div>
                        <div><span>AT/EP</span><strong>{formatMoney(line.company_at_ep)} €</strong></div>
                        <div><span>MEI empresa</span><strong>{formatMoney(line.company_mei)} €</strong></div>
                        <div><span>Bonificaciones</span><strong>{formatMoney(line.bonuses)} €</strong></div>
                        <div><span>Reducciones</span><strong>{formatMoney(line.reductions)} €</strong></div>
                        <div><span>Estado nómina</span><strong>{line.payroll_status}</strong></div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SocialSecuritySettlementsPage({ companies = [], initialSection = "settlements" }) {
  const [section, setSection] = useState(initialSection);
  const [form, setForm] = useState({
    company_id: "",
    ccc_id: "",
    period_month: DEFAULT_MONTH,
    period_year: DEFAULT_YEAR,
  });
  const [cccOptions, setCccOptions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [communications, setCommunications] = useState([]);
  const [selectedCommunication, setSelectedCommunication] = useState(null);
  const [loadingCcc, setLoadingCcc] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingCommunications, setLoadingCommunications] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active !== false),
    [companies]
  );

  const issueCounts = useMemo(
    () => countSettlementIssues(selectedSettlement),
    [selectedSettlement]
  );

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!form.company_id && activeCompanies.length === 1) {
      setForm((previous) => ({ ...previous, company_id: String(activeCompanies[0].id) }));
    }
  }, [activeCompanies, form.company_id]);

  useEffect(() => {
    const companyId = Number(form.company_id);
    setForm((previous) => ({ ...previous, ccc_id: "" }));
    setCccOptions([]);
    setSelectedSettlement(null);
    setSelectedCommunication(null);
    setError("");
    setSuccess("");

    if (!companyId) {
      setSettlements([]);
      setCommunications([]);
      return undefined;
    }

    let cancelled = false;
    setLoadingCcc(true);
    setLoadingHistory(true);
    setLoadingCommunications(true);

    fetchCompanyCccOptions(companyId)
      .then((data) => {
        if (cancelled) return;
        setCccOptions(data || []);
        if ((data || []).length === 1) {
          setForm((previous) => ({ ...previous, ccc_id: data[0].ccc_id }));
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "No se han podido cargar los CCC");
      })
      .finally(() => {
        if (!cancelled) setLoadingCcc(false);
      });

    fetchSocialSecuritySettlements({ company_id: companyId })
      .then((data) => {
        if (!cancelled) setSettlements(data || []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "No se ha podido cargar el historial");
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    fetchCommunicationFiles({ company_id: companyId, file_type: "SOCIAL_SECURITY_SETTLEMENT" })
      .then((data) => {
        if (!cancelled) setCommunications(data || []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "No se han podido cargar los ficheros");
      })
      .finally(() => {
        if (!cancelled) setLoadingCommunications(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.company_id]);

  const refreshHistory = async (preferredSettlementId = null) => {
    if (!form.company_id) return;
    const history = await fetchSocialSecuritySettlements({ company_id: Number(form.company_id) });
    setSettlements(history || []);
    if (preferredSettlementId) {
      const found = (history || []).find((item) => item.id === preferredSettlementId);
      if (found) setSelectedSettlement(found);
    }
  };

  const refreshCommunications = async (preferredCommunicationId = null) => {
    if (!form.company_id) return;
    const files = await fetchCommunicationFiles({
      company_id: Number(form.company_id),
      file_type: "SOCIAL_SECURITY_SETTLEMENT",
    });
    setCommunications(files || []);
    if (preferredCommunicationId) {
      const found = (files || []).find((item) => item.id === preferredCommunicationId);
      if (found) setSelectedCommunication(found);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handlePrepare = async (event) => {
    if (event) event.preventDefault();
    if (!form.company_id || !form.ccc_id) {
      setError("Selecciona una empresa y un CCC antes de preparar la liquidación.");
      return;
    }

    setBusyAction("prepare");
    setError("");
    setSuccess("");
    try {
      const settlement = await prepareSocialSecuritySettlement({
        company_id: Number(form.company_id),
        ccc_id: form.ccc_id,
        period_month: Number(form.period_month),
        period_year: Number(form.period_year),
      });
      setSelectedSettlement(settlement);
      const counts = countSettlementIssues(settlement);
      setSuccess(
        settlement.status === "READY"
          ? `Liquidación preparada: ${settlement.worker_count} trabajador(es), ${counts.warnings} advertencia(s).`
          : `Liquidación preparada con ${counts.errors} error(es) y ${counts.warnings} advertencia(s).`
      );
      await refreshHistory(settlement.id);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido preparar la liquidación");
    } finally {
      setBusyAction("");
    }
  };

  const handleSelectSettlement = async (settlementId) => {
    setBusyAction(`load-${settlementId}`);
    setError("");
    setSuccess("");
    try {
      const settlement = await fetchSocialSecuritySettlement(settlementId);
      setSelectedSettlement(settlement);
      setForm({
        company_id: String(settlement.company_id),
        ccc_id: settlement.ccc_id,
        period_month: String(settlement.period_month),
        period_year: String(settlement.period_year),
      });
      setSection("settlements");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir la liquidación");
    } finally {
      setBusyAction("");
    }
  };

  const handleConfirm = async () => {
    if (!selectedSettlement) return;
    setBusyAction("confirm");
    setError("");
    setSuccess("");
    try {
      const settlement = await confirmSocialSecuritySettlement(selectedSettlement.id);
      setSelectedSettlement(settlement);
      setSuccess("Liquidación confirmada. Ya puede generarse el fichero.");
      await refreshHistory(settlement.id);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido confirmar la liquidación");
    } finally {
      setBusyAction("");
    }
  };

  const handleGenerate = async () => {
    if (!selectedSettlement) return;
    setBusyAction("generate");
    setError("");
    setSuccess("");
    try {
      const settlement = await generateSocialSecuritySettlement(selectedSettlement.id);
      setSelectedSettlement(settlement);
      let communication = null;
      if (settlement.communication_file_id) {
        communication = await fetchCommunicationFile(settlement.communication_file_id);
        setSelectedCommunication(communication);
      }
      setSuccess("Fichero de liquidación generado y guardado en Comunicaciones.");
      await Promise.all([
        refreshHistory(settlement.id),
        refreshCommunications(settlement.communication_file_id),
      ]);
      if (communication) downloadCommunicationContent(communication);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido generar el fichero");
    } finally {
      setBusyAction("");
    }
  };

  const handleOpenCommunication = async (communicationId) => {
    setBusyAction(`communication-${communicationId}`);
    setError("");
    try {
      const communication = await fetchCommunicationFile(communicationId);
      setSelectedCommunication(communication);
      setSection("communications");
    } catch (requestError) {
      setError(requestError.message || "No se ha podido abrir el fichero");
    } finally {
      setBusyAction("");
    }
  };

  const handleDownloadCommunication = async (communication) => {
    setError("");
    try {
      const fullCommunication = communication?.content
        ? communication
        : await fetchCommunicationFile(communication.id);
      downloadCommunicationContent(fullCommunication);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido descargar el fichero");
    }
  };

  const selectedCompany = activeCompanies.find((company) => String(company.id) === String(form.company_id));
  const selectedCcc = cccOptions.find((option) => option.ccc_id === form.ccc_id);
  const busy = Boolean(busyAction);

  return (
    <div style={styles.page}>
      <nav style={styles.tabs} aria-label="Secciones de cotización">
        <button type="button" style={section === "settlements" ? styles.tabActive : styles.tab} onClick={() => setSection("settlements")}>
          Liquidaciones
        </button>
        <button type="button" style={section === "communications" ? styles.tabActive : styles.tab} onClick={() => setSection("communications")}>
          Ficheros generados
        </button>
      </nav>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {success && <div style={styles.successBanner}>{success}</div>}

      {section === "settlements" && (
        <>
          <PageCard
            title="Preparar liquidación"
            subtitle="Selecciona empresa, CCC y periodo. AulaNomina agrupa las nóminas y valida la información antes de confirmar."
          >
            <form onSubmit={handlePrepare} style={styles.form}>
              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span>Empresa</span>
                  <select name="company_id" value={form.company_id} onChange={handleFormChange} style={styles.input}>
                    <option value="">Selecciona empresa</option>
                    {activeCompanies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </label>

                <label style={styles.fieldWide}>
                  <span>CCC</span>
                  <select name="ccc_id" value={form.ccc_id} onChange={handleFormChange} style={styles.input} disabled={!form.company_id || loadingCcc}>
                    <option value="">{loadingCcc ? "Cargando CCC..." : "Selecciona CCC"}</option>
                    {cccOptions.map((option) => (
                      <option key={option.ccc_id} value={option.ccc_id}>{option.label}</option>
                    ))}
                  </select>
                  {form.company_id && !loadingCcc && cccOptions.length === 0 && (
                    <small style={styles.fieldError}>La empresa no tiene CCC configurados.</small>
                  )}
                </label>

                <label style={styles.fieldSmall}>
                  <span>Mes</span>
                  <select name="period_month" value={form.period_month} onChange={handleFormChange} style={styles.input}>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <option key={month} value={month}>{String(month).padStart(2, "0")}</option>
                    ))}
                  </select>
                </label>

                <label style={styles.fieldSmall}>
                  <span>Año</span>
                  <input name="period_year" type="number" min="2000" max="2100" value={form.period_year} onChange={handleFormChange} style={styles.input} />
                </label>
              </div>

              <div style={styles.formFooter}>
                <div style={styles.contextText}>
                  <strong>{selectedCompany?.name || "Selecciona una empresa"}</strong>
                  <span>{selectedCcc?.label || "Elige un CCC para recuperar las nóminas del periodo."}</span>
                </div>
                <button type="submit" disabled={busy || !form.company_id || !form.ccc_id} style={styles.primaryButton}>
                  {busyAction === "prepare" ? "Preparando..." : selectedSettlement ? "Recalcular liquidación" : "Preparar liquidación"}
                </button>
              </div>
            </form>
          </PageCard>

          {selectedSettlement && (
            <PageCard
              title={`Liquidación ${formatPeriod(selectedSettlement.period_year, selectedSettlement.period_month)} · ${selectedSettlement.ccc_id}`}
              subtitle={`Preparada ${formatDateTime(selectedSettlement.prepared_at)} · ${selectedCompany?.name || `Empresa ${selectedSettlement.company_id}`}`}
            >
              <div style={styles.settlementHeader}>
                <div style={styles.statusBlock}>
                  <StatusBadge status={selectedSettlement.status} />
                  <span>{issueCounts.errors} errores · {issueCounts.warnings} advertencias</span>
                </div>
                <div style={styles.actionRow}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    disabled={busy || !["DRAFT", "VALIDATION_ERROR", "READY"].includes(selectedSettlement.status)}
                    onClick={() => handlePrepare()}
                  >
                    Recalcular
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    disabled={busy || !canConfirmSettlement(selectedSettlement)}
                    onClick={handleConfirm}
                  >
                    {busyAction === "confirm" ? "Confirmando..." : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    disabled={busy || !canGenerateSettlement(selectedSettlement)}
                    onClick={handleGenerate}
                  >
                    {busyAction === "generate" ? "Generando..." : "Generar fichero"}
                  </button>
                  {selectedSettlement.communication_file_id && (
                    <button type="button" style={styles.secondaryButton} onClick={() => handleOpenCommunication(selectedSettlement.communication_file_id)}>
                      Ver fichero
                    </button>
                  )}
                </div>
              </div>

              <div style={styles.summaryGrid}>
                <SummaryCard label="Trabajadores" value={selectedSettlement.worker_count} />
                <SummaryCard label="Días cotizados" value={selectedSettlement.contribution_days} />
                <SummaryCard label="Base CC" value={`${formatMoney(selectedSettlement.common_contingencies_base)} €`} />
                <SummaryCard label="Base CP" value={`${formatMoney(selectedSettlement.professional_contingencies_base)} €`} />
                <SummaryCard label="Cuota trabajadores" value={`${formatMoney(selectedSettlement.employee_total)} €`} />
                <SummaryCard label="Cuota empresa" value={`${formatMoney(selectedSettlement.company_total)} €`} />
                <SummaryCard label="Bonificaciones" value={`${formatMoney(selectedSettlement.bonuses)} €`} />
                <SummaryCard label="Reducciones" value={`${formatMoney(selectedSettlement.reductions)} €`} />
                <SummaryCard label="Total a ingresar" value={`${formatMoney(selectedSettlement.total_due)} €`} accent />
              </div>

              <SettlementIssuePanel settlement={selectedSettlement} />

              <section style={styles.sectionBlock}>
                <div style={styles.sectionHeadingRow}>
                  <div>
                    <h3 style={styles.sectionTitle}>Trabajadores incluidos</h3>
                    <p style={styles.sectionHint}>Importes calculados a partir de las nóminas incluidas cuando se preparó la liquidación.</p>
                  </div>
                </div>
                <SettlementLinesTable settlement={selectedSettlement} />
              </section>
            </PageCard>
          )}

          <PageCard title="Historial de liquidaciones" subtitle="Consulta liquidaciones anteriores y vuelve a abrir su detalle cuando sea necesario.">
            {loadingHistory ? (
              <EmptyState>Cargando historial...</EmptyState>
            ) : settlements.length === 0 ? (
              <EmptyState>{form.company_id ? "La empresa no tiene liquidaciones preparadas." : "Selecciona una empresa para consultar su historial."}</EmptyState>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={{ ...styles.table, minWidth: "980px" }}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Periodo</th>
                      <th style={styles.th}>CCC</th>
                      <th style={styles.th}>Estado</th>
                      <th style={styles.thRight}>Trabajadores</th>
                      <th style={styles.thRight}>Cuota trabajador</th>
                      <th style={styles.thRight}>Cuota empresa</th>
                      <th style={styles.thRight}>Total</th>
                      <th style={styles.th}>Actualización</th>
                      <th style={styles.th}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((settlement) => (
                      <tr key={settlement.id}>
                        <td style={styles.tdStrong}>{formatPeriod(settlement.period_year, settlement.period_month)}</td>
                        <td style={styles.td}>{settlement.ccc_id}</td>
                        <td style={styles.td}><StatusBadge status={settlement.status} /></td>
                        <td style={styles.tdRight}>{settlement.worker_count}</td>
                        <td style={styles.tdRight}>{formatMoney(settlement.employee_total)} €</td>
                        <td style={styles.tdRight}>{formatMoney(settlement.company_total)} €</td>
                        <td style={styles.tdRightStrong}>{formatMoney(settlement.total_due)} €</td>
                        <td style={styles.td}>{formatDateTime(settlement.updated_at)}</td>
                        <td style={styles.td}>
                          <button type="button" style={styles.tableButton} disabled={busy} onClick={() => handleSelectSettlement(settlement.id)}>
                            {busyAction === `load-${settlement.id}` ? "Abriendo..." : "Abrir"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageCard>
        </>
      )}

      {section === "communications" && (
        <>
          <PageCard title="Ficheros de liquidación" subtitle="Consulta y descarga los ficheros generados desde liquidaciones confirmadas.">
            <div style={styles.communicationFilter}>
              <label style={styles.fieldWide}>
                <span>Empresa</span>
                <select name="company_id" value={form.company_id} onChange={handleFormChange} style={styles.input}>
                  <option value="">Selecciona empresa</option>
                  {activeCompanies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </label>
              <button type="button" style={styles.secondaryButton} disabled={!form.company_id || loadingCommunications} onClick={() => refreshCommunications()}>
                {loadingCommunications ? "Cargando..." : "Actualizar"}
              </button>
            </div>

            {loadingCommunications ? (
              <EmptyState>Cargando ficheros...</EmptyState>
            ) : communications.length === 0 ? (
              <EmptyState>{form.company_id ? "No hay ficheros de liquidación generados." : "Selecciona una empresa para consultar los ficheros."}</EmptyState>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={{ ...styles.table, minWidth: "1050px" }}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Nombre</th>
                      <th style={styles.th}>Periodo</th>
                      <th style={styles.th}>CCC</th>
                      <th style={styles.th}>Estado</th>
                      <th style={styles.th}>Generado</th>
                      <th style={styles.thRight}>Trabajadores</th>
                      <th style={styles.thRight}>Total</th>
                      <th style={styles.th}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {communications.map((communication) => (
                      <tr key={communication.id}>
                        <td style={styles.tdStrong}>{communication.original_filename || `Comunicación ${communication.id}`}</td>
                        <td style={styles.td}>{communication.period}</td>
                        <td style={styles.td}>{communication.ccc_id || "-"}</td>
                        <td style={styles.td}><StatusBadge status={communication.status} communication /></td>
                        <td style={styles.td}>{formatDateTime(communication.generated_at)}</td>
                        <td style={styles.tdRight}>{communication.metadata?.worker_count ?? "-"}</td>
                        <td style={styles.tdRightStrong}>{communication.metadata?.total_due ? `${formatMoney(communication.metadata.total_due)} €` : "-"}</td>
                        <td style={styles.td}>
                          <div style={styles.inlineActions}>
                            <button type="button" style={styles.tableButton} onClick={() => handleOpenCommunication(communication.id)}>Ver</button>
                            <button type="button" style={styles.tableButton} onClick={() => handleDownloadCommunication(communication)}>Descargar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageCard>

          {selectedCommunication && (
            <PageCard title={selectedCommunication.original_filename || `Comunicación ${selectedCommunication.id}`} subtitle={`Periodo ${selectedCommunication.period} · CCC ${selectedCommunication.ccc_id || "-"}`}>
              <div style={styles.fileHeader}>
                <div style={styles.statusBlock}>
                  <StatusBadge status={selectedCommunication.status} communication />
                  <span>Generado {formatDateTime(selectedCommunication.generated_at)}</span>
                </div>
                <button type="button" style={styles.primaryButton} onClick={() => handleDownloadCommunication(selectedCommunication)}>Descargar fichero</button>
              </div>
              <div style={styles.fileMetadata}>
                <span><strong>Tipo</strong>{selectedCommunication.file_type}</span>
                <span><strong>Liquidación</strong>{selectedCommunication.metadata?.settlement_id || "-"}</span>
                <span><strong>Trabajadores</strong>{selectedCommunication.metadata?.worker_count ?? "-"}</span>
                <span><strong>Total</strong>{selectedCommunication.metadata?.total_due ? `${formatMoney(selectedCommunication.metadata.total_due)} €` : "-"}</span>
              </div>
              <pre style={styles.codePreview}>{selectedCommunication.content || "El fichero no contiene contenido."}</pre>
            </PageCard>
          )}
        </>
      )}
    </div>
  );
}

const baseButton = {
  minHeight: "36px",
  borderRadius: "6px",
  padding: "7px 12px",
  cursor: "pointer",
  fontWeight: 750,
  fontSize: "12px",
};

const severityBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "54px",
  borderRadius: "999px",
  padding: "2px 6px",
  fontSize: "9px",
  fontWeight: 800,
  lineHeight: 1.4,
};

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "16px" },
  tabs: { display: "flex", alignItems: "flex-end", gap: "24px", borderBottom: "1px solid #dbe3ed" },
  tab: { border: 0, borderBottom: "2px solid transparent", backgroundColor: "transparent", color: "#60708a", padding: "9px 0 10px", cursor: "pointer", fontSize: "12px", fontWeight: 750 },
  tabActive: { border: 0, borderBottom: "2px solid #2563eb", backgroundColor: "transparent", color: "#1d4ed8", padding: "9px 0 10px", cursor: "pointer", fontSize: "12px", fontWeight: 800 },
  errorBanner: { border: "1px solid #fecaca", borderLeft: "3px solid #dc2626", borderRadius: "6px", backgroundColor: "#fff7f7", color: "#991b1b", padding: "10px 12px", fontWeight: 700, fontSize: "12px" },
  successBanner: { border: "1px solid #bbf7d0", borderLeft: "3px solid #16a34a", borderRadius: "6px", backgroundColor: "#f7fcf8", color: "#166534", padding: "10px 12px", fontWeight: 700, fontSize: "12px" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  formGrid: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(300px, 1.5fr) 100px 120px", gap: "10px", alignItems: "start" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#46546b", fontSize: "11px", fontWeight: 750 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "5px", color: "#46546b", fontSize: "11px", fontWeight: 750, minWidth: "280px" },
  fieldSmall: { display: "flex", flexDirection: "column", gap: "5px", color: "#46546b", fontSize: "11px", fontWeight: 750 },
  input: { border: "1px solid #cbd6e3", borderRadius: "6px", padding: "8px 10px", backgroundColor: "#ffffff", color: "#172033", fontSize: "13px", minHeight: "38px" },
  fieldError: { color: "#b42318", fontWeight: 650, fontSize: "10px" },
  formFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", borderTop: "1px solid #e4e9f0", paddingTop: "12px" },
  contextText: { display: "flex", flexDirection: "column", gap: "2px", color: "#738199", fontSize: "11px" },
  primaryButton: { ...baseButton, backgroundColor: "#2563eb", color: "#ffffff", border: "1px solid #2563eb" },
  secondaryButton: { ...baseButton, backgroundColor: "#ffffff", color: "#344258", border: "1px solid #cbd6e3" },
  settlementHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "14px" },
  statusBlock: { display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", color: "#738199", fontSize: "11px", fontWeight: 600 },
  badge: { display: "inline-flex", alignItems: "center", borderRadius: "999px", padding: "3px 7px", fontSize: "10px", fontWeight: 750, whiteSpace: "nowrap" },
  actionRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 0, marginBottom: "16px", border: "1px solid #dbe3ed", borderRadius: "7px", overflow: "hidden" },
  summaryCard: { borderRight: "1px solid #e4e9f0", backgroundColor: "#ffffff", padding: "10px 11px", display: "flex", flexDirection: "column", gap: "3px", minHeight: "64px" },
  summaryCardAccent: { backgroundColor: "#f4f8ff", boxShadow: "inset 3px 0 0 #2563eb" },
  summaryLabel: { color: "#738199", fontSize: "9px", fontWeight: 750 },
  summaryValue: { color: "#172033", fontSize: "17px", lineHeight: 1.2 },
  summaryValueAccent: { color: "#1d4ed8" },
  issuePanel: { border: "1px solid #dbe3ed", borderRadius: "7px", backgroundColor: "#ffffff", marginBottom: "18px", overflow: "hidden" },
  successPanel: { border: "1px solid #d7eadf", borderLeft: "3px solid #2f8f5b", borderRadius: "6px", backgroundColor: "#f8fcf9", color: "#276749", padding: "10px 12px", marginBottom: "16px", fontWeight: 650, fontSize: "11px" },
  validationHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "11px 12px", borderBottom: "1px solid #e4e9f0", backgroundColor: "#fbfcfe", flexWrap: "wrap" },
  issueSummary: { display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", color: "#738199", fontSize: "10px" },
  issueTable: { overflowX: "auto" },
  issueTableHeader: { minWidth: "850px", display: "grid", gridTemplateColumns: "70px 170px 220px minmax(320px, 1fr)", gap: "10px", alignItems: "center", padding: "7px 10px", backgroundColor: "#f1f4f8", color: "#5b687d", borderBottom: "1px solid #dbe3ed", fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" },
  issueRow: { minWidth: "850px", display: "grid", gridTemplateColumns: "70px 170px 220px minmax(320px, 1fr)", gap: "10px", alignItems: "center", padding: "7px 10px", borderBottom: "1px solid #edf0f4", color: "#344258", fontSize: "10px" },
  issueSeverityError: { ...severityBase, backgroundColor: "#fff1f2", color: "#b42318" },
  issueSeverityWarning: { ...severityBase, backgroundColor: "#fff8e7", color: "#9a6700" },
  issueWorker: { color: "#263248", fontSize: "10px", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  issueCode: { color: "#5d6980", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  issueMessage: { color: "#536176", minWidth: 0 },
  sectionBlock: { display: "flex", flexDirection: "column", gap: "10px" },
  sectionHeadingRow: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start" },
  sectionTitle: { margin: 0, color: "#172033", fontSize: "14px", fontWeight: 800 },
  sectionHint: { margin: "3px 0 0", color: "#738199", fontSize: "11px", fontWeight: 500 },
  tableWrapper: { overflowX: "auto", border: "1px solid #dbe3ed", borderRadius: "7px" },
  table: { width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff" },
  th: { padding: "7px 8px", textAlign: "left", backgroundColor: "#f1f4f8", color: "#4b5870", borderBottom: "1px solid #cbd6e3", fontSize: "9px", fontWeight: 800, whiteSpace: "nowrap" },
  thRight: { padding: "7px 8px", textAlign: "right", backgroundColor: "#f1f4f8", color: "#4b5870", borderBottom: "1px solid #cbd6e3", fontSize: "9px", fontWeight: 800, whiteSpace: "nowrap" },
  td: { padding: "7px 8px", borderBottom: "1px solid #e6ebf1", color: "#344258", fontSize: "10.5px", verticalAlign: "middle" },
  tdStrong: { padding: "7px 8px", borderBottom: "1px solid #e6ebf1", color: "#172033", fontSize: "10.5px", fontWeight: 750, verticalAlign: "middle" },
  tdIssueMarker: { boxShadow: "inset 2px 0 0 #dc2626" },
  tdRight: { padding: "7px 8px", borderBottom: "1px solid #e6ebf1", color: "#344258", textAlign: "right", fontSize: "10.5px", whiteSpace: "nowrap", verticalAlign: "middle" },
  tdRightStrong: { padding: "7px 8px", borderBottom: "1px solid #e6ebf1", color: "#172033", textAlign: "right", fontSize: "10.5px", fontWeight: 750, whiteSpace: "nowrap", verticalAlign: "middle" },
  cellSecondary: { display: "block", marginTop: "2px", color: "#8793a7", fontWeight: 500, fontSize: "8.5px" },
  missingValue: { display: "inline-flex", borderRadius: "999px", backgroundColor: "#fff1f2", color: "#b42318", padding: "2px 6px", fontWeight: 750, fontSize: "9px", whiteSpace: "nowrap" },
  tableButton: { ...baseButton, minHeight: "28px", border: "1px solid #cbd6e3", backgroundColor: "#ffffff", color: "#344258", padding: "4px 8px", fontSize: "9px" },
  detailCell: { padding: "10px 12px", backgroundColor: "#f8fafc", borderBottom: "1px solid #dbe3ed" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "8px" },
  emptyState: { padding: "22px", textAlign: "center", color: "#738199", backgroundColor: "#fbfcfe", border: "1px dashed #cbd5e1", borderRadius: "6px", fontWeight: 600, fontSize: "12px" },
  communicationFilter: { display: "flex", alignItems: "end", gap: "10px", marginBottom: "14px", flexWrap: "wrap" },
  inlineActions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  fileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" },
  fileMetadata: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", border: "1px solid #dbe3ed", borderRadius: "7px", backgroundColor: "#f8fafc", marginBottom: "12px", overflow: "hidden" },
  codePreview: { margin: 0, maxHeight: "520px", overflow: "auto", borderRadius: "7px", backgroundColor: "#111827", color: "#e5e7eb", padding: "14px", fontSize: "11px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" },
};
