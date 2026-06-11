import { useEffect, useState } from "react";

import logo from "../../assets/aulanomina-logo.svg";

const groups = [
  {
    title: "Datos",
    items: [
      { id: "dashboard", label: "Panel", enabled: true },
      {
        id: "companies-menu",
        label: "Empresas / centros",
        enabled: true,
        children: [
          { id: "companies", label: "Nueva empresa", enabled: true, hash: "#company-companies", modeGroup: "companies", modeValue: "new" },
          { id: "companies", label: "Centros", enabled: true, hash: "#company-centers", modeGroup: "companies", modeValue: "centers" },
          { id: "companies", label: "Listado empresas", enabled: true, hash: "#company-list", modeGroup: "companies", modeValue: "list" },
        ],
      },
      {
        id: "worker-menu",
        label: "Trabajador",
        enabled: true,
        children: [
          { id: "employees", label: "Nuevo trabajador", enabled: true },
          { id: "employees-list", label: "Listado trabajadores", enabled: true },
          { id: "employee-record", label: "Expediente", enabled: true },
        ],
      },
      {
        id: "contracts-menu",
        label: "Contratos",
        enabled: true,
        children: [
          { id: "contracts", label: "Nuevo contrato", enabled: true, modeGroup: "contracts", modeValue: "new" },
          { id: "contracts", label: "Historial contratos", enabled: true, modeGroup: "contracts", modeValue: "history" },
          { id: "contracts", label: "Impresión contratos", enabled: true, modeGroup: "contracts", modeValue: "print" },
        ],
      },
      { id: "collective-agreements", label: "Convenios", enabled: true },
      { id: "documents", label: "Documentos", enabled: true, hash: "#documents" },
      { id: "alerts", label: "Alertas laborales", enabled: true, hash: "#alerts" },
      { id: "reports", label: "Informes", enabled: true, hash: "#reports" },
    ],
  },
  {
    title: "Acciones",
    items: [
      { id: "payroll-concepts", label: "Historial conceptos", enabled: true },
      { id: "permanent-payroll-concepts", label: "Conceptos permanentes", enabled: true },
      { id: "payroll-monthly-preparation", label: "Preparar mensuales", enabled: true },
      { id: "payroll-individual", label: "Nómina individual", enabled: true },
      { id: "payroll-simulation", label: "Simulación", enabled: true },
      { id: "payroll-history", label: "Histórico nóminas", enabled: true },
      { id: "irpf", label: "IRPF", enabled: true },
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

const modeStorageKeys = {
  contracts: "aulanomina:contractsMode",
  companies: "aulanomina:companiesMode",
};

const modeEvents = {
  contracts: "aulanomina-contract-mode",
  companies: "aulanomina-route-change",
};

function getItemKey(item) {
  if (item.modeGroup && item.modeValue) return `${item.id}:${item.modeGroup}:${item.modeValue}`;
  if (item.hash) return `${item.id}:${item.hash}`;
  return item.id;
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
  return activePage;
}

function getCompanyModeFromHash() {
  if (window.location.hash === "#company-centers") return "centers";
  if (window.location.hash === "#company-list") return "list";
  return "new";
}

function applyItemNavigation(item) {
  if (item.hash) window.location.hash = item.hash;

  if (item.modeGroup && item.modeValue) {
    const storageKey = modeStorageKeys[item.modeGroup];
    if (storageKey) window.sessionStorage.setItem(storageKey, item.modeValue);
  }

  const eventName = item.hash ? "aulanomina-route-change" : modeEvents[item.modeGroup];
  if (eventName) window.dispatchEvent(new Event(eventName));
}

export default function Sidebar({ activePage, setActivePage }) {
  const [activeNavKey, setActiveNavKey] = useState(() => getInitialActiveKey(activePage));

  useEffect(() => {
    setActiveNavKey(getInitialActiveKey(activePage));
  }, [activePage]);

  const handleNavClick = (item) => {
    if (!item.enabled) return;
    applyItemNavigation(item);
    setActiveNavKey(getItemKey(item));
    setActivePage(item.id);
  };

  const isItemActive = (item) => {
    const itemKey = getItemKey(item);
    if (activeNavKey === itemKey) return true;
    if (item.id !== activePage) return false;
    return !item.modeGroup && !item.hash;
  };

  const isParentActive = (item) => {
    if (activePage === item.id) return true;
    return item.children?.some((child) => isItemActive(child));
  };

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
              {group.items.map((item) => (
                <div key={`${item.id}-${item.label}`} style={styles.itemBlock}>
                  <button type="button" disabled={!item.enabled} onClick={() => !item.children && handleNavClick(item)} style={{ ...styles.navItem, ...(isParentActive(item) ? styles.navItemActive : {}), ...(!item.enabled ? styles.navItemDisabled : {}) }}>
                    {item.label}
                  </button>
                  {item.children && (
                    <div style={styles.submenu}>
                      {item.children.map((child) => (
                        <button key={`${child.id}-${child.label}`} type="button" disabled={!child.enabled} onClick={() => handleNavClick(child)} style={{ ...styles.subNavItem, ...(isItemActive(child) ? styles.subNavItemActive : {}), ...(!child.enabled ? styles.navItemDisabled : {}) }}>
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: { width: "272px", minHeight: "100vh", backgroundColor: "#f8f3b5", borderRight: "3px solid #111111", boxSizing: "border-box", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0 },
  logoPanel: { height: "132px", backgroundColor: "#ffffff", borderBottom: "3px solid #111111", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px", boxSizing: "border-box", overflow: "hidden" },
  logo: { width: "275px", maxWidth: "110%", maxHeight: "130px", objectFit: "contain", display: "block" },
  menuPanel: { flex: 1, padding: "18px 14px 26px", overflowY: "auto" },
  group: { marginBottom: "28px" },
  groupTitle: { margin: "0 0 10px", color: "#111111", fontSize: "20px", fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase" },
  groupItems: { display: "flex", flexDirection: "column", gap: "7px" },
  itemBlock: { display: "flex", flexDirection: "column", gap: "5px" },
  navItem: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", borderRadius: 0, color: "#111111", padding: "6px 10px", cursor: "pointer", fontSize: "14px", fontWeight: 950, letterSpacing: "0.05em", textTransform: "uppercase" },
  navItemActive: { backgroundColor: "#ffffff", border: "3px solid #111111", boxShadow: "3px 3px 0 #111111" },
  navItemDisabled: { opacity: 0.45, cursor: "not-allowed" },
  submenu: { display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "18px", borderLeft: "3px solid #111111", marginLeft: "8px" },
  subNavItem: { width: "100%", textAlign: "left", backgroundColor: "transparent", border: "none", color: "#111111", padding: "6px 8px", cursor: "pointer", fontSize: "12px", fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" },
  subNavItemActive: { backgroundColor: "#ffffff", border: "2px solid #111111" },
};
