import { useEffect, useRef, useState } from "react";

import PageCard from "../components/layout/PageCard";
import ContractForm from "../components/ContractFormProfessional";
import ContractPrintPage from "../components/ContractPrintPageV5";
import ContractHistoryScope from "../components/contracts/ContractHistoryScope";
import "../components/contracts/contractSplit42Refinements.css";
import "../components/contracts/contractEditSplit42.css";
import "../components/contracts/contractHistoryTableCompact.css";

function getStoredMode() {
  return window.sessionStorage.getItem("aulanomina:contractsMode") || "history";
}

function getHeaderContext(mode) {
  if (mode === "new") {
    return {
      eyebrow: "Contratación",
      title: "Nuevo contrato",
      subtitle: "Alta y configuración de la relación contractual del trabajador",
    };
  }
  if (mode === "print") {
    return {
      eyebrow: "Contratación",
      title: "Impresión de contratos",
      subtitle: "Generación y revisión de documentación contractual",
    };
  }
  return {
    eyebrow: "Contratación",
    title: "Historial de contratos",
    subtitle: "Consulta, filtrado y seguimiento de contratos laborales",
  };
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
      assignmentId: params.get("caseAssignmentId"),
      taskId: params.get("caseTaskId"),
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

function isTerminationAction(actionCode) {
  return String(actionCode || "").includes("termination")
    || String(actionCode || "").includes("settlement");
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
  const appliedContextRef = useRef("");
  const currentMode = mode || contractMode;
  const isHistory = currentMode === "history";
  const isPrint = currentMode === "print";

  useEffect(() => {
    const syncContractMode = () => setContractMode(getStoredMode());
    window.addEventListener("aulanomina-contract-mode", syncContractMode);
    return () => window.removeEventListener("aulanomina-contract-mode", syncContractMode);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("aulanomina-header-context", { detail: getHeaderContext(currentMode) }));
  }, [currentMode]);

  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent("aulanomina-header-context", { detail: null }));
  }, []);

  useEffect(() => {
    const applyContext = (context) => {
      if (!context || context.page !== "contracts") return;

      if (isTerminationAction(context.actionCode)) {
        window.sessionStorage.setItem("aulanomina:contractsMode", "history");
        setContractMode("history");
        window.dispatchEvent(new Event("aulanomina-contract-mode"));
        return;
      }

      if (context.actionCode !== "create_contract") return;
      const contextKey = [
        context.assignmentId || "",
        context.taskId || "",
        context.employeeId || context.employeeName || "",
        context.startDate || "",
      ].join(":");
      if (contextKey && appliedContextRef.current === contextKey) return;

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
      window.dispatchEvent(new Event("aulanomina-contract-mode"));
      if (employeeId) onContractChange({ target: { name: "employee_id", value: String(employeeId) } });
      if (companyId) onContractChange({ target: { name: "company_id", value: String(companyId) } });
      if (centerId) onContractChange({ target: { name: "center_id", value: String(centerId) } });
      if (context.startDate) onContractChange({ target: { name: "start_date", value: context.startDate } });
      onContractChange({ target: { name: "contract_type", value: "sustitucion" } });
      onContractChange({ target: { name: "status", value: "active" } });
      appliedContextRef.current = contextKey;
    };

    applyContext(readInitialCaseContext());
    const handleContext = (event) => applyContext(event.detail);
    window.addEventListener("aulanomina-case-context", handleContext);
    return () => window.removeEventListener("aulanomina-case-context", handleContext);
  }, [employees, onContractChange]);

  return (
    <div className="contract-page-split42">
      {!isHistory && !isPrint && (
        <div className="contract-new-workspace">
          <PageCard>
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
        </div>
      )}

      {isHistory && (
        <ContractHistoryScope
          loading={loading}
          contracts={contracts}
          employees={employees}
          companies={companies}
          workCenters={workCenters}
          onUpdateContract={onUpdateContract}
          onDeleteContract={onDeleteContract}
          submitting={contractSubmitting}
        />
      )}

      {isPrint && (
        <div className="contract-print-workspace">
          <ContractPrintPage
            loading={loading}
            contracts={contracts}
            employees={employees}
            companies={companies}
            workCenters={workCenters}
          />
        </div>
      )}
    </div>
  );
}
