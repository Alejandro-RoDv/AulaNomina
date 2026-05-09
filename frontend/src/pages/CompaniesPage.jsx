import PageCard from "../components/layout/PageCard";
import CompanyTable from "../components/CompanyTable";
import WorkCenterTable from "../components/workCenters/WorkCenterTable";
import CompanyCenterForm from "../components/companyCenters/CompanyCenterForm";

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
        title="Empresa y centro"
        subtitle="Alta rápida: crea una empresa con su primer centro o añade un centro a una empresa ya existente usando su CCC."
      >
        <CompanyCenterForm companies={companies} onReloadData={reloadPageData} />
      </PageCard>

      <PageCard
        title="Empresas"
        subtitle="Empresas registradas actualmente en AulaNomina."
      >
        <CompanyTable
          loading={loading}
          companies={companies}
          onUpdateCompany={onUpdateCompany}
          onDeleteCompany={onDeleteCompany}
          submitting={companySubmitting}
        />
      </PageCard>

      <PageCard
        title="Centros"
        subtitle="Centros vinculados a empresas. Cada centro puede tener una CCC de empresa y una CCC propia."
      >
        <WorkCenterTable
          loading={loading}
          workCenters={activeWorkCenters}
          companies={companies}
          onUpdateWorkCenter={onUpdateWorkCenter}
          onDeleteWorkCenter={onDeleteWorkCenter}
          submitting={workCenterSubmitting}
        />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
};
