import { useEffect, useMemo, useState } from "react";

import CompanyTable from "../components/CompanyTable";
import CompanyBankingPanel from "../components/companyBanking/CompanyBankingPanel";
import CompanyCenterSplitForm from "../components/companyCenters/CompanyCenterSplitForm";
import CompanyPreferencesPanel from "../components/companyPreferences/CompanyPreferencesPanel";
import CompanyMasterCreateForm from "../components/companies/CompanyMasterCreateForm";
import PageCard from "../components/layout/PageCard";
import WorkCenterTable from "../components/workCenters/WorkCenterTable";
import { openReportPreset } from "../utils/reportShortcuts";

const SECTIONS = {
  new: ["Nueva empresa", "#company-companies"],
  centers: ["Centros", "#company-centers"],
  list: ["Listado empresas", "#company-list"],
  preferences: ["Preferencias", "#company-preferences"],
  banking: ["Domiciliación de pagos", "#company-banking"],
};

function getInitialSection() {
  return Object.entries(SECTIONS).find(([, value]) => value[1] === window.location.hash)?.[0] || "new";
}

export default function CompaniesPage(props) {
  const { loading, companies, workCenters, onUpdateCompany, onDeleteCompany, onUpdateWorkCenter, onDeleteWorkCenter, companySubmitting, workCenterSubmitting } = props;
  const [section, setSection] = useState(getInitialSection);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const visibleWorkCenters = useMemo(() => section === "centers" && selectedCompanyId
    ? workCenters.filter((center) => center.is_active && String(center.company_id) === String(selectedCompanyId))
    : [], [section, selectedCompanyId, workCenters]);

  useEffect(() => {
    const sync = () => setSection(getInitialSection());
    window.addEventListener("hashchange", sync);
    window.addEventListener("aulanomina-route-change", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("aulanomina-route-change", sync);
    };
  }, []);

  const changeSection = (next) => {
    window.location.hash = SECTIONS[next]?.[1] || SECTIONS.new[1];
    window.dispatchEvent(new Event("aulanomina-route-change"));
    setSection(next);
  };

  const openPreferences = (company) => {
    setSelectedCompanyId(String(company.id));
    changeSection("preferences");
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.tabs}>{Object.entries(SECTIONS).map(([key, value]) => <button key={key} type="button" onClick={() => changeSection(key)} style={section === key ? styles.tabActive : styles.tab}>{value[0]}</button>)}</div>

      {section === "new" && <PageCard title="Nueva empresa" subtitle="Alta de datos maestros. Las reglas operativas se configuran en Preferencias."><CompanyMasterCreateForm onCreated={() => window.location.reload()} onOpenPreferences={openPreferences} /></PageCard>}

      {section === "centers" && <>
        <PageCard title="Centros" subtitle="Crea centros asociados a empresas existentes."><CompanyCenterSplitForm companies={companies} workCenters={workCenters} initialSection="centers" onReloadData={() => window.location.reload()} onSelectedCompanyChange={setSelectedCompanyId} /></PageCard>
        <PageCard title="Centros de la empresa seleccionada" subtitle={selectedCompanyId ? "Centros vinculados a la empresa elegida." : "Selecciona una empresa para cargar sus centros."}><WorkCenterTable loading={loading} workCenters={visibleWorkCenters} companies={companies} onUpdateWorkCenter={onUpdateWorkCenter} onDeleteWorkCenter={onDeleteWorkCenter} submitting={workCenterSubmitting} /></PageCard>
      </>}

      {section === "list" && <PageCard title="Listado empresas" subtitle="Consulta y edición completa de empresas ya creadas.">
        <div style={styles.actions}>
          <button type="button" style={styles.banking} onClick={() => changeSection("banking")}>Domiciliación de pagos</button>
          <button type="button" style={styles.preferences} onClick={() => changeSection("preferences")}>Preferencias de empresa</button>
          <button type="button" style={styles.report} onClick={() => openReportPreset({ category: "company", reportId: "companies-active" })}>Informe empresas activas</button>
          <button type="button" style={styles.reportAlt} onClick={() => openReportPreset({ category: "company", reportId: "centers-ccc" })}>Informe centros / CCC</button>
        </div>
        <CompanyTable loading={loading} companies={companies} onUpdateCompany={onUpdateCompany} onDeleteCompany={onDeleteCompany} onOpenPreferences={openPreferences} submitting={companySubmitting} />
      </PageCard>}

      {section === "preferences" && <PageCard title="Preferencias de empresa" subtitle="Configuración operativa por empresa."><CompanyPreferencesPanel companies={companies} selectedCompanyId={selectedCompanyId} onSelectedCompanyChange={setSelectedCompanyId} /></PageCard>}

      {section === "banking" && <PageCard title="Domiciliación de pagos" subtitle="Cuentas bancarias simuladas y asignación por operación."><CompanyBankingPanel companies={companies} selectedCompanyId={selectedCompanyId} onSelectedCompanyChange={setSelectedCompanyId} /></PageCard>}
    </div>
  );
}

const baseButton = { borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 };
const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  tabs: { display: "flex", gap: "8px", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", flexWrap: "wrap" },
  tab: { ...baseButton, backgroundColor: "#fff", color: "#374151", border: "1px solid #d1d5db" },
  tabActive: { ...baseButton, backgroundColor: "#111827", color: "#fff", border: "1px solid #111827" },
  actions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "14px", flexWrap: "wrap" },
  banking: { ...baseButton, backgroundColor: "#16a34a", color: "#fff", border: "1px solid #15803d" },
  preferences: { ...baseButton, backgroundColor: "#facc15", color: "#111827", border: "1px solid #eab308" },
  report: { ...baseButton, backgroundColor: "#111827", color: "#fff", border: "1px solid #111827" },
  reportAlt: { ...baseButton, backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db" },
};
