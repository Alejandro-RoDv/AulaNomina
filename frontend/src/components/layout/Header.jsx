import { useEffect, useMemo, useState } from "react";
import { Bell, Menu, RefreshCw, Settings, X } from "lucide-react";

import SiltraGlobalLauncher from "../siltra/SiltraGlobalLauncher";
import { fetchContracts } from "../../services/api";
import { fetchCompanies } from "../../services/companyApi";
import { fetchDocuments } from "../../services/documentApi";
import { fetchAllEmployees } from "../../services/employeeApi";
import { fetchIncidents } from "../../services/incidentApi";
import { fetchPayrolls } from "../../services/payrollApi";
import { fetchWorkCenters } from "../../services/workCenterApi";
import { generateAlerts, getAlertStats } from "../../utils/alertRules";
import "./layout.css";
import "./panel-header-polish.css";

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

function getSeverityClass(severity) {
  if (["critical", "high", "medium", "low"].includes(severity)) return severity;
  return "low";
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
  if (typeof window === "undefined" || !overlayHashes.has(window.location.hash)) return;
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
  const [pageContext, setPageContext] = useState(null);
  const [alertData, setAlertData] = useState({
    documents: [],
    contracts: [],
    incidents: [],
    payrolls: [],
    employees: [],
    companies: [],
    workCenters: [],
  });

  const effectiveTitle = pageContext?.title || title;
  const effectiveSubtitle = pageContext?.subtitle ?? subtitle;
  const effectiveEyebrow = pageContext?.eyebrow || "AulaNomina";
  const alerts = useMemo(() => generateAlerts(alertData), [alertData]);
  const alertStats = useMemo(() => getAlertStats(alerts), [alerts]);
  const previewAlerts = alerts.slice(0, 5);
  const showWorkerTabs = isWorkerTitle(effectiveTitle);
  const showContractTabs = effectiveTitle === "Contratos";
  const isPanel = effectiveTitle === "Dashboard";
  const displayTitle = isPanel ? "Panel" : effectiveTitle;
  const displaySubtitle = isPanel
    ? "Visión general de la actividad y procesos pendientes"
    : effectiveSubtitle;

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
    } catch (error) {
      setAlertsError(error.message || "Error cargando alertas");
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    loadHeaderAlerts();
    const handleRefresh = () => loadHeaderAlerts();
    const handleContractMode = () => setContractMode(getStoredContractMode());
    const handleHeaderContext = (event) => setPageContext(event.detail || null);
    window.addEventListener("aulanomina-alerts-refresh", handleRefresh);
    window.addEventListener("aulanomina-contract-mode", handleContractMode);
    window.addEventListener("aulanomina-header-context", handleHeaderContext);
    return () => {
      window.removeEventListener("aulanomina-alerts-refresh", handleRefresh);
      window.removeEventListener("aulanomina-contract-mode", handleContractMode);
      window.removeEventListener("aulanomina-header-context", handleHeaderContext);
    };
  }, []);

  const openAlertsPage = () => {
    setAlertsOpen(false);
    window.location.hash = "alerts";
    window.dispatchEvent(new Event("aulanomina-route-change"));
  };

  const changeContractTab = (mode) => {
    window.sessionStorage.setItem("aulanomina:contractsMode", mode);
    setContractMode(mode);
    clearOverlayHash();
    window.dispatchEvent(new Event("aulanomina-contract-mode"));
    window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "contracts" } }));
  };

  const alertTone = alertStats.critical > 0
    ? " is-critical"
    : alertStats.high > 0
      ? " is-high"
      : "";

  return (
    <header className="an-header">
      <div className="an-header__topbar">
        <div className="an-header__identity">
          <button
            type="button"
            className="an-header__mobile-menu"
            onClick={() => window.dispatchEvent(new Event("aulanomina-toggle-sidebar"))}
            aria-label="Abrir navegación"
          >
            <Menu aria-hidden="true" />
          </button>
          <div className="an-header__user">
            <span className="an-header__context">Sesión activa</span>
            <strong>Docente</strong>
          </div>
        </div>

        <div className="an-header__actions">
          <div className="an-header__siltra">
            <SiltraGlobalLauncher />
          </div>

          <div className="an-header__alert-wrapper">
            <button
              type="button"
              className={`an-header__alert-button${alertTone}`}
              onClick={() => setAlertsOpen((previous) => !previous)}
              aria-expanded={alertsOpen}
              title="Alertas"
            >
              <Bell aria-hidden="true" />
              <span className="an-header__action-label">Alertas</span>
              <strong className="an-header__counter">{alertsLoading ? "…" : alertStats.total}</strong>
            </button>

            {alertsOpen && (
              <section className="an-header__alert-dropdown" aria-label="Centro de avisos">
                <div className="an-header__dropdown-header">
                  <div>
                    <p className="an-header__kicker">Centro de avisos</p>
                    <h2 className="an-header__dropdown-title">{alertStats.total} alertas activas</h2>
                  </div>
                  <button type="button" className="an-header__plain-button" onClick={() => setAlertsOpen(false)}>
                    Cerrar
                  </button>
                </div>

                <div className="an-header__stats">
                  <span className="an-header__stat an-header__stat--critical">{alertStats.critical} críticas</span>
                  <span className="an-header__stat an-header__stat--high">{alertStats.high} altas</span>
                  <span className="an-header__stat an-header__stat--medium">{alertStats.medium} medias</span>
                </div>

                {alertsError && <div className="an-header__message an-header__message--error">{alertsError}</div>}
                {alertsLoading && <div className="an-header__message">Actualizando alertas…</div>}
                {!alertsLoading && !alertsError && previewAlerts.length === 0 && (
                  <div className="an-header__message">No hay alertas activas.</div>
                )}

                {!alertsLoading && !alertsError && previewAlerts.length > 0 && (
                  <div className="an-header__alert-list">
                    {previewAlerts.map((alert) => {
                      const severityClass = getSeverityClass(alert.severity);
                      return (
                        <article key={alert.id} className="an-header__alert-item">
                          <div className="an-header__alert-top">
                            <span className={`an-header__severity an-header__severity--${severityClass}`}>
                              {SEVERITY_LABELS[alert.severity] || alert.severity}
                            </span>
                            <span className="an-header__alert-source">{SOURCE_LABELS[alert.source] || alert.source}</span>
                          </div>
                          <strong className="an-header__alert-title">{alert.title}</strong>
                          <p className="an-header__alert-copy">{alert.employeeName} · {formatDate(alert.dueDate)}</p>
                        </article>
                      );
                    })}
                  </div>
                )}

                <div className="an-header__dropdown-actions">
                  <button type="button" className="an-header__plain-button" onClick={loadHeaderAlerts} disabled={alertsLoading}>
                    <RefreshCw size={14} aria-hidden="true" /> Actualizar
                  </button>
                  <button type="button" className="an-header__primary-button" onClick={openAlertsPage}>
                    Ver todas
                  </button>
                </div>
              </section>
            )}
          </div>

          <button type="button" className="an-header__action-button" onClick={onOpenSettings}>
            <Settings aria-hidden="true" />
            <span className="an-header__action-label">Ajustes</span>
          </button>
        </div>
      </div>

      <div className={`an-header__page${isPanel ? " an-header__page--panel" : ""}`}>
        <div>
          {!isPanel && <p className="an-header__eyebrow">{effectiveEyebrow}</p>}
          <h1 className="an-header__title">{displayTitle}</h1>
          {displaySubtitle && <p className="an-header__subtitle">{displaySubtitle}</p>}
        </div>
      </div>

      {showWorkerTabs && (
        <nav className="an-header__tabs" aria-label="Navegación trabajador">
          {workerTabs.map((tab) => (
            <button
              key={tab.page}
              type="button"
              onClick={() => openAppPage(tab.page)}
              className={`an-header__tab${tab.titles.includes(effectiveTitle) ? " is-active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {showContractTabs && (
        <nav className="an-header__tabs" aria-label="Navegación contratos">
          {contractTabs.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              onClick={() => changeContractTab(tab.mode)}
              className={`an-header__tab${contractMode === tab.mode ? " is-active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {settingsOpen && (
        <div className="an-header__modal-overlay" role="presentation">
          <section className="an-header__modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="an-header__modal-header">
              <div>
                <p className="an-header__kicker">Configuración</p>
                <h2 className="an-header__modal-title" id="settings-title">Ajustes del entorno</h2>
              </div>
              <button type="button" className="an-header__plain-button" onClick={onCloseSettings} aria-label="Cerrar ajustes">
                <X size={16} aria-hidden="true" /> Cerrar
              </button>
            </div>

            <div className="an-header__warning">
              <strong>Vaciar entorno de trabajo</strong>
              <p>
                Elimina todas las empresas y sus datos asociados: centros, trabajadores, contratos,
                incidencias, nóminas, ficheros y comunicaciones. Los catálogos generales del sistema se conservan.
              </p>
            </div>

            {resetDemoError && <p className="an-header__message an-header__message--error">{resetDemoError}</p>}
            {resetDemoMessage && <p className="an-header__message">{resetDemoMessage}</p>}

            <div className="an-header__modal-actions">
              <span />
              <button
                type="button"
                className="an-header__danger-button"
                onClick={onResetDemo}
                disabled={resetDemoLoading}
              >
                {resetDemoLoading ? "Vaciando…" : "Vaciar entorno"}
              </button>
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
