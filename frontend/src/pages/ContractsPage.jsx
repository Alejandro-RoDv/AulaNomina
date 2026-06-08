import { useEffect, useState } from "react";

import PageCard from "../components/layout/PageCard";
import ContractForm from "../components/ContractFormProfessional";
import ContractPrintPage from "../components/ContractPrintPageV2";
import ContractTable from "../components/ContractTable";

function getStoredMode() {
  return window.sessionStorage.getItem("aulanomina:contractsMode") || "new";
}

export default function ContractsPage({
  mode = null,
  loading,
  contracts,
  employees,
  companies,
  workCenters,
  collectiveAgreements = [],
  contractForm,
  onContractChange,
  onContractSubmit,
  onUpdateContract,
  onDeleteContract,
  contractError,
  contractSuccess,
  contractSubmitting,
}) {
  const [contractMode, setContractMode] = useState(getStoredMode);

  useEffect(() => {
    const syncContractMode = () => setContractMode(getStoredMode());
    window.addEventListener("aulanomina-contract-mode", syncContractMode);
    return () => window.removeEventListener("aulanomina-contract-mode", syncContractMode);
  }, []);

  const currentMode = mode || contractMode;
  const isHistory = currentMode === "history";
  const isPrint = currentMode === "print";

  return (
    <div style={styles.wrapper}>
      {!isHistory && !isPrint && (
        <PageCard title="Nuevo contrato" subtitle="Alta contractual, retribución, jornada, bonificaciones, afiliación y registro.">
          <ContractForm
            form={contractForm}
            employees={employees}
            companies={companies}
            workCenters={workCenters}
            contracts={contracts}
            collectiveAgreements={collectiveAgreements}
            onChange={onContractChange}
            onSubmit={onContractSubmit}
            error={contractError}
            success={contractSuccess}
            submitting={contractSubmitting}
          />
        </PageCard>
      )}

      {isHistory && (
        <PageCard>
          <ContractTable
            loading={loading}
            contracts={contracts}
            employees={employees}
            companies={companies}
            workCenters={workCenters}
            onUpdateContract={onUpdateContract}
            onDeleteContract={onDeleteContract}
            submitting={contractSubmitting}
          />
        </PageCard>
      )}

      {isPrint && (
        <ContractPrintPage
          loading={loading}
          contracts={contracts}
          employees={employees}
          companies={companies}
          workCenters={workCenters}
        />
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
};
