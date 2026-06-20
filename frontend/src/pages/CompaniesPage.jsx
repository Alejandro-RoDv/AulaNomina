import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import CompanyTable from "../components/CompanyTable";
import CompanyPreferencesPanel from "../components/companyPreferences/CompanyPreferencesPanel";
import WorkCenterTable from "../components/workCenters/WorkCenterTable";
import CompanyCenterSplitForm from "../components/companyCenters/CompanyCenterSplitForm";
import { openReportPreset } from "../utils/reportShortcuts";

function getInitialSection() {
  if (window.location.hash === "#company-centers") return "centers";
  if (window.location.hash === "#company-list") return "list";
  if (window.location.hash === "#company-preferences") return "preferences";
  return "new";
}

export default function CompaniesPage({
  loading,
  companies,
  workCenters,
  onUpdateCompany,
  onDeleteCompany,
  onUpdateWorkCenter,
  onDeleteWorkCenter,
  companySubmitting,
  workCenterSubmitting,
}) {
  const [section, setSection] = useState(getInitialSection);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const visibleWorkCenters = useMemo(() => {
    if (section !== "centers" || !selectedCompanyId) return [];
    return workCenters.filter(
      (center) => center.is_active && String(center.company_id) === String(selectedCompanyId)
    );
  }, [section, selectedCompanyId, workCenters]);

  useEffect(() => {
    const syncSection = () => setSection(getInitialSection());
    syncSection();
    window.addEventListener("hashchange", syncSection);
    window.addEventListener("aulanomina-route-change", syncSection);
    return () => {
      window.removeEventListener("hashchange", syncSection);
      window.removeEventListener("aulanomina-route-change", syncSection);
    };
  }, []);

  const changeSection = (nextSection) => {
    const hashBySection = {
      centers: "#company-centers",
      list: "#company-list",
      preferences: "#company-preferences",
      new: "#company-companies",
    };
    window.location.hash = hashBySection[nextSection] || hashBySection.new;
    window.dispatchEvent(new Event("aulanomina-route-change"));
    setSection(nextSection);
  };

  const reloadPageData = async () => {
    window.location.reload();
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.tabs}>
        <button type="button" onClick={() => changeSection("new")} style={section === "new" ? styles.tabActive : styles.tab}>Nueva empresa</button>
        <button type="button" onClick={() => changeSection("centers")} style={section === "centers" ? styles.tabActive : styles.tab}>Centros</button>
        <button type="button" onClick={() => changeSection("list")} style={section === "list" ? styles.tabActive : styles.tab}>Listado empresas</button>
        <button type="button" onClick={() => changeSection("preferences")} style={section === "preferences" ? styles.tabActive : styles.tab}>Preferencias</button>
      </div>

      {section === "new" && (
        <PageCard title="Nueva empresa" subtitle="Alta de empresa con ficha laboral, fiscal, SILTRA y calendario de trabajo.">
          <CompanyCenterSplitForm
            companies={companies}
            workCenters={workCenters}
            initialSection="companies"
            onReloadData={reloadPageData}
            onSelectedCompanyChange={setSelectedCompanyId}
          />
        </PageCard>
      )}

      {section === "centers" && (
        <>
          <PageCard title="Centros" subtitle="Crea centros asociados a empresas existentes. El historial se carga al elegir empresa.">
            <CompanyCenterSplitForm
              companies={companies}
              workCenters={workCenters}
              initialSection="centers"
              onReloadData={reloadPageData}
              onSelectedCompanyChange={setSelectedCompanyId}
            />
          </PageCard>
          <PageCard title="Centros de la empresa seleccionada" subtitle={selectedCompanyId ? "Centros vinculados a la empresa elegida." : "Selecciona una empresa en el formulario superior para cargar sus centros."}>
            <WorkCenterTable loading={loading} workCenters={visibleWorkCenters} companies={companies} onUpdateWorkCenter={onUpdateWorkCenter} onDeleteWorkCenter={onDeleteWorkCenter} submitting={workCenterSubmitting} />
          </PageCard>
        </>
      )}

      {section === "list" && (
        <PageCard title="Listado empresas" subtitle="Consulta y edición completa de empresas ya creadas.">
          <div style={styles.reportActions}>
            <button type="button" style={styles.preferencesButton} onClick={() => changeSection("preferences")}>Preferencias de empresa</button>
            <button type="button" style={styles.reportButton} onClick={() => openReportPreset({ category: "company", reportId: "companies-active" })}>Informe empresas activas</button>
            <button type="button" style={styles.reportButtonSecondary} onClick={() => openReportPreset({ category: "company", reportId: "centers-ccc" })}>Informe centros / CCC</button>
          </div>
          <CompanyTable loading={loading} companies={companies} onUpdateCompany={onUpdateCompany} onDeleteCompany={onDeleteCompany} submitting={companySubmitting} />
        </PageCard>
      )}

      {section === "preferences" && (
        <PageCard title="Preferencias de empresa" subtitle="Personaliza cálculo, cotización, retenciones, recibos, imagen corporativa e idioma sin duplicar los datos maestros de la empresa.">
          <CompanyPreferencesPanel
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectedCompanyChange={setSelectedCompanyId}
          />
        </PageCard>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  tabs: { display: "flex", gap: "8px", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", flexWrap: "wrap" },
  tab: { backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  tabActive: { backgroundColor: "#111827", color: "#ffffff", border: "1px solid #111827", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  reportActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "14px", flexWrap: "wrap" },
  preferencesButton: { backgroundColor: "#facc15", color: "#111827", border: "1px solid #eab308", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  reportButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  reportButtonSecondary: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
};
