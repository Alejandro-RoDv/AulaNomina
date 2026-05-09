import PageCard from "../components/layout/PageCard";
import CompanyForm from "../components/CompanyForm";
import CompanyTable from "../components/CompanyTable";
import WorkCenterForm from "../components/workCenters/WorkCenterForm";
import WorkCenterTable from "../components/workCenters/WorkCenterTable";

export default function CompaniesPage({
  loading,
  companies,
  workCenters,
  companyForm,
  workCenterForm,
  onCompanyChange,
  onCompanySubmit,
  onUpdateCompany,
  onDeleteCompany,
  onWorkCenterChange,
  onWorkCenterSubmit,
  onUpdateWorkCenter,
  onDeleteWorkCenter,
  companyError,
  companySuccess,
  workCenterError,
  workCenterSuccess,
  companySubmitting,
  workCenterSubmitting,
}) {
  const activeCompanies = companies.filter((company) => company.is_active);
  const activeWorkCenters = workCenters.filter((center) => center.is_active);

  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Nueva empresa madre"
        subtitle="Crea la entidad principal. Su CCC funcionará como CCC general para los centros dependientes."
      >
        <CompanyForm
          form={companyForm}
          onChange={onCompanyChange}
          onSubmit={onCompanySubmit}
          error={companyError}
          success={companySuccess}
          submitting={companySubmitting}
        />
      </PageCard>

      <PageCard
        title="Nuevo centro de trabajo"
        subtitle="Crea un centro dependiente de una empresa madre, con CCC general y CCC principal propia del centro."
      >
        <WorkCenterForm
          form={workCenterForm}
          companies={activeCompanies}
          onChange={onWorkCenterChange}
          onSubmit={onWorkCenterSubmit}
          error={workCenterError}
          success={workCenterSuccess}
          submitting={workCenterSubmitting}
        />
      </PageCard>

      <PageCard
        title="Empresas madre"
        subtitle="Empresas principales registradas actualmente en AulaNomina."
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
        title="Centros de trabajo"
        subtitle="Centros vinculados a empresas madre. Aquí se controla la CCC general y la CCC principal del centro."
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
