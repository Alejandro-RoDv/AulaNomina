import logo from "../../assets/aulanomina-logo.svg";

export default function Sidebar({ activePage, setActivePage }) {
  const groups = [
    {
      title: "Datos",
      items: [
        { id: "dashboard", label: "Panel", enabled: true },
        { id: "companies", label: "Empresa", enabled: true },
        { id: "employees", label: "Trabajador", enabled: true },
        { id: "contracts", label: "Contratos", enabled: true },
        { id: "documents", label: "Documentos", enabled: false },
        { id: "reports", label: "Informes", enabled: false },
      ],
    },
    {
      title: "Acciones",
      items: [
        { id: "payroll", label: "Cálculo nóminas", enabled: false },
        { id: "irpf", label: "IRPF", enabled: false },
        { id: "tax", label: "Mod. 111/190", enabled: false },
        { id: "social-security", label: "Seguros sociales", enabled: false },
      ],
    },
    {
      title: "Seg. Social",
      items: [
        { id: "incidents", label: "Incidencias", enabled: true },
        { id: "affiliations", label: "Altas y bajas", enabled: false },
        { id: "variations", label: "Variaciones", enabled: false },
        { id: "communications", label: "Comunicados", enabled: false },
      ],
    },
  ];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoPanel}>
        <img src={logo} alt="AulaNomina" style={styles.logo} />
      </div>

      <div style={styles.menuPanel}>
        {groups.map((group) => (
          <section key={group.title} style={styles.group}>
            <p style={styles.groupTitle}>{group.title}</p>
            <div style={styles.groupItems}>
              {group.items.map((item) => {
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
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "272px",
    minHeight: "100vh",
    backgroundColor: "#f8f3b5",
    borderRight: "3px solid #111111",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
  },
  logoPanel: {
    height: "132px",
    backgroundColor: "#ffffff",
    borderBottom: "3px solid #111111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  logo: {
    width: "275px",
    maxWidth: "110%",
    maxHeight: "130px",
    objectFit: "contain",
    display: "block",
  },
  menuPanel: {
    flex: 1,
    padding: "18px 14px 26px",
    overflowY: "auto",
  },
  group: {
    marginBottom: "28px",
  },
  groupTitle: {
    margin: "0 0 10px",
    color: "#111111",
    fontSize: "20px",
    fontWeight: 900,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },
  groupItems: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
    paddingLeft: "60px",
  },
  navItem: {
    border: "2px solid transparent",
    backgroundColor: "transparent",
    color: "#111111",
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.2,
    cursor: "pointer",
    padding: "5px 8px",
    textAlign: "left",
    textTransform: "uppercase",
  },
  navItemActive: {
    border: "3px solid #111111",
    backgroundColor: "#ffffff",
    boxShadow: "3px 3px 0 #e6d85c",
  },
  navItemDisabled: {
    cursor: "not-allowed",
    opacity: 0.55,
  },
};
