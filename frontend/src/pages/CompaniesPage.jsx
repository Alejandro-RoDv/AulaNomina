import PageCard from "../components/layout/PageCard";
import CompanyTable from "../components/CompanyTable";
import WorkCenterTable from "../components/workCenters/WorkCenterTable";
import CompanyCenterForm from "../components/companyCenters/CompanyCenterForm";
import { openReportPreset } from "../utils/reportShortcuts";

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
  const activeWorkCenters = workCenters.filter((center) => center.is_active);

  const reloadPageData = async () => {
    window.location.reload();
  };

  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Empresas y centros"
        subtitle="Elige si quieres crear una empresa o crear un centro asociado a una empresa existente."
      >
        <CompanyCenterForm companies={companies} onReloadData={reloadPageData} />
      </PageCard>

      <PageCard title="Empresas" subtitle="Empresas registradas actualmente en AulaNomina. Aquí sí se mantiene visible el ID de empresa.">
        <div style={styles.reportActions}>
          <button type="button" style={styles.reportButton} onClick={() => openReportPreset({ category: "company", reportId: "companies-active" })}>Informe empresas activas</button>
          <button type="button" style={styles.reportButtonSecondary} onClick={() => openReportPreset({ category: "company", reportId: "centers-ccc" })}>Informe centros / CCC</button>
        </div>
        <CompanyTable loading={loading} companies={companies} onUpdateCompany={onUpdateCompany} onDeleteCompany={onDeleteCompany} submitting={companySubmitting} />
      </PageCard>

      <PageCard title="Centros" subtitle="Centros vinculados a empresas. No se muestra el ID técnico del centro.">
        <WorkCenterTable loading={loading} workCenters={activeWorkCenters} companies={companies} onUpdateWorkCenter={onUpdateWorkCenter} onDeleteWorkCenter={onDeleteWorkCenter} submitting={workCenterSubmitting} />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  reportActions: { display: "flex", gap: "10px", justifyContent: "flex-end", marginBottom: "14px" },
  reportButton: { backgroundColor: "#111827", color: "#fff", border: "1px solid #111827", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  reportButtonSecondary: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "7px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
};