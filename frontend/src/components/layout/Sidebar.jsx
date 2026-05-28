import logo from "../../assets/aulanomina-logo.svg";

export default function Sidebar({ activePage, setActivePage }) {
  const groups = [
    {
      title: "Datos",
      items: [
        { id: "dashboard", label: "Panel", enabled: true },
        { id: "companies", label: "Empresas / Centros", enabled: true },
        { id: "employees", label: "Trabajadores", enabled: true },
        { id: "contracts", label: "Contratos", enabled: true },
        { id: "collective-agreements", label: "Convenios", enabled: true },
        { id: "documents", label: "Documentos", enabled: false },
        { id: "alerts", label: "Alertas laborales", enabled: false },
        { id: "reports", label: "Informes", enabled: false },
      ],
    },
    {
      title: "Acciones",
      items: [
        { id: "payrolls", label: "Cálculo nóminas", enabled: true },
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
    {
      title: "Docencia",
      separator: true,
      items: [
        { id: "teacher-dashboard", label: "Panel profesor", enabled: false },
        { id: "case-studies", label: "Casos prácticos", enabled: false },
        { id: "assignments", label: "Asignar caso", enabled: false },
        { id: "corrections", label: "Correcciones", enabled: false },
        { id: "students", label: "Alumnos", enabled: false },
        { id: "groups", label: "Grupos", enabled: false },
      ],
    },
  ];

  const handleNavClick = (item) => {
    if (!item.enabled) return;
    setActivePage(item.id);
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoPanel}>
        <img src={logo} alt="AulaNomina" style={styles.logo} />
      </div>

      <div style={styles.menuPanel}>
        {groups.map((group) => (
          <section key={group.title} style={styles.group}>
            {group.separator && <div style={styles.erpSeparator} />}
            <p style={styles.groupTitle}>{group.title}</p>
            <div style={styles.groupItems}>
              {group.items.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.enabled}
                    onClick={() => handleNavClick(item)}
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
  menuPanel: { flex: 1, padding: "18px 14px 26px", overflowY: "auto" },
  group: { marginBottom: "28px" },
  erpSeparator: { height: "3px", backgroundColor: "#111111", margin: "8px 0 22px", width: "100%" },
  groupTitle: { margin: "0 0 10px", color: "#111111", fontSize: "20px", fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase" },
  groupItems: { display: "flex", flexDirection: "column", gap: "7px" },
  navItem: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", borderRadius: 0, color: "#111111", padding: "6px 10px", cursor: "pointer", fontSize: "14px", fontWeight: 950, letterSpacing: "0.05em", textTransform: "uppercase" },
  navItemActive: { backgroundColor: "#ffffff", border: "3px solid #111111", boxShadow: "3px 3px 0 #111111" },
  navItemDisabled: { opacity: 0.45, cursor: "not-allowed" },
};
