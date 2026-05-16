import { useEffect, useState } from "react";

import logo from "../../assets/aulanomina-logo.svg";

const overlayPages = [
  "alerts",
  "reports",
  "employee-admissions",
  "employees",
  "employee-record",
  "teacher-dashboard",
  "teaching-alerts",
  "case-studies",
  "assignments",
  "corrections",
  "student-demo",
  "students",
  "groups",
  "progress",
];

const employeePages = ["employee-admissions", "employees", "employee-record"];
const overlayHashes = overlayPages.map((page) => `#${page}`);

function getOverlayPageFromHash() {
  const page = window.location.hash.replace("#", "");
  return overlayPages.includes(page) ? page : null;
}

export default function Sidebar({ activePage, setActivePage }) {
  const [hashActivePage, setHashActivePage] = useState(getOverlayPageFromHash());
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(true);

  useEffect(() => {
    const syncActivePageFromHash = () => {
      const overlayPage = getOverlayPageFromHash();
      setHashActivePage(overlayPage);

      if (employeePages.includes(overlayPage)) {
        setEmployeeMenuOpen(true);
      }

      if (overlayPage) {
        setActivePage(overlayPage);
      }
    };

    syncActivePageFromHash();

    window.addEventListener("hashchange", syncActivePageFromHash);
    window.addEventListener("aulanomina-route-change", syncActivePageFromHash);

    return () => {
      window.removeEventListener("hashchange", syncActivePageFromHash);
      window.removeEventListener("aulanomina-route-change", syncActivePageFromHash);
    };
  }, [setActivePage]);

  const currentActivePage = hashActivePage || activePage;

  const groups = [
    {
      title: "Datos",
      items: [
        { id: "dashboard", label: "Panel", enabled: true },
        { id: "companies", label: "Empresa", enabled: true },
        {
          id: "employee-menu",
          label: "Trabajador",
          enabled: true,
          children: [
            { id: "employee-admissions", label: "Alta / baja", enabled: true },
            { id: "employees", label: "Trabajadores", enabled: true },
            { id: "employee-record", label: "Expediente", enabled: true },
          ],
        },
        { id: "contracts", label: "Contratos", enabled: true },
        { id: "documents", label: "Documentos", enabled: true },
        { id: "alerts", label: "Alertas", enabled: true },
        { id: "reports", label: "Informes", enabled: true },
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
        { id: "teacher-dashboard", label: "Panel profesor", enabled: true },
        { id: "teaching-alerts", label: "Alertas", enabled: true },
        { id: "case-studies", label: "Casos prácticos", enabled: true },
        { id: "assignments", label: "Asignar caso", enabled: true },
        { id: "corrections", label: "Correcciones", enabled: true },
        { id: "student-demo", label: "Vista alumno", enabled: true },
        { id: "students", label: "Alumnos", enabled: true },
        { id: "groups", label: "Grupos", enabled: true },
        { id: "progress", label: "Progreso", enabled: true },
      ],
    },
  ];

  const handleNavClick = (item) => {
    if (!item.enabled) return;

    if (item.children) {
      setEmployeeMenuOpen((prev) => !prev);
      return;
    }

    setActivePage(item.id);

    if (overlayPages.includes(item.id)) {
      setHashActivePage(item.id);
      window.location.hash = item.id;
      window.dispatchEvent(new Event("aulanomina-route-change"));
      return;
    }

    setHashActivePage(null);

    if (overlayHashes.includes(window.location.hash)) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      window.dispatchEvent(new Event("aulanomina-route-change"));
    }
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
                const isActive = currentActivePage === item.id || (item.children && employeePages.includes(currentActivePage));
                const submenuOpen = item.children && employeeMenuOpen;

                return (
                  <div key={item.id} style={styles.itemBlock}>
                    <button
                      type="button"
                      disabled={!item.enabled}
                      onClick={() => handleNavClick(item)}
                      style={{
                        ...styles.navItem,
                        ...(isActive ? styles.navItemActive : {}),
                        ...(!item.enabled ? styles.navItemDisabled : {}),
                      }}
                    >
                      {item.children ? `${submenuOpen ? "▾" : "▸"} ${item.label}` : item.label}
                    </button>

                    {item.children && submenuOpen && (
                      <div style={styles.submenu}>
                        {item.children.map((child) => {
                          const childActive = currentActivePage === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              disabled={!child.enabled}
                              onClick={() => handleNavClick(child)}
                              style={{
                                ...styles.subNavItem,
                                ...(childActive ? styles.subNavItemActive : {}),
                                ...(!child.enabled ? styles.navItemDisabled : {}),
                              }}
                            >
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
  erpSeparator: {
    height: "3px",
    backgroundColor: "#111111",
    margin: "8px 0 22px",
    width: "100%",
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
  itemBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "3px",
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
  submenu: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    marginLeft: "16px",
    paddingLeft: "10px",
    borderLeft: "3px solid #111111",
  },
  subNavItem: {
    border: "2px solid transparent",
    backgroundColor: "transparent",
    color: "#111111",
    fontSize: "12px",
    fontWeight: 900,
    lineHeight: 1.2,
    cursor: "pointer",
    padding: "4px 6px",
    textAlign: "left",
    textTransform: "uppercase",
  },
  subNavItemActive: {
    border: "2px solid #111111",
    backgroundColor: "#ffffff",
    boxShadow: "2px 2px 0 #e6d85c",
  },
};
