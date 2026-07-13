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
    DRAFT: ["#f3f4f6", "#374151"],
    VALIDATING: ["#dbeafe", "#1d4ed8"],
    VALIDATION_ERROR: ["#fee2e2", "#991b1b"],
    READY: ["#fef3c7", "#92400e"],
    CONFIRMED: ["#dbeafe", "#1e40af"],
    GENERATED: ["#dcfce7", "#166534"],
    SENT: ["#e0e7ff", "#3730a3"],
    PROCESSING: ["#e0f2fe", "#075985"],
    ACCEPTED: ["#dcfce7", "#166534"],
    ACCEPTED_WITH_WARNINGS: ["#fef3c7", "#92400e"],
    REJECTED: ["#fee2e2", "#991b1b"],
    CANCELLED: ["#e5e7eb", "#4b5563"],
  };
  const [backgroundColor, color] = palette[status] || palette.DRAFT;
  const label = communication ? communicationStatusLabel(status) : settlementStatusLabel(status);
  return <span style={{ ...styles.badge, backgroundColor, color }}>{label}</span>;
}

function SummaryCard({ label, value, emphasis = false }) {
  return (
    <div style={{ ...styles.summaryCard, ...(emphasis ? styles.summaryCardEmphasis : {}) }}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={styles.emptyState}>{children}</div>;
}

function SettlementIssuePanel({ settlement }) {
  const issues = getSettlementIssues(settlement);
  if (!issues.length) {
    return <div style={styles.successPanel}>La liquidación no contiene incidencias de validación.</div>;
  }

  return (
    <section style={styles.issuePanel}>
      <div style={styles.sectionHeadingRow}>
        <div>
          <h3 style={styles.sectionTitle}>Validaciones</h3>
          <p style={styles.sectionHint}>Los errores bloquean la confirmación. Las advertencias permiten continuar.</p>
        </div>
      </div>
      <div style={styles.issueList}>
        {issues.map((issue, index) => {
          const warning = String(issue.severity || "ERROR").toUpperCase() === "WARNING";
          return (
            <div key={`${issue.code || "issue"}-${issue.payroll_id || "general"}-${index}`} style={warning ? styles.warningIssue : styles.errorIssue}>
              <strong>{warning ? "Advertencia" : "Error"} · {issue.code || "VALIDATION"}</strong>
              <span>{issue.message || "Validación sin descripción"}</span>
              {(issue.employee_name || issue.payroll_id) && (
                <small>{issue.employee_name || `Nómina ${issue.payroll_id}`}</small>
              )}
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
      <table style={{ ...styles.table, minWidth: "1380px" }}>
        <thead>
          <tr>
            <th style={styles.th}>Trabajador</th>
            <th style={styles.th}>NAF</th>
            <th style={styles.th}>Grupo</th>
            <th style={styles.thRight}>Días</th>
            <th style={styles.thRight}>Base CC</th>
            <th style={styles.thRight}>Base CP</th>
            <th style={styles.thRight}>Base desempleo</th>
            <th style={styles.thRight}>Cuota trabajador</th>
            <th style={styles.thRight}>Cuota empresa</th>
            <th style={styles.thRight}>Bonif./reducc.</th>
            <th style={styles.thRight}>Total</th>
            <th style={styles.th}>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const isExpanded = Boolean(expanded[line.id]);
            const lineIssues = Array.isArray(line.validation_errors) ? line.validation_errors : [];
            return (
              <Fragment key={line.id}>
                <tr style={lineIssues.some((item) => String(item.severity || "ERROR").toUpperCase() === "ERROR") ? styles.rowWithError : undefined}>
                  <td style={styles.tdStrong}>
                    {line.employee_code ? `${line.employee_code} · ` : ""}{line.employee_name}
                    <small style={styles.cellSecondary}>{line.document || "Sin documento"}</small>
                  </td>
                  <td style={styles.td}>{line.naf || <span style={styles.missingValue}>Falta NAF</span>}</td>
                  <td style={styles.td}>{line.contribution_group || <span style={styles.missingValue}>Sin grupo</span>}</td>
                  <td style={styles.tdRight}>{line.contribution_days}</td>
                  <td style={styles.tdRight}>{formatMoney(line.common_contingencies_base)} €</td>
                  <td style={styles.tdRight}>{formatMoney(line.professional_contingencies_base)} €</td>
                  <td style={styles.tdRight}>{formatMoney(line.unemployment_training_fogasa_base)} €</td>
                  <td style={styles.tdRight}>{formatMoney(line.employee_total)} €</td>
                  <td style={styles.tdRight}>{formatMoney(line.company_total)} €</td>
                  <td style={styles.tdRight}>{formatMoney(Number(line.bonuses || 0) + Number(line.reductions || 0))} €</td>
                  <td style={styles.tdRightStrong}>{formatMoney(line.total_due)} €</td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.tableButton}
                      onClick={() => setExpanded((previous) => ({ ...previous, [line.id]: !previous[line.id] }))}
                    >
                      {isExpanded ? "Ocultar" : "Ver"}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan="12" style={styles.detailCell}>
                      <div style={styles.detailGrid}>
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
      <div style={styles.tabs}>
        <button type="button" style={section === "settlements" ? styles.tabActive : styles.tab} onClick={() => setSection("settlements")}>
          Liquidaciones
        </button>
        <button type="button" style={section === "communications" ? styles.tabActive : styles.tab} onClick={() => setSection("communications")}>
          Ficheros generados
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {success && <div style={styles.successBanner}>{success}</div>}

      {section === "settlements" && (
        <>
          <PageCard
            title="Preparar liquidación de Seguridad Social"
            subtitle="Agrupa las nóminas mensuales por empresa y CCC, valida los datos y genera un fichero educativo de liquidación."
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
                  <strong>{selectedCompany?.name || "Sin empresa"}</strong>
                  <span>{selectedCcc?.label || "Selecciona un CCC para recuperar las nóminas"}</span>
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
                    style={styles.confirmButton}
                    disabled={busy || !canConfirmSettlement(selectedSettlement)}
                    onClick={handleConfirm}
                  >
                    {busyAction === "confirm" ? "Confirmando..." : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    style={styles.generateButton}
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
                <SummaryCard label="Base contingencias comunes" value={`${formatMoney(selectedSettlement.common_contingencies_base)} €`} />
                <SummaryCard label="Base contingencias profesionales" value={`${formatMoney(selectedSettlement.professional_contingencies_base)} €`} />
                <SummaryCard label="Cuota trabajadores" value={`${formatMoney(selectedSettlement.employee_total)} €`} />
                <SummaryCard label="Cuota empresa" value={`${formatMoney(selectedSettlement.company_total)} €`} />
                <SummaryCard label="Bonificaciones" value={`${formatMoney(selectedSettlement.bonuses)} €`} />
                <SummaryCard label="Reducciones" value={`${formatMoney(selectedSettlement.reductions)} €`} />
                <SummaryCard label="Total a ingresar" value={`${formatMoney(selectedSettlement.total_due)} €`} emphasis />
              </div>

              <SettlementIssuePanel settlement={selectedSettlement} />

              <section style={styles.sectionBlock}>
                <div style={styles.sectionHeadingRow}>
                  <div>
                    <h3 style={styles.sectionTitle}>Trabajadores incluidos</h3>
                    <p style={styles.sectionHint}>Las cantidades son una fotografía de las nóminas en el momento de preparar la liquidación.</p>
                  </div>
                </div>
                <SettlementLinesTable settlement={selectedSettlement} />
              </section>
            </PageCard>
          )}

          <PageCard title="Historial de liquidaciones" subtitle="Abre una liquidación anterior para revisar sus líneas, validaciones y fichero asociado.">
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

          <PageCard title="Checklist de pruebas" subtitle="Casos mínimos para validar el módulo antes de continuar con SILTRA.">
            <div style={styles.checklistGrid}>
              <div style={styles.checkItem}><strong>1. Caso correcto</strong><span>Nóminas con CCC, NAF y grupo de cotización. Debe quedar READY.</span></div>
              <div style={styles.checkItem}><strong>2. NAF ausente</strong><span>Debe mostrar NAF_REQUIRED y bloquear Confirmar.</span></div>
              <div style={styles.checkItem}><strong>3. Grupo ausente</strong><span>Debe mostrar CONTRIBUTION_GROUP_REQUIRED.</span></div>
              <div style={styles.checkItem}><strong>4. Varios CCC</strong><span>Cada liquidación debe incluir únicamente las nóminas de su CCC.</span></div>
              <div style={styles.checkItem}><strong>5. Confirmación</strong><span>Una liquidación READY debe pasar a CONFIRMED.</span></div>
              <div style={styles.checkItem}><strong>6. Generación</strong><span>Debe crear un fichero, descargarlo y dejar ambos registros en GENERATED.</span></div>
            </div>
          </PageCard>
        </>
      )}

      {section === "communications" && (
        <>
          <PageCard title="Ficheros de liquidación generados" subtitle="Repositorio común de comunicaciones de Seguridad Social generado desde las liquidaciones confirmadas.">
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
                <button type="button" style={styles.generateButton} onClick={() => handleDownloadCommunication(selectedCommunication)}>Descargar fichero</button>
              </div>
              <div style={styles.fileMetadata}>
                <span><strong>Tipo:</strong> {selectedCommunication.file_type}</span>
                <span><strong>Liquidación:</strong> {selectedCommunication.metadata?.settlement_id || "-"}</span>
                <span><strong>Trabajadores:</strong> {selectedCommunication.metadata?.worker_count ?? "-"}</span>
                <span><strong>Total:</strong> {selectedCommunication.metadata?.total_due ? `${formatMoney(selectedCommunication.metadata.total_due)} €` : "-"}</span>
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
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: "13px",
};

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  tabs: { display: "flex", gap: "8px", borderBottom: "2px solid #111111", paddingBottom: "8px" },
  tab: { ...baseButton, backgroundColor: "#ffffff", color: "#111111", border: "1px solid #111111" },
  tabActive: { ...baseButton, backgroundColor: "#f5ef9c", color: "#111111", border: "2px solid #111111" },
  errorBanner: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "12px 14px", fontWeight: 800 },
  successBanner: { border: "2px solid #166534", backgroundColor: "#dcfce7", color: "#14532d", padding: "12px 14px", fontWeight: 800 },
  form: { display: "flex", flexDirection: "column", gap: "18px" },
  formGrid: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(300px, 1.5fr) 110px 130px", gap: "14px", alignItems: "start" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800, minWidth: "280px" },
  fieldSmall: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800 },
  input: { border: "1px solid #9ca3af", borderRadius: "8px", padding: "10px 11px", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", minHeight: "42px" },
  fieldError: { color: "#991b1b", fontWeight: 700 },
  formFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" },
  contextText: { display: "flex", flexDirection: "column", gap: "3px", color: "#4b5563", fontSize: "13px" },
  primaryButton: { ...baseButton, backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827", padding: "12px 18px" },
  secondaryButton: { ...baseButton, backgroundColor: "#ffffff", color: "#111827", border: "1px solid #9ca3af" },
  confirmButton: { ...baseButton, backgroundColor: "#f5ef9c", color: "#111111", border: "2px solid #111111" },
  generateButton: { ...baseButton, backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827" },
  settlementHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "16px" },
  statusBlock: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", color: "#4b5563", fontSize: "13px", fontWeight: 700 },
  badge: { display: "inline-flex", alignItems: "center", borderRadius: "999px", padding: "5px 9px", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
  actionRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", marginBottom: "18px" },
  summaryCard: { border: "1px solid #d1d5db", backgroundColor: "#ffffff", padding: "12px", display: "flex", flexDirection: "column", gap: "5px", minHeight: "68px" },
  summaryCardEmphasis: { border: "2px solid #111111", backgroundColor: "#fff8a6", boxShadow: "3px 3px 0 #111111" },
  summaryLabel: { color: "#6b7280", fontSize: "12px", fontWeight: 800 },
  summaryValue: { color: "#111827", fontSize: "18px" },
  issuePanel: { border: "1px solid #f59e0b", backgroundColor: "#fffbeb", padding: "14px", marginBottom: "18px" },
  successPanel: { border: "1px solid #22c55e", backgroundColor: "#f0fdf4", color: "#166534", padding: "12px", marginBottom: "18px", fontWeight: 800 },
  issueList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px", marginTop: "10px" },
  errorIssue: { borderLeft: "5px solid #dc2626", backgroundColor: "#ffffff", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", color: "#7f1d1d" },
  warningIssue: { borderLeft: "5px solid #d97706", backgroundColor: "#ffffff", padding: "10px", display: "flex", flexDirection: "column", gap: "4px", color: "#78350f" },
  sectionBlock: { display: "flex", flexDirection: "column", gap: "12px" },
  sectionHeadingRow: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start" },
  sectionTitle: { margin: 0, color: "#111827", fontSize: "15px", fontWeight: 900 },
  sectionHint: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 600 },
  tableWrapper: { overflowX: "auto", border: "1px solid #d1d5db" },
  table: { width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff" },
  th: { padding: "10px", textAlign: "left", backgroundColor: "#f8f3b5", color: "#111111", borderBottom: "2px solid #111111", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
  thRight: { padding: "10px", textAlign: "right", backgroundColor: "#f8f3b5", color: "#111111", borderBottom: "2px solid #111111", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
  td: { padding: "10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", verticalAlign: "top" },
  tdStrong: { padding: "10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", fontWeight: 800, verticalAlign: "top" },
  tdRight: { padding: "10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontSize: "13px", whiteSpace: "nowrap", verticalAlign: "top" },
  tdRightStrong: { padding: "10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontSize: "13px", fontWeight: 900, whiteSpace: "nowrap", verticalAlign: "top" },
  cellSecondary: { display: "block", marginTop: "3px", color: "#6b7280", fontWeight: 600 },
  missingValue: { color: "#b91c1c", fontWeight: 900 },
  rowWithError: { backgroundColor: "#fff7f7" },
  tableButton: { border: "1px solid #111827", borderRadius: "6px", backgroundColor: "#ffffff", color: "#111827", padding: "6px 9px", cursor: "pointer", fontSize: "12px", fontWeight: 900 },
  detailCell: { padding: "12px", backgroundColor: "#f9fafb", borderBottom: "2px solid #d1d5db" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px" },
  emptyState: { padding: "28px", textAlign: "center", color: "#6b7280", backgroundColor: "#f9fafb", border: "1px dashed #9ca3af", fontWeight: 700 },
  checklistGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px" },
  checkItem: { border: "1px solid #111111", backgroundColor: "#fffdf0", padding: "12px", display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px" },
  communicationFilter: { display: "flex", alignItems: "end", gap: "12px", marginBottom: "16px", flexWrap: "wrap" },
  inlineActions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  fileHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" },
  fileMetadata: { display: "flex", gap: "18px", flexWrap: "wrap", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "10px", marginBottom: "12px", fontSize: "13px" },
  codePreview: { margin: 0, maxHeight: "520px", overflow: "auto", backgroundColor: "#111827", color: "#f9fafb", padding: "16px", fontSize: "12px", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" },
};
