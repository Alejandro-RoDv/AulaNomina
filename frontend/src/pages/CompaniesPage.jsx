import { useEffect, useMemo, useState } from "react";

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

function parseRoute() {
  const hash = window.location.hash || HASHES.list;
  if (hash.startsWith("#company-detail/")) {
    return { area: "companies", view: "detail", companyId: hash.split("/")[1] || "" };
  }
  if (hash === HASHES.new) return { area: "companies", view: "new", companyId: "" };
  if (hash === HASHES.centers) return { area: "centers", view: "centers", companyId: "" };
  if (hash === HASHES.reports) return { area: "reports", view: "reports", companyId: "" };
  return { area: "companies", view: "list", companyId: "" };
}

function navigate(hash) {
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

  useEffect(() => {
    const sync = () => setRoute(parseRoute());
    window.addEventListener("hashchange", sync);
    window.addEventListener("aulanomina-route-change", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("aulanomina-route-change", sync);
    };
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === String(route.companyId)),
    [companies, route.companyId]
  );

  const visibleWorkCenters = useMemo(
    () => selectedCompanyId
      ? workCenters.filter((center) => center.is_active !== false && String(center.company_id) === String(selectedCompanyId))
      : [],
    [selectedCompanyId, workCenters]
  );

  const openCompany = (company) => navigate(`#company-detail/${company.id}`);

  const manageCenters = (company) => {
    setSelectedCompanyId(String(company.id));
    navigate(HASHES.centers);
  };

  const handleCompanyCreated = () => {
    window.location.hash = HASHES.list;
    window.location.reload();
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
          <button key={area} type="button" className={route.area === area ? "active" : ""} onClick={() => navigate(hash)}>{label}</button>
        ))}
      </nav>

      {route.area === "companies" && route.view === "list" && (
        <>
          <div className="company-module-header">
            <div><h2>Empresas</h2><p>Localiza una empresa y accede a sus datos, centros, preferencias y cuentas bancarias.</p></div>
            <div className="company-module-actions"><button type="button" className="company-button-primary" onClick={() => navigate(HASHES.new)}>+ Nueva empresa</button></div>
          </div>
          <PageCard title="Empresas registradas" subtitle="La tabla se utiliza para localizar y abrir fichas; las configuraciones se gestionan dentro de cada empresa.">
            <CompanyDirectory companies={companies} workCenters={workCenters} loading={loading} onOpenCompany={openCompany} onDeleteCompany={onDeleteCompany} onCreated={handleCompanyCreated} />
          </PageCard>
        </>
      )}

      {route.area === "companies" && route.view === "new" && (
        <>
          <div className="company-module-header">
            <div><h2>Nueva empresa</h2><p>Alta de datos maestros. Las reglas operativas se completan posteriormente en su ficha.</p></div>
            <button type="button" className="company-button-ghost" onClick={() => navigate(HASHES.list)}>Volver al listado</button>
          </div>
          <PageCard title="Alta de empresa" subtitle="Crea la empresa y continúa después con centros, preferencias y domiciliación de pagos.">
            <CompanyMasterCreateForm onCreated={handleCompanyCreated} onOpenPreferences={openCompany} />
          </PageCard>
        </>
      )}

      {route.area === "companies" && route.view === "detail" && selectedCompany && (
        <CompanyDetailWorkspace
          company={selectedCompany}
          companies={companies}
          workCenters={workCenters}
          onBack={() => navigate(HASHES.list)}
          onUpdateCompany={onUpdateCompany}
          onManageCenters={manageCenters}
          onUpdateWorkCenter={onUpdateWorkCenter}
          onDeleteWorkCenter={onDeleteWorkCenter}
          companySubmitting={companySubmitting}
          workCenterSubmitting={workCenterSubmitting}
        />
      )}

      {route.area === "companies" && route.view === "detail" && !selectedCompany && !loading && (
        <div className="company-empty-state">La empresa indicada no existe o ya no está disponible. <button type="button" className="company-button-ghost" onClick={() => navigate(HASHES.list)}>Volver al listado</button></div>
      )}

      {route.area === "centers" && (
        <>
          <div className="company-module-header"><div><h2>Centros de trabajo</h2><p>Crea y mantiene centros vinculados a empresas existentes.</p></div></div>
          <PageCard title="Gestión de centros" subtitle="Selecciona una empresa para cargar o crear sus centros.">
            <CompanyCenterSplitForm companies={companies} workCenters={workCenters} initialSection="centers" onReloadData={() => window.location.reload()} onSelectedCompanyChange={setSelectedCompanyId} />
          </PageCard>
          <PageCard title="Centros de la empresa seleccionada" subtitle={selectedCompanyId ? "Centros vinculados a la empresa elegida." : "Selecciona una empresa para cargar sus centros."}>
            <WorkCenterTable loading={loading} workCenters={visibleWorkCenters} companies={companies} onUpdateWorkCenter={onUpdateWorkCenter} onDeleteWorkCenter={onDeleteWorkCenter} submitting={workCenterSubmitting} />
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
