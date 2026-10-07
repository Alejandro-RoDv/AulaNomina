import { Building2, Calculator, FileCheck2, Landmark, UsersRound } from "lucide-react";

import { normalizeExpandedParents } from "./sidebarExpansion.js";

const ACTIVE_GROUP_STORAGE_KEY = "aulanomina:sidebarActiveGroup";
const EXPANDED_PARENTS_STORAGE_KEY = "aulanomina:sidebarExpandedParents";
const panelItem = { id: "dashboard", label: "Inicio", enabled: true };

const groups = [
  {
    id: "organization",
    title: "Organización",
    dashboard: "companies-dashboard",
    icon: Building2,
    items: [
      {
        id: "companies-menu",
        dashboard: "companies-dashboard",
        label: "Empresas / centros",
        enabled: true,
        children: [
          { id: "companies", label: "Nueva empresa", enabled: true, hash: "#company-new", modeGroup: "companies", modeValue: "new" },
          { id: "companies", label: "Listado empresas", enabled: true, hash: "#company-list", modeGroup: "companies", modeValue: "list" },
          { id: "companies", label: "Centros", enabled: true, hash: "#company-centers", modeGroup: "companies", modeValue: "centers" },
        ],
      },
      { id: "collective-agreements", label: "Convenios", enabled: true },
    ],
  },
  {
    id: "people",
    title: "Personas",
    dashboard: "workers-dashboard",
    icon: UsersRound,
    items: [
      {
        id: "employees-menu",
        dashboard: "workers-dashboard",
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
    dashboard: "contracts-dashboard",
    icon: FileCheck2,
    items: [
      {
        id: "contracts-menu",
        dashboard: "contracts-dashboard",
        label: "Contratos",
        enabled: true,
        children: [
          { id: "contracts", label: "Nuevo contrato", enabled: true, modeGroup: "contracts", modeValue: "new" },
          { id: "contracts", label: "Historial contratos", enabled: true, modeGroup: "contracts", modeValue: "history" },
          { id: "contracts", label: "Datos y gestión del contrato", enabled: true, modeGroup: "contracts", modeValue: "lifecycle" },
          { id: "contracts", label: "Bajas y finiquitos", enabled: true, modeGroup: "contracts", modeValue: "termination" },
          { id: "contracts", label: "Impresión contratos", enabled: true, modeGroup: "contracts", modeValue: "print" },
        ],
      },
    ],
  },
  {
    id: "labor-management",
    title: "Gestión laboral",
    dashboard: "labor-dashboard",
    icon: UsersRound,
    items: [
      {
        id: "labor-incidents-menu",
        dashboard: "labor-dashboard",
        label: "Incidencias",
        enabled: true,
        children: [
          { id: "incidents", label: "Resumen", enabled: true, modeGroup: "incidentCategory", modeValue: "all" },
          { id: "incidents", label: "IT y prestaciones", enabled: true, modeGroup: "incidentCategory", modeValue: "medical" },
          { id: "incidents", label: "Absentismo", enabled: true, modeGroup: "incidentCategory", modeValue: "absence" },
          { id: "incidents", label: "Vacaciones", enabled: true, modeGroup: "incidentCategory", modeValue: "vacation" },
          { id: "incidents", label: "Horas extra", enabled: true, modeGroup: "incidentCategory", modeValue: "overtime" },
          { id: "incidents", label: "Histórico de variaciones", enabled: true, modeGroup: "incidentCategory", modeValue: "movement" },
          { id: "incidents", label: "Control nómina", enabled: true, modeGroup: "incidentCategory", modeValue: "payroll" },
          { id: "incidents", label: "Historial", enabled: true, modeGroup: "incidentCategory", modeValue: "history" },
        ],
      },
      { id: "incidents", label: "Embargos judiciales", enabled: true, modeGroup: "incidents", modeValue: "embargo" },
    ],
  },
  {
    id: "payroll",
    title: "Nómina",
    dashboard: "payroll-dashboard",
    icon: Calculator,
    items: [
      { id: "payroll-monthly-preparation", label: "Preparación mensual", enabled: true },
      { id: "payroll-simulation", label: "Generar nóminas", enabled: true },
      { id: "payroll-history", label: "Histórico de nóminas", enabled: true },
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
    dashboard: "social-security-dashboard",
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
          { id: "social-security-dashboard", label: "Ficheros CRA", enabled: true, hash: "#cra-files" },
        ],
      },
      {
        id: "communications-menu",
        label: "Comunicaciones",
        enabled: true,
        children: [
          { id: "fie-inss", label: "Comunicaciones INSS (FIE)", enabled: true, hash: "#fie-inss" },
        ],
      },
      { id: "siltra-launcher", label: "SILTRA", enabled: true, launchSelector: ".siltra-global-launcher" },
    ],
  },
  {
    id: "tax-management",
    title: "Fiscalidad",
    dashboard: "tax-dashboard",
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
    dashboard: "documents-dashboard",
    icon: FileCheck2,
    items: [
      { id: "documents", label: "Documentos", enabled: true, hash: "#documents" },
      { id: "reports", label: "Informes", enabled: true, hash: "#reports" },
    ],
  },
];

const modeStorageKeys = {
  contracts: "aulanomina:contractsMode",
  companies: "aulanomina:companiesMode",
  incidents: "aulanomina:incidentsMode",
  incidentCategory: "aulanomina:incidentCategory",
};

const modeEvents = {
  contracts: "aulanomina-contract-mode",
  companies: "aulanomina-route-change",
  incidents: "aulanomina-incidents-mode",
  incidentCategory: "aulanomina-incident-category",
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
      const child = item.children?.find((candidate) => candidate.id === activePage && candidate.hash === hash);
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
    const mode = getCompanyModeFromHash() || window.sessionStorage.getItem(modeStorageKeys.companies) || "list";
    return `companies:companies:${mode}`;
  }
  if (activePage === "incidents") {
    const mode = window.sessionStorage.getItem(modeStorageKeys.incidents) || "list";
    if (mode === "embargo") return "incidents:incidents:embargo";
    const category = window.sessionStorage.getItem(modeStorageKeys.incidentCategory) || "all";
    return `incidents:incidentCategory:${category}`;
  }

  const hashItem = findItemForHash(activePage, window.location.hash);
  if (hashItem) return getItemKey(hashItem);
  return activePage;
}

function getStoredExpandedParents() {
  if (typeof window === "undefined") return {};
  try {
    return normalizeExpandedParents(JSON.parse(window.localStorage.getItem(EXPANDED_PARENTS_STORAGE_KEY) || "{}"));
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

  if (item.modeGroup === "incidentCategory") {
    window.sessionStorage.setItem(modeStorageKeys.incidents, "list");
    window.sessionStorage.setItem(modeStorageKeys.incidentCategory, item.modeValue);
    window.dispatchEvent(new Event(modeEvents.incidentCategory));
    return;
  }

  if (item.modeGroup && item.modeValue) {
    const storageKey = modeStorageKeys[item.modeGroup];
    if (storageKey) window.sessionStorage.setItem(storageKey, item.modeValue);
  }

  const eventName = modeEvents[item.modeGroup];
  if (eventName) window.dispatchEvent(new Event(eventName));
  if (item.hash || routeChanged) window.dispatchEvent(new Event("aulanomina-route-change"));
}

function itemMatchesPage(item, activePage, activeNavKey) {
  if (isActionItem(item)) return false;
  if (item.hash || item.modeGroup) return getItemKey(item) === activeNavKey;
  return item.id === activePage || getItemKey(item) === activeNavKey;
}

function groupContainsActiveItem(group, activePage, activeNavKey) {
  return group.dashboard === activePage || group.items.some(
    (item) => itemMatchesPage(item, activePage, activeNavKey)
      || item.children?.some((child) => itemMatchesPage(child, activePage, activeNavKey))
  );
}

function findGroupIdForPage(activePage, activeNavKey) {
  return groups.find((group) => groupContainsActiveItem(group, activePage, activeNavKey))?.id || null;
}

function findParentKeyForPage(groupId, activePage, activeNavKey) {
  const group = groups.find((candidate) => candidate.id === groupId);
  const parent = group?.items.find((item) => item.children?.some((child) => itemMatchesPage(child, activePage, activeNavKey)));
  return parent ? getItemKey(parent) : null;
}


export { groups, panelItem, getItemKey, getInitialActiveKey, getStoredExpandedParents, storeExpandedParents, getStoredActiveGroup, storeActiveGroup, applyItemNavigation, isActionItem, itemMatchesPage, groupContainsActiveItem, findGroupIdForPage, findParentKeyForPage };
