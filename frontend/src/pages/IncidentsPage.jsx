import { useEffect, useMemo, useState } from "react";

import CategoryIncidentForm from "../components/incidents/CategoryIncidentForm";
import IncidentDashboard from "../components/incidents/IncidentDashboard";
import IncidentHistoryPanel from "../components/incidents/IncidentHistoryPanel";
import IncidentPayrollControl from "../components/incidents/IncidentPayrollControl";
import "../components/incidents/incidentWorkspace.css";
import "../components/incidents/incidentSplit42Refinements.css";
import PageCard from "../components/layout/PageCard";
import {
  getCategoryFormUpdates,
  getIncidentCategory,
} from "../utils/incidentCategories";
import { getEmployeeVisibleCode } from "../utils/visibleCodes";
import WageGarnishmentManagementPage from "./WageGarnishmentManagementPage";

const INCIDENTS_MODE_KEY = "aulanomina:incidentsMode";
const INCIDENTS_MODE_EVENT = "aulanomina-incidents-mode";
const INCIDENT_CATEGORY_KEY = "aulanomina:incidentCategory";
const INCIDENT_CATEGORY_EVENT = "aulanomina-incident-category";
const HEADER_EVENT = "aulanomina-header-context";

const CATEGORY_HEADERS = {
  all: {
    title: "Incidencias laborales",
    subtitle: "Resumen y seguimiento de incidencias con impacto laboral y en nómina",
  },
  medical: {
    title: "IT y prestaciones",
    subtitle: "Incapacidades temporales, recaídas y prestaciones vinculadas al trabajador",
  },
  absence: {
    title: "Absentismo",
    subtitle: "Ausencias, permisos, suspensiones y sanciones con trazabilidad laboral",
  },
  vacation: {
    title: "Vacaciones",
    subtitle: "Registro y seguimiento de periodos de vacaciones",
  },
  overtime: {
    title: "Horas extraordinarias",
    subtitle: "Registro de horas extra y su tratamiento económico",
  },
  movement: {
    title: "Cambios del trabajador",
    subtitle: "Cambios de categoría, jornada, centro y otras condiciones laborales",
  },
  payroll: {
    title: "Control de nómina",
    subtitle: "Revisión del impacto de las incidencias sobre el cálculo mensual",
  },
  history: {
    title: "Historial de incidencias",
    subtitle: "Consulta, filtrado y trazabilidad de incidencias registradas",
  },
};

function getInitialMode() {
  if (typeof window === "undefined") return "list";
  return window.sessionStorage.getItem(INCIDENTS_MODE_KEY) || "list";
}

function readCaseContext() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const context = {
    page: params.get("page"),
    employeeId: params.get("employeeId"),
    startDate: params.get("startDate"),
    incidentCategory: params.get("incidentCategory"),
  };
  if (Object.values(context).some(Boolean)) return context;
  try {
    return JSON.parse(window.sessionStorage.getItem("aulanomina:active-case-context") || "{}") || {};
  } catch {
    return {};
  }
}

function getInitialCategory() {
  if (typeof window === "undefined") return "all";
  return readCaseContext().incidentCategory
    || window.sessionStorage.getItem(INCIDENT_CATEGORY_KEY)
    || "all";
}

function publishHeader(mode, category = "all") {
  const detail = mode === "embargo"
    ? {
        eyebrow: "Gestión laboral",
        title: "Embargos judiciales",
        subtitle: "Gestión, cálculo y seguimiento de retenciones judiciales",
      }
    : {
        eyebrow: "Gestión laboral",
        ...(CATEGORY_HEADERS[getIncidentCategory(category).value] || CATEGORY_HEADERS.all),
      };
  window.dispatchEvent(new CustomEvent(HEADER_EVENT, { detail }));
}

function agreementData(contract) {
  const key = contract?.collective_agreement_id
    || contract?.collective_agreement_code
    || contract?.collective_agreement_name
    || "";
  const name = contract?.collective_agreement_name
    || contract?.collective_agreement_code
    || (key ? `Convenio ${key}` : "Sin convenio asignado");
  return { key: String(key), name };
}

export default function IncidentsPage({
  loading,
  incidents,
  employees,
  contracts,
  companies,
  workCenters,
  payrolls = [],
  incidentForm,
  onIncidentChange,
  onIncidentSubmit,
  onUpdateIncident,
  incidentError,
  incidentSuccess,
  incidentSubmitting,
  onDataChanged,
}) {
  const [activeMode, setActiveMode] = useState(getInitialMode);
  const [activeCategory, setActiveCategory] = useState(getInitialCategory);
  const activeTab = getIncidentCategory(activeCategory);

  useEffect(() => {
    const syncNavigation = () => {
      const mode = getInitialMode();
      const category = window.sessionStorage.getItem(INCIDENT_CATEGORY_KEY) || getInitialCategory();
      setActiveMode(mode);
      if (mode !== "embargo") setActiveCategory(getIncidentCategory(category).value);
      publishHeader(mode, category);
    };

    syncNavigation();
    window.addEventListener(INCIDENTS_MODE_EVENT, syncNavigation);
    window.addEventListener(INCIDENT_CATEGORY_EVENT, syncNavigation);
    return () => {
      window.removeEventListener(INCIDENTS_MODE_EVENT, syncNavigation);
      window.removeEventListener(INCIDENT_CATEGORY_EVENT, syncNavigation);
      window.dispatchEvent(new CustomEvent(HEADER_EVENT, { detail: null }));
    };
  }, []);

  useEffect(() => {
    if (activeMode === "embargo") return;
    const tab = getIncidentCategory(activeCategory);
    const updates = getCategoryFormUpdates(tab, incidentForm.incident_type);
    Object.entries(updates).forEach(([name, valueToApply]) => {
      onIncidentChange({ target: { name, value: valueToApply, type: "select-one" } });
    });
    publishHeader("list", tab.value);
  }, [activeCategory]);

  const enrichedIncidents = useMemo(() => {
    const employeeMap = Object.fromEntries(employees.map((item) => [String(item.id), item]));
    const contractMap = Object.fromEntries(contracts.map((item) => [String(item.id), item]));
    const companyMap = Object.fromEntries(companies.map((item) => [String(item.id), item]));
    const centerMap = Object.fromEntries(workCenters.map((item) => [String(item.id), item]));

    return incidents.map((incident) => {
      const contract = contractMap[String(incident.contract_id)];
      const employee = employeeMap[String(incident.employee_id)];
      const companyId = incident.company_id || contract?.company_id;
      const centerId = incident.center_id || contract?.center_id;
      const agreement = agreementData(contract);
      return {
        ...incident,
        company_id: companyId,
        center_id: centerId,
        employee_name: incident.employee_name
          || [employee?.first_name, employee?.last_name].filter(Boolean).join(" "),
        employee_code: employee
          ? getEmployeeVisibleCode(employee, employees, contracts, companyId)
          : incident.employee_code,
        company_name: incident.company_name
          || companyMap[String(companyId)]?.name
          || "Empresa sin identificar",
        center_name: centerMap[String(centerId)]?.name || "Centro sin identificar",
        agreement_key: agreement.key,
        agreement_name: agreement.name,
        professional_category: contract?.professional_category
          || contract?.professional_category_name
          || "",
      };
    });
  }, [incidents, employees, contracts, companies, workCenters]);

  const openCategory = (value) => {
    const tab = getIncidentCategory(value);
    window.sessionStorage.setItem(INCIDENTS_MODE_KEY, "list");
    window.sessionStorage.setItem(INCIDENT_CATEGORY_KEY, tab.value);
    setActiveMode("list");
    setActiveCategory(tab.value);
    publishHeader("list", tab.value);
    window.dispatchEvent(new Event(INCIDENT_CATEGORY_EVENT));
  };

  useEffect(() => {
    const applyContext = (context) => {
      if (!context || context.page !== "incidents") return;
      const category = context.incidentCategory || "medical";
      openCategory(category);
      if (context.employeeId) {
        onIncidentChange({ target: { name: "employee_id", value: String(context.employeeId), type: "select-one" } });
      }
      if (context.startDate) {
        onIncidentChange({ target: { name: "start_date", value: context.startDate, type: "date" } });
      }
    };

    applyContext(readCaseContext());
    const handleCaseContext = (event) => applyContext(event.detail);
    window.addEventListener("aulanomina-case-context", handleCaseContext);
    return () => window.removeEventListener("aulanomina-case-context", handleCaseContext);
  }, []);

  if (activeMode === "embargo") {
    return <WageGarnishmentManagementPage
      companies={companies}
      employees={employees}
      contracts={contracts}
      payrolls={payrolls}
    />;
  }

  return <div className="incident-workspace incident-workspace--split42">
    <div role="tabpanel" className="incident-workspace-content">
      {activeTab.kind === "dashboard" && <IncidentDashboard incidents={enrichedIncidents} onOpenCategory={openCategory} />}

      {activeTab.kind === "payroll" && <IncidentPayrollControl
        payrolls={payrolls}
        employees={employees}
        contracts={contracts}
        onDataChanged={onDataChanged}
      />}

      {activeTab.kind === "history" && <IncidentHistoryPanel
        loading={loading}
        incidents={enrichedIncidents}
        employees={employees}
        companies={companies}
        workCenters={workCenters}
        contracts={contracts}
        onUpdateIncident={onUpdateIncident}
        incidentSubmitting={incidentSubmitting}
      />}

      {activeTab.kind === "form" && <PageCard className="incident-form-card" title={activeTab.title} subtitle={activeTab.subtitle}>
        <CategoryIncidentForm
          category={activeTab}
          form={incidentForm}
          employees={employees}
          contracts={contracts}
          companies={companies}
          workCenters={workCenters}
          onChange={onIncidentChange}
          onSubmit={onIncidentSubmit}
          error={incidentError}
          success={incidentSuccess}
          submitting={incidentSubmitting}
        />
      </PageCard>}
    </div>
  </div>;
}
