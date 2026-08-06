import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  FileText,
  MapPin,
  Receipt,
  Users,
} from "lucide-react";

import { Page } from "../components/layout";
import "./Dashboard.css";

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getPayrollPeriod(payroll) {
  if (!payroll) return "Sin generar";
  if (payroll.period_label) return payroll.period_label;
  return `${String(payroll.period_month || "").padStart(2, "0")}/${payroll.period_year || ""}`;
}

function clearCurrentHash() {
  if (!window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function openPage(page, { hash = "", modeGroup = "", modeValue = "" } = {}) {
  if (hash) window.location.hash = hash;
  else clearCurrentHash();

  if (modeGroup && modeValue) {
    window.sessionStorage.setItem(`aulanomina:${modeGroup}Mode`, modeValue);
  }

  if (modeGroup === "contracts") window.dispatchEvent(new Event("aulanomina-contract-mode"));
  if (modeGroup === "incidents") window.dispatchEvent(new Event("aulanomina-incidents-mode"));
  if (hash) window.dispatchEvent(new Event("aulanomina-route-change"));

  window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page } }));
}

export default function Dashboard({
  companies = [],
  workCenters = [],
  employees = [],
  contracts = [],
  incidents = [],
  payrolls = [],
  collectiveAgreements = [],
}) {
  const activeCompanies = companies.filter((company) => company.is_active !== false).length;
  const activeCenters = workCenters.filter((center) => center.is_active !== false).length;
  const activeEmployees = employees.filter((employee) => employee.is_active !== false).length;
  const activeContractRecords = contracts.filter((contract) => contract.status === "active");
  const activeContracts = activeContractRecords.length;
  const openIncidents = incidents.filter((incident) => incident.status === "open").length;
  const activeAgreements = collectiveAgreements.filter((agreement) => agreement.is_active !== false).length;
  const contractsWithoutAgreement = activeContractRecords.filter(
    (contract) => !contract.collective_agreement_id && !contract.collective_agreement_code,
  ).length;
  const contractsWithoutSalary = activeContractRecords.filter(
    (contract) => contract.salary_base === null
      || contract.salary_base === undefined
      || contract.salary_base === "",
  ).length;
  const pendingPayrolls = payrolls.filter((payroll) =>
    ["draft", "pending", "calculated"].includes(payroll.status)
  ).length;
  const closedPayrolls = payrolls.filter((payroll) => payroll.status === "closed").length;
  const totalNetPayroll = payrolls.reduce(
    (accumulator, payroll) => accumulator + Number(payroll.net_salary || 0),
    0,
  );
  const latestPayroll = [...payrolls].sort((leftPayroll, rightPayroll) => {
    const left = Number(
      `${leftPayroll.period_year || 0}${String(leftPayroll.period_month || 0).padStart(2, "0")}`,
    );
    const right = Number(
      `${rightPayroll.period_year || 0}${String(rightPayroll.period_month || 0).padStart(2, "0")}`,
    );
    return right - left;
  })[0];

  const quickActions = [
    {
      label: "Nueva empresa",
      description: "Crear estructura",
      icon: Building2,
      onClick: () => openPage("companies", {
        hash: "#company-companies",
        modeGroup: "companies",
        modeValue: "new",
      }),
    },
    {
      label: "Nuevo trabajador",
      description: "Dar de alta",
      icon: Users,
      onClick: () => openPage("employees"),
    },
    {
      label: "Nuevo contrato",
      description: "Iniciar relación",
      icon: FileText,
      onClick: () => openPage("contracts", { modeGroup: "contracts", modeValue: "new" }),
    },
    {
      label: "Preparar nómina",
      description: "Abrir periodo",
      icon: Receipt,
      onClick: () => openPage("payroll-monthly-preparation"),
    },
  ];

  const metrics = [
    {
      label: "Trabajadores activos",
      value: activeEmployees,
      description: "Personas disponibles en el entorno",
      icon: Users,
      tone: "info",
    },
    {
      label: "Contratos activos",
      value: activeContracts,
      description: "Relaciones laborales vigentes",
      icon: FileText,
      tone: "neutral",
    },
    {
      label: "Nóminas pendientes",
      value: pendingPayrolls,
      description: pendingPayrolls > 0 ? "Requieren revisión o cierre" : "No hay trabajo pendiente",
      icon: Receipt,
      tone: pendingPayrolls > 0 ? "warning" : "success",
    },
    {
      label: "Incidencias abiertas",
      value: openIncidents,
      description: openIncidents > 0 ? "Bajas, ausencias o permisos" : "Sin incidencias por revisar",
      icon: Activity,
      tone: openIncidents > 0 ? "warning" : "success",
    },
  ];

  const attentionItems = [
    {
      title: "Nóminas pendientes",
      count: pendingPayrolls,
      description: "Borradores, cálculos o periodos todavía sin cerrar.",
      icon: Receipt,
      onClick: () => openPage("payroll-monthly-preparation"),
    },
    {
      title: "Incidencias abiertas",
      count: openIncidents,
      description: "Revisa bajas, ausencias, vacaciones y permisos activos.",
      icon: Activity,
      onClick: () => openPage("incidents", { modeGroup: "incidents", modeValue: "list" }),
    },
    {
      title: "Contratos sin convenio",
      count: contractsWithoutAgreement,
      description: "Contratos activos sin referencia de convenio colectivo.",
      icon: BookOpen,
      onClick: () => openPage("contracts", { modeGroup: "contracts", modeValue: "history" }),
    },
    {
      title: "Contratos sin salario base",
      count: contractsWithoutSalary,
      description: "Datos necesarios para una simulación salarial coherente.",
      icon: AlertTriangle,
      onClick: () => openPage("contracts", { modeGroup: "contracts", modeValue: "history" }),
    },
  ];

  const readinessChecks = [
    { label: "Empresa disponible", done: activeCompanies > 0 },
    { label: "Centro de trabajo configurado", done: activeCenters > 0 },
    { label: "Trabajadores cargados", done: activeEmployees > 0 },
    { label: "Contratos activos", done: activeContracts > 0 },
    { label: "Convenio colectivo disponible", done: activeAgreements > 0 },
    { label: "Nóminas generadas", done: payrolls.length > 0 },
  ];
  const completedReadiness = readinessChecks.filter((item) => item.done).length;
  const readinessPercent = Math.round((completedReadiness / readinessChecks.length) * 100);

  return (
    <Page className="an-dashboard" spacing="default">
      <section className="an-dashboard__welcome">
        <div className="an-dashboard__welcome-copy">
          <span className="an-dashboard__welcome-icon" aria-hidden="true">
            <Building2 />
          </span>
          <div>
            <p className="an-dashboard__section-label">AulaNomina</p>
            <h2>Bienvenido a AulaNomina</h2>
            <p>
              Consulta y gestiona empresas, trabajadores, contratos, incidencias y nóminas
              desde un único espacio de trabajo.
            </p>
            <div className="an-dashboard__welcome-meta">
              <span className="an-dashboard__availability">Entorno disponible</span>
              <span>Última nómina: {getPayrollPeriod(latestPayroll)}</span>
            </div>
          </div>
        </div>

        <div className="an-dashboard__quick-area">
          <p className="an-dashboard__section-label">Acciones rápidas</p>
          <div className="an-dashboard__quick-grid">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} type="button" className="an-dashboard__quick-action" onClick={action.onClick}>
                  <span className="an-dashboard__quick-icon" aria-hidden="true"><Icon /></span>
                  <span>
                    <strong>{action.label}</strong>
                    <small>{action.description}</small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="an-dashboard__overview" aria-labelledby="dashboard-overview-title">
        <div className="an-dashboard__section-heading">
          <div>
            <p className="an-dashboard__section-label">Vista general</p>
            <h2 id="dashboard-overview-title">Situación actual</h2>
          </div>
          <p>{activeCompanies} empresas · {activeCenters} centros · {activeAgreements} convenios</p>
        </div>

        <div className="an-dashboard__metrics">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label} className={`an-dashboard__metric an-dashboard__metric--${metric.tone}`}>
                <span className="an-dashboard__metric-icon" aria-hidden="true"><Icon /></span>
                <div>
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                  <span>{metric.description}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="an-dashboard__main-grid">
        <section className="an-dashboard__panel" aria-labelledby="dashboard-attention-title">
          <div className="an-dashboard__panel-heading">
            <div>
              <p className="an-dashboard__section-label">Trabajo pendiente</p>
              <h2 id="dashboard-attention-title">Qué requiere atención</h2>
              <span>Accede directamente a los procesos que necesitan revisión.</span>
            </div>
          </div>

          <div className="an-dashboard__attention-list">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              const isPending = item.count > 0;
              return (
                <button key={item.title} type="button" className="an-dashboard__attention-item" onClick={item.onClick}>
                  <span className={`an-dashboard__attention-icon${isPending ? " is-pending" : ""}`} aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="an-dashboard__attention-copy">
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className={`an-dashboard__attention-status${isPending ? " is-pending" : ""}`}>
                    {isPending ? item.count : "Al día"}
                  </span>
                  <ArrowRight className="an-dashboard__attention-arrow" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <aside className="an-dashboard__panel an-dashboard__readiness" aria-labelledby="dashboard-readiness-title">
          <div className="an-dashboard__panel-heading">
            <div>
              <p className="an-dashboard__section-label">Estado general</p>
              <h2 id="dashboard-readiness-title">Configuración del entorno</h2>
              <span>{completedReadiness} de {readinessChecks.length} elementos preparados.</span>
            </div>
            <strong className="an-dashboard__readiness-value">{readinessPercent}%</strong>
          </div>

          <div className="an-dashboard__progress" aria-label={`Configuración del entorno: ${readinessPercent}%`}>
            <span style={{ width: `${readinessPercent}%` }} />
          </div>

          <div className="an-dashboard__readiness-list">
            {readinessChecks.map((item) => (
              <div key={item.label} className="an-dashboard__readiness-item">
                <span className={`an-dashboard__readiness-check${item.done ? " is-complete" : ""}`} aria-hidden="true">
                  {item.done && <Check />}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="an-dashboard__payroll-summary">
            <div>
              <span>Neto acumulado</span>
              <strong>{formatMoney(totalNetPayroll)}</strong>
            </div>
            <div>
              <span>Nóminas cerradas</span>
              <strong>{closedPayrolls}</strong>
            </div>
          </div>
        </aside>
      </div>

      <footer className="an-dashboard__context-strip" aria-label="Resumen estructural del entorno">
        <span><Building2 aria-hidden="true" /> {activeCompanies} empresas</span>
        <span><MapPin aria-hidden="true" /> {activeCenters} centros</span>
        <span><Users aria-hidden="true" /> {activeEmployees} trabajadores</span>
        <span><FileText aria-hidden="true" /> {activeContracts} contratos activos</span>
      </footer>
    </Page>
  );
}
