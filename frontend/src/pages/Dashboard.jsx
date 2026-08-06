import {
  Activity,
  BookOpen,
  Building2,
  Check,
  Database,
  FileText,
  Landmark,
  MapPin,
  Minus,
  Network,
  Receipt,
  UserCheck,
  Users,
} from "lucide-react";

import { Page, PageGrid } from "../components/layout";
import { Badge, ContentCard, StatCard, StatusCard } from "../components/ui";
import "./Dashboard.css";

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getPayrollPeriod(payroll) {
  if (!payroll) return "-";
  if (payroll.period_label) return payroll.period_label;
  return `${String(payroll.period_month || "").padStart(2, "0")}/${payroll.period_year || ""}`;
}

function getStatusLevel(done, warning = false) {
  if (done) return "ok";
  if (warning) return "warning";
  return "pending";
}

function getStatusTone(status) {
  if (status === "ok") return "success";
  if (status === "warning") return "warning";
  return "neutral";
}

function getProcessTone(status) {
  return status.includes("Pendiente") || status.includes("Sin") ? "neutral" : "success";
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
  const activeContracts = contracts.filter((contract) => contract.status === "active").length;
  const openIncidents = incidents.filter((incident) => incident.status === "open").length;
  const activeAgreements = collectiveAgreements.filter((agreement) => agreement.is_active !== false).length;
  const contractsWithAgreement = contracts.filter(
    (contract) => contract.collective_agreement_id || contract.collective_agreement_code,
  ).length;
  const contractsWithSalary = contracts.filter(
    (contract) => contract.salary_base !== null
      && contract.salary_base !== undefined
      && contract.salary_base !== "",
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

  const stats = [
    {
      label: "Empresas activas",
      value: activeCompanies,
      description: "Entidades disponibles para simulación",
      icon: Building2,
      tone: "info",
    },
    {
      label: "Centros activos",
      value: activeCenters,
      description: "Colegios, sedes o centros de trabajo",
      icon: MapPin,
      tone: "neutral",
    },
    {
      label: "Trabajadores activos",
      value: activeEmployees,
      description: "Personas disponibles en el flujo laboral",
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
      label: "Convenios activos",
      value: activeAgreements,
      description: "Parámetros didácticos de convenio",
      icon: BookOpen,
      tone: "brand",
    },
    {
      label: "Nóminas pendientes",
      value: pendingPayrolls,
      description: "Borrador, pendiente o calculada",
      icon: Receipt,
      tone: pendingPayrolls > 0 ? "warning" : "success",
    },
  ];

  const processHealth = [
    {
      title: "Base organizativa",
      status: activeCompanies > 0 && activeCenters > 0 ? "Operativa" : "Pendiente",
      description: "Empresas y centros preparados para trabajar con datos demo.",
      icon: Building2,
    },
    {
      title: "Ciclo laboral",
      status: activeEmployees > 0 && activeContracts > 0 ? "Operativo" : "Pendiente",
      description: "Trabajadores vinculados a contratos y centros.",
      icon: UserCheck,
    },
    {
      title: "Convenios",
      status: activeAgreements > 0 ? "Con datos" : "Sin datos",
      description: "Referencias disponibles para contratos y casos prácticos.",
      icon: BookOpen,
    },
    {
      title: "Incidencias",
      status: incidents.length > 0 ? "Con datos" : "Sin datos",
      description: "Registro de bajas, ausencias, vacaciones y permisos.",
      icon: Activity,
    },
    {
      title: "Nómina simulada",
      status: payrolls.length > 0 ? "Con nóminas" : "Sin nóminas",
      description: "Preparación mensual y consulta de importes simulados.",
      icon: Receipt,
    },
  ];

  const demoChecklist = [
    { label: "Empresa demo cargada", done: activeCompanies > 0 },
    { label: "Centros configurados", done: activeCenters > 0 },
    { label: "Trabajadores disponibles", done: activeEmployees > 0 },
    { label: "Contratos activos", done: activeContracts > 0 },
    { label: "Convenio demo cargado", done: activeAgreements > 0 },
    { label: "Contratos con salario base", done: contractsWithSalary > 0 },
    { label: "Incidencias registradas", done: incidents.length > 0 },
    { label: "Nóminas generadas", done: payrolls.length > 0 },
  ];

  const systemChecks = [
    {
      label: "Carga global de datos",
      status: getStatusLevel(companies.length + employees.length + contracts.length + payrolls.length > 0),
      value: `${companies.length + employees.length + contracts.length + payrolls.length} registros base`,
      hint: "Si queda a cero tras reset demo, revisar endpoints base.",
      icon: Database,
    },
    {
      label: "Estructura empresa-centro",
      status: getStatusLevel(activeCompanies > 0 && activeCenters > 0),
      value: `${activeCompanies} empresas · ${activeCenters} centros`,
      hint: "Necesario para crear trabajadores y contratos coherentes.",
      icon: Network,
    },
    {
      label: "Trabajadores y contratos",
      status: getStatusLevel(activeEmployees > 0 && contracts.length > 0),
      value: `${activeEmployees} trabajadores · ${contracts.length} contratos`,
      hint: "Base del ciclo laboral del MVP.",
      icon: UserCheck,
    },
    {
      label: "Convenios",
      status: getStatusLevel(activeAgreements > 0),
      value: `${activeAgreements} convenios · ${contractsWithAgreement} contratos vinculados`,
      hint: "Debe existir al menos el convenio demo SIM-ADM-2026.",
      icon: Landmark,
    },
    {
      label: "Nómina e incidencias",
      status: getStatusLevel(payrolls.length > 0 || incidents.length > 0, true),
      value: `${payrolls.length} nóminas · ${incidents.length} incidencias`,
      hint: "No bloquea la demo, pero conviene tener datos visibles.",
      icon: Activity,
    },
  ];

  return (
    <Page className="an-dashboard" spacing="relaxed">
      <section className="an-dashboard__hero">
        <div className="an-dashboard__hero-copy">
          <Badge tone="brand">Demo comercial</Badge>
          <h2 className="an-dashboard__hero-title">Entorno de simulación laboral listo para trabajar</h2>
          <p className="an-dashboard__hero-description">
            Consulta la estructura empresarial, los trabajadores, contratos, convenios,
            incidencias y nóminas desde una vista operativa y orientada a la docencia.
          </p>
          <div className="an-dashboard__hero-context">
            <span>Sistema disponible</span>
            <span>{openIncidents} incidencias abiertas</span>
            <span>{pendingPayrolls} nóminas pendientes</span>
          </div>
        </div>

        <div className="an-dashboard__summary" aria-label="Resumen de nómina">
          <div className="an-dashboard__summary-row">
            <span>Última nómina</span>
            <strong>{latestPayroll ? getPayrollPeriod(latestPayroll) : "Sin generar"}</strong>
          </div>
          <div className="an-dashboard__summary-row">
            <span>Neto acumulado</span>
            <strong>{formatMoney(totalNetPayroll)}</strong>
          </div>
          <div className="an-dashboard__summary-row">
            <span>Nóminas cerradas</span>
            <strong>{closedPayrolls}</strong>
          </div>
        </div>
      </section>

      <PageGrid columns={3}>
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </PageGrid>

      <ContentCard
        title="Estado del sistema"
        description="Control rápido de regresión antes de enseñar la demo."
      >
        <div className="an-dashboard__system-grid">
          {systemChecks.map((item) => (
            <StatusCard
              key={item.label}
              title={item.label}
              value={item.value}
              description={item.hint}
              status={item.status === "ok" ? "OK" : item.status === "warning" ? "Revisar" : "Pendiente"}
              tone={getStatusTone(item.status)}
              icon={item.icon}
            />
          ))}
        </div>
      </ContentCard>

      <div className="an-dashboard__columns">
        <ContentCard
          title="Estado del flujo principal"
          description="Lectura rápida de la demo funcional."
        >
          <div className="an-dashboard__process-list">
            {processHealth.map((process) => (
              <StatusCard
                key={process.title}
                title={process.title}
                description={process.description}
                status={process.status}
                tone={getProcessTone(process.status)}
                icon={process.icon}
                compact
              />
            ))}
          </div>
        </ContentCard>

        <ContentCard
          title="Checklist demo"
          description="Preparación para enseñar el producto."
        >
          <div className="an-dashboard__checklist">
            {demoChecklist.map((item) => {
              const Icon = item.done ? Check : Minus;
              return (
                <div key={item.label} className="an-dashboard__check-item">
                  <span className={`an-dashboard__check-icon${item.done ? " is-complete" : ""}`}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </ContentCard>
      </div>
    </Page>
  );
}
