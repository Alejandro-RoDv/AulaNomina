import PageCard from "../components/layout/PageCard";
import CompanyForm from "../components/CompanyForm";
import CompanyTable from "../components/CompanyTable";

export default function CompaniesPage({
  loading,
  companies,
  companyForm,
  onCompanyChange,
  onCompanySubmit,
  companyError,
  companySuccess,
  companySubmitting,
}) {
  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Nueva empresa / centro"
        subtitle="Crea una empresa o centro de trabajo para usarlo en simulaciones."
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
        title="Listado de empresas"
        subtitle="Empresas y centros registrados actualmente en AulaNomina."
      >
        <CompanyTable loading={loading} companies={companies} />
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
