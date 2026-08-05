import { useEffect, useState } from "react";

import PageCard from "../components/layout/PageCard";
import ContractForm from "../components/ContractFormProfessional";
import ContractPrintPage from "../components/ContractPrintPageV5";
import ContractTable from "../components/ContractTable";

function getStoredMode() {
  return window.sessionStorage.getItem("aulanomina:contractsMode") || "new";
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function readInitialCaseContext() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("page") === "contracts") {
    return {
      page: "contracts",
      actionCode: params.get("caseAction"),
      employeeId: params.get("employeeId"),
      employeeName: params.get("employee"),
      companyId: params.get("companyId"),
      startDate: params.get("startDate"),
    };
  }
  try {
    return JSON.parse(window.sessionStorage.getItem("aulanomina:active-case-context") || "null");
  } catch {
    return null;
  }
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

  useEffect(() => {
    const applyContext = (context) => {
      if (!context || context.page !== "contracts" || context.actionCode !== "create_contract") return;
      const expectedName = normalize(context.employeeName);
      const employee = employees.find((item) => (
        (context.employeeId && String(item.id) === String(context.employeeId))
        || (expectedName && normalize(`${item.first_name || ""} ${item.last_name || ""} ${item.second_last_name || ""}`) === expectedName)
      ));
      const employeeId = employee?.id || context.employeeId || "";
      const companyId = employee?.company_id || context.companyId || "";
      const centerId = employee?.center_id || "";

      window.sessionStorage.setItem("aulanomina:contractsMode", "new");
      setContractMode("new");
      if (employeeId) onContractChange({ target: { name: "employee_id", value: String(employeeId) } });
      if (companyId) onContractChange({ target: { name: "company_id", value: String(companyId) } });
      if (centerId) onContractChange({ target: { name: "center_id", value: String(centerId) } });
      if (context.startDate) onContractChange({ target: { name: "start_date", value: context.startDate } });
      onContractChange({ target: { name: "contract_type", value: "sustitucion" } });
      onContractChange({ target: { name: "status", value: "active" } });
    };

    const initialContext = readInitialCaseContext();
    applyContext(initialContext);
    const handleContext = (event) => applyContext(event.detail);
    window.addEventListener("aulanomina-case-context", handleContext);
    return () => window.removeEventListener("aulanomina-case-context", handleContext);
  }, [employees, onContractChange]);

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
