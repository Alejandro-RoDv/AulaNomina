import { useEffect, useState } from "react";
import {
  Building2,
  Calculator,
  ChevronDown,
  FileCheck2,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  UsersRound,
  X,
} from "lucide-react";

import logo from "../../assets/aulanomina-logo.svg";
import "./layout.css";
import "./navigation.css";

const ACTIVE_GROUP_STORAGE_KEY = "aulanomina:sidebarActiveGroup";
const EXPANDED_PARENTS_STORAGE_KEY = "aulanomina:sidebarExpandedParents";
const panelItem = { id: "dashboard", label: "Panel", enabled: true };

const groups = [
  {
    id: "master-data",
    title: "Datos empresa",
    icon: Building2,
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
    icon: UsersRound,
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
          { id: "fie-inss", label: "Comunicaciones INSS (FIE)", enabled: true, hash: "#fie-inss" },
          { id: "variations", label: "Variaciones", enabled: false },
        ],
      },
    ],
  },
  {
    id: "payroll",
    title: "Nómina",
    icon: Calculator,
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
          { id: "social-security-dashboard", label: "Ficheros CRA", enabled: true, hash: "#cra-files" },
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
    id: "tax-management",
    title: "Fiscalidad",
    icon: Landmark,
    items: [
      { id: "reports", label: "Modelo 111", enabled: true, hash: "#model-111" },
      { id: "reports", label: "Modelo 190", enabled: true, hash: "#model-190" },
    ],
  },
  {
    id: "document-control",
    title: "Documentación y control",
    icon: FileCheck2,
    items: [
      { id: "documents", label: "Documentos", enabled: true, hash: "#documents" },
      { id: "alerts", label: "Alertas laborales", enabled: true, hash: "#alerts" },
      { id: "reports", label: "Informes", enabled: true, hash: "#reports" },
    ],
  },
  {
    id: "teaching",
    title: "Docencia",
    icon: GraduationCap,
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
  if (activePage === "reports" && window.location.hash) return `reports:${window.location.hash}`;
  if (activePage === "fie-inss") return "fie-inss:#fie-inss";
  return activePage;
}

function getStoredExpandedParents() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(EXPANDED_PARENTS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function storeExpandedParents(value) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(EXPANDED_PARENTS_STORAGE_KEY, JSON.stringify(value));
  }
}

function getStoredActiveGroup() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY);
}

function storeActiveGroup(groupId) {
  if (typeof window === "undefined") return;
  if (groupId) window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, groupId);
  else window.localStorage.removeItem(ACTIVE_GROUP_STORAGE_KEY);
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
  if (item.hash || item.modeGroup) return getItemKey(item) === activeNavKey;
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

function findParentKeyForPage(groupId, activePage, activeNavKey) {
  const group = groups.find((candidate) => candidate.id === groupId);
  const parent = group?.items.find(
    (item) => item.children?.some((child) => itemMatchesPage(child, activePage, activeNavKey))
      || (item.children && itemMatchesPage(item, activePage, activeNavKey))
  );
  return parent ? getItemKey(parent) : null;
}

export default function Sidebar({ activePage, setActivePage }) {
  const initialNavKey = getInitialActiveKey(activePage);
  const initialGroupId = findGroupIdForPage(activePage, initialNavKey);
  const initialParentKey = initialGroupId
    ? findParentKeyForPage(initialGroupId, activePage, initialNavKey)
    : null;

  const [activeNavKey, setActiveNavKey] = useState(initialNavKey);
  const [expandedGroupId, setExpandedGroupId] = useState(
    initialGroupId || getStoredActiveGroup
  );
  const [expandedParents, setExpandedParents] = useState(() => {
    const stored = getStoredExpandedParents();
    if (!initialGroupId || !initialParentKey) return stored;
    return { ...stored, [initialGroupId]: initialParentKey };
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const nextActiveKey = getInitialActiveKey(activePage);
    const nextGroupId = findGroupIdForPage(activePage, nextActiveKey);
    setActiveNavKey(nextActiveKey);

    if (nextGroupId) {
      setExpandedGroupId(nextGroupId);
      storeActiveGroup(nextGroupId);
      const nextParentKey = findParentKeyForPage(nextGroupId, activePage, nextActiveKey);
      if (nextParentKey) {
        setExpandedParents((previous) => {
          const next = { ...previous, [nextGroupId]: nextParentKey };
          storeExpandedParents(next);
          return next;
        });
      }
    }
  }, [activePage]);

  useEffect(() => {
    const handleToggle = () => setMobileOpen((previous) => !previous);
    const handleClose = () => setMobileOpen(false);
    window.addEventListener("aulanomina-toggle-sidebar", handleToggle);
    window.addEventListener("aulanomina-close-sidebar", handleClose);
    return () => {
      window.removeEventListener("aulanomina-toggle-sidebar", handleToggle);
      window.removeEventListener("aulanomina-close-sidebar", handleClose);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const toggleGroup = (groupId) => {
    const nextGroupId = expandedGroupId === groupId ? null : groupId;
    setExpandedGroupId(nextGroupId);
    storeActiveGroup(nextGroupId);
  };

  const toggleParent = (groupId, parentKey) => {
    setExpandedGroupId(groupId);
    storeActiveGroup(groupId);
    setExpandedParents((previous) => {
      const next = {
        ...previous,
        [groupId]: previous[groupId] === parentKey ? null : parentKey,
      };
      storeExpandedParents(next);
      return next;
    });
  };

  const handleNavClick = (item, groupId = null, parentKey = null) => {
    if (!item.enabled) return;
    applyItemNavigation(item);
    if (item.launchEvent) return;

    const itemKey = getItemKey(item);
    setActiveNavKey(itemKey);
    setActivePage(item.id);
    setMobileOpen(false);

    const resolvedGroupId = groupId || findGroupIdForPage(item.id, itemKey);
    if (!resolvedGroupId) return;

    setExpandedGroupId(resolvedGroupId);
    storeActiveGroup(resolvedGroupId);

    const resolvedParentKey = parentKey || (item.children ? itemKey : null);
    if (resolvedParentKey) {
      setExpandedParents((previous) => {
        const next = { ...previous, [resolvedGroupId]: resolvedParentKey };
        storeExpandedParents(next);
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
    <>
      <aside className={`an-sidebar${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Navegación principal">
        <div className="an-sidebar__brand">
          <div className="an-sidebar__brand-copy">
            <img src={logo} alt="AulaNomina" className="an-sidebar__logo" />
            <span className="an-sidebar__descriptor">ERP laboral educativo</span>
          </div>
          <button
            type="button"
            className="an-sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar navegación"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav className="an-sidebar__navigation">
          <button
            type="button"
            className={`an-sidebar__panel${activePage === panelItem.id ? " is-active" : ""}`}
            onClick={() => handleNavClick(panelItem)}
          >
            <LayoutDashboard aria-hidden="true" />
            <span>{panelItem.label}</span>
          </button>

          {groups.map((group) => {
            const GroupIcon = group.icon;
            const isGroupActive = groupContainsActiveItem(group, activePage, activeNavKey);
            const isExpanded = expandedGroupId === group.id;

            return (
              <section key={group.id} className="an-sidebar__group">
                <button
                  type="button"
                  className={`an-sidebar__group-toggle${isGroupActive ? " is-active" : ""}`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="an-sidebar__group-label">
                    <GroupIcon aria-hidden="true" />
                    <span>{group.title}</span>
                  </span>
                  <span className={`an-sidebar__chevron${isExpanded ? " is-open" : ""}`}>
                    <ChevronDown size={15} aria-hidden="true" />
                  </span>
                </button>

                {isExpanded && (
                  <div className="an-sidebar__group-items">
                    {group.items.map((item) => {
                      const itemKey = getItemKey(item);
                      const hasChildren = Boolean(item.children?.length);
                      const parentActive = isParentActive(item);
                      const parentExpanded = expandedParents[group.id] === itemKey;

                      return (
                        <div key={`${item.id}-${item.label}`} className="an-sidebar__item-block">
                          {hasChildren ? (
                            <div className={`an-sidebar__item-row${parentActive ? " is-active" : ""}`}>
                              <button
                                type="button"
                                disabled={!item.enabled}
                                onClick={() => handleNavClick(item, group.id, itemKey)}
                                className={`an-sidebar__item an-sidebar__item--with-toggle${parentActive ? " is-active" : ""}`}
                              >
                                {item.label}
                              </button>
                              <button
                                type="button"
                                className={`an-sidebar__item-toggle${parentExpanded ? " is-open" : ""}`}
                                onClick={() => toggleParent(group.id, itemKey)}
                                aria-expanded={parentExpanded}
                                aria-label={`${parentExpanded ? "Contraer" : "Desplegar"} ${item.label}`}
                              >
                                <ChevronDown aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!item.enabled}
                              onClick={() => handleNavClick(item, group.id)}
                              className={`an-sidebar__item${parentActive ? " is-active" : ""}`}
                            >
                              {item.label}
                            </button>
                          )}

                          {hasChildren && parentExpanded && (
                            <div className="an-sidebar__subitems">
                              {item.children.map((child) => (
                                <button
                                  key={`${child.id}-${child.label}`}
                                  type="button"
                                  disabled={!child.enabled}
                                  onClick={() => handleNavClick(child, group.id, itemKey)}
                                  className={`an-sidebar__subitem${isItemActive(child) ? " is-active" : ""}`}
                                >
                                  {child.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <div className="an-sidebar__footer">
          <span className="an-sidebar__environment">Entorno disponible</span>
          <span>v0.1</span>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="an-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar navegación"
        />
      )}
    </>
  );
}
