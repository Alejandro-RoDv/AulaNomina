function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function safeCount(items) {
  return Array.isArray(items) ? items.length : 0;
}

function getEmployeeCompanyId(employee, contracts) {
  const activeContract = contracts.find((contract) => Number(contract.employee_id) === Number(employee.id) && contract.status === "active") || contracts.find((contract) => Number(contract.employee_id) === Number(employee.id));
  return activeContract?.company_id || employee.company_id;
}

function getCompanyName(companies, companyId) {
  return companies.find((company) => String(company.id) === String(companyId))?.name || "Sin empresa";
}

function goToPage(page) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  window.dispatchEvent(new Event("aulanomina-route-change"));
  window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page } }));
}

function goToCompanySection(section) {
  const hash = section === "centers" ? "#company-centers" : section === "list" ? "#company-list" : "#company-companies";
  window.location.hash = hash;
  window.sessionStorage.setItem("aulanomina:companiesMode", section === "centers" ? "centers" : section === "list" ? "list" : "new");
  window.dispatchEvent(new Event("aulanomina-route-change"));
  window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "companies" } }));
}

function goToContractSection(mode) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  window.sessionStorage.setItem("aulanomina:contractsMode", mode);
  window.dispatchEvent(new Event("aulanomina-route-change"));
  window.dispatchEvent(new Event("aulanomina-contract-mode"));
  window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "contracts" } }));
}

function DonutCard({ title, value, total, label, help }) {
  const rate = percent(value, total);
  return (
    <article style={styles.donutCard}>
      <div style={{ ...styles.donut, background: `conic-gradient(#111827 0 ${rate}%, #e5e7eb ${rate}% 100%)` }}>
        <div style={styles.donutInner}>
          <strong>{rate}%</strong>
          <span>{value}/{total || 0}</span>
        </div>
      </div>
      <div>
        <h3 style={styles.cardTitle}>{title}</h3>
        <p style={styles.cardLabel}>{label}</p>
        <p style={styles.cardHelp}>{help}</p>
      </div>
    </article>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <article style={styles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function ActionButton({ children, onClick, secondary = false }) {
  return <button type="button" style={secondary ? styles.actionButtonSecondary : styles.actionButton} onClick={onClick}>{children}</button>;
}

function TopCompaniesList({ title, rows }) {
  return (
    <section style={styles.listCard}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {!rows.length ? <p style={styles.empty}>Sin datos suficientes.</p> : (
        <div style={styles.rankedList}>
          {rows.slice(0, 6).map((row) => (
            <div key={row.name} style={styles.rankedRow}>
              <span>{row.name}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function buildCompanyDashboard({ companies, workCenters, employees, contracts }) {
  const activeCompanies = companies.filter((company) => company.is_active !== false);
  const inactiveCompanies = companies.filter((company) => company.is_active === false);
  const activeCenters = workCenters.filter((center) => center.is_active !== false);
  const companiesWithCenters = companies.filter((company) => workCenters.some((center) => String(center.company_id) === String(company.id)));

  const employeesByCompany = companies.map((company) => ({
    name: company.name,
    value: employees.filter((employee) => String(getEmployeeCompanyId(employee, contracts)) === String(company.id)).length,
  })).sort((a, b) => b.value - a.value);

  const centersByCompany = companies.map((company) => ({
    name: company.name,
    value: workCenters.filter((center) => String(center.company_id) === String(company.id)).length,
  })).sort((a, b) => b.value - a.value);

  return {
    title: "Dashboard empresas / centros",
    subtitle: "Resumen visual de empresas, centros de trabajo y volumen asociado antes de entrar al mantenimiento.",
    metrics: [
      ["Empresas", safeCount(companies), `${activeCompanies.length} activas`],
      ["Centros", safeCount(workCenters), `${activeCenters.length} activos`],
      ["Trabajadores", safeCount(employees), "Vinculados a empresas"],
      ["Contratos", safeCount(contracts), "Histórico contractual"],
    ],
    donuts: [
      ["Empresas activas", activeCompanies.length, companies.length, "Alta operativa", "Proporción de empresas disponibles para trabajar."],
      ["Empresas con centros", companiesWithCenters.length, companies.length, "Estructura creada", "Controla qué empresas tienen al menos un centro."],
      ["Centros activos", activeCenters.length, workCenters.length, "Centros disponibles", "Centros utilizables para altas, contratos y nóminas."],
    ],
    lists: [
      ["Trabajadores por empresa", employeesByCompany],
      ["Centros por empresa", centersByCompany],
    ],
    actions: [
      ["Nueva empresa", () => goToCompanySection("new")],
      ["Centros", () => goToCompanySection("centers")],
      ["Listado empresas", () => goToCompanySection("list")],
    ],
  };
}

function buildWorkerDashboard({ companies, workCenters, employees, contracts }) {
  const activeEmployees = employees.filter((employee) => employee.is_active !== false);
  const inactiveEmployees = employees.filter((employee) => employee.is_active === false);
  const employeesWithContract = employees.filter((employee) => contracts.some((contract) => Number(contract.employee_id) === Number(employee.id)));
  const employeesWithCenter = employees.filter((employee) => Boolean(employee.center_id));

  const employeesByCompany = companies.map((company) => ({
    name: company.name,
    value: employees.filter((employee) => String(getEmployeeCompanyId(employee, contracts)) === String(company.id)).length,
  })).sort((a, b) => b.value - a.value);

  const employeesByCenter = workCenters.map((center) => ({
    name: center.name,
    value: employees.filter((employee) => String(employee.center_id) === String(center.id)).length,
  })).sort((a, b) => b.value - a.value);

  return {
    title: "Dashboard trabajadores",
    subtitle: "Vista previa del volumen de trabajadores antes de entrar al alta, listado o expediente.",
    metrics: [
      ["Trabajadores", safeCount(employees), `${activeEmployees.length} activos`],
      ["Activos", activeEmployees.length, `${inactiveEmployees.length} inactivos`],
      ["Con contrato", employeesWithContract.length, "Tienen relación contractual"],
      ["Con centro", employeesWithCenter.length, "Asignación organizativa"],
    ],
    donuts: [
      ["Trabajadores activos", activeEmployees.length, employees.length, "Plantilla viva", "Proporción de trabajadores actualmente activos."],
      ["Con contrato", employeesWithContract.length, employees.length, "Expediente laboral", "Trabajadores con al menos un contrato registrado."],
      ["Con centro", employeesWithCenter.length, employees.length, "Asignación centro", "Trabajadores ubicados en un centro de trabajo."],
    ],
    lists: [
      ["Trabajadores por empresa", employeesByCompany],
      ["Trabajadores por centro", employeesByCenter],
    ],
    actions: [
      ["Nuevo trabajador", () => goToPage("employees")],
      ["Listado trabajadores", () => goToPage("employees-list")],
      ["Expediente", () => goToPage("employee-record")],
    ],
  };
}

function buildContractDashboard({ companies, employees, contracts }) {
  const activeContracts = contracts.filter((contract) => contract.status === "active" || (!contract.end_date && contract.status !== "closed"));
  const endedContracts = contracts.filter((contract) => contract.end_date || contract.status === "closed" || contract.status === "expired");
  const indefiniteContracts = contracts.filter((contract) => String(contract.contract_code || "").startsWith("1") || String(contract.contract_code || "").startsWith("2"));
  const temporaryContracts = contracts.filter((contract) => String(contract.contract_code || "").startsWith("4") || String(contract.contract_code || "").startsWith("5"));
  const partTimeContracts = contracts.filter((contract) => contract.working_day_type === "part_time" || Number(contract.partiality_coefficient) > 0);

  const contractsByCompany = companies.map((company) => ({
    name: company.name,
    value: contracts.filter((contract) => String(contract.company_id) === String(company.id)).length,
  })).sort((a, b) => b.value - a.value);

  const contractsByWorker = employees.map((employee) => ({
    name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || `Trabajador ${employee.id}`,
    value: contracts.filter((contract) => Number(contract.employee_id) === Number(employee.id)).length,
  })).sort((a, b) => b.value - a.value);

  return {
    title: "Dashboard contratos",
    subtitle: "Resumen contractual antes de crear contratos, revisar histórico o preparar impresión.",
    metrics: [
      ["Contratos", safeCount(contracts), `${activeContracts.length} activos`],
      ["Finalizados", endedContracts.length, "Con fecha de fin o cerrados"],
      ["Indefinidos", indefiniteContracts.length, "Códigos 100-299"],
      ["Temporales", temporaryContracts.length, "Códigos 400-599"],
    ],
    donuts: [
      ["Contratos activos", activeContracts.length, contracts.length, "Relaciones vigentes", "Contratos que siguen operativos o sin fecha final."],
      ["Indefinidos", indefiniteContracts.length, contracts.length, "Estabilidad", "Contratos identificados como indefinidos por código."],
      ["Jornada parcial", partTimeContracts.length, contracts.length, "Parcialidad", "Contratos con jornada parcial o coeficiente de parcialidad."],
    ],
    lists: [
      ["Contratos por empresa", contractsByCompany],
      ["Contratos por trabajador", contractsByWorker],
    ],
    actions: [
      ["Nuevo contrato", () => goToContractSection("new")],
      ["Historial contratos", () => goToContractSection("history")],
      ["Impresión contratos", () => goToContractSection("print")],
    ],
  };
}

function getDashboardData(type, props) {
  if (type === "companies") return buildCompanyDashboard(props);
  if (type === "workers") return buildWorkerDashboard(props);
  return buildContractDashboard(props);
}

export default function ModuleDashboardPage({ type, companies = [], workCenters = [], employees = [], contracts = [] }) {
  const dashboard = getDashboardData(type, { companies, workCenters, employees, contracts });

  return (
    <div style={styles.wrapper}>
      <section style={styles.heroCard}>
        <div>
          <p style={styles.kicker}>Resumen del módulo</p>
          <h2 style={styles.title}>{dashboard.title}</h2>
          <p style={styles.subtitle}>{dashboard.subtitle}</p>
        </div>
        <div style={styles.actions}>{dashboard.actions.map(([label, onClick]) => <ActionButton key={label} onClick={onClick}>{label}</ActionButton>)}</div>
      </section>

      <section style={styles.metricsGrid}>
        {dashboard.metrics.map(([label, value, detail]) => <MetricCard key={label} label={label} value={value} detail={detail} />)}
      </section>

      <section style={styles.donutsGrid}>
        {dashboard.donuts.map(([title, value, total, label, help]) => <DonutCard key={title} title={title} value={value} total={total} label={label} help={help} />)}
      </section>

      <section style={styles.listsGrid}>
        {dashboard.lists.map(([title, rows]) => <TopCompaniesList key={title} title={title} rows={rows.filter((row) => row.value > 0)} />)}
      </section>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "18px" },
  heroCard: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "18px", backgroundColor: "#ffffff", display: "flex", justifyContent: "space-between", gap: "18px", flexWrap: "wrap", alignItems: "flex-end" },
  kicker: { margin: 0, color: "#6b7280", fontSize: "11px", fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.08em" },
  title: { margin: "4px 0 0", color: "#111827", fontSize: "22px", fontWeight: 950 },
  subtitle: { margin: "8px 0 0", color: "#4b5563", fontSize: "14px", fontWeight: 700, lineHeight: 1.45, maxWidth: "820px" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  actionButton: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 13px", cursor: "pointer", fontWeight: 900 },
  actionButtonSecondary: { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 13px", cursor: "pointer", fontWeight: 900 },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  metricCard: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "5px" },
  donutsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" },
  donutCard: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff", display: "grid", gridTemplateColumns: "120px 1fr", gap: "16px", alignItems: "center" },
  donut: { width: "112px", height: "112px", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center" },
  donutInner: { width: "76px", height: "76px", borderRadius: "999px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #e5e7eb" },
  cardTitle: { margin: 0, color: "#111827", fontSize: "15px", fontWeight: 950 },
  cardLabel: { margin: "6px 0 0", color: "#111827", fontSize: "13px", fontWeight: 900 },
  cardHelp: { margin: "6px 0 0", color: "#6b7280", fontSize: "12px", lineHeight: 1.45, fontWeight: 700 },
  listsGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  listCard: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#ffffff" },
  sectionTitle: { margin: "0 0 12px", color: "#111827", fontSize: "16px", fontWeight: 950 },
  rankedList: { display: "flex", flexDirection: "column", gap: "8px" },
  rankedRow: { display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #f3f4f6", paddingBottom: "8px", color: "#374151", fontSize: "13px", fontWeight: 800 },
  empty: { margin: 0, color: "#6b7280", fontSize: "13px", fontWeight: 800 },
};
