import { useCallback, useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import {
  fetchCommunicationFiles,
  fetchSocialSecuritySettlements,
} from "../services/socialSecurityApi";
import {
  formatDateTime,
  formatMoney,
  formatPeriod,
  settlementStatusLabel,
} from "../utils/socialSecuritySettlement";

const STATUS_ORDER = ["VALIDATION_ERROR", "READY", "CONFIRMED", "GENERATED"];

function StatusBadge({ status }) {
  const palette = {
    DRAFT: ["#f3f4f6", "#374151"],
    VALIDATION_ERROR: ["#fee2e2", "#991b1b"],
    READY: ["#fef3c7", "#92400e"],
    CONFIRMED: ["#dbeafe", "#1e40af"],
    GENERATED: ["#dcfce7", "#166534"],
    CANCELLED: ["#e5e7eb", "#4b5563"],
  };
  const [backgroundColor, color] = palette[status] || palette.DRAFT;
  return (
    <span style={{ ...styles.badge, backgroundColor, color }}>
      {settlementStatusLabel(status)}
    </span>
  );
}

function SummaryCard({ label, value, hint, emphasis = false }) {
  return (
    <div style={{ ...styles.summaryCard, ...(emphasis ? styles.summaryCardEmphasis : {}) }}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
      {hint && <small style={styles.summaryHint}>{hint}</small>}
    </div>
  );
}

export default function SocialSecurityDashboardPage({ companies = [], onNavigate }) {
  const activeCompanies = useMemo(
    () => companies.filter((company) => company.is_active !== false),
    [companies]
  );
  const [companyId, setCompanyId] = useState("");
  const [settlements, setSettlements] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId && activeCompanies.length > 0) {
      setCompanyId(String(activeCompanies[0].id));
    }
  }, [activeCompanies, companyId]);

  const loadDashboard = useCallback(async () => {
    if (!companyId) {
      setSettlements([]);
      setCommunications([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [settlementData, communicationData] = await Promise.all([
        fetchSocialSecuritySettlements({ company_id: Number(companyId) }),
        fetchCommunicationFiles({
          company_id: Number(companyId),
          file_type: "SOCIAL_SECURITY_SETTLEMENT",
        }),
      ]);
      setSettlements(settlementData || []);
      setCommunications(communicationData || []);
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
    let workerCount = 0;

    settlements.forEach((settlement) => {
      counts[settlement.status] = (counts[settlement.status] || 0) + 1;
      totalDue += Number(settlement.total_due || 0);
      workerCount += Number(settlement.worker_count || 0);
    });

    return {
      total: settlements.length,
      errors: counts.VALIDATION_ERROR || 0,
      ready: counts.READY || 0,
      confirmed: counts.CONFIRMED || 0,
      generated: counts.GENERATED || 0,
      totalDue,
      workerCount,
      files: communications.length,
    };
  }, [communications.length, settlements]);

  const latestSettlements = useMemo(
    () => [...settlements]
      .sort((left, right) => new Date(right.updated_at || 0) - new Date(left.updated_at || 0))
      .slice(0, 6),
    [settlements]
  );

  const selectedCompany = activeCompanies.find(
    (company) => String(company.id) === String(companyId)
  );

  return (
    <div style={styles.page}>
      {error && <div style={styles.errorBanner}>{error}</div>}

      <PageCard
        title="Resumen de Seguros Sociales"
        subtitle="Situación general de las liquidaciones y los ficheros generados para la empresa seleccionada."
      >
        <div style={styles.toolbar}>
          <label style={styles.field}>
            <span>Empresa</span>
            <select
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              style={styles.input}
            >
              <option value="">Selecciona empresa</option>
              {activeCompanies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={!companyId || loading}
            onClick={loadDashboard}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div style={styles.summaryGrid}>
          <SummaryCard label="Liquidaciones" value={stats.total} hint={selectedCompany?.name || "Sin empresa"} />
          <SummaryCard label="Con errores" value={stats.errors} hint="Requieren corrección" />
          <SummaryCard label="Preparadas" value={stats.ready} hint="Pendientes de confirmar" />
          <SummaryCard label="Confirmadas" value={stats.confirmed} hint="Pendientes de fichero" />
          <SummaryCard label="Generadas" value={stats.generated} hint={`${stats.files} fichero(s)`} />
          <SummaryCard label="Trabajadores procesados" value={stats.workerCount} />
          <SummaryCard label="Total liquidado" value={`${formatMoney(stats.totalDue)} €`} emphasis />
        </div>

        <div style={styles.quickActions}>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => onNavigate?.("social-security-settlements")}
          >
            Abrir liquidaciones
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => onNavigate?.("social-security-files")}
          >
            Ver ficheros generados
          </button>
        </div>
      </PageCard>

      <PageCard
        title="Últimas liquidaciones"
        subtitle="Actividad reciente de la empresa seleccionada."
      >
        {loading ? (
          <div style={styles.emptyState}>Cargando información...</div>
        ) : latestSettlements.length === 0 ? (
          <div style={styles.emptyState}>
            {companyId
              ? "Todavía no hay liquidaciones para esta empresa."
              : "Selecciona una empresa para consultar sus liquidaciones."}
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Periodo</th>
                  <th style={styles.th}>CCC</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.thRight}>Trabajadores</th>
                  <th style={styles.thRight}>Total</th>
                  <th style={styles.th}>Actualización</th>
                  <th style={styles.th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {latestSettlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <td style={styles.tdStrong}>{formatPeriod(settlement.period_year, settlement.period_month)}</td>
                    <td style={styles.td}>{settlement.ccc_id}</td>
                    <td style={styles.td}><StatusBadge status={settlement.status} /></td>
                    <td style={styles.tdRight}>{settlement.worker_count}</td>
                    <td style={styles.tdRightStrong}>{formatMoney(settlement.total_due)} €</td>
                    <td style={styles.td}>{formatDateTime(settlement.updated_at)}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.tableButton}
                        onClick={() => onNavigate?.("social-security-settlements")}
                      >
                        Revisar
                      </button>
                    </td>
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
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: "13px",
};

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  errorBanner: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "12px 14px", fontWeight: 800 },
  toolbar: { display: "flex", alignItems: "end", gap: "12px", flexWrap: "wrap", marginBottom: "18px" },
  field: { minWidth: "300px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800 },
  input: { border: "1px solid #9ca3af", borderRadius: "8px", padding: "10px 11px", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", minHeight: "42px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "10px" },
  summaryCard: { border: "1px solid #d1d5db", backgroundColor: "#ffffff", padding: "12px", display: "flex", flexDirection: "column", gap: "5px", minHeight: "82px" },
  summaryCardEmphasis: { border: "2px solid #111111", backgroundColor: "#fff8a6", boxShadow: "3px 3px 0 #111111" },
  summaryLabel: { color: "#6b7280", fontSize: "12px", fontWeight: 800 },
  summaryValue: { color: "#111827", fontSize: "22px" },
  summaryHint: { color: "#6b7280", fontWeight: 700 },
  quickActions: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" },
  primaryButton: { ...baseButton, backgroundColor: "#111827", color: "#ffffff", border: "2px solid #111827" },
  secondaryButton: { ...baseButton, backgroundColor: "#ffffff", color: "#111827", border: "1px solid #9ca3af" },
  emptyState: { border: "1px dashed #9ca3af", padding: "24px", color: "#6b7280", textAlign: "center", fontWeight: 700 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", minWidth: "880px", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "11px 10px", borderBottom: "2px solid #111111", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.03em" },
  thRight: { textAlign: "right", padding: "11px 10px", borderBottom: "2px solid #111111", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.03em" },
  td: { padding: "11px 10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px" },
  tdStrong: { padding: "11px 10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", fontWeight: 900 },
  tdRight: { padding: "11px 10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", textAlign: "right" },
  tdRightStrong: { padding: "11px 10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", textAlign: "right", fontWeight: 900 },
  tableButton: { ...baseButton, padding: "7px 10px", backgroundColor: "#ffffff", color: "#111827", border: "1px solid #111827" },
  badge: { display: "inline-flex", alignItems: "center", borderRadius: "999px", padding: "5px 9px", fontSize: "12px", fontWeight: 900, whiteSpace: "nowrap" },
};
