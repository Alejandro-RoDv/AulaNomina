import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import CompanyTable from "../components/CompanyTable";
import WorkCenterTable from "../components/workCenters/WorkCenterTable";
import CompanyCenterSplitForm from "../components/companyCenters/CompanyCenterSplitForm";
import { openReportPreset } from "../utils/reportShortcuts";

function getInitialSection() {
  if (window.location.hash === "#company-centers") return "centers";
  return "companies";
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

  const reloadPageData = async () => {
    window.location.reload();
  };

  return (
    <div style={styles.wrapper}>
      <PageCard
        title={section === "centers" ? "Centros" : "Empresas"}
        subtitle={section === "centers" ? "Crea centros asociados a empresas existentes. El historial se carga al elegir empresa." : "Crea empresas y consulta el listado principal."}
      >
        <CompanyCenterSplitForm
          companies={companies}
          workCenters={workCenters}
          initialSection={section}
          onReloadData={reloadPageData}
          onSelectedCompanyChange={setSelectedCompanyId}
        />
      </PageCard>

      {section === "companies" ? (
        <PageCard title="Empresas ya creadas" subtitle="Empresas registradas actualmente en AulaNomina. Aquí sí se mantiene visible el ID de empresa.">
          <div style={styles.reportActions}>
            <button type="button" style={styles.reportButton} onClick={() => openReportPreset({ category: "company", reportId: "companies-active" })}>Informe empresas activas</button>
            <button type="button" style={styles.reportButtonSecondary} onClick={() => openReportPreset({ category: "company", reportId: "centers-ccc" })}>Informe centros / CCC</button>
          </div>
          <CompanyTable loading={loading} companies={companies} onUpdateCompany={onUpdateCompany} onDeleteCompany={onDeleteCompany} submitting={companySubmitting} />
        </PageCard>
      ) : (
        <PageCard title="Centros de la empresa seleccionada" subtitle={selectedCompanyId ? "Centros vinculados a la empresa elegida." : "Selecciona una empresa en el formulario superior para cargar sus centros."}>
          <WorkCenterTable loading={loading} workCenters={visibleWorkCenters} companies={companies} onUpdateWorkCenter={onUpdateWorkCenter} onDeleteWorkCenter={onDeleteWorkCenter} submitting={workCenterSubmitting} />
        </PageCard>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  reportActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "14px" },
  reportButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  reportButtonSecondary: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
};
