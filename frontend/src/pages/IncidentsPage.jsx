import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Calculator,
  CalendarDays,
  Clock3,
  HeartPulse,
  History,
  LayoutDashboard,
  UserMinus,
} from "lucide-react";

import CategoryIncidentForm from "../components/incidents/CategoryIncidentForm";
import IncidentDashboard from "../components/incidents/IncidentDashboard";
import IncidentHistoryPanel from "../components/incidents/IncidentHistoryPanel";
import IncidentPayrollControl from "../components/incidents/IncidentPayrollControl";
import "../components/incidents/incidentWorkspace.css";
import PageCard from "../components/layout/PageCard";
import {
  getCategoryFormUpdates,
  getIncidentCategory,
  INCIDENT_CATEGORY_TABS,
} from "../utils/incidentCategories";
import { getEmployeeVisibleCode } from "../utils/visibleCodes";
import WageGarnishmentManagementPage from "./WageGarnishmentManagementPage";

const INCIDENTS_MODE_KEY = "aulanomina:incidentsMode";
const INCIDENTS_MODE_EVENT = "aulanomina-incidents-mode";
const HEADER_EVENT = "aulanomina-header-context";

const TAB_ICONS = {
  all: LayoutDashboard,
  medical: HeartPulse,
  absence: UserMinus,
  vacation: CalendarDays,
  overtime: Clock3,
  movement: ArrowLeftRight,
  payroll: Calculator,
  history: History,
};

function getInitialMode() {
  if (typeof window === "undefined") return "list";
  return window.sessionStorage.getItem(INCIDENTS_MODE_KEY) || "list";
}

function publishHeader(mode) {
  const detail = mode === "embargo"
    ? { title: "Embargos judiciales", subtitle: "Gestión, cálculo y seguimiento de retenciones judiciales" }
    : { title: "Incidencias laborales", subtitle: "Registro, cálculo y trazabilidad del impacto mensual" };
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
  const [activeCategory, setActiveCategory] = useState("all");
  const activeTab = getIncidentCategory(activeCategory);

  useEffect(() => {
    const handleModeChange = () => {
      const mode = getInitialMode();
      setActiveMode(mode);
      publishHeader(mode);
    };
    handleModeChange();
    window.addEventListener(INCIDENTS_MODE_EVENT, handleModeChange);
    return () => {
      window.removeEventListener(INCIDENTS_MODE_EVENT, handleModeChange);
      window.dispatchEvent(new CustomEvent(HEADER_EVENT, { detail: null }));
    };
  }, []);

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

  const workspaceStats = useMemo(() => {
    const active = enrichedIncidents.filter((item) => !item.is_cancelled);
    return {
      total: active.length,
      pending: active.filter((item) => ["draft", "open", "pending"].includes(item.status)).length,
      recalculation: active.filter((item) => item.requires_recalculation).length,
      regularization: active.filter((item) => item.requires_regularization).length,
    };
  }, [enrichedIncidents]);

  const openCategory = (value) => {
    const tab = getIncidentCategory(value);
    if (tab.value === activeCategory) return;
    setActiveCategory(tab.value);
    const updates = getCategoryFormUpdates(tab, incidentForm.incident_type);
    Object.entries(updates).forEach(([name, valueToApply]) => {
      onIncidentChange({ target: { name, value: valueToApply, type: "select-one" } });
    });
  };

  if (activeMode === "embargo") {
    return <WageGarnishmentManagementPage
      companies={companies}
      employees={employees}
      contracts={contracts}
      payrolls={payrolls}
    />;
  }

  return <div className="incident-workspace">
    <section className="incident-workspace-hero">
      <div>
        <span className="incident-workspace-eyebrow">Gestión laboral · Motor trazable</span>
        <h1>Incidencias laborales</h1>
        <p>Registra situaciones del trabajador, revisa conflictos y controla su impacto antes de calcular la nómina.</p>
      </div>
      <div className="incident-workspace-status">
        <article><small>Activas</small><strong>{workspaceStats.total}</strong></article>
        <article><small>Pendientes</small><strong>{workspaceStats.pending}</strong></article>
        <article className={workspaceStats.recalculation ? "warning" : ""}><small>Recálculo</small><strong>{workspaceStats.recalculation}</strong></article>
        <article className={workspaceStats.regularization ? "critical" : ""}><small>Regularización</small><strong>{workspaceStats.regularization}</strong></article>
      </div>
    </section>

    <nav className="incident-workspace-tabs" role="tablist" aria-label="Procesos de incidencias">
      {INCIDENT_CATEGORY_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab.value] || LayoutDashboard;
        return <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={activeCategory === tab.value}
          onClick={() => openCategory(tab.value)}
          className={activeCategory === tab.value ? "active" : ""}
        >
          <Icon size={16} />
          <span>{tab.shortLabel || tab.label}</span>
        </button>;
      })}
    </nav>

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

      {activeTab.kind === "form" && <PageCard title={activeTab.title} subtitle={activeTab.subtitle}>
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
