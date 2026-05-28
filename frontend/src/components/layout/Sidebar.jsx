import { useEffect, useState } from "react";

import logo from "../../assets/aulanomina-logo.svg";

const overlayPages = [
  "company-companies",
  "company-centers",
  "employee-record",
  "documents",
  "alerts",
  "reports",
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

const companyPages = ["company-companies", "company-centers"];
const teachingPages = ["teacher-dashboard", "teaching-alerts", "case-studies", "assignments", "corrections", "student-demo", "students", "groups", "progress"];
const overlayHashes = overlayPages.map((page) => `#${page}`);
const IRPF_HASH = "#irpf-module";

function getOverlayPageFromHash() {
  const page = window.location.hash.replace("#", "");
  if (page === "irpf-module") return "irpf-module";
  return overlayPages.includes(page) ? page : null;
}

export default function Sidebar({ activePage, setActivePage }) {
  const [hashActivePage, setHashActivePage] = useState(getOverlayPageFromHash());
  const [companyMenuOpen, setCompanyMenuOpen] = useState(true);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(true);

  useEffect(() => {
    const syncActivePageFromHash = () => {
      const overlayPage = getOverlayPageFromHash();
      setHashActivePage(overlayPage);

      if (companyPages.includes(overlayPage)) {
        setCompanyMenuOpen(true);
        setActivePage("companies");
        return;
      }

      if (overlayPage === "employee-record") {
        setEmployeeMenuOpen(true);
        setActivePage("employees");
        return;
      }

      if (overlayPage === "irpf-module") {
        setActivePage("payrolls");
        return;
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
        {
          id: "company-menu",
          label: "Empresa",
          enabled: true,
          menu: "company",
          children: [
            { id: "company-companies", label: "Empresas", enabled: true },
            { id: "company-centers", label: "Centros", enabled: true },
          ],
        },
        {
          id: "employee-menu",
          label: "Trabajador",
          enabled: true,
          menu: "employee",
          children: [
            { id: "employees", label: "Trabajadores", enabled: true },
            { id: "employee-record", label: "Expediente", enabled: true },
          ],
        },
        { id: "contracts", label: "Contratos", enabled: true },
        { id: "collective-agreements", label: "Convenios", enabled: true },
        { id: "documents", label: "Documentos", enabled: true },
        { id: "alerts", label: "Alertas laborales", enabled: true },
        { id: "reports", label: "Informes", enabled: true },
      ],
    },
    {
      title: "Acciones",
      items: [
        { id: "payrolls", label: "Cálculo nóminas", enabled: true },
        { id: "irpf", label: "IRPF", enabled: true },
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
        { id: "teaching-alerts", label: "Alertas docentes", enabled: true },
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

  const clearHashIfNeeded = () => {
    if (overlayHashes.includes(window.location.hash) || window.location.hash === IRPF_HASH) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      window.dispatchEvent(new Event("aulanomina-route-change"));
    }
  };

  const activateHashRoute = (routeId, basePage = routeId) => {
    setActivePage(basePage);
    setHashActivePage(routeId);
    window.location.hash = routeId;
    window.dispatchEvent(new Event("aulanomina-route-change"));
  };

  const activateMainRoute = (routeId) => {
    setHashActivePage(null);
    clearHashIfNeeded();
    setActivePage(routeId);
  };

  const handleNavClick = (item) => {
    if (!item.enabled) return;

    if (item.children) {
      if (item.menu === "company") setCompanyMenuOpen((prev) => !prev);
      if (item.menu === "employee") setEmployeeMenuOpen((prev) => !prev);
      return;
    }

    if (companyPages.includes(item.id)) {
      activateHashRoute(item.id, "companies");
      return;
    }

    if (item.id === "employee-record") {
      activateHashRoute(item.id, "employees");
      return;
    }

    if (item.id === "irpf") {
      activateHashRoute("irpf-module", "payrolls");
      return;
    }

    if (["documents", "alerts", "reports", ...teachingPages].includes(item.id)) {
      activateHashRoute(item.id, item.id);
      return;
    }

    activateMainRoute(item.id);
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
                const submenuOpen = item.children && (item.menu === "company" ? companyMenuOpen : employeeMenuOpen);
                const childPages = item.menu === "company" ? companyPages : ["employees", "employee-record"];
                const isActive = currentActivePage === item.id || (item.id === "irpf" && currentActivePage === "irpf-module") || (item.children && childPages.includes(currentActivePage));

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
  logo: { width: "275px", maxWidth: "110%", maxHeight: "130px", objectFit: "contain", display: "block" },
  menuPanel: { flex: 1, padding: "18px 14px 26px", overflowY: "auto" },
  group: { marginBottom: "28px" },
  erpSeparator: { height: "3px", backgroundColor: "#111111", margin: "8px 0 22px", width: "100%" },
  groupTitle: { margin: "0 0 10px", color: "#111111", fontSize: "20px", fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase" },
  groupItems: { display: "flex", flexDirection: "column", gap: "7px" },
  itemBlock: { display: "flex", flexDirection: "column", gap: "5px" },
  navItem: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", borderRadius: 0, color: "#111111", padding: "6px 10px", cursor: "pointer", fontSize: "14px", fontWeight: 950, letterSpacing: "0.05em", textTransform: "uppercase" },
  navItemActive: { backgroundColor: "#ffffff", border: "3px solid #111111", boxShadow: "3px 3px 0 #111111" },
  navItemDisabled: { opacity: 0.45, cursor: "not-allowed" },
  submenu: { display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "18px", borderLeft: "3px solid #111111", marginLeft: "8px" },
  subNavItem: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", color: "#111111", padding: "5px 8px", cursor: "pointer", fontSize: "12px", fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" },
  subNavItemActive: { backgroundColor: "#ffffff", border: "2px solid #111111" },
};
