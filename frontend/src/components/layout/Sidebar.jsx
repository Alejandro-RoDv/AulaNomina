import logo from "../../assets/aulanomina-logo.svg";

export default function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", enabled: true },
    { id: "companies", label: "Empresas / Centros", enabled: true },
    { id: "contracts", label: "Contratos", enabled: true },
    { id: "employees", label: "Empleados", enabled: false },
    { id: "payroll", label: "Nóminas", enabled: false },
    { id: "incidents", label: "Incidencias", enabled: false },
    { id: "cases", label: "Casos prácticos", enabled: false },
  ];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.logoBox}>
          <img src={logo} alt="AulaNomina" style={styles.logo} />
        </div>
        <div>
          <p style={styles.brandTitle}>AulaNomina</p>
          <p style={styles.brandSubtitle}>Gestión laboral simulada</p>
        </div>
      </div>

      <nav style={styles.nav}>
        {menuItems.map((item) => {
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              disabled={!item.enabled}
              onClick={() => item.enabled && setActivePage(item.id)}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                ...(!item.enabled ? styles.navItemDisabled : {}),
              }}
            >
              <span>{item.label}</span>
              {!item.enabled && <small style={styles.soon}>Próximamente</small>}
            </button>
          );
        })}
      </nav>

      <div style={styles.footer}>Demo MVP · Entorno docente</div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "240px",
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    padding: "18px 14px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 6px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: "16px",
  },
  logoBox: {
    width: "54px",
    height: "42px",
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    padding: "6px",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logo: {
    display: "block",
    width: "100%",
  },
  brandTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 900,
  },
  brandSubtitle: {
    margin: "2px 0 0",
    fontSize: "11px",
    color: "#94a3b8",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
  },
  navItem: {
    border: "none",
    borderRadius: "10px",
    padding: "11px 12px",
    textAlign: "left",
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "#cbd5e1",
    fontWeight: 700,
    fontSize: "13px",
  },
  navItemActive: {
    backgroundColor: "#f4c430",
    color: "#111827",
  },
  navItemDisabled: {
    cursor: "not-allowed",
    color: "#64748b",
  },
  soon: {
    display: "block",
    marginTop: "3px",
    fontSize: "10px",
    fontWeight: 500,
  },
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    paddingTop: "12px",
    color: "#94a3b8",
    fontSize: "11px",
  },
};
