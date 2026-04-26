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
      <div style={styles.logoBox}>
        <img src={logo} alt="AulaNomina" style={styles.logo} />
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

      <div style={styles.footer}>MVP educativo · Split 5</div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "260px",
    minHeight: "100vh",
    backgroundColor: "#111827",
    color: "#ffffff",
    padding: "22px 18px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
  },
  logoBox: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "12px",
    marginBottom: "28px",
  },
  logo: {
    display: "block",
    width: "100%",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flex: 1,
  },
  navItem: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "#d4d4d8",
    fontWeight: 700,
    fontSize: "14px",
  },
  navItemActive: {
    backgroundColor: "#f4c430",
    color: "#111827",
  },
  navItemDisabled: {
    cursor: "not-allowed",
    color: "#71717a",
  },
  soon: {
    display: "block",
    marginTop: "4px",
    fontSize: "11px",
    fontWeight: 500,
  },
  footer: {
    borderTop: "1px solid #27272a",
    paddingTop: "14px",
    color: "#a1a1aa",
    fontSize: "12px",
  },
};
