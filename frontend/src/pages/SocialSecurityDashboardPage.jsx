import { useCallback, useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import {
  fetchCommunicationFiles,
  fetchCommunicationSubmissions,
  fetchSocialSecuritySettlements,
} from "../services/socialSecurityApi";
import { setSelectedCompanyId } from "../utils/companyContext";
import {
  formatDateTime,
  formatMoney,
  formatPeriod,
  settlementStatusLabel,
} from "../utils/socialSecuritySettlement";
import {
  latestSubmission,
  submissionCounts,
  submissionStatusLabel,
  submissionStatusTone,
} from "../utils/siltraSimulation";

const STATUS_ORDER = ["VALIDATION_ERROR", "READY", "CONFIRMED", "GENERATED"];

function StatusBadge({ status, submission = false }) {
  const settlementPalette = {
    DRAFT: ["#f1f5f9", "#475569"],
    VALIDATION_ERROR: ["#fff1f2", "#b42318"],
    READY: ["#fff8e7", "#9a6700"],
    CONFIRMED: ["#eef4ff", "#2458c5"],
    GENERATED: ["#edf8f1", "#18794e"],
    CANCELLED: ["#f1f5f9", "#64748b"],
  };
  const submissionPalette = {
    success: ["#edf8f1", "#18794e"],
    warning: ["#fff8e7", "#9a6700"],
    danger: ["#fff1f2", "#b42318"],
    info: ["#eef4ff", "#2458c5"],
    neutral: ["#f1f5f9", "#475569"],
  };
  const [backgroundColor, color] = submission
    ? submissionPalette[submissionStatusTone(status)] || submissionPalette.neutral
    : settlementPalette[status] || settlementPalette.DRAFT;
  const label = submission ? submissionStatusLabel(status) : settlementStatusLabel(status);
  return <span style={{ ...styles.badge, backgroundColor, color }}>{label}</span>;
}

function SummaryCard({ label, value, hint, accent = false }) {
  return (
    <div style={{ ...styles.summaryCard, ...(accent ? styles.summaryCardAccent : {}) }}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={{ ...styles.summaryValue, ...(accent ? styles.summaryValueAccent : {}) }}>{value}</strong>
      {hint && <small style={styles.summaryHint}>{hint}</small>}
    </div>
  );
}

export default function SocialSecurityDashboardPage({ companies = [], onNavigate }) {
  const activeCompanies = useMemo(() => companies.filter((company) => company.is_active !== false), [companies]);
  const [companyId, setCompanyId] = useState("");
  const [settlements, setSettlements] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId && activeCompanies.length > 0) setCompanyId(String(activeCompanies[0].id));
  }, [activeCompanies, companyId]);

  const loadDashboard = useCallback(async () => {
    if (!companyId) {
      setSettlements([]);
      setCommunications([]);
      setSubmissions([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [settlementData, communicationData, submissionData] = await Promise.all([
        fetchSocialSecuritySettlements({ company_id: Number(companyId) }),
        fetchCommunicationFiles({ company_id: Number(companyId), file_type: "SOCIAL_SECURITY_SETTLEMENT" }),
        fetchCommunicationSubmissions({ company_id: Number(companyId), limit: 500 }),
      ]);
      setSettlements(settlementData || []);
      setCommunications(communicationData || []);
      setSubmissions(submissionData?.items || []);
    } catch (requestError) {
      setError(requestError.message || "No se ha podido cargar el resumen de Seguros Sociales");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
    let totalDue = 0;

    settlements.forEach((settlement) => {
      counts[settlement.status] = (counts[settlement.status] || 0) + 1;
      totalDue += Number(settlement.total_due || 0);
    });

    return {
      total: settlements.length,
      errors: counts.VALIDATION_ERROR || 0,
      ready: counts.READY || 0,
      confirmed: counts.CONFIRMED || 0,
      generated: counts.GENERATED || 0,
      totalDue,
      files: communications.length,
      pendingFiles: communications.filter((file) => file.status === "GENERATED").length,
      ...submissionCounts(submissions),
    };
  }, [communications, settlements, submissions]);

  const latestSettlements = useMemo(
    () => [...settlements]
      .sort((left, right) => new Date(right.updated_at || 0) - new Date(left.updated_at || 0))
      .slice(0, 6),
    [settlements]
  );
  const lastSubmission = useMemo(() => latestSubmission(submissions), [submissions]);
  const selectedCompany = activeCompanies.find((company) => String(company.id) === String(companyId));
  const pendingProcess = stats.errors + stats.ready + stats.confirmed;

  const openCraFiles = () => {
    if (companyId) setSelectedCompanyId(companyId);
    window.location.hash = "#cra-files";
    window.dispatchEvent(new Event("aulanomina-route-change"));
  };

  return (
    <div style={styles.page}>
      {error && <div style={styles.errorBanner}>{error}</div>}

      <PageCard title="Resumen de Seguros Sociales" subtitle="Liquidaciones, ficheros y estado de las comunicaciones de la empresa seleccionada.">
        <div style={styles.toolbar}>
          <label style={styles.field}>
            <span>Empresa</span>
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} style={styles.input}>
              <option value="">Selecciona empresa</option>
              {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <button type="button" style={styles.secondaryButton} disabled={!companyId || loading} onClick={loadDashboard}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div style={styles.summaryGrid}>
          <SummaryCard label="Liquidaciones" value={stats.total} hint={selectedCompany?.name || "Sin empresa"} />
          <SummaryCard label="Pendientes de proceso" value={pendingProcess} hint={`${stats.errors} con errores · ${stats.ready} preparadas`} />
          <SummaryCard label="Ficheros pendientes" value={stats.pendingFiles} hint={`${stats.files} fichero(s) generados`} />
          <SummaryCard label="Envíos aceptados" value={stats.accepted} hint={`${stats.warnings} con advertencias · ${stats.rejected} rechazados`} />
          <SummaryCard label="Total liquidado" value={`${formatMoney(stats.totalDue)} €`} accent />
        </div>

        <div style={styles.lastSubmissionPanel}>
          <div>
            <span style={styles.summaryLabel}>Último envío registrado</span>
            {lastSubmission ? (
              <div style={styles.lastSubmissionData}>
                <strong>{lastSubmission.submission_number}</strong>
                <StatusBadge status={lastSubmission.status} submission />
                <span>{lastSubmission.response_code || "Sin código"}</span>
                <span>{formatDateTime(lastSubmission.processed_at || lastSubmission.created_at)}</span>
              </div>
            ) : <strong style={styles.noSubmission}>Sin envíos registrados</strong>}
          </div>
          <div style={styles.quickActions}>
            <button type="button" style={styles.secondaryButton} onClick={() => onNavigate?.("social-security-files")}>Ficheros generados</button>
            <button type="button" style={styles.secondaryButton} disabled={!companyId} onClick={openCraFiles}>Preparar CRA</button>
            <button type="button" style={styles.primaryButton} onClick={() => onNavigate?.("social-security-settlements")}>Abrir liquidaciones</button>
          </div>
        </div>
      </PageCard>

      <PageCard title="Últimas liquidaciones" subtitle="Actividad reciente de la empresa seleccionada.">
        {loading ? <div style={styles.emptyState}>Cargando información...</div> : latestSettlements.length === 0 ? (
          <div style={styles.emptyState}>{companyId ? "Todavía no hay liquidaciones para esta empresa." : "Selecciona una empresa para consultar sus liquidaciones."}</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>Periodo</th><th style={styles.th}>CCC</th><th style={styles.th}>Estado</th><th style={styles.thRight}>Trabajadores</th><th style={styles.thRight}>Total</th><th style={styles.th}>Actualización</th><th style={styles.th}>Acción</th></tr></thead>
              <tbody>
                {latestSettlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <td style={styles.tdStrong}>{formatPeriod(settlement.period_year, settlement.period_month)}</td>
                    <td style={styles.td}>{settlement.ccc_id}</td>
                    <td style={styles.td}><StatusBadge status={settlement.status} /></td>
                    <td style={styles.tdRight}>{settlement.worker_count}</td>
                    <td style={styles.tdRightStrong}>{formatMoney(settlement.total_due)} €</td>
                    <td style={styles.td}>{formatDateTime(settlement.updated_at)}</td>
                    <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => onNavigate?.("social-security-settlements")}>Revisar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>
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

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "16px" },
  errorBanner: { border: "1px solid #fecaca", borderLeft: "3px solid #dc2626", borderRadius: "6px", backgroundColor: "#fff7f7", color: "#991b1b", padding: "10px 12px", fontWeight: 700, fontSize: "12px" },
  toolbar: { display: "flex", alignItems: "end", gap: "10px", flexWrap: "wrap", marginBottom: "16px" },
  field: { minWidth: "300px", display: "flex", flexDirection: "column", gap: "5px", color: "#46546b", fontSize: "11px", fontWeight: 750 },
  input: { border: "1px solid #cbd6e3", borderRadius: "6px", padding: "8px 10px", backgroundColor: "#ffffff", color: "#172033", fontSize: "13px", minHeight: "38px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 0, border: "1px solid #dbe3ed", borderRadius: "7px", overflow: "hidden" },
  summaryCard: { borderRight: "1px solid #e4e9f0", backgroundColor: "#ffffff", padding: "11px 12px", display: "flex", flexDirection: "column", gap: "3px", minHeight: "72px" },
  summaryCardAccent: { backgroundColor: "#f4f8ff", boxShadow: "inset 3px 0 0 #2563eb" },
  summaryLabel: { color: "#738199", fontSize: "10px", fontWeight: 750 },
  summaryValue: { color: "#172033", fontSize: "20px", lineHeight: 1.15 },
  summaryValueAccent: { color: "#1d4ed8" },
  summaryHint: { color: "#8793a7", fontWeight: 500, fontSize: "10px", lineHeight: 1.35 },
  lastSubmissionPanel: { marginTop: "14px", padding: "12px", border: "1px solid #dbe3ed", borderRadius: "7px", backgroundColor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" },
  lastSubmissionData: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "9px", marginTop: "5px", color: "#53627a", fontSize: "12px" },
  noSubmission: { display: "block", marginTop: "5px", color: "#53627a", fontSize: "12px" },
  quickActions: { display: "flex", gap: "8px", flexWrap: "wrap", marginLeft: "auto" },
  primaryButton: { ...baseButton, backgroundColor: "#2563eb", color: "#ffffff", border: "1px solid #2563eb" },
  secondaryButton: { ...baseButton, backgroundColor: "#ffffff", color: "#344258", border: "1px solid #cbd6e3" },
  emptyState: { border: "1px dashed #cbd5e1", borderRadius: "6px", padding: "22px", color: "#738199", textAlign: "center", fontWeight: 600, fontSize: "12px", backgroundColor: "#fbfcfe" },
  tableWrapper: { overflowX: "auto", border: "1px solid #dbe3ed", borderRadius: "7px" },
  table: { width: "100%", minWidth: "880px", borderCollapse: "collapse", backgroundColor: "#ffffff" },
  th: { textAlign: "left", padding: "8px 9px", borderBottom: "1px solid #cbd6e3", backgroundColor: "#f1f4f8", color: "#4b5870", fontSize: "10px", fontWeight: 800, whiteSpace: "nowrap" },
  thRight: { textAlign: "right", padding: "8px 9px", borderBottom: "1px solid #cbd6e3", backgroundColor: "#f1f4f8", color: "#4b5870", fontSize: "10px", fontWeight: 800, whiteSpace: "nowrap" },
  td: { padding: "8px 9px", borderBottom: "1px solid #e6ebf1", color: "#344258", fontSize: "12px" },
  tdStrong: { padding: "8px 9px", borderBottom: "1px solid #e6ebf1", color: "#172033", fontSize: "12px", fontWeight: 750 },
  tdRight: { padding: "8px 9px", borderBottom: "1px solid #e6ebf1", color: "#344258", fontSize: "12px", textAlign: "right" },
  tdRightStrong: { padding: "8px 9px", borderBottom: "1px solid #e6ebf1", color: "#172033", fontSize: "12px", textAlign: "right", fontWeight: 750 },
  tableButton: { ...baseButton, minHeight: "30px", padding: "5px 9px", backgroundColor: "#ffffff", color: "#344258", border: "1px solid #cbd6e3", fontSize: "11px" },
  badge: { display: "inline-flex", alignItems: "center", borderRadius: "999px", padding: "3px 7px", fontSize: "10px", fontWeight: 750, whiteSpace: "nowrap" },
};
