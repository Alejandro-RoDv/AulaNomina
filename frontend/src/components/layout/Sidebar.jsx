import { useEffect, useState } from "react";

import logo from "../../assets/aulanomina-logo.svg";

const SIDEBAR_STORAGE_KEY = "aulanomina:sidebarExpandedGroups";
const panelItem = { id: "dashboard", label: "Panel", enabled: true };

const groups = [
  {
    id: "master-data",
    title: "Datos empresa",
    items: [
      {
        id: "companies-dashboard",
        label: "Empresas / centros",
        enabled: true,
        children: [
          { id: "companies", label: "Nueva empresa", enabled: true, hash: "#company-companies", modeGroup: "companies", modeValue: "new" },
          { id: "companies", label: "Centros", enabled: true, hash: "#company-centers", modeGroup: "companies", modeValue: "centers" },
          { id: "companies", label: "Listado empresas", enabled: true, hash: "#company-list", modeGroup: "companies", modeValue: "list" },
        ],
      },
      {
        id: "collective-agreements",
        label: "Convenios",
        enabled: true,
        children: [{ id: "collective-agreements", label: "Convenios colectivos", enabled: true }],
      },
    ],
  },
  {
    id: "labor-management",
    title: "Gestión de personal",
    items: [
      {
        id: "workers-dashboard",
        label: "Trabajadores",
        enabled: true,
        children: [
          { id: "employees", label: "Nuevo trabajador", enabled: true },
          { id: "employees-list", label: "Listado trabajadores", enabled: true },
          { id: "employee-record", label: "Expediente", enabled: true },
        ],
      },
      {
        id: "contracts-dashboard",
        label: "Contratos",
        enabled: true,
        children: [
          { id: "contracts", label: "Nuevo contrato", enabled: true, modeGroup: "contracts", modeValue: "new" },
          { id: "contracts", label: "Historial contratos", enabled: true, modeGroup: "contracts", modeValue: "history" },
          { id: "contracts", label: "Impresión contratos", enabled: true, modeGroup: "contracts", modeValue: "print" },
        ],
      },
      {
        id: "labor-operations",
        label: "Gestión laboral",
        enabled: true,
        children: [
          { id: "incidents", label: "Incidencias laborales", enabled: true, modeGroup: "incidents", modeValue: "list" },
          { id: "incidents", label: "Embargos judiciales", enabled: true, modeGroup: "incidents", modeValue: "embargo" },
          { id: "affiliations", label: "Altas y bajas", enabled: true },
          { id: "affiliation-files", label: "Ficheros AFI", enabled: true },
          { id: "variations", label: "Variaciones", enabled: false },
          { id: "communications", label: "Comunicados", enabled: false },
        ],
      },
    ],
  },
  {
    id: "payroll",
    title: "Nómina",
    items: [
      { id: "payroll-monthly-preparation", label: "Preparación mensual", enabled: true },
      { id: "payroll-individual", label: "Nómina individual", enabled: true },
      { id: "payroll-simulation", label: "Simulación", enabled: true },
      { id: "payroll-history", label: "Histórico nóminas", enabled: true },
      { id: "irpf", label: "IRPF", enabled: true },
      {
        id: "social-security-dashboard",
        label: "Seguros sociales",
        enabled: true,
        children: [
          { id: "social-security-settlements", label: "Liquidaciones", enabled: true },
          { id: "social-security-files", label: "Ficheros generados", enabled: true },
        ],
      },
      {
        id: "payroll-concepts",
        label: "Conceptos salariales",
        enabled: true,
        children: [
          { id: "payroll-concepts", label: "Historial conceptos", enabled: true },
          { id: "permanent-payroll-concepts", label: "Conceptos permanentes", enabled: true },
        ],
      },
    ],
  },
  {
    id: "document-control",
    title: "Documentación y control",
    items: [
      { id: "documents", label: "Documentos", enabled: true, hash: "#documents" },
      { id: "alerts", label: "Alertas laborales", enabled: true, hash: "#alerts" },
      { id: "reports", label: "Informes", enabled: true, hash: "#reports" },
    ],
  },
  {
    id: "teaching",
    title: "Docencia",
    items: [
      { id: "teacher-dashboard", label: "Panel docente", enabled: true, hash: "#teacher-dashboard" },
      { id: "case-studies", label: "Casos prácticos", enabled: true, hash: "#case-studies" },
      { id: "assignments", label: "Asignaciones", enabled: true, hash: "#assignments" },
      { id: "corrections", label: "Correcciones", enabled: true, hash: "#corrections" },
      { id: "students", label: "Alumnos", enabled: true, hash: "#students" },
      { id: "groups", label: "Grupos", enabled: true, hash: "#groups" },
      { id: "progress", label: "Progreso", enabled: true, hash: "#progress" },
      { id: "student-demo", label: "Vista alumno", enabled: true, hash: "#student-demo" },
      { id: "teaching-alerts", label: "Alertas docentes", enabled: true, hash: "#teaching-alerts" },
    ],
  },
];

const modeStorageKeys = {
  contracts: "aulanomina:contractsMode",
  companies: "aulanomina:companiesMode",
  incidents: "aulanomina:incidentsMode",
};

const modeEvents = {
  contracts: "aulanomina-contract-mode",
  companies: "aulanomina-route-change",
  incidents: "aulanomina-incidents-mode",
};

function getItemKey(item) {
  if (item.modeGroup && item.modeValue) return `${item.id}:${item.modeGroup}:${item.modeValue}`;
  if (item.hash) return `${item.id}:${item.hash}`;
  return item.id;
}

function getCompanyModeFromHash() {
  if (window.location.hash === "#company-centers") return "centers";
  if (window.location.hash === "#company-list") return "list";
  return "new";
}

function getInitialActiveKey(activePage) {
  if (activePage === "contracts") {
    const mode = window.sessionStorage.getItem(modeStorageKeys.contracts) || "new";
    return `contracts:contracts:${mode}`;
  }
  if (activePage === "companies") {
    const mode = window.sessionStorage.getItem(modeStorageKeys.companies) || getCompanyModeFromHash();
    return `companies:companies:${mode}`;
  }
  if (activePage === "incidents") {
    const mode = window.sessionStorage.getItem(modeStorageKeys.incidents) || "list";
    return `incidents:incidents:${mode}`;
  }
  return activePage;
}

function getStoredExpandedGroups() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function storeExpandedGroups(value) {
  if (typeof window !== "undefined") window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(value));
}

function clearHashIfNeeded(item) {
  if (item.hash || !window.location.hash) return false;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return true;
}

function applyItemNavigation(item) {
  if (item.launchEvent) {
    window.dispatchEvent(new Event(item.launchEvent));
    return;
  }

  let routeChanged = false;
  if (item.hash) {
    if (window.location.hash !== item.hash) window.location.hash = item.hash;
    routeChanged = true;
  } else {
    routeChanged = clearHashIfNeeded(item);
  }

  if (item.modeGroup && item.modeValue) {
    const storageKey = modeStorageKeys[item.modeGroup];
    if (storageKey) window.sessionStorage.setItem(storageKey, item.modeValue);
  }

  const eventName = item.hash || routeChanged ? "aulanomina-route-change" : modeEvents[item.modeGroup];
  if (eventName) window.dispatchEvent(new Event(eventName));
}

function itemMatchesPage(item, activePage, activeNavKey) {
  if (item.launchEvent) return false;
  return item.id === activePage || getItemKey(item) === activeNavKey;
}

function groupContainsActiveItem(group, activePage, activeNavKey) {
  return group.items.some(
    (item) => itemMatchesPage(item, activePage, activeNavKey)
      || item.children?.some((child) => itemMatchesPage(child, activePage, activeNavKey))
  );
}

function findGroupIdForPage(activePage, activeNavKey) {
  return groups.find((group) => groupContainsActiveItem(group, activePage, activeNavKey))?.id || null;
}

export default function Sidebar({ activePage, setActivePage }) {
  const [activeNavKey, setActiveNavKey] = useState(() => getInitialActiveKey(activePage));
  const [expandedGroups, setExpandedGroups] = useState(getStoredExpandedGroups);

  useEffect(() => {
    setActiveNavKey(getInitialActiveKey(activePage));
  }, [activePage]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((previous) => {
      const next = { ...previous, [groupId]: !previous[groupId] };
      storeExpandedGroups(next);
      return next;
    });
  };

  const handleNavClick = (item) => {
    if (!item.enabled) return;
    applyItemNavigation(item);
    if (item.launchEvent) return;

    const itemKey = getItemKey(item);
    setActiveNavKey(itemKey);
    setActivePage(item.id);

    const groupId = findGroupIdForPage(item.id, itemKey);
    if (groupId) {
      setExpandedGroups((previous) => {
        const next = { ...previous, [groupId]: true };
        storeExpandedGroups(next);
        return next;
      });
    }
  };

  const isItemActive = (item) => {
    if (item.launchEvent) return false;
    const itemKey = getItemKey(item);
    if (activeNavKey === itemKey) return true;
    if (item.id !== activePage) return false;
    return !item.modeGroup && !item.hash;
  };

  const isParentActive = (item) => (
    activePage === item.id
    || activeNavKey === getItemKey(item)
    || item.children?.some((child) => isItemActive(child))
  );

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoPanel}><img src={logo} alt="AulaNomina" style={styles.logo} /></div>
      <div style={styles.menuPanel}>
        <button
          type="button"
          style={activePage === panelItem.id ? styles.panelButtonActive : styles.panelButton}
          onClick={() => handleNavClick(panelItem)}
        >
          {panelItem.label}
        </button>

        {groups.map((group) => {
          const isExpanded = Boolean(expandedGroups[group.id]);
          const isGroupActive = groupContainsActiveItem(group, activePage, activeNavKey);
          return (
            <section key={group.id} style={styles.group}>
              <button
                type="button"
                style={{ ...styles.groupToggle, ...(isGroupActive ? styles.groupToggleActive : {}) }}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isExpanded}
              >
                <span>{group.title}</span><strong>{isExpanded ? "−" : "+"}</strong>
              </button>
              {isExpanded && (
                <div style={styles.groupItems}>
                  {group.items.map((item) => (
                    <div key={`${item.id}-${item.label}`} style={styles.itemBlock}>
                      <button
                        type="button"
                        disabled={!item.enabled}
                        onClick={() => handleNavClick(item)}
                        style={{ ...styles.navItem, ...(isParentActive(item) ? styles.navItemActive : {}), ...(!item.enabled ? styles.navItemDisabled : {}) }}
                      >
                        {item.label}
                      </button>
                      {item.children && (
                        <div style={styles.submenu}>
                          {item.children.map((child) => (
                            <button
                              key={`${child.id}-${child.label}`}
                              type="button"
                              disabled={!child.enabled}
                              onClick={() => handleNavClick(child)}
                              style={{ ...styles.subNavItem, ...(isItemActive(child) ? styles.subNavItemActive : {}), ...(!child.enabled ? styles.navItemDisabled : {}) }}
                            >
                              {child.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: { width: "272px", minHeight: "100vh", backgroundColor: "#f8f3b5", borderRight: "3px solid #111111", boxSizing: "border-box", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0 },
  logoPanel: { height: "132px", backgroundColor: "#ffffff", borderBottom: "3px solid #111111", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", boxSizing: "border-box", overflow: "hidden" },
  logo: { width: "275px", maxWidth: "110%", maxHeight: "130px", objectFit: "contain", display: "block" },
  menuPanel: { flex: 1, padding: "16px 10px 26px", overflowY: "auto" },
  panelButton: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", color: "#111111", padding: "9px 8px", cursor: "pointer", fontSize: "16px", fontWeight: 950, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: "8px" },
  panelButtonActive: { width: "100%", textAlign: "left", backgroundColor: "#ffffff", border: "3px solid #111111", boxShadow: "3px 3px 0 #111111", color: "#111111", padding: "9px 8px", cursor: "pointer", fontSize: "16px", fontWeight: 950, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: "8px" },
  group: { marginBottom: "8px" },
  groupToggle: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", backgroundColor: "transparent", border: "none", color: "#111111", padding: "9px 8px", cursor: "pointer", fontSize: "16px", fontWeight: 950, letterSpacing: "0.03em", textTransform: "uppercase", textAlign: "left" },
  groupToggleActive: { backgroundColor: "rgba(255, 255, 255, 0.72)", outline: "2px solid #111111", boxShadow: "3px 3px 0 #111111" },
  groupItems: { display: "flex", flexDirection: "column", gap: "7px", paddingTop: "8px", paddingBottom: "10px" },
  itemBlock: { display: "flex", flexDirection: "column", gap: "5px" },
  navItem: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", borderRadius: 0, color: "#111111", padding: "6px 10px", cursor: "pointer", fontSize: "13px", fontWeight: 950, letterSpacing: "0.05em", textTransform: "uppercase" },
  navItemActive: { backgroundColor: "#ffffff", border: "3px solid #111111", boxShadow: "3px 3px 0 #111111" },
  navItemDisabled: { opacity: 0.45, cursor: "not-allowed" },
  submenu: { display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "18px", borderLeft: "3px solid #111111", marginLeft: "8px" },
  subNavItem: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", color: "#111111", padding: "6px 8px", cursor: "pointer", fontSize: "12px", fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" },
  subNavItemActive: { backgroundColor: "#ffffff", border: "2px solid #111111" },
};
