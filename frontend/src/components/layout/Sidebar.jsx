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
const panelItem = { id: "dashboard", label: "Inicio", enabled: true };

const groups = [
  {
    id: "organization",
    title: "Organización",
    icon: Building2,
    items: [
      {
        id: "companies-menu",
        label: "Empresas / centros",
        enabled: true,
        children: [
          {
            id: "companies",
            label: "Nueva empresa",
            enabled: true,
            hash: "#company-new",
            modeGroup: "companies",
            modeValue: "new",
          },
          {
            id: "companies",
            label: "Listado empresas",
            enabled: true,
            hash: "#company-list",
            modeGroup: "companies",
            modeValue: "list",
          },
          {
            id: "companies",
            label: "Centros",
            enabled: true,
            hash: "#company-centers",
            modeGroup: "companies",
            modeValue: "centers",
          },
        ],
      },
      { id: "collective-agreements", label: "Convenios", enabled: true },
    ],
  },
  {
    id: "people",
    title: "Personas",
    icon: UsersRound,
    items: [
      {
        id: "employees-menu",
        label: "Trabajadores",
        enabled: true,
        children: [
          { id: "employees", label: "Nuevo trabajador", enabled: true },
          { id: "employees-list", label: "Listado de trabajadores", enabled: true },
          { id: "employee-record", label: "Expediente", enabled: true },
        ],
      },
    ],
  },
  {
    id: "hiring",
    title: "Contratación",
    icon: FileCheck2,
    items: [
      {
        id: "contracts",
        label: "Contratos",
        enabled: true,
        modeGroup: "contracts",
        modeValue: "history",
      },
    ],
  },
  {
    id: "labor-management",
    title: "Gestión laboral",
    icon: UsersRound,
    items: [
      {
        id: "labor-incidents-menu",
        label: "Incidencias",
        enabled: true,
        children: [
          {
            id: "incidents",
            label: "Incidencias laborales",
            enabled: true,
            modeGroup: "incidents",
            modeValue: "list",
          },
          {
            id: "incidents",
            label: "Embargos judiciales",
            enabled: true,
            modeGroup: "incidents",
            modeValue: "embargo",
          },
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
      {
        id: "payroll-pages-menu",
        label: "Nóminas",
        enabled: true,
        children: [
          { id: "payroll-individual", label: "Nómina individual", enabled: true },
          { id: "payroll-history", label: "Histórico de nóminas", enabled: true },
        ],
      },
      { id: "payroll-simulation", label: "Simulación", enabled: true },
      {
        id: "payroll-concepts-menu",
        label: "Conceptos salariales",
        enabled: true,
        children: [
          { id: "permanent-payroll-concepts", label: "Conceptos permanentes", enabled: true },
          { id: "payroll-concepts", label: "Histórico de conceptos", enabled: true },
        ],
      },
    ],
  },
  {
    id: "social-security",
    title: "Seguridad Social",
    icon: Landmark,
    items: [
      {
        id: "affiliation-menu",
        label: "Afiliación",
        enabled: true,
        children: [
          { id: "affiliations", label: "Altas y bajas", enabled: true },
          { id: "affiliation-files", label: "Ficheros AFI", enabled: true },
        ],
      },
      {
        id: "contribution-menu",
        label: "Cotización",
        enabled: true,
        children: [
          { id: "social-security-dashboard", label: "Seguros sociales", enabled: true },
          { id: "social-security-settlements", label: "Liquidaciones", enabled: true },
          { id: "social-security-files", label: "Ficheros generados", enabled: true },
          {
            id: "social-security-dashboard",
            label: "Ficheros CRA",
            enabled: true,
            hash: "#cra-files",
          },
        ],
      },
      {
        id: "communications-menu",
        label: "Comunicaciones",
        enabled: true,
        children: [
          {
            id: "fie-inss",
            label: "Comunicaciones INSS (FIE)",
            enabled: true,
            hash: "#fie-inss",
          },
        ],
      },
      {
        id: "siltra-launcher",
        label: "SILTRA",
        enabled: true,
        launchSelector: ".siltra-global-launcher",
      },
    ],
  },
  {
    id: "tax-management",
    title: "Fiscalidad",
    icon: Landmark,
    items: [
      { id: "irpf", label: "IRPF", enabled: true },
      { id: "reports", label: "Modelo 111", enabled: true, hash: "#model-111" },
      { id: "reports", label: "Modelo 190", enabled: true, hash: "#model-190" },
    ],
  },
  {
    id: "documents",
    title: "Documentación",
    icon: FileCheck2,
    items: [
      { id: "documents", label: "Documentos", enabled: true, hash: "#documents" },
      { id: "reports", label: "Informes", enabled: true, hash: "#reports" },
    ],
  },
  {
    id: "training",
    title: "Formación",
    icon: GraduationCap,
    items: [
      {
        id: "mail-launcher",
        label: "Bandeja de entrada",
        enabled: true,
        launchSelector: ".mail-global-launcher",
      },
      {
        id: "student-demo",
        label: "Mis casos prácticos",
        enabled: true,
        hash: "#student-demo",
      },
    ],
  },
  {
    id: "teaching",
    title: "Docencia",
    icon: GraduationCap,
    items: [
      { id: "teacher-dashboard", label: "Panel docente", enabled: true, hash: "#teacher-dashboard" },
      { id: "case-studies", label: "Casos prácticos", enabled: true, hash: "#case-studies" },
      {
        id: "teaching-cases-menu",
        label: "Gestión de casos",
        enabled: true,
        children: [
          { id: "assignments", label: "Asignaciones", enabled: true, hash: "#assignments" },
          { id: "corrections", label: "Correcciones", enabled: true, hash: "#corrections" },
        ],
      },
      {
        id: "teaching-students-menu",
        label: "Alumnos",
        enabled: true,
        children: [
          { id: "students", label: "Alumnos", enabled: true, hash: "#students" },
          { id: "groups", label: "Grupos", enabled: true, hash: "#groups" },
        ],
      },
      {
        id: "teaching-tracking-menu",
        label: "Seguimiento",
        enabled: true,
        children: [
          { id: "progress", label: "Progreso", enabled: true, hash: "#progress" },
          {
            id: "teaching-alerts",
            label: "Alertas docentes",
            enabled: true,
            hash: "#teaching-alerts",
          },
        ],
      },
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

function isActionItem(item) {
  return Boolean(item.launchEvent || item.launchSelector);
}

function getCompanyModeFromHash() {
  if (window.location.hash === "#company-new") return "new";
  if (window.location.hash === "#company-centers") return "centers";
  if (window.location.hash === "#company-list" || window.location.hash.startsWith("#company-detail/")) return "list";
  return null;
}

function findItemForHash(activePage, hash) {
  if (!hash) return null;
  for (const group of groups) {
    for (const item of group.items) {
      if (item.id === activePage && item.hash === hash) return item;
      const child = item.children?.find(
        (candidate) => candidate.id === activePage && candidate.hash === hash
      );
      if (child) return child;
    }
  }
  return null;
}

function getInitialActiveKey(activePage) {
  if (activePage === "contracts") {
    const mode = window.sessionStorage.getItem(modeStorageKeys.contracts) || "history";
    return `contracts:contracts:${mode}`;
  }
  if (activePage === "companies") {
    const mode = getCompanyModeFromHash()
      || window.sessionStorage.getItem(modeStorageKeys.companies)
      || "list";
    return `companies:companies:${mode}`;
  }
  if (activePage === "incidents") {
    const mode = window.sessionStorage.getItem(modeStorageKeys.incidents) || "list";
    return `incidents:incidents:${mode}`;
  }

  const hashItem = findItemForHash(activePage, window.location.hash);
  if (hashItem) return getItemKey(hashItem);

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
  const storedGroupId = window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY);
  return groups.some((group) => group.id === storedGroupId) ? storedGroupId : null;
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
  if (item.launchSelector) {
    document.querySelector(item.launchSelector)?.click();
    return;
  }

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
  if (isActionItem(item)) return false;
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
    const syncActiveNavigation = () => {
      const nextActiveKey = getInitialActiveKey(activePage);
      const nextGroupId = findGroupIdForPage(activePage, nextActiveKey);
      setActiveNavKey(nextActiveKey);

      if (!nextGroupId) return;

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
    };

    syncActiveNavigation();
    window.addEventListener("aulanomina-route-change", syncActiveNavigation);
    window.addEventListener("hashchange", syncActiveNavigation);
    return () => {
      window.removeEventListener("aulanomina-route-change", syncActiveNavigation);
      window.removeEventListener("hashchange", syncActiveNavigation);
    };
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

    if (isActionItem(item)) {
      setMobileOpen(false);
      return;
    }

    const itemKey = getItemKey(item);
    setActiveNavKey(itemKey);
    setActivePage(item.id);
    setMobileOpen(false);

    const resolvedGroupId = groupId || findGroupIdForPage(item.id, itemKey);
    if (!resolvedGroupId) return;

    setExpandedGroupId(resolvedGroupId);
    storeActiveGroup(resolvedGroupId);

    if (parentKey) {
      setExpandedParents((previous) => {
        const next = { ...previous, [resolvedGroupId]: parentKey };
        storeExpandedParents(next);
        return next;
      });
    }
  };

  const isItemActive = (item) => {
    if (isActionItem(item)) return false;
    const itemKey = getItemKey(item);
    if (activeNavKey === itemKey) return true;
    if (item.id !== activePage) return false;
    return !item.modeGroup && !item.hash;
  };

  const isParentActive = (item) => (
    item.children?.some((child) => isItemActive(child))
  );

  return (
    <>
      <aside className={`an-sidebar${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Navegación principal">
        <div className="an-sidebar__brand">
          <div className="an-sidebar__brand-copy">
            <img src={logo} alt="AulaNomina" className="an-sidebar__logo" />
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
                            <div className={`an-sidebar__item-row${parentActive ? " has-active-child" : ""}`}>
                              <button
                                type="button"
                                disabled={!item.enabled}
                                onClick={() => toggleParent(group.id, itemKey)}
                                className="an-sidebar__item an-sidebar__item--with-toggle"
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
                              className={`an-sidebar__item${isItemActive(item) ? " is-active" : ""}`}
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
