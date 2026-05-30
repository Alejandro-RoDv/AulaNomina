import { useMemo, useState } from "react";

import ContractPayrollConceptsPanel from "../components/contracts/ContractPayrollConceptsPanel";
import PageCard from "../components/layout/PageCard";

function buildContractsWithDisplayCodes(contracts, employees) {
  const employeeCodeById = employees.reduce((acc, employee) => {
    acc[employee.id] = employee.employee_code || String(employee.id);
    return acc;
  }, {});

  const countersByEmployee = {};

  return [...contracts]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((contract) => {
      const employeeId = contract.employee_id;
      countersByEmployee[employeeId] = (countersByEmployee[employeeId] || 0) + 1;

      return {
        ...contract,
        contract_display_code: `${employeeCodeById[employeeId] || employeeId}.${countersByEmployee[employeeId]}`,
      };
    });
}

export default function PermanentPayrollConceptsPage({ contracts = [], employees = [], companies = [], workCenters = [] }) {
  const [selectedContractId, setSelectedContractId] = useState("");

  const contractsWithDisplayCodes = useMemo(
    () => buildContractsWithDisplayCodes(contracts, employees),
    [contracts, employees]
  );

  const selectedContract = useMemo(
    () => contractsWithDisplayCodes.find((contract) => String(contract.id) === String(selectedContractId)) || null,
    [contractsWithDisplayCodes, selectedContractId]
  );

  function getEmployeeName(contract) {
    if (contract.employee_name) return contract.employee_name;
    const employee = employees.find((item) => Number(item.id) === Number(contract.employee_id));
    if (!employee) return contract.employee_id || "-";
    return `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  }

  function getCompanyAndCenterName(contract) {
    const company = companies.find((item) => Number(item.id) === Number(contract.company_id));
    const center = workCenters.find((item) => Number(item.id) === Number(contract.center_id));
    const companyName = contract.company_name || company?.name || "Sin empresa";
    return center?.name ? `${companyName} · ${center.name}` : companyName;
  }

  function getContractOptionLabel(contract) {
    return `${contract.contract_display_code} · ${getEmployeeName(contract)} · ${contract.contract_type || "Contrato"}`;
  }

  return (
    <div style={styles.wrapper}>
      <PageCard
        title="Conceptos permanentes"
        subtitle="Configura conceptos recurrentes asociados a un contrato: antigüedad, complemento convenio, mejora voluntaria, pluses fijos, etc."
      >
        <div style={styles.selectorBlock}>
          <label style={styles.selectorGroup}>
            Contrato
            <select value={selectedContractId} onChange={(event) => setSelectedContractId(event.target.value)} style={styles.input}>
              <option value="">Selecciona un contrato</option>
              {contractsWithDisplayCodes.map((contract) => (
                <option key={contract.id} value={contract.id}>{getContractOptionLabel(contract)}</option>
              ))}
            </select>
          </label>

          {selectedContract && (
            <div style={styles.contextBox}>
              <div><span>Trabajador</span><strong>{getEmployeeName(selectedContract)}</strong></div>
              <div><span>Empresa / centro</span><strong>{getCompanyAndCenterName(selectedContract)}</strong></div>
              <div><span>Contrato</span><strong>{selectedContract.contract_display_code}</strong></div>
            </div>
          )}
        </div>

        {selectedContract ? (
          <ContractPayrollConceptsPanel contract={selectedContract} />
        ) : (
          <p style={styles.empty}>Selecciona un contrato para ver o añadir sus conceptos permanentes.</p>
        )}
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  selectorBlock: { display: "flex", flexDirection: "column", gap: "12px" },
  selectorGroup: { display: "flex", flexDirection: "column", gap: "6px", fontWeight: 900, color: "#374151" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "2px solid #d1d5db", borderRadius: "8px", fontSize: "14px", fontWeight: 700 },
  contextBox: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", border: "2px solid #111827", borderRadius: "12px", padding: "12px", backgroundColor: "#fffdf0" },
  empty: { margin: "12px 0 0", color: "#6b7280", fontWeight: 700 },
};
