import PageCard from "../components/layout/PageCard";

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

export default function Dashboard({
  companies = [],
  workCenters = [],
  employees = [],
  contracts = [],
  incidents = [],
  payrolls = [],
}) {
  const activeCompanies = companies.filter((company) => company.is_active !== false).length;
  const activeCenters = workCenters.filter((center) => center.is_active !== false).length;
  const activeEmployees = employees.filter((employee) => employee.is_active !== false).length;
  const activeContracts = contracts.filter((contract) => contract.status === "active").length;
  const openIncidents = incidents.filter((incident) => incident.status === "open").length;
  const pendingPayrolls = payrolls.filter((payroll) => ["draft", "pending", "calculated"].includes(payroll.status)).length;
  const closedPayrolls = payrolls.filter((payroll) => payroll.status === "closed").length;
  const totalNetPayroll = payrolls.reduce((acc, payroll) => acc + Number(payroll.net_salary || 0), 0);
  const latestPayroll = [...payrolls].sort((a, b) => {
    const left = Number(`${a.period_year || 0}${String(a.period_month || 0).padStart(2, "0")}`);
    const right = Number(`${b.period_year || 0}${String(b.period_month || 0).padStart(2, "0")}`);
    return right - left;
  })[0];

  const stats = [
    {
      label: "Empresas activas",
      value: activeCompanies,
      description: "Entidades disponibles para simulación",
    },
    {
      label: "Centros activos",
      value: activeCenters,
      description: "Colegios, sedes o centros de trabajo",
    },
    {
      label: "Trabajadores activos",
      value: activeEmployees,
      description: "Personas disponibles en el flujo laboral",
    },
    {
      label: "Contratos activos",
      value: activeContracts,
      description: "Relaciones laborales vigentes",
    },
    {
      label: "Incidencias abiertas",
      value: openIncidents,
      description: "IT, ausencias o permisos pendientes",
    },
    {
      label: "Nóminas pendientes",
      value: pendingPayrolls,
      description: "Borrador, pendiente o calculada",
    },
  ];

  const processHealth = [
    {
      title: "Base organizativa",
      status: activeCompanies > 0 && activeCenters > 0 ? "Operativa" : "Pendiente",
      description: "Empresas y centros preparados para trabajar con datos demo.",
    },
    {
      title: "Ciclo laboral",
      status: activeEmployees > 0 && activeContracts > 0 ? "Operativo" : "Pendiente",
      description: "Trabajadores vinculados a contratos y centros.",
    },
    {
      title: "Incidencias",
      status: incidents.length > 0 ? "Con datos" : "Sin datos",
      description: "Registro de bajas, ausencias, vacaciones y permisos.",
    },
    {
      title: "Nómina simulada",
      status: payrolls.length > 0 ? "Con nóminas" : "Sin nóminas",
      description: "Preparación mensual y consulta de importes simulados.",
    },
  ];

  const demoChecklist = [
    { label: "Empresa demo cargada", done: activeCompanies > 0 },
    { label: "Centros configurados", done: activeCenters > 0 },
    { label: "Trabajadores disponibles", done: activeEmployees > 0 },
    { label: "Contratos activos", done: activeContracts > 0 },
    { label: "Incidencias registradas", done: incidents.length > 0 },
    { label: "Nóminas generadas", done: payrolls.length > 0 },
  ];

  return (
    <div style={styles.wrapper}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Demo comercial AulaNomina</p>
          <h2 style={styles.heroTitle}>Panel ERP de simulación laboral</h2>
          <p style={styles.heroText}>
            Vista rápida del entorno docente: estructura empresarial, trabajadores, contratos, incidencias y nóminas simuladas.
          </p>
        </div>
        <div style={styles.heroMetrics}>
          <div style={styles.heroMetricBox}>
            <span>Última nómina</span>
            <strong>{latestPayroll ? getPayrollPeriod(latestPayroll) : "Sin generar"}</strong>
          </div>
          <div style={styles.heroMetricBox}>
            <span>Neto acumulado</span>
            <strong>{formatMoney(totalNetPayroll)}</strong>
          </div>
          <div style={styles.heroMetricBox}>
            <span>Nóminas cerradas</span>
            <strong>{closedPayrolls}</strong>
          </div>
        </div>
      </section>

      <div style={styles.grid}>
        {stats.map((stat) => (
          <PageCard key={stat.label}>
            <p style={styles.label}>{stat.label}</p>
            <p style={styles.value}>{stat.value}</p>
            <p style={styles.description}>{stat.description}</p>
          </PageCard>
        ))}
      </div>

      <div style={styles.columns}>
        <PageCard title="Estado del flujo principal" subtitle="Lectura rápida de la demo funcional">
          <div style={styles.processList}>
            {processHealth.map((process) => (
              <div key={process.title} style={styles.processItem}>
                <div style={styles.processMarker} />
                <div style={styles.processContent}>
                  <div style={styles.processHeader}>
                    <p style={styles.processTitle}>{process.title}</p>
                    <span style={process.status.includes("Pendiente") || process.status.includes("Sin") ? styles.neutralBadge : styles.okBadge}>
                      {process.status}
                    </span>
                  </div>
                  <p style={styles.processDescription}>{process.description}</p>
                </div>
              </div>
            ))}
          </div>
        </PageCard>

        <PageCard title="Checklist demo" subtitle="Preparación para enseñar el producto">
          <div style={styles.checklist}>
            {demoChecklist.map((item) => (
              <div key={item.label} style={styles.checkItem}>
                <span style={item.done ? styles.checkDone : styles.checkPending}>{item.done ? "✓" : "·"}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </PageCard>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 0.9fr)",
    gap: "18px",
    alignItems: "stretch",
    border: "2px solid #111111",
    borderRadius: "16px",
    padding: "24px",
    background: "linear-gradient(135deg, #ffffff 0%, #fefce8 62%, #e6d85c 100%)",
    boxShadow: "6px 6px 0 #111111",
  },
  kicker: {
    margin: 0,
    color: "#9a7b00",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: "8px 0 0",
    color: "#111827",
    fontSize: "34px",
    lineHeight: 1.05,
    fontWeight: 950,
  },
  heroText: {
    margin: "10px 0 0",
    maxWidth: "720px",
    color: "#374151",
    fontSize: "15px",
    lineHeight: 1.5,
    fontWeight: 650,
  },
  heroMetrics: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
  },
  heroMetricBox: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    border: "1px solid rgba(17, 17, 17, 0.28)",
    borderRadius: "12px",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "baseline",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "14px",
  },
  label: {
    margin: 0,
    minHeight: "34px",
    fontSize: "12px",
    color: "#6b7280",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  value: {
    margin: "8px 0 0",
    fontSize: "34px",
    lineHeight: 1,
    fontWeight: 950,
    color: "#111827",
  },
  description: {
    margin: "10px 0 0",
    fontSize: "12px",
    color: "#6b7280",
    lineHeight: 1.35,
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "16px",
    alignItems: "start",
  },
  processList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  processItem: {
    display: "flex",
    gap: "12px",
    padding: "14px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    backgroundColor: "#fafafa",
  },
  processMarker: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    backgroundColor: "#e6d85c",
    marginTop: "7px",
    flexShrink: 0,
  },
  processContent: {
    flex: 1,
    minWidth: 0,
  },
  processHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  processTitle: {
    margin: 0,
    fontWeight: 900,
    color: "#111827",
  },
  processDescription: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: "#6b7280",
    lineHeight: 1.4,
  },
  okBadge: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: "999px",
    padding: "4px 9px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  neutralBadge: {
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    padding: "4px 9px",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  checklist: {
    display: "flex",
    flexDirection: "column",
    gap: "11px",
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 750,
  },
  checkDone: {
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    backgroundColor: "#dcfce7",
    color: "#166534",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
  checkPending: {
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
};
