import { useEffect, useMemo, useRef, useState } from "react";

import CompanyDetailWorkspace from "../components/companies/CompanyDetailWorkspace";
import CompanyDirectory from "../components/companies/CompanyDirectory";
import CompanyMasterCreateForm from "../components/companies/CompanyMasterCreateForm";
import WorkCenterCreatePanel from "../components/workCenters/WorkCenterCreatePanel";
import WorkCenterTable from "../components/workCenters/WorkCenterTable";
import { Button } from "../components/ui";
import { getSelectedCompanyId, setSelectedCompanyId as persistSelectedCompanyId } from "../utils/companyContext";
import { openReportPreset } from "../utils/reportShortcuts";

const HASHES = {
  list: "#company-list",
  new: "#company-new",
  centers: "#company-centers",
  reports: "#company-reports",
};

const DETAIL_TABS = new Set(["general", "centers", "preferences", "banking"]);

function parseRoute(hash = window.location.hash || HASHES.list) {
  if (hash.startsWith("#company-detail/")) {
    const [companyId = "", requestedTab = "general"] = hash.replace("#company-detail/", "").split("/");
    return {
      area: "companies",
      view: "detail",
      companyId,
      tab: DETAIL_TABS.has(requestedTab) ? requestedTab : "general",
    };
  }
  if (hash === HASHES.new) return { area: "companies", view: "new", companyId: "", tab: "" };
  if (hash === HASHES.centers) return { area: "centers", view: "centers", companyId: "", tab: "" };
  if (hash === HASHES.reports) return { area: "reports", view: "reports", companyId: "", tab: "" };
  return { area: "companies", view: "list", companyId: "", tab: "" };
}

function routeToHash(route) {
  if (route.view === "detail") return `#company-detail/${route.companyId}/${route.tab || "general"}`;
  if (route.view === "new") return HASHES.new;
  if (route.area === "centers") return HASHES.centers;
  if (route.area === "reports") return HASHES.reports;
  return HASHES.list;
}

function publishRoute(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new Event("aulanomina-route-change"));
}

export default function CompaniesPage(props) {
  const {
    loading,
    companies,
    workCenters,
    collectiveAgreements = [],
    onDataChanged,
    onUpdateCompany,
    onDeleteCompany,
    onUpdateWorkCenter,
    onDeleteWorkCenter,
    companySubmitting,
    workCenterSubmitting,
  } = props;

  const [route, setRoute] = useState(parseRoute);
  const [selectedCompanyId, setSelectedCompanyId] = useState(getSelectedCompanyId);
  const [optimisticCompany, setOptimisticCompany] = useState(null);
  const [detailDirty, setDetailDirty] = useState(false);
  const routeRef = useRef(route);

  const availableCompanies = useMemo(() => {
    if (!optimisticCompany || companies.some((company) => String(company.id) === String(optimisticCompany.id))) return companies;
    return [...companies, optimisticCompany];
  }, [companies, optimisticCompany]);

  const activeCompanyCount = useMemo(
    () => availableCompanies.filter((company) => company.is_active !== false && company.status !== "baja_definitiva").length,
    [availableCompanies]
  );

  const activeCenterCount = useMemo(
    () => workCenters.filter((center) => center.is_active !== false).length,
    [workCenters]
  );

  const selectCompany = (companyId) => {
    const normalized = companyId ? String(companyId) : "";
    setSelectedCompanyId(normalized);
    persistSelectedCompanyId(normalized);
  };

  useEffect(() => {
    if (optimisticCompany && companies.some((company) => String(company.id) === String(optimisticCompany.id))) {
      setOptimisticCompany(null);
    }
  }, [companies, optimisticCompany]);

  useEffect(() => {
    if (!loading && selectedCompanyId && !availableCompanies.some((company) => String(company.id) === String(selectedCompanyId))) {
      selectCompany("");
    }
  }, [availableCompanies, loading, selectedCompanyId]);

  const commitRoute = (hash) => {
    const nextRoute = parseRoute(hash);
    routeRef.current = nextRoute;
    setRoute(nextRoute);
    publishRoute(hash);
  };

  useEffect(() => {
    const sync = () => {
      const nextRoute = parseRoute();
      const currentRoute = routeRef.current;
      const changedDetailContext = currentRoute.view === "detail" && (
        nextRoute.view !== "detail"
        || nextRoute.companyId !== currentRoute.companyId
        || nextRoute.tab !== currentRoute.tab
      );

      if (detailDirty && changedDetailContext) {
        const confirmed = window.confirm("Hay cambios sin guardar en la ficha de empresa. ¿Salir y descartarlos?");
        if (!confirmed) {
          const previousHash = routeToHash(currentRoute);
          if (window.location.hash !== previousHash) window.location.hash = previousHash;
          return;
        }
        setDetailDirty(false);
      }

      routeRef.current = nextRoute;
      setRoute(nextRoute);
    };

    window.addEventListener("hashchange", sync);
    window.addEventListener("aulanomina-route-change", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("aulanomina-route-change", sync);
    };
  }, [detailDirty]);

  const requestRoute = (hash) => {
    if (detailDirty) {
      const confirmed = window.confirm("Hay cambios sin guardar en la ficha de empresa. ¿Salir y descartarlos?");
      if (!confirmed) return;
      setDetailDirty(false);
    }
    commitRoute(hash);
  };

  const selectedCompany = useMemo(
    () => availableCompanies.find((company) => String(company.id) === String(route.companyId)),
    [availableCompanies, route.companyId]
  );

  const visibleWorkCenters = useMemo(
    () => selectedCompanyId
      ? workCenters.filter((center) => center.is_active !== false && String(center.company_id) === String(selectedCompanyId))
      : [],
    [selectedCompanyId, workCenters]
  );

  const openCompany = (company) => {
    selectCompany(company.id);
    requestRoute(`#company-detail/${company.id}/general`);
  };

  const manageCenters = (company) => {
    selectCompany(company.id);
    requestRoute(HASHES.centers);
  };

  const handleCompanyCreated = (company) => {
    if (!company?.id) {
      requestRoute(HASHES.list);
      return;
    }
    setOptimisticCompany(company);
    selectCompany(company.id);
    commitRoute(`#company-detail/${company.id}/general`);
  };

  const handleCenterCreated = async (_center, companyId) => {
    selectCompany(companyId);
    await onDataChanged?.();
  };

  const changeDetailTab = (tab) => {
    setDetailDirty(false);
    commitRoute(`#company-detail/${route.companyId}/${tab}`);
  };

  return (
    <div className="company-page">
      {route.area === "companies" && route.view === "list" && (
        <section className="company-list-workspace" aria-label="Directorio de empresas">
          <div className="company-page-commandbar">
            <div className="company-page-commandbar__summary">
              <strong>{activeCompanyCount} empresas activas</strong>
              <span>{activeCenterCount} centros de trabajo registrados</span>
            </div>
            <Button onClick={() => requestRoute(HASHES.new)}>Nueva empresa</Button>
          </div>

          <div className="company-directory-surface">
            <CompanyDirectory
              companies={availableCompanies}
              workCenters={workCenters}
              loading={loading}
              onOpenCompany={openCompany}
              onDeleteCompany={onDeleteCompany}
              onCreated={handleCompanyCreated}
              onCreateCompany={() => requestRoute(HASHES.new)}
            />
          </div>
        </section>
      )}

      {route.area === "companies" && route.view === "new" && (
        <section className="company-create-workspace" aria-label="Alta de empresa">
          <div className="company-page-commandbar company-page-commandbar--back">
            <div className="company-page-commandbar__summary">
              <strong>Alta de empresa</strong>
              <span>Introduce los datos maestros. La configuración avanzada se completa después desde la ficha.</span>
            </div>
            <Button variant="ghost" onClick={() => requestRoute(HASHES.list)}>Volver a empresas</Button>
          </div>

          <CompanyMasterCreateForm
            collectiveAgreements={collectiveAgreements}
            onCreated={handleCompanyCreated}
            onOpenPreferences={openCompany}
          />
        </section>
      )}

      {route.area === "companies" && route.view === "detail" && selectedCompany && (
        <CompanyDetailWorkspace
          company={selectedCompany}
          companies={availableCompanies}
          workCenters={workCenters}
          collectiveAgreements={collectiveAgreements}
          activeTab={route.tab}
          onTabChange={changeDetailTab}
          onBack={() => {
            setDetailDirty(false);
            commitRoute(HASHES.list);
          }}
          onDirtyChange={setDetailDirty}
          onUpdateCompany={onUpdateCompany}
          onManageCenters={manageCenters}
          onUpdateWorkCenter={onUpdateWorkCenter}
          onDeleteWorkCenter={onDeleteWorkCenter}
          companySubmitting={companySubmitting}
          workCenterSubmitting={workCenterSubmitting}
        />
      )}

      {route.area === "companies" && route.view === "detail" && !selectedCompany && !loading && (
        <div className="company-empty-state">
          La empresa indicada no existe o ya no está disponible.
          <Button variant="ghost" onClick={() => requestRoute(HASHES.list)}>Volver al listado</Button>
        </div>
      )}

      {route.area === "centers" && (
        <section className="company-centers-workspace" aria-label="Centros de trabajo">
          <div className="company-page-commandbar">
            <div className="company-page-commandbar__summary">
              <strong>{activeCenterCount} centros activos</strong>
              <span>Selecciona una empresa para crear y mantener sus centros de trabajo.</span>
            </div>
          </div>

          <div className="company-center-section">
            <div className="company-section-heading">
              <h3>Nuevo centro de trabajo</h3>
              <p>El centro quedará vinculado a la empresa seleccionada.</p>
            </div>
            <WorkCenterCreatePanel
              companies={availableCompanies}
              workCenters={workCenters}
              collectiveAgreements={collectiveAgreements}
              selectedCompanyId={selectedCompanyId}
              onSelectedCompanyChange={selectCompany}
              onCreated={handleCenterCreated}
            />
          </div>

          <div className="company-center-section">
            <div className="company-section-heading">
              <h3>Centros de la empresa seleccionada</h3>
              <p>{selectedCompanyId ? "Los cambios se reflejan directamente en el directorio." : "Selecciona una empresa para cargar sus centros."}</p>
            </div>
            <WorkCenterTable
              loading={loading}
              workCenters={visibleWorkCenters}
              companies={availableCompanies}
              onUpdateWorkCenter={onUpdateWorkCenter}
              onDeleteWorkCenter={onDeleteWorkCenter}
              submitting={workCenterSubmitting}
            />
          </div>
        </section>
      )}

      {route.area === "reports" && (
        <section className="company-reports-workspace" aria-label="Informes de empresas">
          <div className="company-page-commandbar">
            <div className="company-page-commandbar__summary">
              <strong>Informes de organización</strong>
              <span>Consultas consolidadas de empresas y centros de trabajo.</span>
            </div>
          </div>
          <div className="company-report-grid">
            <article className="company-report-card"><h3>Empresas activas</h3><p>Relación de empresas actualmente en situación de alta.</p><button type="button" className="company-button-primary" onClick={() => openReportPreset({ category: "company", reportId: "companies-active" })}>Abrir informe</button></article>
            <article className="company-report-card"><h3>Centros y CCC</h3><p>Distribución de centros de trabajo y códigos de cuenta de cotización.</p><button type="button" className="company-button-primary" onClick={() => openReportPreset({ category: "company", reportId: "centers-ccc" })}>Abrir informe</button></article>
          </div>
        </section>
      )}
    </div>
  );
}
