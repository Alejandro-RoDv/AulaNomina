import PageCard from "../components/layout/PageCard";
import ContractForm from "../components/ContractForm";
import ContractTable from "../components/ContractTable";

export default function ContractsPage({
  loading,
  contracts,
  employees,
  contractForm,
  onContractChange,
  onContractSubmit,
  contractError,
  contractSuccess,
  contractSubmitting,
}) {
  return (
    <div style={styles.wrapper}>
      <PageCard title="Nuevo contrato" subtitle="Registra un contrato laboral simulado.">
        <ContractForm
          form={contractForm}
          employees={employees}
          onChange={onContractChange}
          onSubmit={onContractSubmit}
          error={contractError}
          success={contractSuccess}
          submitting={contractSubmitting}
        />
      </PageCard>

      <PageCard title="Listado de contratos" subtitle="Contratos creados en el sistema.">
        <ContractTable loading={loading} contracts={contracts} employees={employees} />
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
