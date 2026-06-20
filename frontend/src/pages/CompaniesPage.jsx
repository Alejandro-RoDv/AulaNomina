import { useEffect, useMemo, useRef, useState } from "react";

import CompanyCenterSplitForm from "../components/companyCenters/CompanyCenterSplitForm";
import CompanyDetailWorkspace from "../components/companies/CompanyDetailWorkspace";
import CompanyDirectory from "../components/companies/CompanyDirectory";
import CompanyMasterCreateForm from "../components/companies/CompanyMasterCreateForm";
import PageCard from "../components/layout/PageCard";
import WorkCenterTable from "../components/workCenters/WorkCenterTable";
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
    onUpdateCompany,
    onDeleteCompany,
    onUpdateWorkCenter,
    onDeleteWorkCenter,
    companySubmitting,
    workCenterSubmitting,
  } = props;

  const [route, setRoute] = useState(parseRoute);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [optimisticCompany, setOptimisticCompany] = useState(null);
  const [detailDirty, setDetailDirty] = useState(false);
  const routeRef = useRef(route);

  const availableCompanies = useMemo(() => {
    if (!optimisticCompany || companies.some((company) => String(company.id) === String(optimisticCompany.id))) return companies;
    return [...companies, optimisticCompany];
  }, [companies, optimisticCompany]);

  useEffect(() => {
    if (optimisticCompany && companies.some((company) => String(company.id) === String(optimisticCompany.id))) {
      setOptimisticCompany(null);
    }
  }, [companies, optimisticCompany]);

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

  const openCompany = (company) => requestRoute(`#company-detail/${company.id}/general`);

  const manageCenters = (company) => {
    setSelectedCompanyId(String(company.id));
    requestRoute(HASHES.centers);
  };

  const handleCompanyCreated = (company) => {
    if (!company?.id) {
      window.location.hash = HASHES.list;
      window.location.reload();
      return;
    }
    setOptimisticCompany(company);
    commitRoute(`#company-detail/${company.id}/general`);
  };

  const changeDetailTab = (tab) => {
    setDetailDirty(false);
    commitRoute(`#company-detail/${route.companyId}/${tab}`);
  };

  const navItems = [
    ["companies", "Empresas", HASHES.list],
    ["centers", "Centros de trabajo", HASHES.centers],
    ["reports", "Informes", HASHES.reports],
  ];

  return (
    <div style={styles.wrapper}>
      <nav className="company-primary-nav">
        {navItems.map(([area, label, hash]) => (
          <button key={area} type="button" className={route.area === area ? "active" : ""} onClick={() => requestRoute(hash)}>{label}</button>
        ))}
      </nav>

      {route.area === "companies" && route.view === "list" && (
        <>
          <div className="company-module-header">
            <div><h2>Empresas</h2><p>Localiza una empresa y accede a sus datos, centros, preferencias y cuentas bancarias.</p></div>
            <div className="company-module-actions"><button type="button" className="company-button-primary" onClick={() => requestRoute(HASHES.new)}>+ Nueva empresa</button></div>
          </div>
          <PageCard title="Empresas registradas" subtitle="La tabla se utiliza para localizar y abrir fichas; las configuraciones se gestionan dentro de cada empresa.">
            <CompanyDirectory companies={availableCompanies} workCenters={workCenters} loading={loading} onOpenCompany={openCompany} onDeleteCompany={onDeleteCompany} onCreated={handleCompanyCreated} />
          </PageCard>
        </>
      )}

      {route.area === "companies" && route.view === "new" && (
        <>
          <div className="company-module-header">
            <div><h2>Nueva empresa</h2><p>Alta de datos maestros. Las reglas operativas se completan posteriormente en su ficha.</p></div>
            <button type="button" className="company-button-ghost" onClick={() => requestRoute(HASHES.list)}>Volver al listado</button>
          </div>
          <PageCard title="Alta de empresa" subtitle="Crea la empresa y continúa después con centros, preferencias y domiciliación de pagos.">
            <CompanyMasterCreateForm onCreated={handleCompanyCreated} onOpenPreferences={openCompany} />
          </PageCard>
        </>
      )}

      {route.area === "companies" && route.view === "detail" && selectedCompany && (
        <CompanyDetailWorkspace
          company={selectedCompany}
          companies={availableCompanies}
          workCenters={workCenters}
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
        <div className="company-empty-state">La empresa indicada no existe o ya no está disponible. <button type="button" className="company-button-ghost" onClick={() => requestRoute(HASHES.list)}>Volver al listado</button></div>
      )}

      {route.area === "centers" && (
        <>
          <div className="company-module-header"><div><h2>Centros de trabajo</h2><p>Crea y mantiene centros vinculados a empresas existentes.</p></div></div>
          <PageCard title="Gestión de centros" subtitle="Selecciona una empresa para cargar o crear sus centros.">
            <CompanyCenterSplitForm companies={availableCompanies} workCenters={workCenters} initialSection="centers" onReloadData={() => window.location.reload()} onSelectedCompanyChange={setSelectedCompanyId} />
          </PageCard>
          <PageCard title="Centros de la empresa seleccionada" subtitle={selectedCompanyId ? "Centros vinculados a la empresa elegida." : "Selecciona una empresa para cargar sus centros."}>
            <WorkCenterTable loading={loading} workCenters={visibleWorkCenters} companies={availableCompanies} onUpdateWorkCenter={onUpdateWorkCenter} onDeleteWorkCenter={onDeleteWorkCenter} submitting={workCenterSubmitting} />
          </PageCard>
        </>
      )}

      {route.area === "reports" && (
        <>
          <div className="company-module-header"><div><h2>Informes de empresas</h2><p>Consultas consolidadas del módulo de empresas y centros.</p></div></div>
          <div className="company-report-grid">
            <article className="company-report-card"><h3>Empresas activas</h3><p>Relación de empresas actualmente en situación de alta.</p><button type="button" className="company-button-primary" onClick={() => openReportPreset({ category: "company", reportId: "companies-active" })}>Abrir informe</button></article>
            <article className="company-report-card"><h3>Centros y CCC</h3><p>Distribución de centros de trabajo y códigos de cuenta de cotización.</p><button type="button" className="company-button-primary" onClick={() => openReportPreset({ category: "company", reportId: "centers-ccc" })}>Abrir informe</button></article>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
};
