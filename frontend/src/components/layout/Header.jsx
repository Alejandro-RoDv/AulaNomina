import { useEffect, useMemo, useState } from "react";

import { fetchContracts } from "../../services/api";
import { fetchCompanies } from "../../services/companyApi";
import { fetchDocuments } from "../../services/documentApi";
import { fetchAllEmployees } from "../../services/employeeApi";
import { fetchIncidents } from "../../services/incidentApi";
import { fetchPayrolls } from "../../services/payrollApi";
import { fetchWorkCenters } from "../../services/workCenterApi";
import { generateAlerts, getAlertStats } from "../../utils/alertRules";

const SEVERITY_LABELS = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const SOURCE_LABELS = {
  document: "Documentos",
  contract: "Contratos",
  incident: "Incidencias",
  payroll: "Nóminas",
};

const workerTabs = [
  { page: "employees", label: "Nuevo trabajador", titles: ["Nuevo trabajador"] },
  { page: "employees-list", label: "Listado trabajadores", titles: ["Listado de trabajadores"] },
  { page: "employee-record", label: "Expediente", titles: ["Expediente del trabajador"] },
];

const contractTabs = [
  { mode: "new", label: "Nuevo contrato" },
  { mode: "history", label: "Historial contratos" },
  { mode: "print", label: "Impresión contratos" },
];

const overlayHashes = new Set(["#documents", "#alerts", "#reports"]);

function getSeverityStyle(severity) {
  if (severity === "critical") return styles.alertSeverityCritical;
  if (severity === "high") return styles.alertSeverityHigh;
  if (severity === "medium") return styles.alertSeverityMedium;
  return styles.alertSeverityLow;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-ES");
}

function getStoredContractMode() {
  if (typeof window === "undefined") return "new";
  return window.sessionStorage.getItem("aulanomina:contractsMode") || "new";
}

function clearOverlayHash() {
  if (typeof window === "undefined") return;
  if (!overlayHashes.has(window.location.hash)) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  window.dispatchEvent(new Event("aulanomina-route-change"));
}

function openAppPage(page) {
  clearOverlayHash();
  window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page } }));
}

function isWorkerTitle(title) {
  return workerTabs.some((tab) => tab.titles.includes(title));
}

function getWorkerTabActive(title, tab) {
  return tab.titles.includes(title);
}

export default function Header({
  title,
  subtitle,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
  onResetDemo,
  resetDemoLoading,
  resetDemoMessage,
  resetDemoError,
}) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState("");
  const [contractMode, setContractMode] = useState(getStoredContractMode);
  const [alertData, setAlertData] = useState({
    documents: [],
    contracts: [],
    incidents: [],
    payrolls: [],
    employees: [],
    companies: [],
    workCenters: [],
  });

  const alerts = useMemo(
    () =>
      generateAlerts({
        documents: alertData.documents,
        contracts: alertData.contracts,
        incidents: alertData.incidents,
        payrolls: alertData.payrolls,
        employees: alertData.employees,
        companies: alertData.companies,
        workCenters: alertData.workCenters,
      }),
    [alertData]
  );

  const alertStats = useMemo(() => getAlertStats(alerts), [alerts]);
  const previewAlerts = alerts.slice(0, 5);
  const showWorkerTabs = isWorkerTitle(title);
  const showContractTabs = title === "Contratos";

  const loadHeaderAlerts = async () => {
    try {
      setAlertsLoading(true);
      setAlertsError("");

      const [documents, contracts, incidents, payrolls, employees, companies, workCenters] = await Promise.all([
        fetchDocuments(),
        fetchContracts(),
        fetchIncidents(),
        fetchPayrolls(),
        fetchAllEmployees(),
        fetchCompanies(),
        fetchWorkCenters(),
      ]);

      setAlertData({ documents, contracts, incidents, payrolls, employees, companies, workCenters });
    } catch (err) {
      setAlertsError(err.message || "Error cargando alertas");
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    loadHeaderAlerts();

    const handleRefresh = () => loadHeaderAlerts();
    const handleContractMode = () => setContractMode(getStoredContractMode());
    window.addEventListener("aulanomina-alerts-refresh", handleRefresh);
    window.addEventListener("aulanomina-contract-mode", handleContractMode);

    return () => {
      window.removeEventListener("aulanomina-alerts-refresh", handleRefresh);
      window.removeEventListener("aulanomina-contract-mode", handleContractMode);
    };
  }, []);

  const openAlertsPage = () => {
    setAlertsOpen(false);
    window.location.hash = "alerts";
    window.dispatchEvent(new Event("aulanomina-route-change"));
  };

  const changeWorkerTab = (page) => {
    openAppPage(page);
  };

  const changeContractTab = (mode) => {
    window.sessionStorage.setItem("aulanomina:contractsMode", mode);
    setContractMode(mode);
    clearOverlayHash();
    window.dispatchEvent(new Event("aulanomina-contract-mode"));
    window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "contracts" } }));
  };

  return (
    <header style={styles.header}>
      <div style={styles.topBar}>
        <div style={styles.userBox}>Usuario demo · Docente</div>
        <div style={styles.headerActions}>
          <div style={styles.alertBellWrapper}>
            <button
              type="button"
              style={{
                ...styles.alertBellButton,
                ...(alertStats.critical > 0 ? styles.alertBellCritical : {}),
                ...(alertStats.critical === 0 && alertStats.high > 0 ? styles.alertBellHigh : {}),
              }}
              onClick={() => setAlertsOpen((prev) => !prev)}
              title="Alertas"
            >
              <span style={styles.bellIcon}>●</span>
              Alertas
              <strong style={styles.alertCounter}>{alertsLoading ? "..." : alertStats.total}</strong>
            </button>

            {alertsOpen && (
              <section style={styles.alertDropdown}>
                <div style={styles.alertDropdownHeader}>
                  <div>
                    <p style={styles.alertDropdownKicker}>Centro de avisos</p>
                    <h2 style={styles.alertDropdownTitle}>{alertStats.total} alertas activas</h2>
                  </div>
                  <button type="button" style={styles.alertCloseButton} onClick={() => setAlertsOpen(false)}>
                    Cerrar
                  </button>
                </div>

                <div style={styles.alertStatsRow}>
                  <span style={styles.alertStatCritical}>{alertStats.critical} críticas</span>
                  <span style={styles.alertStatHigh}>{alertStats.high} altas</span>
                  <span style={styles.alertStatMedium}>{alertStats.medium} medias</span>
                </div>

                {alertsError && <div style={styles.alertError}>{alertsError}</div>}
                {alertsLoading && <div style={styles.alertEmpty}>Actualizando alertas...</div>}

                {!alertsLoading && !alertsError && previewAlerts.length === 0 && (
                  <div style={styles.alertEmpty}>No hay alertas activas.</div>
                )}

                {!alertsLoading && !alertsError && previewAlerts.length > 0 && (
                  <div style={styles.alertList}>
                    {previewAlerts.map((alert) => (
                      <article key={alert.id} style={styles.alertItem}>
                        <div style={styles.alertItemTop}>
                          <span style={{ ...styles.alertSeverity, ...getSeverityStyle(alert.severity) }}>
                            {SEVERITY_LABELS[alert.severity] || alert.severity}
                          </span>
                          <span style={styles.alertSource}>{SOURCE_LABELS[alert.source] || alert.source}</span>
                        </div>
                        <strong style={styles.alertItemTitle}>{alert.title}</strong>
                        <p style={styles.alertItemText}>{alert.employeeName} · {formatDate(alert.dueDate)}</p>
                      </article>
                    ))}
                  </div>
                )}

                <div style={styles.alertDropdownActions}>
                  <button type="button" style={styles.alertRefreshButton} onClick={loadHeaderAlerts} disabled={alertsLoading}>
                    Actualizar
                  </button>
                  <button type="button" style={styles.alertOpenButton} onClick={openAlertsPage}>
                    Ver todas
                  </button>
                </div>
              </section>
            )}
          </div>

          <div style={styles.statusBox}>Demo MVP</div>
          <button type="button" style={styles.settingsButton} onClick={onOpenSettings}>
            Ajustes
          </button>
        </div>
      </div>

      <div style={styles.titleBlock}>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>

      {showWorkerTabs && (
        <nav style={styles.moduleTabs} aria-label="Navegación trabajador">
          {workerTabs.map((tab) => (
            <button key={tab.page} type="button" onClick={() => changeWorkerTab(tab.page)} style={getWorkerTabActive(title, tab) ? styles.moduleTabActive : styles.moduleTab}>
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {showContractTabs && (
        <nav style={styles.moduleTabs} aria-label="Navegación contratos">
          {contractTabs.map((tab) => (
            <button key={tab.mode} type="button" onClick={() => changeContractTab(tab.mode)} style={contractMode === tab.mode ? styles.moduleTabActive : styles.moduleTab}>
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {settingsOpen && (
        <div style={styles.modalOverlay}>
          <section style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.modalKicker}>Configuración</p>
                <h2 style={styles.modalTitle}>Ajustes de demo</h2>
              </div>
              <button type="button" style={styles.closeButton} onClick={onCloseSettings}>
                Cerrar
              </button>
            </div>

            <div style={styles.warningBox}>
              <strong>Reset demo</strong>
              <p style={styles.warningText}>
                Reinicia únicamente los datos controlados de Fundación AulaNomina. No borra empresas,
                trabajadores ni contratos creados fuera de la demo.
              </p>
            </div>

            {resetDemoError && <p style={styles.errorMessage}>{resetDemoError}</p>}
            {resetDemoMessage && <p style={styles.successMessage}>{resetDemoMessage}</p>}

            <div style={styles.modalActions}>
              <button
                type="button"
                style={{ ...styles.resetButton, opacity: resetDemoLoading ? 0.7 : 1 }}
                onClick={onResetDemo}
                disabled={resetDemoLoading}
              >
                {resetDemoLoading ? "Reiniciando..." : "Reset demo"}
              </button>
            </div>
          </section>
        </div>
      )}
    </header>
  );
}

const styles = {
  header: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderBottom: "3px solid #111111",
    position: "relative",
    zIndex: 40,
    isolation: "isolate",
    flexShrink: 0,
    overflow: "visible",
  },
  topBar: {
    minHeight: "54px",
    background: "linear-gradient(90deg, #e6d85c 0%, #f5ef9c 55%, #ffffff 100%)",
    borderBottom: "3px solid #111111",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 34px",
    boxSizing: "border-box",
    position: "relative",
    zIndex: 42,
  },
  userBox: { color: "#111111", fontSize: "15px", fontWeight: 900, letterSpacing: "0.03em", textTransform: "uppercase" },
  headerActions: { display: "flex", alignItems: "center", gap: "10px" },
  alertBellWrapper: { position: "relative" },
  alertBellButton: { minHeight: "31px", display: "inline-flex", alignItems: "center", gap: "7px", color: "#111111", backgroundColor: "#ffffff", border: "1px solid #111111", padding: "5px 9px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" },
  alertBellCritical: { backgroundColor: "#fee2e2", borderColor: "#991b1b", color: "#991b1b" },
  alertBellHigh: { backgroundColor: "#ffedd5", borderColor: "#9a3412", color: "#9a3412" },
  bellIcon: { fontSize: "10px", lineHeight: 1 },
  alertCounter: { minWidth: "20px", height: "20px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", backgroundColor: "#111111", color: "#ffffff", fontSize: "11px", fontWeight: 900, padding: "0 5px", boxSizing: "border-box" },
  alertDropdown: { position: "absolute", top: "38px", right: 0, width: "420px", backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "8px 8px 0 rgba(17, 17, 17, 0.18)", padding: "16px", boxSizing: "border-box", zIndex: 80 },
  alertDropdownHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "12px" },
  alertDropdownKicker: { margin: 0, color: "#9a7b00", fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" },
  alertDropdownTitle: { margin: "3px 0 0", color: "#111111", fontSize: "20px", fontWeight: 950 },
  alertCloseButton: { color: "#111111", backgroundColor: "#f3f4f6", border: "1px solid #9ca3af", padding: "5px 8px", fontSize: "11px", fontWeight: 900, cursor: "pointer", textTransform: "uppercase" },
  alertStatsRow: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" },
  alertStatCritical: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", padding: "4px 7px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  alertStatHigh: { backgroundColor: "#ffedd5", color: "#9a3412", border: "1px solid #fed7aa", padding: "4px 7px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  alertStatMedium: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "4px 7px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  alertList: { display: "flex", flexDirection: "column", gap: "8px", maxHeight: "330px", overflowY: "auto" },
  alertItem: { border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", padding: "10px" },
  alertItemTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" },
  alertSeverity: { borderRadius: "999px", padding: "3px 7px", fontSize: "10px", fontWeight: 950, textTransform: "uppercase" },
  alertSeverityCritical: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
  alertSeverityHigh: { backgroundColor: "#ffedd5", color: "#9a3412", border: "1px solid #fed7aa" },
  alertSeverityMedium: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" },
  alertSeverityLow: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
  alertSource: { color: "#6b7280", fontSize: "11px", fontWeight: 900, textTransform: "uppercase" },
  alertItemTitle: { display: "block", color: "#111827", fontSize: "13px", fontWeight: 950, lineHeight: 1.25 },
  alertItemText: { margin: "5px 0 0", color: "#4b5563", fontSize: "12px", fontWeight: 700, lineHeight: 1.35 },
  alertDropdownActions: { display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "14px" },
  alertRefreshButton: { color: "#111827", backgroundColor: "#ffffff", border: "1px solid #d1d5db", padding: "8px 11px", fontSize: "12px", fontWeight: 900, cursor: "pointer", textTransform: "uppercase" },
  alertOpenButton: { color: "#ffffff", backgroundColor: "#111827", border: "1px solid #111827", padding: "8px 11px", fontSize: "12px", fontWeight: 900, cursor: "pointer", textTransform: "uppercase" },
  alertEmpty: { border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", color: "#6b7280", padding: "12px", fontSize: "13px", fontWeight: 800 },
  alertError: { border: "1px solid #fecaca", backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", fontSize: "13px", fontWeight: 800 },
  statusBox: { color: "#111111", backgroundColor: "rgba(255, 255, 255, 0.65)", border: "1px solid rgba(0, 0, 0, 0.25)", padding: "5px 10px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase" },
  settingsButton: { color: "#111111", backgroundColor: "#ffffff", border: "1px solid #111111", padding: "6px 12px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" },
  titleBlock: {
    padding: "24px 34px 14px",
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    position: "relative",
    zIndex: 41,
  },
  title: { margin: 0, color: "#111111", fontSize: "32px", lineHeight: 1.1, fontWeight: 950 },
  subtitle: { margin: "8px 0 0", color: "#4b5563", fontSize: "15px", fontWeight: 700 },
  moduleTabs: { display: "flex", gap: "8px", padding: "0 34px 16px", backgroundColor: "#ffffff", flexWrap: "wrap", position: "relative", zIndex: 41 },
  moduleTab: { backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  moduleTabActive: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", backgroundColor: "rgba(17, 24, 39, 0.35)", padding: "72px 34px", boxSizing: "border-box" },
  modalBox: { width: "420px", backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "0 18px 40px rgba(0, 0, 0, 0.22)", padding: "22px", boxSizing: "border-box" },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "18px" },
  modalKicker: { margin: 0, color: "#9a7b00", fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" },
  modalTitle: { margin: "4px 0 0", color: "#111111", fontSize: "22px", fontWeight: 900 },
  closeButton: { color: "#111111", backgroundColor: "#f3f4f6", border: "1px solid #9ca3af", padding: "6px 10px", fontSize: "12px", fontWeight: 800, cursor: "pointer" },
  warningBox: { border: "1px solid #d1d5db", backgroundColor: "#f9fafb", padding: "14px", color: "#111827", fontSize: "14px", fontWeight: 700 },
  warningText: { margin: "8px 0 0", color: "#4b5563", fontSize: "13px", lineHeight: 1.45, fontWeight: 600 },
  errorMessage: { marginTop: "14px", color: "#991b1b", backgroundColor: "#fee2e2", border: "1px solid #fecaca", padding: "10px 12px", fontSize: "13px", fontWeight: 800 },
  successMessage: { marginTop: "14px", color: "#166534", backgroundColor: "#dcfce7", border: "1px solid #bbf7d0", padding: "10px 12px", fontSize: "13px", fontWeight: 800 },
  modalActions: { display: "flex", justifyContent: "flex-end", marginTop: "18px" },
  resetButton: { color: "#ffffff", backgroundColor: "#111111", border: "2px solid #111111", padding: "9px 14px", fontSize: "13px", fontWeight: 900, textTransform: "uppercase", cursor: "pointer" },
};
