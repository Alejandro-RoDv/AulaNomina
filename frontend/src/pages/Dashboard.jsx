import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  MapPin,
  Receipt,
  Users,
} from "lucide-react";

import { Page } from "../components/layout";
import "./Dashboard.css";
import "./DashboardCalendar.css";
import "./DashboardCompact.css";

const INCIDENT_TYPE_LABELS = {
  IT: "Incapacidad temporal",
  RECAIDA: "Recaída",
  NACIMIENTO_CUIDADO: "Nacimiento y cuidado",
  RIESGO_EMBARAZO: "Riesgo durante el embarazo",
  RIESGO_LACTANCIA: "Riesgo durante la lactancia",
  CUIDADO_MENOR: "Cuidado de menor",
  VACACIONES: "Vacaciones",
  AUSENCIA: "Ausencia",
  PERMISO_RETRIBUIDO: "Permiso retribuido",
  PERMISO_NO_RETRIBUIDO: "Permiso no retribuido",
  SUSPENSION: "Suspensión",
  SANCION: "Sanción",
  HORAS_EXTRA: "Horas extraordinarias",
  MOVIMIENTO: "Movimiento laboral",
};

function getPayrollPeriod(payroll) {
  if (!payroll) return "Sin generar";
  if (payroll.period_label) return payroll.period_label;
  return `${String(payroll.period_month || "").padStart(2, "0")}/${payroll.period_year || ""}`;
}

function parseLocalDate(value) {
  if (!value) return null;
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameMonth(date, reference) {
  return date
    && date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth();
}

function formatMonthLabel(date) {
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
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
  const [showAllCalendarEvents, setShowAllCalendarEvents] = useState(false);

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
  const latestPayroll = [...payrolls].sort((leftPayroll, rightPayroll) => {
    const left = Number(
      `${leftPayroll.period_year || 0}${String(leftPayroll.period_month || 0).padStart(2, "0")}`,
    );
    const right = Number(
      `${rightPayroll.period_year || 0}${String(rightPayroll.period_month || 0).padStart(2, "0")}`,
    );
    return right - left;
  })[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthlyDate = (day) => new Date(currentYear, currentMonth, Math.min(day, lastDayOfMonth));

  const quickActions = [
    {
      label: "Nueva empresa",
      icon: Building2,
      onClick: () => openPage("companies", {
        hash: "#company-companies",
        modeGroup: "companies",
        modeValue: "new",
      }),
    },
    {
      label: "Nuevo trabajador",
      icon: Users,
      onClick: () => openPage("employees"),
    },
    {
      label: "Nuevo contrato",
      icon: FileText,
      onClick: () => openPage("contracts", { modeGroup: "contracts", modeValue: "new" }),
    },
    {
      label: "Preparar nómina",
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
      description: "Borradores, cálculos o periodos sin cerrar.",
      icon: Receipt,
      onClick: () => openPage("payroll-monthly-preparation"),
    },
    {
      title: "Incidencias abiertas",
      count: openIncidents,
      description: "Bajas, ausencias, vacaciones y permisos activos.",
      icon: Activity,
      onClick: () => openPage("incidents", { modeGroup: "incidents", modeValue: "list" }),
    },
    {
      title: "Contratos sin convenio",
      count: contractsWithoutAgreement,
      description: "Relaciones activas sin convenio colectivo.",
      icon: BookOpen,
      onClick: () => openPage("contracts", { modeGroup: "contracts", modeValue: "history" }),
    },
    {
      title: "Contratos sin salario base",
      count: contractsWithoutSalary,
      description: "Dato necesario para calcular la nómina.",
      icon: AlertTriangle,
      onClick: () => openPage("contracts", { modeGroup: "contracts", modeValue: "history" }),
    },
  ];

  const contractEvents = activeContractRecords
    .map((contract) => ({ contract, date: parseLocalDate(contract.end_date) }))
    .filter(({ date }) => isSameMonth(date, today))
    .map(({ contract, date }) => ({
      id: `contract-${contract.id}`,
      date,
      title: "Fin de contrato",
      description: contract.employee_name || contract.contract_code_description || "Contrato activo",
      category: "Contrato",
      tone: "warning",
      onClick: () => openPage("contracts", { modeGroup: "contracts", modeValue: "history" }),
    }));

  const incidentEvents = incidents
    .filter((incident) => incident.status !== "cancelled")
    .flatMap((incident) => {
      const label = INCIDENT_TYPE_LABELS[incident.incident_type] || "Incidencia laboral";
      const employee = incident.employee_name || `Trabajador ${incident.employee_id || ""}`.trim();
      const events = [];
      const startDate = parseLocalDate(incident.start_date);
      const endDate = parseLocalDate(incident.end_date);

      if (isSameMonth(startDate, today)) {
        events.push({
          id: `incident-start-${incident.id}`,
          date: startDate,
          title: `Inicio de ${label.toLowerCase()}`,
          description: employee,
          category: "Incidencia",
          tone: "info",
          onClick: () => openPage("incidents", { modeGroup: "incidents", modeValue: "list" }),
        });
      }

      if (isSameMonth(endDate, today)) {
        events.push({
          id: `incident-end-${incident.id}`,
          date: endDate,
          title: `Fin previsto de ${label.toLowerCase()}`,
          description: employee,
          category: "Incidencia",
          tone: "success",
          onClick: () => openPage("incidents", { modeGroup: "incidents", modeValue: "list" }),
        });
      }

      return events;
    });

  const operationalEvents = [
    {
      id: "monthly-incidents-cutoff",
      date: monthlyDate(5),
      title: "Revisión de incidencias",
      description: "Comprueba bajas, ausencias y permisos.",
      category: "Incidencias",
      tone: "info",
      onClick: () => openPage("incidents", { modeGroup: "incidents", modeValue: "list" }),
    },
    {
      id: "monthly-payroll-opening",
      date: monthlyDate(15),
      title: "Preparación de nómina",
      description: pendingPayrolls > 0
        ? `${pendingPayrolls} nómina${pendingPayrolls === 1 ? "" : "s"} pendiente${pendingPayrolls === 1 ? "" : "s"}.`
        : "Abre o revisa el periodo mensual.",
      category: "Nómina",
      tone: pendingPayrolls > 0 ? "warning" : "info",
      onClick: () => openPage("payroll-monthly-preparation"),
    },
    {
      id: "monthly-cra-review",
      date: monthlyDate(20),
      title: "Revisión de ficheros CRA",
      description: "Valida los conceptos retributivos.",
      category: "Seguridad Social",
      tone: "neutral",
      onClick: () => openPage("social-security-dashboard", { hash: "#cra-files" }),
    },
    {
      id: "monthly-payroll-review",
      date: monthlyDate(25),
      title: "Revisión de nóminas",
      description: "Comprueba resultados e importes.",
      category: "Nómina",
      tone: "warning",
      onClick: () => openPage("payroll-monthly-preparation"),
    },
    {
      id: "monthly-close",
      date: monthlyDate(lastDayOfMonth),
      title: "Cierre del periodo mensual",
      description: "Revisa los procesos antes del cierre.",
      category: "Cierre mensual",
      tone: "neutral",
      onClick: () => openPage("payroll-monthly-preparation"),
    },
  ];

  const actualEvents = [...contractEvents, ...incidentEvents]
    .sort((left, right) => left.date - right.date)
    .slice(0, 3);
  const operationalSlots = Math.max(0, 5 - actualEvents.length);
  const selectedOperationalEvents = [...operationalEvents]
    .sort((left, right) => {
      const leftPast = left.date < today;
      const rightPast = right.date < today;
      if (leftPast !== rightPast) return leftPast ? 1 : -1;
      return leftPast ? right.date - left.date : left.date - right.date;
    })
    .slice(0, operationalSlots);
  const calendarEvents = [...actualEvents, ...selectedOperationalEvents]
    .sort((left, right) => left.date - right.date);
  const upcomingCalendarEvents = calendarEvents.filter((event) => event.date >= today);
  const pastCalendarEvents = calendarEvents.filter((event) => event.date < today);
  const defaultCalendarEvents = upcomingCalendarEvents.length > 0
    ? upcomingCalendarEvents.slice(0, 4)
    : pastCalendarEvents.slice(-4);
  const visibleCalendarEvents = showAllCalendarEvents ? calendarEvents : defaultCalendarEvents;
  const hiddenCalendarEvents = Math.max(0, calendarEvents.length - defaultCalendarEvents.length);
  const upcomingEvents = upcomingCalendarEvents.length;

  return (
    <Page className="an-dashboard" spacing="default">
      <section className="an-dashboard__intro" aria-labelledby="dashboard-welcome-title">
        <div className="an-dashboard__intro-copy">
          <h2 id="dashboard-welcome-title">Bienvenido</h2>
          <p>Consulta el estado general y accede a las operaciones más habituales.</p>
        </div>
        <div className="an-dashboard__intro-meta" aria-label="Estado del entorno">
          <span className="an-dashboard__availability">Entorno disponible</span>
          <span>Última nómina: <strong>{getPayrollPeriod(latestPayroll)}</strong></span>
        </div>
      </section>

      <section className="an-dashboard__quick-toolbar" aria-labelledby="dashboard-quick-actions-title">
        <div className="an-dashboard__quick-heading">
          <p className="an-dashboard__section-label" id="dashboard-quick-actions-title">Acciones rápidas</p>
          <span>Operaciones frecuentes</span>
        </div>
        <div className="an-dashboard__quick-row">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label} type="button" className="an-dashboard__quick-button" onClick={action.onClick}>
                <span className="an-dashboard__quick-button-icon" aria-hidden="true"><Icon /></span>
                <strong>{action.label}</strong>
                <ArrowRight aria-hidden="true" />
              </button>
            );
          })}
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

        <aside className="an-dashboard__panel an-dashboard__calendar" aria-labelledby="dashboard-calendar-title">
          <div className="an-dashboard__panel-heading an-dashboard__calendar-heading">
            <div>
              <p className="an-dashboard__section-label">Agenda mensual</p>
              <h2 id="dashboard-calendar-title">Fechas clave</h2>
              <span>Hitos laborales y administrativos del mes.</span>
            </div>
            <span className="an-dashboard__calendar-month">
              <CalendarDays aria-hidden="true" />
              {formatMonthLabel(today)}
            </span>
          </div>

          <div className="an-dashboard__calendar-list">
            {visibleCalendarEvents.map((event) => {
              const isPast = event.date < today;
              return (
                <button
                  key={event.id}
                  type="button"
                  className={`an-dashboard__calendar-event an-dashboard__calendar-event--${event.tone}${isPast ? " is-past" : ""}`}
                  onClick={event.onClick}
                  aria-label={`${event.date.getDate()} de ${formatMonthLabel(event.date)}: ${event.title}`}
                >
                  <span className="an-dashboard__calendar-date" aria-hidden="true">
                    <strong>{String(event.date.getDate()).padStart(2, "0")}</strong>
                    <small>{formatWeekday(event.date)}</small>
                  </span>
                  <span className="an-dashboard__calendar-copy">
                    <strong>{event.title}</strong>
                    <small>{event.description}</small>
                  </span>
                  <span className="an-dashboard__calendar-category">{event.category}</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className="an-dashboard__calendar-footer">
            <span className="an-dashboard__calendar-footer-copy">
              <Clock3 aria-hidden="true" />
              <span>
                {upcomingEvents > 0
                  ? `${upcomingEvents} fecha${upcomingEvents === 1 ? "" : "s"} todavía por llegar este mes.`
                  : "No quedan fechas programadas este mes."}
              </span>
            </span>
            {hiddenCalendarEvents > 0 && (
              <button
                type="button"
                className="an-dashboard__calendar-toggle"
                onClick={() => setShowAllCalendarEvents((current) => !current)}
                aria-expanded={showAllCalendarEvents}
              >
                {showAllCalendarEvents ? "Mostrar próximas" : `Ver todas (${calendarEvents.length})`}
                <ChevronDown aria-hidden="true" />
              </button>
            )}
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